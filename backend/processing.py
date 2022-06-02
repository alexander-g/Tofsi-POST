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

from base.backend import GLOBALS

def load_image(imagepath):
    return PIL.Image.open(imagepath) / np.float32(255)

def process_image(imagepath, settings):
    with GLOBALS.processing_lock:
        detector = settings.models['detection']
        result   = detector.process_image(imagepath)
    W,H                      = PIL.Image.open(imagepath).size
    result['boxes_absolute'] = result['boxes_relative'] * (W,H,W,H)
    return result

def fuse_zstack_image(path, settings):
    detector = settings.models['detection']
    zstack   = detector.load_image(path) / np.float32(255)
    fused    = detector.fuse_image_stack(zstack)
    fused_path = f'{path}.fused.jpg'
    fused    = PIL.Image.fromarray((fused*255).astype(np.uint8)).convert('RGB')
    fused.save(fused_path)
    return fused_path

