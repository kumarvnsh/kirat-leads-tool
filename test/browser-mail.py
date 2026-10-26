"""Email UI checks backed by real queue and a fictional transport."""
import json, os, shutil, subprocess, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]; directory=Path(tempfile.mkdtemp(prefix='kirat-mail-ui-'))
code="""
const {spawn}=require('node:child_process');
const path=require('node:path');
const mail=require('./lib/mail').createMail({poll:false,invoke:(action,data)=>new Promise((resolve,reject)=>{
 const p=spawn(path.resolve('.local/venv/bin/python'),['test/fake-mail-worker.py',process.argv[1]]);let out='';p.stdout.on('data',c=>out+=c);p.stderr.pipe(process.stderr);p.on('close',()=>{try{const r=JSON.parse(out);if(!r.ok)reject(new Error(r.error));else resolve(r.data);}catch(e){reject(e);}});p.stdin.end(JSON.stringify({action,data}));
})});
require('./lib/local-server').start({port:4175,autoSetup:false,mail,jobs:require('./lib/local-jobs').createJobs({worker:path.resolve('test/fake-worker.js')})});
"""
server=subprocess.Popen(['node','-e',code,str(directory)],cwd=root,stdout=subprocess.PIPE,text=True)
try:
    assert 'Kirat app' in server.stdout.readline()
    with sync_playwright() as p:
        browser=p.chromium.launch(channel=os.environ.get('KIRAT_BROWSER_CHANNEL','chrome'),headless=True)
        page=browser.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:4175')
        for name in ['Today','Leads','Emails','Replies','Settings']:
            page.get_by_role('tab',name=name,exact=True).wait_for()
        # A composer can mount before contact research adds its first recipient.
        page.evaluate("""()=>{
          const host=document.createElement('div');host.id='mail-contact-fixture';document.body.append(host);
          window.contactFixtureRoot=ReactDOM.createRoot(host);
          window.contactFixtureLead={id:'contact-fixture',company:'Fictional first contact',contacts:[]};
          window.renderContactFixture=()=>contactFixtureRoot.render(React.createElement(KiratMailProvider,null,React.createElement(KiratMailLeadPanel,{lead:contactFixtureLead})));
          renderContactFixture();
        }""")
        fixture=page.locator('#mail-contact-fixture')
        fixture.get_by_text('Add a published business email contact first.',exact=True).wait_for()
        page.evaluate("""()=>{contactFixtureLead={...contactFixtureLead,contacts:[{type:'email',value:'first@example.com',source_url:'https://example.com/contact'}]};renderContactFixture();}""")
        page.wait_for_timeout(100)
        assert not errors,errors
        fixture.locator('select').first.wait_for(timeout=3000)
        assert fixture.locator('select').first.input_value()=='first@example.com'
        fixture.get_by_label('Prepared email subject',exact=True).fill('Fictional first contact')
        fixture.get_by_label('Prepared email body',exact=True).fill('Keep this unsaved draft.')
        assert fixture.get_by_role('button',name='Queue this email for review',exact=True).is_disabled()
        fixture.get_by_label('I reviewed this published contact',exact=False).check()
        page.route('**/api/mail/stage',lambda route:route.fulfill(status=200,content_type='application/json',body='{"id":"fixture-only"}'))
        with page.expect_request('**/api/mail/stage') as staged:
            fixture.get_by_role('button',name='Queue this email for review',exact=True).click()
        assert staged.value.post_data_json['email']=='first@example.com'
        page.unroute('**/api/mail/stage')
        page.evaluate("""()=>{contactFixtureLead={...contactFixtureLead,contacts:[{type:'email',value:'replacement@example.com',source_url:'https://example.com/contact'}]};renderContactFixture();}""")
        page.wait_for_function("()=>document.querySelector('#mail-contact-fixture select').value==='replacement@example.com'")
        page.wait_for_function("()=>!document.querySelector('#mail-contact-fixture input[type=checkbox]').checked")
        assert not fixture.get_by_label('I reviewed this published contact',exact=False).is_checked()
        assert fixture.get_by_label('Prepared email body',exact=True).input_value()=='Keep this unsaved draft.'
        # Applying a confirmed replacement updates the composer; opening confirmation alone does not.
        page.evaluate('''()=>{contactFixtureLead={...contactFixtureLead,outreach_draft:{emails:[{subject:'Confirmed replacement',body:'Explicitly accepted replacement body.'}]}};renderContactFixture();}''' )
        page.wait_for_function("()=>document.querySelector('#mail-contact-fixture textarea').value==='Explicitly accepted replacement body.'",timeout=3000)
        page.evaluate("()=>{contactFixtureRoot.unmount();document.getElementById('mail-contact-fixture').remove();}")
        page.get_by_role('tab',name='Settings',exact=True).click()
        panel=page.get_by_role('region',name='Email settings',exact=True)
        page.get_by_role('button',name='Sending paused',exact=True).wait_for()
        panel.locator('summary').filter(has_text='Mailbox setup').click()
        panel.get_by_label('Mailbox password',exact=True).fill('fictional-local-only-password')
        panel.get_by_role('button',name='Save mailbox settings',exact=True).click()
        panel.get_by_text('Saved in Keychain.',exact=False).wait_for()
        assert panel.get_by_label('Mailbox password',exact=True).input_value()==''
        panel.get_by_role('button',name='Test connection without sending',exact=True).click()
        panel.get_by_text('SMTP and IMAP login verified. No email was sent.',exact=True).wait_for()
        panel.get_by_text('Controlled test and sending readiness',exact=True).click()
        panel.get_by_label('Controlled test recipient',exact=True).fill('owner@example.com')
        panel.get_by_role('button',name='Queue controlled test for approval',exact=True).click()
        page.get_by_role('tab',name='Emails',exact=True).click()
        panel=page.get_by_role('region',name='Emails',exact=True)
        page.get_by_role('button',name='Open email to owner@example.com',exact=True).click()
        item=panel.get_by_role('article',name='Email to owner@example.com',exact=True)
        page.get_by_role('button',name='Needs approval',exact=True).click()
        item.get_by_text('pending review',exact=True).wait_for()
        assert item.get_by_role('button',name='Approve this email',exact=True).is_disabled()
        item.get_by_role('button',name='Preview complete email',exact=True).click()
        frame=item.locator('iframe');frame.wait_for()
        assert 'cid:kirat-logo' not in frame.get_attribute('srcdoc')
        assert 'data:image/png;base64,' in frame.get_attribute('srcdoc')
        assert 'https://kiratcreations.com' in frame.get_attribute('srcdoc')
        item.get_by_role('button',name='Approve this email',exact=True).click()
        page.get_by_role('button',name='Scheduled',exact=True).click()
        item.get_by_text('approved',exact=True).wait_for()
        item.get_by_label('Queued email body',exact=True).fill('Edited controlled test body.')
        page.get_by_role('button',name='Sent',exact=True).click()
        page.get_by_role('button',name='Scheduled',exact=True).click()
        assert item.get_by_label('Queued email body',exact=True).input_value()=='Edited controlled test body.'
        page.get_by_role('tab',name='Replies',exact=True).click()
        page.get_by_role('tab',name='Settings',exact=True).click()
        page.get_by_role('tab',name='Emails',exact=True).click()
        assert item.get_by_label('Queued email body',exact=True).input_value()=='Edited controlled test body.'
        item.get_by_role('button',name='Save queued email edits',exact=True).click()
        page.get_by_role('button',name='Needs approval',exact=True).click()
        item.get_by_text('pending review',exact=True).wait_for()
        assert item.get_by_role('button',name='Approve this email',exact=True).is_disabled()
        item.get_by_role('button',name='Preview complete email',exact=True).click()
        page.wait_for_function("()=>Array.from(document.querySelectorAll('iframe')).some(f=>(f.srcdoc||'').includes('Edited controlled test body.'))")
        item.get_by_role('button',name='Approve this email',exact=True).click()
        page.get_by_role('button',name='Scheduled',exact=True).click()
        item.get_by_text('approved',exact=True).wait_for()
        page.get_by_role('tab',name='Settings',exact=True).click()
        page.get_by_role('button',name='Enable approved test only',exact=True).click()
        page.get_by_role('tab',name='Emails',exact=True).click()
        page.get_by_role('button',name='Sent',exact=True).click()
        item.get_by_text('sent',exact=True).wait_for()
        page.get_by_role('button',name='Sending paused',exact=True).wait_for()
        # Source-backed fictional lead imports through the existing review workflow.
        page.get_by_role('tab',name='Leads',exact=True).click()
        page.get_by_role('button',name='Find leads',exact=True).click()
        page.get_by_role('button',name='Start research',exact=True).click()
        page.get_by_role('button',name='Review 1 researched lead(s)',exact=True).click()
        page.get_by_role('button',name='Import 1 lead(s)',exact=True).click()
        page.get_by_role('button',name='=1+1 Fictional Chai',exact=True).click()
        page.get_by_role('tab',name='Email',exact=True).click()
        page.get_by_role('button',name='Draft outreach',exact=True).click()
        page.get_by_role('button',name='Save generated drafts',exact=True).click()
        lead=page.get_by_role('region',name='Prepare email to lead',exact=True)
        lead.get_by_role('button',name='Use initial draft',exact=True).click()
        lead.get_by_label('I reviewed this published contact',exact=False).check()
        lead.get_by_role('button',name='Queue this email for review',exact=True).click()
        page.get_by_role('tab',name='Emails',exact=True).wait_for()
        page.get_by_role('tab',name='Emails',exact=True).click()
        page.get_by_role('button',name='Needs approval',exact=True).click()
        page.get_by_role('button',name='Open email to hello@chai.example',exact=True).click()
        queue=panel.get_by_role('article',name='Email to hello@chai.example',exact=True)
        queue.get_by_text('pending review',exact=True).wait_for()
        # Open an exact queued message even while a different segment is selected.
        queue_id=page.evaluate("async()=>{const s=await (await fetch('/api/mail/status')).json();return s.items.find(i=>i.to_email==='hello@chai.example').id;}")
        queue.get_by_label('Queued email body',exact=True).fill('Unsaved exact-message route draft.')
        page.get_by_role('button',name='Sent',exact=True).click()
        page.evaluate("id=>window.dispatchEvent(new CustomEvent('kirat-open-email',{detail:{id}}))",queue_id)
        queue.get_by_text('pending review',exact=True).wait_for(timeout=3000)
        assert queue.get_by_label('Queued email body',exact=True).input_value()=='Unsaved exact-message route draft.'
        assert not errors,errors
        page.screenshot(path=str(directory/'mail-ui.png'),full_page=True)
        print('Mail UI: Keychain setup form, connection test, exact signature preview, individual approval, edit invalidation, retained edits across segments/tabs, controlled test and saved-lead staging passed')
        browser.close()
finally:
    server.terminate();server.wait(timeout=10);shutil.rmtree(directory)
