import os, glob
from base.backend.settings import Settings as BaseSettings
from . import processing


class Settings(BaseSettings):
    def set_settings(self, s):
        super().set_settings(s)
        processing.load_model(self)

    def get_available_models(self):
        models     = glob.glob('models/*.pkl')
        modelnames = [os.path.basename(m).replace('.pkl','') for m in models]
        return modelnames



