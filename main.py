import webbrowser, os, tempfile, io, sys
os.environ['PYTORCH_JIT']='0' #needed for packaging

import flask
from flask import Flask, escape, request
import json

import processing

import torch, torchvision

import numpy as np
import skimage.io         as skio
skio.use_plugin('tifffile')
import skimage.draw       as skdraw
import skimage.transform  as sktransform
import skimage.measure    as skmeasure
import skimage.morphology as skmorph
import skimage.filters    as skfilters
import skimage.util       as skimgutil
#import sklearn.utils      as skutils

import tempfile
#import util
#monkeypatching
#util.tempfile = tempfile
#util.os       = os
#util.keras    = keras





app        = Flask('Pollen Detector', static_folder=os.path.abspath('./HTML'))
TEMPFOLDER = tempfile.TemporaryDirectory(prefix='pollen_detector_')
print('Temporary Directory: %s'%TEMPFOLDER.name)





@app.route('/')
def root():
    return app.send_static_file('index.html')

@app.route('/static/<path:path>')
def staticfiles(path):
    return app.send_static_file(path)

@app.route('/file_upload', methods=['POST'])
def file_upload():
    files = request.files.getlist("files")
    for f in files:
        print('Upload: %s'%f.filename)
        fullpath = os.path.join(TEMPFOLDER.name, os.path.basename(f.filename) )
        f.save(fullpath)
        #save the file additionally as jpg to make sure format is compatible with browser (tiff)
        processing.write_layers_as_jpeg(fullpath, processing.load_image(fullpath) )
    return 'OK'

@app.route('/images/<imgname>')
def images(imgname):
    print('Download: %s'%os.path.join(TEMPFOLDER.name, imgname))
    return flask.send_from_directory(TEMPFOLDER.name, imgname)

@app.route('/process_image/<imgname>')
def process_image(imgname):
    fullpath     = os.path.join(TEMPFOLDER.name, imgname)
    image        = processing.load_image(fullpath)
    result       = processing.process_image(image)

    for i,patch in enumerate(result.patches):
        processing.write_as_jpeg(os.path.join(TEMPFOLDER.name, 'patch_%i_%s.jpg'%(i,imgname)), patch)
    print(result.labels)
    return flask.jsonify({'labels':result.labels, 'flags':result.flags, 
                          'boxes':np.array(result.boxes).tolist(), 'imagesize':image.shape })


@app.route('/delete_image/<imgname>')
def delete_image(imgname):
    fullpath = os.path.join(TEMPFOLDER.name, imgname)
    print('DELETE: %s'%fullpath)
    if os.path.exists(fullpath):
        os.remove(fullpath)
    return 'OK'


@app.route('/custom_patch/<imgname>')
def custom_patch(imgname):
    box      = json.loads(request.args.get('box'))
    index    = int(request.args.get('index'))
    print(f'CUSTOM PATCH: {imgname} @box={box}')
    fullpath = os.path.join(TEMPFOLDER.name, imgname)
    image    = processing.load_image(fullpath)
    patch    = processing.extract_patch(image, box)
    if patch is not None:
        processing.write_as_jpeg(os.path.join(TEMPFOLDER.name, 'patch_%i_%s.jpg'%(index,imgname)), patch)
        return 'OK'



@app.after_request
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



is_debug = sys.argv[0].endswith('.py')
if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not is_debug:  #to avoid flask starting twice
    with app.app_context():
        processing.init()
        if not is_debug:
        	print('Flask started')
        	webbrowser.open('http://localhost:5000', new=2)

#ugly ugly
host = ([x[x.index('=')+1:] for x in sys.argv if x.startswith('--host=')] + ['127.0.0.1'])[0]
print(f'Host: {host}')
app.run(host=host,port=5000, debug=is_debug)
