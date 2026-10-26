"""Local control-panel smoke test with fictional worker output, never real research."""
import os
from pathlib import Path
import subprocess
import tempfile
import json
import shutil
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
settings_dir=Path(tempfile.mkdtemp(prefix='kirat-ui-settings-'))
server=subprocess.Popen(['node','-e',"require('./lib/local-server').start({port:4174,autoSetup:false,settingsPath:'"+str(settings_dir/'settings.json')+"',jobs:require('./lib/local-jobs').createJobs({worker:require('path').resolve('test/fake-worker.js')})})"],cwd=root,stdout=subprocess.PIPE,text=True)
try:
    assert 'Kirat app' in server.stdout.readline()
    with sync_playwright() as p:
        browser=p.chromium.launch(channel=os.environ.get('KIRAT_BROWSER_CHANNEL','chrome'),headless=True)
        page=browser.new_page()
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:4174')
        page.get_by_role('tab',name='Settings',exact=True).click()
        page.get_by_text('Advanced',exact=True).click()
        page.get_by_role('tabpanel',name='Settings',exact=True).get_by_text('Setup ready.',exact=False).wait_for()
        page.get_by_text('Local provider settings (optional)',exact=True).click()
        page.get_by_label('Hunter API key',exact=False).fill('fictional-test-key')
        page.get_by_role('button',name='Save provider keys',exact=True).click()
        page.get_by_text('Settings saved on this Mac.',exact=True).wait_for()
        assert 'fictional-test-key' not in page.locator('body').inner_text()
        assert page.get_by_label('Hunter API key',exact=False).input_value()==''
        page.get_by_role('tab',name='Leads',exact=True).click()
        page.get_by_role('button',name='Find leads',exact=True).click()
        page.get_by_role('button',name='Start research',exact=True).click()
        page.get_by_role('button',name='Review 1 researched lead(s)',exact=True).click()
        page.get_by_role('button',name='Import 1 lead(s)',exact=True).click()
        page.get_by_role('button',name='=1+1 Fictional Chai',exact=True).wait_for()
        page.get_by_role('button',name='=1+1 Fictional Chai',exact=True).click()
        page.get_by_text('Project stage: planned',exact=True).wait_for()
        page.locator('#f-notes').fill('Preserve contact lookup sales notes')
        page.get_by_role('tab',name='Email',exact=True).click()
        page.get_by_role('button',name='Draft outreach',exact=True).click()
        page.get_by_role('button',name='Save generated drafts',exact=True).wait_for()
        page.get_by_role('button',name='Close details',exact=True).click()
        revised=json.loads((root/'test/fixture-batch.json').read_text());revised['leads']=revised['leads'][:1]
        revised['leads'][0]['evidence'][0]['summary']='Updated fictional project facts.'
        revised['leads'][0]['evidence'][0]['url']='https://chai.example/project-update'
        page.get_by_role('button',name='Import batch',exact=True).first.click()
        page.locator('#import-text').fill(json.dumps(revised))
        page.get_by_role('button',name='Check batch',exact=True).click()
        page.get_by_role('button',name='Merge into saved lead',exact=True).click()
        page.get_by_role('button',name='Import 1 lead(s)',exact=True).click()
        page.get_by_role('button',name='=1+1 Fictional Chai',exact=True).click()
        page.get_by_role('tab',name='Email',exact=True).click()
        page.get_by_text('These results use older lead facts or a removed contact. Run preparation again.',exact=True).wait_for()
        assert page.get_by_role('button',name='Save generated drafts',exact=True).count()==0
        page.get_by_role('tab',name='Email',exact=True).click()
        page.get_by_role('button',name='Draft outreach',exact=True).click()
        page.get_by_role('button',name='Save generated drafts',exact=True).click()
        page.get_by_label('Prepared email body',exact=True).fill('Edited by user; keep this draft.')
        page.get_by_role('button',name='Save selected draft edits',exact=True).click()
        page.get_by_role('button',name='Generate replacement draft',exact=True).click()
        page.get_by_role('button',name='Replace existing draft…',exact=True).click()
        page.get_by_role('tab',name='Email',exact=True).click()
        assert page.get_by_label('Prepared email body',exact=True).input_value()=='Edited by user; keep this draft.'
        page.get_by_role('button',name='Keep existing draft',exact=True).click()
        page.get_by_role('button',name='Verify hello@chai.example',exact=True).click()
        page.get_by_role('button',name='Save verification result',exact=True).click()
        page.get_by_text('Verification result saved.',exact=True).wait_for()
        assert page.locator('aside').get_by_role('link',name='Email',exact=True).count()==0
        page.get_by_role('tab',name='Contacts',exact=True).click()
        assert 'Hunter deliverability: risky' in page.locator('aside').inner_text()
        page.get_by_role('button',name='Find contacts',exact=True).click()
        page.get_by_role('button',name='Add selected contacts',exact=True).click()
        page.get_by_text('Contacts added',exact=True).wait_for()
        page.get_by_role('tab',name='Overview',exact=True).click()
        assert page.locator('#f-notes').input_value()=='Preserve contact lookup sales notes'
        page.get_by_role('tab',name='Email',exact=True).click()
        assert page.get_by_label('Prepared email body',exact=True).input_value()=='Edited by user; keep this draft.'
        page.get_by_role('tab',name='Overview',exact=True).click()
        score=page.locator('details').filter(has=page.locator('summary').filter(has_text='Research score'))
        if score.get_attribute('open') is None: score.locator('summary').click()
        assert '1/2' in page.locator('.bar').filter(has_text='Contactability').inner_text()
        page.get_by_role('button',name='Close details',exact=True).click()
        page.reload()
        page.get_by_role('tab',name='Leads',exact=True).click()
        page.get_by_role('button',name='=1+1 Fictional Chai',exact=True).click()
        page.get_by_role('tab',name='Overview',exact=True).click()
        assert page.locator('#f-notes').input_value()=='Preserve contact lookup sales notes'
        page.get_by_role('tab',name='Email',exact=True).click()
        assert page.get_by_label('Prepared email body',exact=True).input_value()=='Edited by user; keep this draft.'
        page.get_by_role('tab',name='Overview',exact=True).click()
        score=page.locator('details').filter(has=page.locator('summary').filter(has_text='Research score'))
        if score.get_attribute('open') is None: score.locator('summary').click()
        assert '1/2' in page.locator('.bar').filter(has_text='Contactability').inner_text()
        page.get_by_role('tab',name='Contacts',exact=True).click()
        assert page.locator('aside').get_by_text('Asha Test',exact=True).count()>=1
        page.get_by_role('button',name='Close details',exact=True).click()

        page.get_by_text('More',exact=True).click()
        with page.expect_download() as download:
            page.get_by_role('button',name='Export backup',exact=True).click()
        backup=settings_dir/'backup.json';download.value.save_as(backup)
        saved=json.loads(backup.read_text())
        assert saved['leads'][0]['outreach_draft']['emails'][0]['body']=='Edited by user; keep this draft.'
        assert saved['leads'][0]['contacts'][0]['delivery_check']['status']=='risky'
        assert 'fictional-test-key' not in backup.read_text()
        page.get_by_role('tab',name='Settings',exact=True).click()
        page.get_by_text('Advanced',exact=True).click()
        page.get_by_text('Local provider settings (optional)',exact=True).click()
        page.get_by_role('button',name='Remove Hunter key',exact=True).click()
        page.get_by_role('tab',name='Leads',exact=True).click()
        page.get_by_role('button',name='Find leads',exact=True).click()
        page.get_by_label('Research city').select_option('Noida, India')
        page.get_by_role('button',name='Start research',exact=True).click()
        page.get_by_role('button',name='Stop',exact=True).click()
        page.get_by_text('cancelled',exact=True).wait_for()
        page.get_by_role('tab',name='Settings',exact=True).click()
        page.get_by_role('button',name='Quit local service',exact=True).click()
        page.get_by_text('Local service stopped. Reopen Kirat Lead Desk.app to start again.',exact=True).wait_for()
        assert not errors,errors
        print('Local UI: settings, project stage, stale draft rejection, draft editing/backup/reload, verification review, contact lookup, cancellation and quit passed')
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=10)
    shutil.rmtree(settings_dir)
