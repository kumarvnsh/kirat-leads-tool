"""Daily review integration with fictional sources; no real models or transport."""
import json, os, subprocess, tempfile, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]; directory=Path(tempfile.mkdtemp(prefix='daily-ui-'))
code=r"""
const fs=require('node:fs'),path=require('node:path');
const mail={request:async(action,data)=>action==='status'?{items:[],suppressed:[],profile:{sender_name:'Business Development Team'},config:{host:'fictional.example'},settings:{},inbound:[]}:{id:'fictional-pending-item'},stop(){},pause:async()=>{}};
const lead=JSON.parse(fs.readFileSync('test/fixture-batch.json')).leads[0];
const draft={generated_on:'2026-10-23',emails:[1,2,3].map(i=>({subject:'Fictional inquiry '+i,body:'Hello team, may Kirat share relevant signage work?'}))};
const daily=require('./lib/daily').createDaily({directory:process.argv[1],mail,worker:async()=>({leads:[{lead,draft}]})});
require('./lib/local-server').start({port:4177,autoSetup:false,mail,daily});
"""
server=subprocess.Popen(['node','-e',code,str(directory)],cwd=root,stdout=subprocess.PIPE,text=True)
try:
 assert 'Kirat app' in server.stdout.readline()
 with sync_playwright() as p:
  browser=p.chromium.launch(channel=os.environ.get('KIRAT_BROWSER_CHANNEL','chrome'),headless=True)
  page=browser.new_page();page.add_init_script("window.KiratNative=true;window.openedEmails=[];window.addEventListener('kirat-open-email',e=>window.openedEmails.push(e.detail.id));");errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:4177');page.wait_for_timeout(1500);assert not errors,errors;panel=page.get_by_role('region',name='Today',exact=True)
  # Native catchup may already complete; only prepare if a run is still needed.
  prepare=panel.get_by_role('button',name='Prepare today’s batch',exact=True)
  if prepare.is_visible(): prepare.click()
  card=panel.get_by_role('article',name='Daily lead =1+1 Fictional Chai',exact=True);card.wait_for()
  panel.get_by_text('Complete — review today’s leads below.',exact=True).wait_for()
  assert prepare.count()==0
  card.get_by_role('button',name='Review email',exact=True).click()
  card.get_by_text('Initial inquiry: Fictional inquiry 1',exact=True).wait_for()
  page.get_by_role('tab',name='Settings',exact=True).click()
  page.get_by_role('region',name='Daily preparation settings',exact=True).get_by_role('button',name='Pause daily preparation',exact=True).wait_for()
  page.get_by_role('tab',name='Today',exact=True).click()
  stage=card.get_by_role('button',name='Move initial email to Emails review',exact=True)
  assert stage.is_disabled()
  card.get_by_role('checkbox').check();stage.click()
  page.get_by_role('tab',name='Emails',exact=True).wait_for()
  page.wait_for_function("document.querySelector('[role=tab][aria-selected=true]')?.textContent.includes('Emails')")
  page.get_by_role('tab',name='Today',exact=True).click()
  card.get_by_role('button',name='Go to Emails',exact=True).wait_for()
  assert page.evaluate('window.openedEmails')==['fictional-pending-item'],page.evaluate('window.openedEmails')
  card.get_by_role('button',name='Go to Emails',exact=True).click()
  page.wait_for_function('window.openedEmails.length===2')
  assert page.evaluate('window.openedEmails')==['fictional-pending-item','fictional-pending-item']
  page.get_by_role('tab',name='Leads',exact=True).click()
  page.wait_for_timeout(6000)
  assert page.get_by_role('button',name='=1+1 Fictional Chai',exact=True).count()==1
  # Preserve local sales edits when mirror refreshes, and never resurrect a deleted acknowledged card.
  page.get_by_role('button',name='=1+1 Fictional Chai',exact=True).click()
  page.locator('#f-notes').fill('Private sales note kept through daily sync')
  page.get_by_role('button',name='Close details',exact=True).click()
  page.reload();panel=page.get_by_role('region',name='Today',exact=True)
  panel.get_by_role('button',name='Go to Emails',exact=True).wait_for()
  page.get_by_role('tab',name='Leads',exact=True).click()
  assert page.get_by_role('button',name='=1+1 Fictional Chai',exact=True).count()==1
  page.get_by_role('button',name='=1+1 Fictional Chai',exact=True).click()
  page.wait_for_timeout(1000);assert not errors,errors
  assert page.locator('#f-notes').input_value()=='Private sales note kept through daily sync'
  page.get_by_role('button',name='Delete…',exact=True).click()
  page.get_by_role('button',name='Delete lead',exact=True).click()
  page.wait_for_timeout(6000)
  assert page.get_by_role('button',name='=1+1 Fictional Chai',exact=True).count()==0
  # Static browser cannot mirror its register into native storage.
  result=page.evaluate("""async()=>{const r=await fetch('/api/daily/sync',{method:'POST',headers:{'Content-Type':'application/json','X-Kirat-Local':'1'},body:'{}'});return r.status;}""")
  assert result==403
  assert not errors,errors
  browser.close()
 print('daily browser: native additions persisted, risk acknowledgement, draft preview, pending-only stage and nonnative sync rejection passed')
finally:
 server.terminate();server.wait(timeout=10);shutil.rmtree(directory)
