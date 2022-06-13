import os, json
import numpy as np
import scipy.ndimage
import PIL.Image
import skimage.io, skimage.util
import torch, torchvision


#internal modules
MODULES = ['modellib']

if "__torch_package__" in dir():
    #inside a torch package
    import torch_package_importer
    [modellib] = [torch_package_importer.import_module(m) for m in MODULES]
else:
    #normal
    import importlib
    [modellib] = [importlib.reload(importlib.import_module(m)) for m in MODULES]


class DetectionDataset:
    def __init__(
        self, 
        tiff_files, 
        jsonfiles, 
        classes_of_interest,
        negative_classes,
        ignored_classes    = [],
        empty_tiffs        = [], 
        n_empty            = 0, 
        image_size         = 512,
        multiclass         = False, 
        augment            = False, 
    ):
        super().__init__()
        ignored_classes  = [c.lower() for c in ignored_classes]
        ignore           = [should_ignore_file(js,ignored_classes) for js in jsonfiles]
        self.tiff_files  = [t for t,ig in zip(tiff_files, ignore) if not ig] + tiff_files[len(jsonfiles):]
        self.jsonfiles   = [j for j,ig in zip(jsonfiles,  ignore) if not ig]
        self.empty_tiffs = empty_tiffs
        self.n_empty     = min(n_empty, len(self.empty_tiffs))
        self.augment     = augment
        self.multiclass  = multiclass
        self.image_size  = image_size
        self.classes     = [c.lower() for c in classes_of_interest]
        self.negative_classes = [c.lower() for c in negative_classes]
        
    
    def __len__(self):
        return len(self.tiff_files) + self.n_empty
    
    def __getitem__(self, i):
        if i < len(self.tiff_files):
            tiff_file      = self.tiff_files[i]
        elif len(self.empty_tiffs):
            tiff_file      = np.random.choice(self.empty_tiffs)
        else:
            raise IndexError
        json_file      = self.jsonfiles[i] if i<len(self.jsonfiles) else ''
        
        image, boxes, labels, labels_str = self.load_image_and_annotation(tiff_file, json_file)
        image          = torchvision.transforms.ToTensor()(image)
        boxes          = torch.as_tensor(boxes.reshape(-1,4), dtype=torch.float32)
        if self.augment:
            k     = np.random.randint(4)
            boxes = rot90_boxes(boxes, image.shape[-2:], k)
            image = torch.rot90(image, k, dims=(1,2))
        if self.augment and np.random.random()<0.5:
            boxes = flip_boxes(boxes, image.shape[-2:])
            image = torch.flip(image, dims=[-1])
        
        labels         = torch.as_tensor(labels, dtype=torch.int64)
        target         = dict(boxes=boxes, labels=labels, labels_str=labels_str)
        return image, target
    
    @staticmethod
    def collate_fn(batchlist):
        images    = [x[0] for x in batchlist]
        images    = torch.stack(images)
        targets   = [x[1] for x in batchlist]
        return images, targets

    def create_dataloader(self, batch_size, shuffle=False, num_workers='auto'):
        if num_workers == 'auto':
            num_workers = os.cpu_count()
        return torch.utils.data.DataLoader(self, batch_size, shuffle, collate_fn=getattr(self, 'collate_fn', None),
                                           num_workers=num_workers, pin_memory=True,
                                           worker_init_fn=lambda x: np.random.seed(torch.randint(0,1000,(1,))[0].item()+x) )
    
    def load_image_and_annotation(self, tiff_file, json_file=''):
        '''Loads image and annotation data. If json_file does not exist, returns empty boxes.'''
        import skimage.io, skimage.util
        stack      = skimage.io.imread(tiff_file)
        if len(stack.shape)<4:
            stack = stack[np.newaxis]
        stackshape = stack.shape
        #resize before fusion for speed
        #PIL faster than skimage.transform.resize()
        stack = np.stack([
            PIL.Image.fromarray(im).resize([self.image_size]*2, PIL.Image.BILINEAR) for im in stack
        ])
        image      = fuse_image_stack(stack)
        image      = skimage.util.img_as_float32(image)

        boxes      = get_boxes_from_jsonfile(json_file,flip_axes=0,normalize=0) if os.path.exists(json_file) else []
        boxes      = scale_boxes(boxes, stackshape[1:3][::-1], [self.image_size]*2)
        labels     = get_labels_from_jsonfile(json_file) if os.path.exists(json_file) else []

        #filtering boxes if they are explicitly labelled as non-pollen
        valid      = [(l not in self.negative_classes) for l in labels]
        boxes      = [b for b,v in zip(boxes,  valid) if v]
        labels     = [l for l,v in zip(labels, valid) if v]
        if self.multiclass:
            labels_ixs = [
                self.classes.index(l) if l in self.classes else self.classes.index('other') for l in labels
            ]
        else:
            labels_ixs = np.ones(len(labels), 'int64')
        return image, np.array(boxes).reshape(-1,4), labels_ixs, labels



class ClassificationDataset:
    def __init__(
        self, 
        tiff_files, 
        jsonfiles, 
        classes_of_interest,
        ignored_classes   = [],             #file will be removed
        nonpollen_classes = ['nonpollen'],  #label will be set to zero
        lowconf_classes   = [],             #label will be set to -1
        detector_output   = {},             #additional boxes per file (false positives)
        image_size        = 224,
        augment           = False
    ):
        super().__init__()
        self.tiff_files          = tiff_files
        self.jsonfiles           = jsonfiles
        self.augment             = augment
        self.classes_of_interest = [c.lower() for c in classes_of_interest]
        self.nonpollen_classes   = [c.lower() for c in nonpollen_classes]
        self.lowconf_classes     = [c.lower() for c in lowconf_classes]
        self.image_size          = image_size
        
        self.annotations = []
        for i,tif in enumerate(tiff_files):
            js        = jsonfiles[i] if i<len(jsonfiles) else None
            labels    = get_labels_from_jsonfile(js) if js else []
            boxes_js  = get_boxes_from_jsonfile(js) if js else np.array([]).reshape(-1,4)
            imgsize   = PIL.Image.open(tif).size
            boxes_out = np.asarray(detector_output.get(tif, [])).reshape(-1,4)
            boxes_fp  = self.combine_boxes(boxes_js, boxes_out)
            boxes     = np.concatenate([boxes_js, boxes_fp])
            labels    = np.concatenate([labels, ['nonpollen']*len(boxes_fp)])
            for l,b in zip(labels, boxes):
                if l in ignored_classes:
                    continue
                index = self.label_str2int(l)
                self.annotations += [(js,tif,index,l,b)]
    
    def __len__(self):
        return len(self.annotations)
    
    def __getitem__(self, i):
        js,tiff, label, label_str, box = self.annotations[i]
        if self.augment:
            box = augment_box(box)
        #image = load_crop_resize(tiff, box, self.augment)
        stack = modellib.load_image(tiff)
        image = modellib.crop_resize_gridify(stack, box, self.image_size, self.augment)
        return image, label
    
    @staticmethod
    def combine_boxes(boxes_gt, boxes_pred, iou_threshold=0.25):
        '''Get boxes from `boxes_pred` that have a low IoU with `boxes_gt` (false positives)`'''
        if len(boxes_pred)==0:
            return np.array([]).reshape(-1,4)
        elif len(boxes_gt)==0:
            return boxes_pred
        boxes_gt   = torch.as_tensor(boxes_gt)
        boxes_pred = torch.as_tensor(boxes_pred).reshape(-1,4)
        iou = torchvision.ops.box_iou(boxes_gt,boxes_pred)
        #get the predicted boxes that have low iou
        return boxes_pred[iou.max(dim=0)[0] < iou_threshold]
    
    def label_str2int(self, label):
        if label in self.classes_of_interest:
            return self.classes_of_interest.index(label)
        elif label in self.nonpollen_classes:
            return 0
        elif label in self.lowconf_classes:
            return -1
        else:
            return self.classes_of_interest.index('other')
        
    def create_dataloader(self, batch_size, shuffle=False, num_workers='auto'): #TODO: code re-use with DetectionDataset
        if num_workers == 'auto':
            num_workers = os.cpu_count()
        return torch.utils.data.DataLoader(self, batch_size, shuffle, collate_fn=getattr(self, 'collate_fn', None),
                                           num_workers=num_workers, pin_memory=True,
                                           worker_init_fn=lambda x: np.random.seed(torch.randint(0,1000,(1,))[0].item()+x) )





def read_json_until_imagedata(jsonfile):
    '''LabelMe JSON are rather large because they contain the whole image additionally to the labels.
       This function reads a jsonfile only up to the imagedata attribute (ignoring everything afterwards) to reduce the loading time.
       Returns a valid JSON string'''
    f = open(jsonfile)
    f.seek(0,2); n=f.tell(); f.seek(0,0)
    buffer = ''
    while 'imageData' not in buffer and len(buffer)<n:
        data      = f.read(1024*16)
        buffer   += data
        if len(data)==0:
            return buffer
    buffer   = buffer[:buffer.index('imageData')]
    buffer   = buffer[:buffer.rindex(',')]
    buffer   = buffer+'}'
    return buffer

def get_boxes_from_jsonfile(jsonfile, flip_axes=False, normalize=False):
    '''Reads bounding boxes from a LabeLMe json file and returns them as a (Nx4) array'''
    jsondata = json.loads(read_json_until_imagedata(jsonfile))
    boxes    = [shape['points'] for shape in jsondata['shapes']]
    boxes    = [[min(box[0],box[2]),min(box[1],box[3]),
                 max(box[0],box[2]),max(box[1],box[3])] for box in np.reshape(boxes, (-1,4))]
    boxes    = np.array(boxes)
    boxes    = (boxes.reshape(-1,2) / get_imagesize_from_jsonfile(jsonfile)[::-1]).reshape(-1,4) if normalize else boxes
    boxes    = boxes[:,[1,0,3,2]] if flip_axes else boxes
    return boxes.reshape(-1,4)

def get_polygons_from_jsonfile(jsonfile):
    '''Reads shapes from a LabeLMe json file and returns them as a list of arrays'''
    jsondata = json.loads(read_json_until_imagedata(jsonfile))
    return     [np.array(shape['points']).reshape(-1,2) for shape in jsondata['shapes']]

def get_labels_from_jsonfile(jsonfile):
    '''Reads a list of labels in a json LabelMe file.'''
    return [ s['label'].lower() for s in json.loads( read_json_until_imagedata(jsonfile) )['shapes'] ]


def draw_box(box, color='w', text='', fontsize=None, *args, **kwargs):
    import matplotlib as mpl
    xywh = np.asarray(torchvision.ops.box_convert(box, 'xyxy','xywh'))
    rect = mpl.patches.Rectangle(xywh[:2], *xywh[2:], edgecolor=color, facecolor='none', *args, **kwargs)
    mpl.pyplot.gca().add_patch(rect)
    mpl.pyplot.gca().text(*box[:2], text, color=color, fontsize=fontsize)


def fuse_image_stack(x, sigma=1.0, return_weight=False):
    '''Fuses a stack of images to a single RGB layer'''
    x_gray    = (x*(0.2126, 0.7152, 0.0722)).sum(-1)
    x_gray    = [scipy.ndimage.gaussian_filter(xi, sigma) for xi in x_gray]
    x_weight  = [scipy.ndimage.laplace(xi) for xi in x_gray]
    x_weight  = np.abs(x_weight)
    x_weight  = [scipy.ndimage.gaussian_filter(xi**2, sigma=1.0) for xi in x_weight]
    x_weight  = np.maximum(x_weight, 1e-3)
    x_weight  = x_weight / x_weight.sum(0)
    if return_weight: return x_weight
    return (x * x_weight[...,None]).sum(0).astype(x.dtype)


def should_ignore_file(json_file='', ignore_list=[]):
    labels = get_labels_from_jsonfile(json_file) if os.path.exists(json_file) else []
    return any([(l in ignore_list) for l in labels])

def flip_boxes(boxes, image_size):
    W,H              = image_size
    boxes[...,(0,2)] = W - boxes[...,(2,0)]
    return boxes

def rot90_boxes(boxes, image_size, k=1):
    k     = k%4
    W,H   = image_size
    boxes = boxes / torch.as_tensor((W,H,W,H))
    for _ in range(k):
        boxes = torch.stack([boxes[...,1], 1-boxes[...,2], boxes[...,3], 1-boxes[...,0]], -1)
    boxes = boxes * torch.as_tensor((W,H,W,H))
    return boxes
    
def scale_boxes(boxes, image_size, target_size):
    W,H            = image_size
    boxes          = np.array(boxes).reshape(-1,4)
    boxes          = boxes / (W,H,W,H)
    W,H            = target_size
    boxes          = boxes * (W,H,W,H)  #FIXME? incorrect if H!=W?
    return boxes

def augment_box(box, alpha=8):
    box = torch.as_tensor(box)
    box = torchvision.ops.box_convert(box, 'xyxy', 'xywh')
    box += np.random.normal(size=box.shape)*alpha
    box = torchvision.ops.box_convert(box, 'xywh', 'xyxy')
    box = box.clamp(min=0)
    return box.numpy()
