from base.backend.app import App as BaseApp, get_models_path
import backend.processing
import backend.training

import os
import flask
import numpy as np


class App(BaseApp):
    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)

        @self.route('/fused_image/<path:path>')
        def fused_image(path):
            full_path = os.path.join(self.cache_path, path)
            if not os.path.exists(full_path):
                flask.abort(404)
            output_path = backend.processing.fuse_zstack_image(full_path, self.settings)
            return os.path.basename(output_path)
    
    #override
    def process_image(self, imagename):
        full_path = os.path.join(self.cache_path, imagename)
        if not os.path.exists(full_path):
            flask.abort(404)
        
        result = backend.processing.process_image(full_path, self.settings)
        return flask.jsonify({
            'labels':    result['per_class_scores'],
            'boxes':     np.array(result['boxes']).tolist(),
        })


    #override
    def training(self):
        requestform  = flask.request.get_json(force=True)
        options      = requestform['options']
        imagefiles   = requestform['filenames']
        imagefiles   = [os.path.join(self.cache_path, f) for f in imagefiles]
        targetfiles  = backend.training.find_targetfiles(imagefiles)
        if not all(targetfiles):
            flask.abort(404)
        
        ok = backend.training.start_training(imagefiles, targetfiles, options, self.settings)
        return ok

