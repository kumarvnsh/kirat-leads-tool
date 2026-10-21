'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const R=require('./research'),K=require('../lead-core');
const {normalizeContacts,contactPrompt,mergeContacts}=require('./contacts');
const root=path.resolve(__dirname,'..');
function python(mode,input) {
 const runtime=path.join(root,'.local/venv/bin/python');
 if(!fs.existsSync(runtime))throw new Error('Harvey setup is missing. Choose Repair setup first.');
 const r=spawnSync(runtime,[path.join(root,'scripts/harvey-contacts.py'),path.join(root,'.local/harvey'),mode],{input:JSON.stringify(input),encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
 if(r.status!==0)throw new Error(r.error?.message||r.stderr?.slice(-1800)||'Public website lookup failed');
 return JSON.parse(r.stdout);
}
function run(input) {
 const lead=input.lead;let collected={contacts:[],pages_opened:0},notes=[];
 console.log('Harvey Scout: opening public company, contact and team pages. No address guessing or paid lookup.');
 try {collected=python('collect',lead);console.log('Harvey opened '+collected.pages_opened+' page(s) and found '+collected.contacts.length+' public contact candidate(s).');}
 catch(e){notes.push('Website collection unavailable.');console.log(e.message);}
 let candidates=normalizeContacts(collected);
 try {
   const prompt=contactPrompt(lead,collected);
   R.atomicWrite(path.join(root,'.local/contact-prompt.txt'),prompt);
   const text=require('./codex-research').runCodex(prompt);
   candidates=normalizeContacts(JSON.parse(text));
 } catch(e) {
   notes.push('Named-person web search did not complete; showing public website results only.');
   console.log('People search: '+e.message);
 }
 console.log('Checking each proposed contact against its public source and ownership evidence.');
 const websiteContacts=normalizeContacts(collected).contacts;
 R.atomicWrite(path.join(root,'.local/jobs',input.id+'.contact-candidates.json'),JSON.stringify(candidates,null,2));
 const attested=python('attest',{contacts:[...candidates.contacts,...websiteContacts].slice(0,24)});
 const normalized=normalizeContacts({contacts:mergeContacts([],attested.contacts).slice(0,12),note:candidates.note});
 const people=normalized.contacts.filter(c=>c.type==='person').length;
 const direct=normalized.contacts.filter(c=>c.scope==='direct').length;
 const summary=people+' named professional(s), '+direct+' directly associated work channel(s), '+normalized.contacts.filter(c=>c.scope==='company').length+' general company channel(s). '+(!direct?'No direct work email or phone was established. ':'');
 const result={...normalized,target_id:lead.id,target_key:K.dupKey(lead),company:lead.company,methods:['Harvey Scout public-site collection','Codex public web research','Harvey public HTTP source check'],rejected:attested.rejected,note:[summary,...notes,attested.rejected.length?attested.rejected.length+' unsupported or inaccessible contact(s) excluded.':''].filter(Boolean).join(' ')};
 R.atomicWrite(path.join(root,'.local/jobs',input.id+'.contacts.json'),JSON.stringify(result,null,2));
 R.atomicWrite(path.join(root,'.local/last-contact-result.json'),JSON.stringify(result,null,2));
 console.log(result.contacts.length+' publicly sourced contact(s) ready for review. Email deliverability has not been verified.');
}
module.exports={run};
