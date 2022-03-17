import os
#restrict gpu usage
os.environ["CUDA_VISIBLE_DEVICES"]=""

import glob, pickle
import cloudpickle
import numpy as np
import itertools

import torch, torchvision, onnxruntime
print(f'PyTorch version:     {torch.__version__}')
print(f'Torchvision version: {torchvision.__version__}')
print(f'ONNXruntime version: {onnxruntime.__version__}')

import skimage.util       as skimgutil
import PIL

detector = None

def init(settings):
    load_model(settings)

def load_model(settings):
    global detector
    settings  = settings.get_settings()
    modelname = settings['active_model']
    if modelname is None:
        modelname = settings['models'][0]
    path = f"models/{modelname}.pkl"
    detector = pickle.load(open(path, 'rb'))
    return detector

def load_image(path):
    return detector.load_image(path)

def process_image(image):
    result   = detector.process_image(image)
    return result

def write_as_jpeg(path,x):
    if len(x.shape)==2:
        x = x[...,np.newaxis]
    elif len(x.shape)==4:
        x = detector.resize_image_for_detection(x)
    x = (x*255).astype(np.uint8)
    x = PIL.Image.fromarray(x).convert('RGB')
    x.save(path)

def write_layers_as_jpeg(basepath, x):
    assert np.ndim(x)==4, 'Image is not a z-stack'

    H,W   = x.shape[1:3]
    ratio = H/W
    stack = np.stack([
        PIL.Image.fromarray(im).resize([420,int(420*ratio)], PIL.Image.BILINEAR) for im in x
    ])
    fused = detector.fuse_image_stack(stack)
    fused = skimgutil.img_as_float32(fused)
    fused = PIL.Image.fromarray((fused*255).astype(np.uint8)).convert('RGB')
    fused.save(basepath+'.jpg')

    for i,layer in enumerate(x):
        if layer.dtype!=np.uint8:
            layer = (layer*255).astype(np.uint8)
        layer = PIL.Image.fromarray(layer).convert('RGB').resize([1024,int(1024*ratio)])
        layer.save(f'{basepath}.layer{i}.jpg')


