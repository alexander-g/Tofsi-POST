from base.backend.app import App as BaseApp, get_models_path
import backend.processing
import backend.training

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
        
        image  = backend.processing.load_image(full_path)
        result = backend.processing.process_image(full_path, self.settings)
        return flask.jsonify({
            'labels':    result['labeled_probabilities'],
            'boxes':     np.array(result['boxes_absolute']).tolist(),
            'imagesize': image.shape
        })


    #override
    def training(self):
        requestform = dict(flask.request.form.lists())
        options = dict(
            classes_of_interest = requestform['options[classes_of_interest][]'],
            classes_other       = requestform['options[classes_other][]'],
            classes_unknown     = requestform['options[classes_unknown][]'],
            classes_nonpollen   = requestform['options[classes_nonpollen][]'],
            train_detector      = requestform['options[train_detector]']   == ['true'],
            train_classifier    = requestform['options[train_classifier]'] == ['true'],
        )
        print(requestform)
        print(options)
        
        imagefiles   = requestform['filenames[]']
        imagefiles   = [os.path.join(self.cache_path, f) for f in imagefiles]
        targetfiles  = backend.training.find_targetfiles(imagefiles)
        if not all(targetfiles):
            flask.abort(404)
        
        ok = backend.training.start_training(imagefiles, targetfiles, options, self.settings)
        return ok

    #override
    def save_model(self):
        newname      = flask.request.args['newname']
        print('Saving trained model as:', newname)
        
        modeltype    = 'detection'
        path = f'{get_models_path()}/{modeltype}/{newname}'
        self.settings.models[modeltype].save(path)
        self.settings.active_models[modeltype] = newname
        return 'OK'
    
    #override
    def stop_training(self):
        #XXX: brute-force approach to avoid boilerplate code
        for m in self.settings.models.values():
            m.stop_training()
        return 'OK'
