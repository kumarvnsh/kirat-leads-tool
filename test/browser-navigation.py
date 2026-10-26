"""Navigation regression using fictional sources and queue; no external messages."""
import os, subprocess, tempfile, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];directory=Path(tempfile.mkdtemp(prefix='kirat-navigation-'))
code=r"""
const path=require('node:path'),{spawn}=require('node:child_process');
const mail=require('./lib/mail').createMail({poll:false,invoke:(action,data)=>new Promise((resolve,reject)=>{const p=spawn(path.resolve('.local/venv/bin/python'),['test/fake-mail-worker.py',process.argv[1]]);let out='';p.stdout.on('data',c=>out+=c);p.stderr.pipe(process.stderr);p.on('close',()=>{try{const r=JSON.parse(out);r.ok?resolve(r.data):reject(new Error(r.error));}catch(e){reject(e);}});p.stdin.end(JSON.stringify({action,data}));})});
require('./lib/local-server').start({port:4178,autoSetup:false,mail,jobs:require('./lib/local-jobs').createJobs({worker:path.resolve('test/fake-worker.js')})});
"""
server=subprocess.Popen(['node','-e',code,str(directory)],cwd=root,stdout=subprocess.PIPE,text=True)
try:
 assert 'Kirat app' in server.stdout.readline()
 with sync_playwright() as p:
  browser=p.chromium.launch(channel=os.environ.get('KIRAT_BROWSER_CHANNEL','chrome'),headless=True)
  page=browser.new_page(viewport={'width':1280,'height':860});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:4178');page.set_default_timeout(5000)
  tabs=page.get_by_role('tablist',name='Main navigation',exact=True)
  assert tabs.get_by_role('tab').count()==5
  assert tabs.get_by_role('tab',name='Today',exact=True).get_attribute('aria-selected')=='true'
  for name in ['Leads','Emails','Replies','Settings','Today']:
   tabs.get_by_role('tab',name=name,exact=True).click()
   assert tabs.get_by_role('tab',name=name,exact=True).get_attribute('aria-selected')=='true'
   assert page.get_by_role('tabpanel').count()==1
  tabs.get_by_role('tab',name='Today',exact=True).focus();page.keyboard.press('ArrowRight')
  assert tabs.get_by_role('tab',name='Leads',exact=True).get_attribute('aria-selected')=='true'
  page.get_by_role('button',name='Find leads',exact=True).click()
  page.get_by_role('button',name='Start research',exact=True).click()
  page.get_by_role('button',name='Review 1 researched lead(s)',exact=True).click()
  page.get_by_role('button',name='Import 1 lead(s)',exact=True).click()
  page.get_by_role('button',name='=1+1 Fictional Chai',exact=True).click()
  page.get_by_role('tab',name='Contacts',exact=True).click()
  assert page.get_by_role('button',name='Find contacts',exact=True).is_visible()
  page.get_by_role('tab',name='Overview',exact=True).click()
  page.locator('#f-notes').fill('Keep this sales note')
  page.get_by_role('tab',name='Email',exact=True).click()
  assert page.get_by_role('region',name='Lead quality tools',exact=True).is_visible()
  page.get_by_label('Prepared email subject',exact=True).fill('Keep my unqueued subject')
  page.get_by_label('Prepared email body',exact=True).fill('Keep my unqueued draft')
  page.get_by_label('I reviewed this published contact',exact=False).check()
  tabs.get_by_role('tab',name='Replies',exact=True).click()
  tabs.get_by_role('tab',name='Leads',exact=True).click()
  assert page.get_by_label('Prepared email body',exact=True).input_value()=='Keep my unqueued draft'
  assert page.get_by_label('I reviewed this published contact',exact=False).is_checked()
  page.get_by_role('button',name='Close details',exact=True).click()
  tabs.get_by_role('tab',name='Settings',exact=True).click()
  page.get_by_role('region',name='Email settings',exact=True).wait_for()
  assert page.get_by_role('button',name='Find leads',exact=True).count()==0
  tabs.get_by_role('tab',name='Leads',exact=True).click()
  page.get_by_role('button',name='=1+1 Fictional Chai',exact=True).click()
  assert page.locator('#f-notes').input_value()=='Keep this sales note'
  page.get_by_role('button',name='Close details',exact=True).click()
  page.set_viewport_size({'width':740,'height':900})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  browser.close()
 print('navigation: five tabs, keyboard, focused research/detail, sales persistence and narrow layout passed')
finally:
 server.terminate();server.wait(timeout=10);shutil.rmtree(directory)
