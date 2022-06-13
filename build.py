#!/bin/python
import os, shutil, sys, subprocess, time

os.environ['DO_NOT_RELOAD'] = 'true'
from backend.app import App
App().recompile_static(force=True)        #make sure the static/ folder is up to date

build_name = f'{time.strftime("%Y-%m-%d_%Hh%Mm%Ss")}_PollenDetector'
build_dir  = 'builds/%s'%build_name

rc = subprocess.call(f'''pyinstaller --noupx                                   \
              --hidden-import=torchvision                           \
              --hidden-import=skimage.io._plugins.tifffile_plugin   \
              --hidden-import=imagecodecs._jpeg8                    \
              --additional-hooks-dir=./hooks                        \
              --distpath {build_dir} main.py''')

if rc!=0:
    print(f'PyInstaller exited with code {rc}')
    sys.exit(rc)

shutil.copytree('static', build_dir+'/static')
shutil.copytree('models', build_dir+'/models')

if 'linux' in sys.platform:
    os.symlink('main/main', build_dir+'/main.run')
else:
    open(build_dir+'/main.bat', 'w').write(r'main\main.exe'+'\npause')

shutil.rmtree('./build')
#shutil.copyfile('settings.json', build_dir+'/settings.json')
os.remove('./main.spec')

#hiddenimport doesnt work; copying the whole folder
import torchvision
shutil.copytree(os.path.dirname(torchvision.__file__), build_dir+'/main/torchvision')

