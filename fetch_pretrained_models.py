

import urllib.request, os

URLS = {
    'https://www.dropbox.com/s/4piafs91nseu4y7/2022-01-21_029b_TAN.pt.zip?dl=1'        : 'models/detection/2022-01-21_029b_TAN.pt.zip',
    'https://www.dropbox.com/s/du7dbc5s6jm4jud/2022-03-17_030c_TSK.pt.zip?dl=1'        : 'models/detection/2022-03-17_030c_TSK.pt.zip',
}

for url, destination in URLS.items():
    print(f'Downloading {url} ...')
    with urllib.request.urlopen(url) as f:
        os.makedirs( os.path.dirname(destination), exist_ok=True )
        open(destination, 'wb').write(f.read())