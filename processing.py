import os
#restrict gpu usage
os.environ["CUDA_VISIBLE_DEVICES"]=""

import glob, pickle
import cloudpickle
import numpy as np
import itertools
import util

import torch, torchvision
print('PyTorch version: %s'%torch.__version__)
print('Torchvision version: %s'%torchvision.__version__)

import skimage.util       as skimgutil
import PIL

detector = None

def init():
    global detector
    #detector = cloudpickle.load(open('models/pollendetector.cpkl', 'rb'))
    detector = pickle.load(open('models/pollendetector.cpkl', 'rb'))
    #load_settings()

def load_image(path):
    return detector.load_image(path)

def process_image(image):
    result = detector.process_image(image)
    #result.labels = [ dict([(k.title(),v) for k,v in L.items()]) for L in result.labels]
    return result

def extract_patch(image, box):
    box = np.clip(box, 0, 1)
    return detector.extract_patch(image, box)


def write_as_jpeg(path,x):
    if len(x.shape)==2:
        x = x[...,np.newaxis]
    elif len(x.shape)==4:
        x = detector.resize_image_for_detection(x)
    x = (x*255).astype(np.uint8)
    x = PIL.Image.fromarray(x).convert('RGB')
    x.save(path)


def write_layers_as_jpeg(basepath, x):
    assert np.ndim(x)==4, 'Image is not a s z-stack'

    stack = np.stack([
        PIL.Image.fromarray(im).resize((480,480), PIL.Image.BILINEAR) for im in x
    ])
    fused = detector.fuse_image_stack(stack)
    fused = skimgutil.img_as_float32(fused)
    fused = PIL.Image.fromarray((fused*255).astype(np.uint8)).convert('RGB')
    fused.save(basepath+'.jpg')

    for i,layer in enumerate(x):
        if layer.dtype!=np.uint8:
            layer = (layer*255).astype(np.uint8)
        layer = PIL.Image.fromarray(layer).convert('RGB').resize([1024,1024])
        layer.save(f'{basepath}.layer{i}.jpg')

def get_imagesize(path):
    return PIL.Image.open(path).size
