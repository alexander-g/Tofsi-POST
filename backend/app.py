from base.backend.app import App as BaseApp
from . import settings
from . import processing



class App(BaseApp):
    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        #self.settings = settings.Settings()

