import sys,os,time,io,warnings
import numpy as np
import scipy.ndimage
import torch, torchvision
import PIL.Image
import skimage.io, skimage.util
#import cloudpickle
#import onnxruntime

#internal modules
MODULES = ['training', 'datasets']

if "__torch_package__" in dir():
    #inside a torch package
    import torch_package_importer
    [traininglib, datasetlib] = [torch_package_importer.import_module(m) for m in MODULES]
else:
    #normal
    import importlib
    [traininglib, datasetlib] = [importlib.reload(importlib.import_module(m)) for m in MODULES]


class PollenDetector(torch.nn.Module):
    def __init__(self, detector_imgsize:int, classifier_imgsize:int, class_list:list):
        super().__init__()
        self.detector           = Detector(detector_imgsize, box_score_thresh=0.5, box_nms_thresh=0.4) 
        self.classifier         = Classifier(classifier_imgsize, class_list)
        self.class_list         = self.classifier.class_list
    
    def process_image(self, image, use_onnx=False):
        if isinstance(image, str):
            image = load_image(image)
        detector_output   = self.detector.process_image(image, use_onnx)
        classifier_output = self.classifier.process_image(image, detector_output['boxes'], use_onnx)
        result = dict(detector_output)
        result.update(classifier_output)
        return result
    
    @staticmethod
    def load_image(path):
        return load_image(path)
    
    @staticmethod
    def fuse_image_stack(x):
        return fuse_image_stack(x)
    
    def save(self, destination):
        if isinstance(destination, str):
            destination = time.strftime(destination)
            if not destination.endswith('.pt.zip'):
                destination += '.pt.zip'
        try:
            import torch_package_importer as imp
            #re-export
            importer = (imp, torch.package.sys_importer)
        except ImportError as e:
            #first export
            importer = (torch.package.sys_importer,)
        with torch.package.PackageExporter(destination, importer) as pe:
            interns = [__name__.split('.')[-1]]+MODULES
            pe.intern(interns)
            pe.extern('**', exclude=['torchvision.**'])
            externs = ['torchvision.ops.**', 'torchvision.datasets.**', 'torchvision.io.**', 'torchvision.models.*']
            pe.intern('torchvision.**', exclude=externs)
            pe.extern(externs, exclude='torchvision.models.detection.**')
            pe.intern('torchvision.models.detection.**')
            
            #force inclusion of internal modules + re-save if importlib.reload'ed
            for inmod in interns:
                if inmod in sys.modules:
                    pe.save_source_file(inmod, sys.modules[inmod].__file__, dependencies=True)
                else:
                    pe.save_source_string(inmod, importer[0].get_source(inmod))
            
            pe.save_pickle('model', 'model.pkl', self)
            pe.save_text('model', 'class_list.txt', '\n'.join(self.class_list))
        return destination

    def start_training_detector(
            self, 
            imagefiles_train,           targetfiles_train,
            imagefiles_valid  = None,   targetfiles_valid = None,
            classes_nonpollen = [],     classes_ignore    = [],
            epochs            = 10,     lr                = 1e-4,
            callback          = None,   num_workers       = 'auto',  batch_size = 8,
            ds_kwargs         = {},     task_kwargs       = {}
    ):
        task         = traininglib.DetectionTask(self.detector, epochs=epochs, lr=lr, callback=callback, **task_kwargs)
        ds_train     = datasetlib.DetectionDataset(
            imagefiles_train,       targetfiles_train, 
            classes_of_interest=[], negative_classes=classes_nonpollen, ignored_classes=classes_ignore, 
            image_size=self.detector.image_size,       multiclass=False,
            augment=True, **ds_kwargs)
        ld_train     = ds_train.create_dataloader(batch_size, shuffle=True, num_workers=num_workers)
        
        ld_valid     = None
        if imagefiles_valid is not None and targetfiles_valid is not None:
            ds_valid = datasetlib.DetectionDataset(
                imagefiles_valid,       targetfiles_valid,
                classes_of_interest=[], negative_classes=classes_nonpollen, ignored_classes=classes_ignore, 
                image_size=self.detector.image_size,       multiclass=False,
                augment=False, **ds_kwargs)
            ld_valid = ds_valid.create_dataloader(batch_size, shuffle=False, num_workers=num_workers)
        
        self.requires_grad_(True)
        ret = task.fit(ld_train, ld_valid, epochs=epochs)
        self.eval().cpu().requires_grad_(False)
        return (not task.stop_requested and not ret)
    
    def start_training_classifier(
            self,
            imagefiles_train,           targetfiles_train,
            imagefiles_valid    = None, targetfiles_valid = None,
            classes_of_interest = None, classes_nonpollen = [], 
            classes_ignore      = [],   classes_lowconf   = [],
            epochs              = 10,   lr                = 1e-4,
            callback            = None, num_workers       = 'auto',  batch_size = 8,
            ds_kwargs           = {},   task_kwargs       = {}
    ):
        task                = traininglib.ClassificationTask(self.classifier, epochs=epochs, lr=lr, callback=callback, **task_kwargs)
        classes_of_interest = classes_of_interest or self.class_list
        self.set_classes(classes_of_interest)
        
        ds_train            = datasetlib.ClassificationDataset(
            imagefiles_train,    targetfiles_train,
            self.class_list, classes_ignore, classes_nonpollen, classes_lowconf,
            image_size=self.classifier.image_size,
            augment=True, **ds_kwargs)
        ld_train     = ds_train.create_dataloader(batch_size, shuffle=True, num_workers=num_workers)
        
        ld_valid     = None
        if imagefiles_valid is not None and targetfiles_valid is not None:
            ds_valid = datasetlib.ClassificationDataset(
                imagefiles_valid, targetfiles_valid,
                self.class_list, classes_ignore, classes_nonpollen, classes_lowconf,
                image_size=self.classifier.image_size,
                augment=False, **ds_kwargs)
            ld_valid = ds_valid.create_dataloader(batch_size, shuffle=False, num_workers=num_workers)
        
        self.requires_grad_(True)
        ret = task.fit(ld_train, ld_valid, epochs=epochs)
        self.eval().cpu().requires_grad_(False)
        return (not task.stop_requested and not ret)
    
    def stop_training(self):
        traininglib.DetectionTask.request_stop()
        traininglib.ClassificationTask.request_stop()
    
    def set_classes(self, class_list):
        self.class_list = self.classifier.set_classes(class_list)



def get_device(model):
    return list(model.parameters())[0].device

def load_image(tiff_file):
    import skimage.io
    stack      = skimage.io.imread(tiff_file)
    if len(stack.shape)<4:
        stack = stack[np.newaxis]
    return stack

def fuse_image_stack(x, sigma=1.0, return_weight=False):
    '''Fuses a stack of images to a single RGB layer'''
    import scipy.ndimage
    x_gray    = (x*(0.2126, 0.7152, 0.0722)).sum(-1)
    x_gray    = [scipy.ndimage.gaussian_filter(xi, sigma) for xi in x_gray]
    x_weight  = [scipy.ndimage.laplace(xi) for xi in x_gray]
    x_weight  = np.abs(x_weight)
    x_weight  = [scipy.ndimage.gaussian_filter(xi**2, sigma=1.0) for xi in x_weight]
    x_weight  = np.maximum(x_weight, 1e-3)
    x_weight  = x_weight / x_weight.sum(0)
    if return_weight: return x_weight
    return (x * x_weight[...,None]).sum(0).astype(x.dtype)


def gridify(stack):
    import scipy.ndimage
    #arange stack layers in a grid
    x         = stack
    x_gray    = (x*(0.2126, 0.7152, 0.0722)).sum(-1)
    x_gray    = [scipy.ndimage.gaussian_filter(xi, sigma=1.0) for xi in x_gray]
    x_weight  = [scipy.ndimage.laplace(xi) for xi in x_gray]
    x_weight  = np.abs(x_weight)
    order     = np.argsort(x_weight.reshape(len(stack),-1).mean(-1))
    x         = np.concatenate([
        np.concatenate([x[order[-1]], x[order[-2]]], axis=1), 
        np.concatenate([x[order[-3]], x[order[-4]]], axis=1), 
    ], axis=0)
    return x

def crop_resize_gridify(stack, box, image_size, augment=False):
    import skimage.util
    if stack.shape[0] < 4:
        stack = np.stack([stack[0]]*5)
    #crop+resize
    stack = np.stack([
        PIL.Image.fromarray(im).crop(box).resize([image_size]*2, PIL.Image.BILINEAR) for im in stack
    ])
    if augment:
        if np.random.random()<0.5:
            stack = np.flip(stack, axis=2)
        k = np.random.randint(4)
        stack = np.rot90(stack, k, axes=(1, 2))
    image      = gridify(stack)
    image      = skimage.util.img_as_float32(image)
    x          = torchvision.transforms.ToTensor()(image.copy())
    return x


class BaseModel(torch.nn.Module):
    def forward(self, *args, **kwargs):
        return self.basemodule(*args,**kwargs)
    
    def init_onnx(self, re_export=False):
        return
        #if getattr(self,'_onnx_bytes',None) is None or re_export:
        #    self._onnx_bytes = to_onnx(self.eval(), self.__class__.__name__.lower())
        #self._onnx_session = onnxruntime.InferenceSession(self._onnx_bytes)
    
    def __getstate__(self):
        d = dict(self.__dict__)
        d['_onnx_session'] = None
        return d
    def __setstate__(self, d):
        super().__setstate__(d)
        #self.init_onnx()                                                                                                                                           #FIXME


class Detector(BaseModel):
    def __init__(self,image_size, state_dict=None, *args, **kwargs):
        super().__init__()
        self.basemodule = torchvision.models.detection.fasterrcnn_resnet50_fpn(pretrained=True, progress=False, min_size=image_size, *args, **kwargs)
        if state_dict is not None:
            self.basemodule.load_state_dict(state_dict)
        self.image_size = image_size
    
    @staticmethod
    def preprocess_image_stack(stack, image_size):
        import skimage.util
        #resize before fusion for speed
        #PIL faster than skimage.transform.resize()  #TODO: torch.nn.functional.interpolate is even faster
        stack = np.stack([
            PIL.Image.fromarray(im).resize([image_size]*2, PIL.Image.BILINEAR) for im in stack
        ])
        image      = fuse_image_stack(stack)
        image      = skimage.util.img_as_float32(image)
        x          = torchvision.transforms.ToTensor()(image)
        return x
    
    def process_image(self, image, use_onnx=False):
        if isinstance(image, str):
            image = load_image(image)
        x = self.preprocess_image_stack(image, self.image_size)[np.newaxis]

        if use_onnx:
            output = self._onnx_session.run(['boxes', 'labels', 'scores'], {'image': x.numpy()})
            output = dict(zip(['boxes', 'labels', 'scores'], output))
        else:
            with torch.no_grad():
                output = self.eval()(x.to(get_device(self)))[0]
            output['boxes']  = output['boxes'].cpu().numpy()
            output['labels'] = output['labels'].cpu().numpy()
            output['scores'] = output['scores'].cpu().numpy()

        output['boxes_raw']        = output['boxes']
        #rescale boxes to original image size
        H,W                        = image.shape[1:3]
        output['boxes_normalized'] = output['boxes'] / self.image_size
        output['boxes']            = output['boxes_normalized'] * (W,H,W,H)
        output['box_scores']       = output['scores']
        return output


#TODO: temperature + threshold calibration
class Classifier(BaseModel):
    def __init__(self,image_size, class_list, state_dict=None, temperature=1.0, threshold=0.7):
        super().__init__()
        self.basemodule = torchvision.models.mobilenet_v3_large(pretrained=True, progress=False)
        if state_dict is not None:
            self.basemodule.load_state_dict(state_dict)
        self.image_size = image_size
        self.class_list = class_list
        #calibrated during training
        self.temperature = temperature
        self.threshold   = threshold
    
    def process_image(self, image, boxes, use_onnx=False):
        if len(boxes)==0:
            return {
                'logits':                np.zeros([0,1000], dtype='float32'), 
                'cls_scores':            np.zeros([0,len(self.class_list)], dtype='float32'), 
                'per_class_scores' :     [],
                'labels':                [], 
            }

        if isinstance(image, str):
            image = load_image(image)
        x = torch.stack([crop_resize_gridify(image, b, self.image_size) for b in boxes])

        if use_onnx:
            logits = self._onnx_session.run(['logits'], {'image': x.numpy()})[0]
            logits = torch.as_tensor(logits)
        else:
            with torch.no_grad():
                logits = self.eval()(x.to(get_device(self)))  #FIXME: why does this give errors
                #logits = self.eval().cpu()(x.cpu())
        probs  = torch.softmax(logits[:,:len(self.class_list)]/self.temperature, -1).cpu().numpy()
        logits = logits.cpu().numpy()

        class_list_titled = [c.title() for c in self.class_list]
        return {
            'logits'           : logits, 
            'cls_scores'       : probs,
            'per_class_scores' : [ dict(zip( class_list_titled, p )) for p in probs.tolist() ],
            'labels'           : [ class_list_titled[p.argmax(-1)]   for p in probs],
        }
    
    def set_classes(self, new_classes):
        new_classes = set([c.title() for c in new_classes]).difference(['Nonpollen', 'nonpollen', 'Other', 'other', ''])
        new_classes = ['Nonpollen'] + sorted( new_classes ) + ['Other']
        old_classes = [c.title() for c in self.class_list]
        old_linear  = self.basemodule.classifier[-1]
        new_linear  = torch.nn.Linear(old_linear.weight.shape[1], len(new_classes)).requires_grad_(False)
        for i,c in enumerate(new_classes):
            if c in old_classes:
                j = old_classes.index(c)
                new_linear.weight.data[i] = old_linear.weight[j]
                new_linear.bias.data[i]   = old_linear.bias[j]
        self.basemodule.classifier[-1] = new_linear
        self.class_list                = new_classes
        return self.class_list





def to_onnx(model, modeltype:str):
    assert modeltype in ['classifier', 'detector']
    def onnx_hardisigmoid(g, x):
        return g.op('HardSigmoid', x, alpha_f=1 / 6)
    torch.onnx.register_custom_op_symbolic('::hardsigmoid', onnx_hardisigmoid, 11)

    buffer = io.BytesIO()
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        b = torch.onnx.export(
            model.eval().cpu(),
            torch.zeros([1,3,256,256]),
            buffer,
            opset_version=11,
            input_names=['image'],
            output_names=['logits'] if modeltype=='classifier' else ['boxes', 'labels', 'scores'],
            dynamic_axes  = {
                'image'  :        { 0 : 'batch', 2:'height', 3:'width'},
                'logits' :        { 0 : 'batch'},
                'boxes'  :        { 0 : 'batch'},
                'scores' :        { 0 : 'batch'},
                'labels' :        { 0 : 'batch'},
            },
        )
    buffer.seek(0)
    return buffer.read()
