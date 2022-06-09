import os
os.environ['TESTS_TO_SKIP'] = (
    '''test_download_basic'''               #single item download disabled
    '''test_download_all'''                 #json files, replaced by TestPollenDownload.test_download_all
    '''test_overlay_side_by_side_switch'''  #side-by-side disabled in this ui
    '''test_brightness'''                   #zooming,brightness,panning disabled in this ui
    '''test_panning'''                      #zooming,brightness,panning disabled in this ui
    '''test_overlay_side_by_side_switch'''  #zooming,brightness,panning disabled in this ui
    '''test_load_results'''                 #result files different,     #TODO: replace
    '''test_load_tiff'''                    #requires non-static (fused) #TODO: replace 
)


from tests.mockmodels import pollen_model
from base.backend.app import get_models_path

models_path = os.path.join(get_models_path(), 'detection')
os.makedirs(models_path, exist_ok=True)
for i in range(3):
    pollen_model.PollenMockModel().save( os.path.join(models_path, f'model_{i}') )
