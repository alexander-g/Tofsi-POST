import numpy as np


def box_center(box):
    '''Calcualtes the center of a box'''
    box = np.array(box)
    return (box[..., :2] + box[..., 2:])*0.5

def box_size(box):
    boxes = np.reshape(box, (-1,4))
    sizes = np.abs(boxes[:,2:] - boxes[:,:2])
    return sizes if len(np.shape(box))>1 else sizes.squeeze()

def box_area(box):
    '''Calculate the area of a rectangle (x0,y0,x1,y1)'''
    boxes = np.reshape(box, (-1,4))
    areas = abs(boxes[:,2] - boxes[:,0]) * abs(boxes[:,3] - boxes[:,1])
    return areas if len(np.shape(box))>1 else areas.squeeze()


def intersection(box0, box1):
    '''Returns a new box which is the intersection between box0 and box1'''
    boxes0 = np.reshape(box0, (-1,4))
    boxes1 = np.reshape(box1, (-1,4))
    x0 = np.maximum( boxes0[:,0], boxes1[:,0] )
    x1 = np.maximum( np.minimum( boxes0[:,2], boxes1[:,2] ), x0 )
    y0 = np.maximum( boxes0[:,1], boxes1[:,1] )
    y1 = np.maximum( np.minimum( boxes0[:,3], boxes1[:,3] ), y0 )
    intersections = np.stack([x0,y0,x1,y1], axis=1)
    return intersections if len(np.shape(box0))>1 or len(np.shape(box1))>1 else intersections.squeeze()


def IoU(box0, box1):
    '''Calculates the Intersection over Union of box0 and box1'''
    intersection_area = box_area( intersection( box0, box1 ) )
    return intersection_area / (box_area(box0) + box_area(box1) - intersection_area)


def flip_box_y(box):
    '''Mirrors a box(es) along the y axis. Box must be normalized.'''
    boxes   = np.reshape(box, (-1,2,2))
    flipped = boxes * [[+1,-1],[+1,-1]] +[[0,1],[0,1]]
    ordered = np.concatenate([np.min(flipped, axis=1), np.max(flipped, axis=1)], axis=-1)
    return ordered if len(np.shape(box))>1 else ordered.squeeze()

def flip_box_x(box):
    '''Mirrors a box(es) along the x axis. Box must be normalized.'''
    boxes   = np.reshape(box, (-1,2,2))
    flipped = boxes * [[-1,+1],[-1,+1]] +[[1,0],[1,0]]
    ordered = np.concatenate([np.min(flipped, axis=1), np.max(flipped, axis=1)], axis=-1)
    return ordered if len(np.shape(box))>1 else ordered.squeeze()

def transpose_box(box):
    '''Swaps box axes to match the .transpose(1,0,2) operation for images'''
    boxes      = np.reshape(box, (-1,4))
    transposed = boxes[:,(1,0,3,2)]
    return transposed if len(np.shape(box))>1 else transposed.squeeze()
