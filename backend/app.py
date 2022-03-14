from base.base.app import App as BaseApp

import tempfile, glob, os, shutil, sys
import flask
import numpy as np

from . import processing



class App(BaseApp):
    def __init__(self, *args, **kw):
        #TODO: move into base package
        if os.environ.get("WERKZEUG_RUN_MAIN") != 'true':
            flask.Flask.__init__(self, 'reloader', *args,**kw)
            return
        
        super().__init__(*args,**kw)


        #TODO: make this a cache folder inside the main folder
        TEMPPREFIX = 'pollen_detector_'
        TEMPFOLDER = tempfile.TemporaryDirectory(prefix=TEMPPREFIX)
        print('Temporary Directory: %s'%TEMPFOLDER.name)
        #delete all previous temporary folders if not cleaned up properly
        for tmpdir in glob.glob( os.path.join(os.path.dirname(TEMPFOLDER.name), TEMPPREFIX+'*') ):
            if tmpdir != TEMPFOLDER.name:
                print('Removing ',tmpdir)
                shutil.rmtree(tmpdir)

        @self.route('/file_upload', methods=['POST'])
        def file_upload():
            files = flask.request.files.getlist("files")
            for f in files:
                print('Upload: %s'%f.filename)
                fullpath = os.path.join(TEMPFOLDER.name, f.filename )
                os.makedirs(os.path.dirname(fullpath), exist_ok=True)
                f.save(fullpath)
                #save the file additionally as jpg to make sure format is compatible with browser (tiff)
                processing.write_layers_as_jpeg(fullpath, processing.load_image(fullpath) )
            return 'OK'

        @self.route('/images/<path:path>')
        def images(path):
            print(f'Download: {os.path.join(TEMPFOLDER.name, path)}')
            return flask.send_from_directory(TEMPFOLDER.name, path)

        @self.route('/process_image/<path:path>')
        def process_image(path):
            fullpath     = os.path.join(TEMPFOLDER.name, path)
            image        = processing.load_image(fullpath)
            result       = processing.process_image(image)

            print(result['labeled_probabilities'])
            return flask.jsonify({
                'labels':    result['labeled_probabilities'],
                'boxes':     np.array(result['boxes_relative'][ :, (1,0,3,2) ]).tolist(),
                'imagesize': image.shape
            })

        @self.route('/delete_image/<path:path>')
        def delete_image(path):
            fullpath = os.path.join(TEMPFOLDER.name, path)
            print('DELETE: %s'%fullpath)
            if os.path.exists(fullpath):
                os.remove(fullpath)
            return 'OK'
        
        
        @self.after_request
        def add_header(r):
            """
            Add headers to both force latest IE rendering engine or Chrome Frame,
            and also to cache the rendered page for 10 minutes.
            """
            r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            r.headers["Pragma"] = "no-cache"
            r.headers["Expires"] = "0"
            r.headers['Cache-Control'] = 'public, max-age=0'
            return r


        processing.init()

        #TODO:
        # if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not is_debug:  #to avoid flask starting twice
        #     with app.app_context():
        #         processing.init()
        #         if not is_debug:
        #             print('Flask started')
        #             webbrowser.open('http://localhost:5000', new=2)
