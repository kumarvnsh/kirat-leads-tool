"""Local control-panel smoke test with fictional worker output, never real research."""
import os
from pathlib import Path
import subprocess
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
server=subprocess.Popen(['node','-e',"require('./lib/local-server').start({port:4174,autoSetup:false,jobs:require('./lib/local-jobs').createJobs({worker:require('path').resolve('test/fake-worker.js')})})"],cwd=root,stdout=subprocess.PIPE,text=True)
try:
    assert 'Kirat app' in server.stdout.readline()
    with sync_playwright() as p:
        browser=p.chromium.launch(channel=os.environ.get('KIRAT_BROWSER_CHANNEL','chrome'),headless=True)
        page=browser.new_page()
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:4174')
        page.get_by_text('Setup ready.',exact=False).wait_for()
        page.get_by_role('button',name='Find leads',exact=True).click()
        page.get_by_role('button',name='Review 1 researched lead(s)',exact=True).click()
        page.get_by_role('button',name='Import 1 lead(s)',exact=True).click()
        page.get_by_role('button',name='=1+1 Fictional Chai',exact=True).wait_for()
        page.get_by_label('Research city').select_option('Noida, India')
        page.get_by_role('button',name='Find candidates only',exact=True).click()
        page.get_by_role('button',name='Stop',exact=True).click()
        page.get_by_text('cancelled',exact=True).wait_for()
        page.get_by_role('button',name='Quit local service',exact=True).click()
        page.get_by_text('Local service stopped. Reopen Kirat Lead Desk.app to start again.',exact=True).wait_for()
        assert not errors,errors
        print('Local UI: research job, review/import, discovery cancellation and quit passed')
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=10)
