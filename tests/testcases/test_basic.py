from seleniumbase import BaseCase, config


#TODO: refactor: move codecoverage code in own file
#TODO: add assertions



class BasicTest(BaseCase):
    def setUp(self):
        config.remote_debug = True #enable chrome remote debugging port 9222
        super().setUp()
        if self.is_chromium():
            self._pyppeteer_page = start_codecoverage()

    def test_open(self):
        self.open("http://localhost:5000/")

    def test_open_and_display(self):
        self.open("http://localhost:5000/")
        self.driver.find_element('id', 'input_images').send_keys("/root/workspace/tests/images/TAN 940 1/img_10.tiff")
        #self.save_screenshot(name="screenshot0.png", selector=None)
        self.click('label:contains("img_10.tiff")')
        self.sleep(1)
        #self.save_screenshot(name="screenshot1.png", selector=None)
        #assert 0

    def tearDown(self):
        if self.is_chromium():
            coverage   = retrieve_codecoverage(self._pyppeteer_page)
            import json, os
            outputfile = os.path.join(self.log_abspath, 'codecoverage/raw', f'{self.test_id}.codecoverage.json')
            os.makedirs(os.path.dirname(outputfile), exist_ok=True)
            open(outputfile,'w').write(json.dumps(coverage))
            import subprocess
            subprocess.call('killall chrome', shell=True)


def start_codecoverage():
    import asyncio
    import pyppeteer as pyp

    async def request_coverage_recording():
        browser    = await pyp.connect(browserURL="http://localhost:9222")
        pages      = await browser.pages()
        assert len(pages) == 1, NotImplemented
        page       = pages[0]
        await page.coverage.startJSCoverage()
        return page
    return asyncio.get_event_loop().run_until_complete(request_coverage_recording())

def retrieve_codecoverage(pyppeteer_page):
    import asyncio

    async def retrieve():
        return await pyppeteer_page.coverage.stopJSCoverage()
    return asyncio.get_event_loop().run_until_complete(retrieve())
