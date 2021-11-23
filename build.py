#!/bin/python
import os, shutil, sys
import datetime


build_name = '%s_PollenDetector'%(datetime.datetime.now().strftime('%Y%m%d_%Hh%Mm%Ss') )
build_dir  = 'builds/%s'%build_name

#why are most of these even needed?
os.system(f'''pyinstaller --noupx                                   \
              --hidden-import=torchvision                           \
              --hidden-import=pytorch_lightning                     \
              --hidden-import=imblearn                              \
              --hidden-import=sklearn.neighbors._typedefs           \
              --hidden-import=sklearn.neighbors._quad_tree          \
              --hidden-import=sklearn.tree._utils                   \
              --hidden-import=boxlib                                \
              --hidden-import=sklearn.utils._cython_blas            \
              --hidden-import=skimage.io._plugins.tifffile_plugin   \
              --additional-hooks-dir=./hooks                        \
              --distpath {build_dir} main.py''')


shutil.copytree('HTML',   build_dir+'/HTML')
shutil.copytree('models', build_dir+'/models')
if 'linux' in sys.platform:
    os.symlink('main/main', build_dir+'/pollennet')
else:
    open(build_dir+'/main.bat', 'w').write(r'main\main.exe'+'\npause')

shutil.rmtree('./build')
#shutil.copyfile('settings.json', build_dir+'/settings.json')
os.remove('./main.spec')

#hiddenimport doesnt work; copying the whole folder
import torchvision
shutil.copytree(os.path.dirname(torchvision.__file__), build_dir+'/main/torchvision')

from PyInstaller.compat import is_win
if is_win:
    #scipy hook doesnt work
    import scipy
    scipy_dir = os.path.dirname(scipy.__file__)
    shutil.copytree(os.path.join(scipy_dir, '.libs'), build_dir+'/main/scipy/.libs')
