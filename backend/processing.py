import PIL, numpy as np
from base.backend import GLOBALS


def process_image(imagepath, settings):
    with GLOBALS.processing_lock:
        detector = settings.models['detection']
        result   = detector.process_image(imagepath)
    return result

def fuse_zstack_image(path, settings):
    detector = settings.models['detection']
    zstack   = detector.load_image(path) / np.float32(255)
    fused    = detector.fuse_image_stack(zstack)
    fused_path = f'{path}.fused.jpg'
    fused    = PIL.Image.fromarray((fused*255).astype(np.uint8)).convert('RGB')
    fused.save(fused_path)
    return fused_path

