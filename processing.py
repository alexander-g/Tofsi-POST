import os
#restrict gpu usage
os.environ["CUDA_VISIBLE_DEVICES"]=""

import glob
import dill
import numpy as np
import itertools
import util

import tensorflow as tf
import tensorflow.keras as keras
K = keras.backend
print('TensorFlow version: %s'%tf.__version__)
print('Keras version: %s'%keras.__version__)

import skimage.measure as skmeasure
import skimage.morphology as skmorph

detector = None

def init():
    global detector
    detector = dill.load(open('models/pollendetector.dill', 'rb'))
    #load_settings()

def load_image(path):
    return detector.load_image(path)

def process_image(image):
    result = detector.process_image(image)
    result.labels = [ dict([(k.title(),v) for k,v in L.items()]) for L in result.labels]
    return result

def extract_patch(image, box):
    box = np.clip(box, 0, 1)
    return detector.extract_patch(image, box)


def write_as_png(path,x):
    x = x[...,tf.newaxis] if len(x.shape)==2 else x
    x = x*255 if tf.reduce_max(x)<=1 else x
    tf.io.write_file(path, tf.image.encode_png(  tf.cast(x, tf.uint8)  ))

def write_as_jpeg(path,x):
    if len(x.shape)==2:
        x = x[...,tf.newaxis]
    elif len(x.shape)==4:
        x = detector.resize_image_for_detection(x)
    x = x*255 if tf.reduce_max(x)<=1 else x
    tf.io.write_file(path, tf.image.encode_jpeg(  tf.cast(x, tf.uint8)  ))
