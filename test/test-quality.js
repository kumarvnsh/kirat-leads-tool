'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const P=require('../lib/providers'),K=require('../lead-core'),O=require('../lib/outreach');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kirat-providers-')),file=path.join(dir,'settings.json');
 try {
  assert.deepEqual(P.settingsStatus(file),{serper:false,hunter:false});
  P.saveSettings({serper:'secret-serper',hunter:'secret-hunter'},file);
  assert.equal(fs.statSync(file).mode&0o777,0o600);
  assert.deepEqual(P.settingsStatus(file),{serper:true,hunter:true});
  assert(!JSON.stringify(P.settingsStatus(file)).includes('secret'));
  P.saveSettings({hunter:''},file);assert.equal(P.settingsStatus(file).hunter,false);
  assert.throws(()=>P.saveSettings({serper:'bad\nkey'},file),/credential/i);
  assert.throws(()=>P.saveSettings({other:'x'},file),/setting/i);
  const request=async(url,options)=>{assert(!url.includes('secret'));assert.equal(options.headers['X-API-KEY'],'secret-hunter');return {data:{email:'work@example.com',status:'valid',result:'deliverable',accept_all:false}};};
  const result=await P.verifyEmail('work@example.com','secret-hunter',request);
  assert.equal(result.status,'deliverable');assert.equal(result.provider,'Hunter');
  const catchall=await P.verifyEmail('work@example.com','x',async()=>({data:{status:'valid',result:'deliverable',accept_all:true}}));
  assert.equal(catchall.status,'risky');
  for(const [status,expected] of [['invalid','undeliverable'],['accept_all','risky'],['unknown','unknown'],['pending','pending']]) {
   assert.equal((await P.verifyEmail('work@example.com','x',async()=>({data:{status}}))).status,expected);
  }
  await assert.rejects(()=>P.verifyEmail('bad','x',request),/email/i);
  await assert.rejects(()=>P.verifyEmail('work@example.com','',request),/Hunter/);
  await assert.rejects(()=>P.verifyEmail('work@example.com','x',async()=>({oops:'x'})),/response/i);
  let calls=0;
  const candidates=await P.discover('Noida, India','key',async(url,options)=>{calls++;assert.equal(url,'https://google.serper.dev/search');assert.equal(JSON.parse(options.body).gl,'in');return {organic:[{title:'Retail plan',link:'https://example.com/news',snippet:'Opening soon'},{title:'bad',link:'file:///tmp/x'}]};});
  assert.equal(calls,5);assert.equal(candidates.length,1);assert.equal(candidates[0].qualified,false);
  const rss='<rss><item><title>Brand opens &amp; expands - Retail News</title><link>https://news.google.com/rss/articles/abc</link><pubDate>Mon, 28 Sep 2026</pubDate><source url="https://x.example">Retail News</source></item><item><title>bad</title><link>javascript:alert(1)</link></item></rss>';
  const gemDocs={response:{response:{docs:[{id:'101',b_bid_number:['GEM/2026/B/1'],bd_category_name:['Signage Board'],ba_official_details_deptName:['Delhi Metro'],final_end_date_sort:['2026-11-16T12:00:00Z']},{id:'../x'}]}}};
  const free=async(url,options={})=>{
    if(url.startsWith('https://news.google.com/rss/search?'))return {text:rss,cookies:[]};
    if(url==='https://bidplus.gem.gov.in/all-bids')return {text:'csrf_bd_gem_nk=abc123&x',cookies:['ci_session=s1; path=/']};
    assert.equal(url,'https://bidplus.gem.gov.in/all-bids-data');assert.equal(options.headers.cookie,'ci_session=s1');
    const body=new URLSearchParams(options.body);assert.equal(body.get('csrf_bd_gem_nk'),'abc123');assert(JSON.parse(body.get('payload')).param.searchBid);
    return {text:JSON.stringify(gemDocs),cookies:[]};
  };
  const news=await P.newsSignals('Gurugram, India',free);
  assert.equal(news.length,1);assert.equal(news[0].title,'Brand opens & expands - Retail News');assert.equal(news[0].source,'Google News');
  const tenders=await P.tenderSignals(free);
  assert.equal(tenders.length,1);assert.equal(tenders[0].source_url,'https://bidplus.gem.gov.in/showbidDocument/101');assert(tenders[0].notes.includes('closes 2026-11-16'));
  const logs=[],partial=await P.freeSignals('Noida, India',async url=>{if(url.includes('gem.gov.in'))throw new Error('down');return free(url);},m=>logs.push(m));
  assert.equal(partial.length,1);assert(logs.some(m=>m.includes('GeM tenders unavailable')));
  const lead={...JSON.parse(fs.readFileSync(path.join(__dirname,'fixture-batch.json'))).leads[0],id:'quality-test'};
  const stage={stage:'planned',source_url:lead.evidence[0].url,checked_on:'2026-10-21',reason:'Announced for next year; procurement unknown.'};
  const draft={generated_on:'2026-10-21',emails:[{subject:'Signage enquiry',body:'Hello team, can we share our services?'},{subject:'Following up',body:'May I contact your projects team?'},{subject:'Closing the loop',body:'Happy to reconnect if relevant.'}]};
  const checked=K.validateLead({...lead,project_stage:stage,outreach_draft:draft},'backup');assert.deepEqual(checked.errors,[]);
  assert.deepEqual(checked.lead.outreach_draft,draft);assert.equal(checked.lead.project_stage.stage,'planned');
  assert(K.validateLead({...lead,project_stage:{...stage,stage:'guessed'}},'backup').errors.length);
  assert(K.validateLead({...lead,project_stage:{...stage,source_url:'https://unrelated.example/'}},'backup').errors.length);
  assert(K.validateLead({...lead,outreach_draft:{...draft,emails:[]}},'backup').errors.length);
  assert.equal(K.priorityRank({...lead,project_stage:stage}),0);assert.equal(K.priorityRank(lead),2);
  assert.equal(K.contactability([{type:'person'}, {type:'email',delivery_check:{status:'undeliverable'}}]),1);
  assert.equal(K.mergeLead({...lead,outreach_draft:draft},{...lead,project_stage:stage},false).outreach_draft.emails[0].subject,draft.emails[0].subject);
  const backup=K.parseEnvelope(K.backupJson([{...checked.lead,contacts:[]}])).rows[0];assert.deepEqual(backup.errors,[]);assert.equal(backup.lead.outreach_draft.emails.length,3);
  assert.deepEqual(O.validateDraft(JSON.stringify(draft)),draft);
  assert.throws(()=>O.validateDraft('{"emails":[]}'),/draft/i);
  assert.notEqual(K.draftSourceKey(lead),K.draftSourceKey({...lead,evidence:[{...lead.evidence[0],summary:'Updated project facts'}]}));
  assert.equal(K.draftSourceKey(lead),K.draftSourceKey({...lead,notes:'Sales edit'}));
  const intro='Kirat Creations provides signage, graphics, display units and turnkey solutions.';
  const oldBody='Hello Team,\n\nKirat Creations provides signage, graphics, display units, installation and maintenance.\n\nCould display units or installation support be relevant to your published store?';
  const corrected=K.correctEmailServices(oldBody);
  assert(corrected.includes(intro));assert(!/installation|maintenance/i.test(corrected));assert(corrected.includes('Could display units be relevant'));
  assert.equal(K.correctEmailServices(corrected),corrected);assert.equal(K.correctEmailServices('My saved custom note.'),'My saved custom note.');
  assert(O.draftPrompt(lead).includes(intro));assert(O.draftPrompt(lead).includes('Do not offer installation or maintenance'));
  const prompt=O.draftPrompt(lead);assert(prompt.includes('untrusted'));assert(prompt.includes('Do not send'));assert(!prompt.includes('secret-hunter'));
  assert.deepEqual(K.mergeLead(lead,{...lead,outreach_draft:draft},false).outreach_draft,draft);
  const c={type:'email',value:'work@example.com',source_url:'https://example.com/contact',verification:'published_only',delivery_check:result};
  assert.equal(K.mergeLead({...lead,contacts:[{...c,delivery_check:undefined}]},{...lead,contacts:[c]},false).contacts[0].delivery_check.status,'deliverable');
  const round=K.validateLead({...lead,contacts:[c]},'backup');assert.deepEqual(round.errors,[]);assert.equal(round.lead.contacts[0].delivery_check.status,'deliverable');assert.equal(round.lead.contacts[0].verification,'published_only');
  assert(K.validateLead({...lead,contacts:[{...c,delivery_check:{...result,status:'sure'}}]},'backup').errors.length);
  const originalFetch=global.fetch;
  try {
    global.fetch=async()=>{throw new Error('request included secret-hunter');};
    await assert.rejects(()=>P.requestJSON('https://api.hunter.io',{}),e=>!e.message.includes('secret-hunter'));
    global.fetch=async()=>({status:202});
    assert.equal((await P.requestJSON('https://api.hunter.io',{})).data.status,'pending');
    global.fetch=async()=>({status:429,ok:false});
    await assert.rejects(()=>P.requestJSON('https://api.hunter.io',{}),/quota/);
    await assert.rejects(()=>P.verifyEmail('work@example.com','secret',async()=>{throw new Error('secret');}),e=>!e.message.includes('secret'));
    await assert.rejects(()=>P.verifyEmail('work@example.com','key',async()=>({data:{email:'different@example.com',status:'valid'}})),/response/);
  } finally {global.fetch=originalFetch;}
  console.log('quality: settings, providers, project stages, drafts and delivery evidence passed');
 }finally {fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
