from base.backend.app import App as BaseApp
from . import settings
from . import processing

import os
import flask
import numpy as np


class App(BaseApp):
    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
    
    #override
    def process_image(self, imagename):
        full_path = os.path.join(self.cache_path, imagename)
        if not os.path.exists(full_path):
            flask.abort(404)
        
        image  = processing.load_image(full_path)
        result = processing.process_image(full_path, self.settings)
        return flask.jsonify({
            'labels':    result['labeled_probabilities'],
            'boxes':     np.array(result['boxes_absolute']).tolist(),
            'imagesize': image.shape
        })

