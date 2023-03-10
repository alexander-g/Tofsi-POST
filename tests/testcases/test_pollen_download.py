import os, subprocess
BaseCase = __import__('base_case').BaseCase



class TestPollenDownload(BaseCase):
    def test_download_csv(self):
        if not self.is_chromium() and not self.headed:
            self.skipTest('xdotool does not work with headless firefox for some reason')
        self.open_main(static=True)

        filenames = [ 
            "img_21.tiff", "img_21.json",
            "img_12.tiff", "img_12.json",
        ]
        self.send_input_files_from_assets(filenames)
        
        self.hover_on_element('[data-tab="detection"] i.download.icon')
        self.click('#download-csv-button')
        #will show missing metadata popup, click again to ignore
        self.sleep(0.2)
        self.click('#download-csv-button')


        #send enter key to x11 to confirm the download dialog window
        if not self.is_chromium():  #self.is_firefox()
            self.sleep(1.0)
            subprocess.call('xdotool key Return', shell=True)

        self.sleep(1.0)
        self.assert_downloaded_file('statistics.csv')
        self.assert_no_js_errors()
        
        
        

        if self.demo_mode:
            self.sleep(1)
