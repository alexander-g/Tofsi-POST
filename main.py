import webbrowser, os, tempfile, io, sys, glob, shutil, json
os.environ['PYTORCH_JIT']='0' #needed for packaging

import flask
from flask import Flask, escape, request

import processing

import torch, torchvision
import onnxruntime

import numpy as np
import skimage.io         as skio
skio.use_plugin('tifffile')




app        = Flask('Pollen Detector', static_folder=os.path.abspath('./HTML'))

is_debug = sys.argv[0].endswith('.py')
if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not is_debug:  #to avoid flask starting twice
    TEMPPREFIX = 'pollen_detector_'
    TEMPFOLDER = tempfile.TemporaryDirectory(prefix=TEMPPREFIX)
    print('Temporary Directory: %s'%TEMPFOLDER.name)
    #delete all previous temporary folders if not cleaned up properly
    for tmpdir in glob.glob( os.path.join(os.path.dirname(TEMPFOLDER.name), TEMPPREFIX+'*') ):
        if tmpdir != TEMPFOLDER.name:
            print('Removing ',tmpdir)
            shutil.rmtree(tmpdir)





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
        fullpath = os.path.join(TEMPFOLDER.name, f.filename )
        os.makedirs(os.path.dirname(fullpath), exist_ok=True)
        f.save(fullpath)
        #save the file additionally as jpg to make sure format is compatible with browser (tiff)
        processing.write_layers_as_jpeg(fullpath, processing.load_image(fullpath) )
    return 'OK'

@app.route('/images/<path:path>')
def images(path):
    print('Download: %s'%os.path.join(TEMPFOLDER.name, path))
    return flask.send_from_directory(TEMPFOLDER.name, path)


@app.route('/process_image/<path:path>')
def process_image(path):
    fullpath     = os.path.join(TEMPFOLDER.name, path)
    image        = processing.load_image(fullpath)
    result       = processing.process_image(image)

    #for i,patch in enumerate(result.patches):
    #    processing.write_as_jpeg(os.path.join(TEMPFOLDER.name, 'patch_%i_%s.jpg'%(i,path)), patch)
    print(result['labeled_probabilities'])
    return flask.jsonify({
        'labels':    result['labeled_probabilities'],
        'boxes':     np.array(result['boxes_relative'][ :, (1,0,3,2) ]).tolist(),
        'imagesize': image.shape
    })


@app.route('/delete_image/<path:path>')
def delete_image(path):
    fullpath = os.path.join(TEMPFOLDER.name, path)
    print('DELETE: %s'%fullpath)
    if os.path.exists(fullpath):
        os.remove(fullpath)
    return 'OK'


@app.route('/custom_patch/<path:path>')
def custom_patch(path):
    box      = json.loads(request.args.get('box'))
    index    = int(request.args.get('index'))
    print(f'CUSTOM PATCH: {path} @box={box}')
    fullpath = os.path.join(TEMPFOLDER.name, path)
    image    = processing.load_image(fullpath)
    patch    = processing.extract_patch(image, box)
    if patch is not None:
        processing.write_as_jpeg(os.path.join(TEMPFOLDER.name, 'patch_%i_%s.jpg'%(index,path)), patch)
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
