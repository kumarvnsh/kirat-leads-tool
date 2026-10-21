import json
import os
import sys
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
output=Path(tempfile.mkdtemp(prefix='kirat-browser-'))
base_url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4173'
fixture=json.loads((root/'test/fixture-batch.json').read_text())
fixture['leads']=fixture['leads'][:1]
with sync_playwright() as p:
    browser=p.chromium.launch(channel=os.environ.get('KIRAT_BROWSER_CHANNEL','chrome'),headless=True)
    context=browser.new_context(accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base_url)
    page.get_by_text('Saved in this browser',exact=True).wait_for()
    page.get_by_role('button',name='Import batch',exact=True).first.click()
    page.locator('#import-text').fill(json.dumps(fixture))
    page.get_by_role('button',name='Check batch',exact=True).click()
    page.get_by_role('button',name='Import 1 lead(s)',exact=True).click()
    company=fixture['leads'][0]['company']
    page.get_by_role('button',name=company,exact=True).click()
    page.locator('#f-notes').fill('Browser persistence check')
    page.get_by_text('Saved in this browser',exact=True).wait_for()
    page.wait_for_timeout(1100)
    page.reload()
    page.get_by_role('button',name=company,exact=True).click()
    assert page.locator('#f-notes').input_value()=='Browser persistence check'
    page.get_by_role('button',name='Close details',exact=True).click()
    page.get_by_role('button',name='Import batch',exact=True).first.click()
    page.locator('#import-text').fill(json.dumps(fixture))
    page.get_by_role('button',name='Check batch',exact=True).click()
    page.get_by_role('button',name='Merge into saved lead',exact=True).click()
    page.get_by_role('button',name='Import 1 lead(s)',exact=True).click()
    page.get_by_role('button',name=company,exact=True).click()
    assert page.locator('#f-notes').input_value()=='Browser persistence check'
    page.get_by_role('button',name='Close details',exact=True).click()
    with page.expect_download() as d:
        page.get_by_role('button',name='Export backup',exact=True).click()
    target=output/'backup.json'
    d.value.save_as(target)
    saved=json.loads(target.read_text())
    assert saved['leads'][0]['notes']=='Browser persistence check'
    with page.expect_download() as d:
        page.get_by_role('button',name='Export CSV (1)',exact=True).click()
    d.value.save_as(output/'export.csv')
    assert page.locator('a',has_text='Open Signage Studio').get_attribute('href')=='https://kiiratstudio.netlify.app/'
    assert not errors,errors
    page.screenshot(path=str(output/'dashboard.png'),full_page=True)
    print('Browser: import, notes, reload, duplicate merge, backup and CSV passed')
    # Exercise storage failure without changing the user's browser profile.
    failed=browser.new_context()
    failed.add_init_script("Object.defineProperty(window, 'indexedDB', {value:{open(){throw new Error('Test storage failure')}}});")
    fp=failed.new_page();fp.goto(base_url)
    fp.get_by_text('Your saved leads did not load.',exact=True).wait_for()
    assert fp.get_by_role('button',name='Import batch',exact=True).first.is_disabled()
    fp.get_by_role('button',name='Work without saving',exact=True).click()
    assert fp.get_by_role('button',name='Import batch',exact=True).first.is_enabled()
    print('Browser: storage failure blocks overwrite and offers memory recovery')
    print('Browser artifacts: '+str(output))
    browser.close()
