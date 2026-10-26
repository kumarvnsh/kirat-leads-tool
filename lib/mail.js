'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path');
const K=require('../lead-core');
const root=path.resolve(__dirname,'..');
const EMAIL=/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;
function createMail({invoke,poll=true,startup=true}={}) {
 let stopped=false,child=null,chain=Promise.resolve(),busy=false,cached=null,timer=null,lastPresence=Date.now();
 function bridge(action,data) {
  return new Promise((resolve,reject)=>{
   child=spawn(path.join(root,'.local/venv/bin/python'),[path.join(root,'scripts/kirat_mail.py')],{cwd:root,stdio:['pipe','pipe','pipe']});
   const current=child;let out='';const timeout=setTimeout(()=>{current.kill('SIGTERM');reject(new Error('Mail operation timed out. Sending is held for review if its delivery is uncertain.'));},180000);
   current.stdout.on('data',c=>{out+=c;if(out.length>8*1024*1024)current.kill('SIGTERM');});current.stderr.resume();current.stdin.on('error',()=>{});
   current.once('error',()=>{clearTimeout(timeout);if(child===current)child=null;reject(new Error('Mail runtime is unavailable. Use Repair setup.'));});
   current.once('exit',()=>{clearTimeout(timeout);if(child===current)child=null;try{const r=JSON.parse(out);if(!r.ok)throw new Error(r.error||'Mail operation failed.');resolve(r.data);}catch(e){reject(new Error(e instanceof SyntaxError?'Mail operation interrupted. Check its status before retrying.':e.message));}});
   current.stdin.end(JSON.stringify({action,data}));
  });
 }
 function call(action,data={}) {
  if(stopped)return Promise.reject(new Error('Mail service stopped. Reopen the app.'));
  const task=chain.catch(()=>{}).then(async()=>{if(stopped)throw new Error('Mail service stopped. Reopen the app.');busy=true;try{const result=await (invoke||bridge)(action,data);if(result&&Array.isArray(result.items))cached=result;return result;}finally{busy=false;}});
  chain=task;return task;
 }
 function plain(v,name,max=15000){if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error('Invalid '+name);return v;}
 function checkEmail(v){if(typeof v!=='string'||v.length>254||!EMAIL.test(v))throw new Error('A valid single email address is required.');return v.toLowerCase();}
 function revision(d){plain(d.id,'email ID',200);if(!Number.isSafeInteger(d.revision)||d.revision<1)throw new Error('Review the current email revision.');}
 async function request(action,d={}) {
  if(!d||typeof d!=='object'||Array.isArray(d))throw new Error('Invalid mail request.');
  if(action==='status'){lastPresence=Date.now();if(busy&&cached)return {...cached,busy:true};return call('status');}
  if(action==='stage') {
   if(!d.lead||K.validateLead(d.lead,'backup').errors.length)throw new Error('Choose a valid saved lead.');
   const email=checkEmail(d.email),contact=d.lead.contacts.find(c=>c.type==='email'&&c.value.toLowerCase()===email);
   if(!contact)throw new Error('Choose a published email saved on this lead.');
   return call('stage',{lead_id:d.lead.id,lead_name:d.lead.company,to_email:email,source_url:contact.source_url,verification:contact.delivery_check?.status||'unknown',risk_acknowledged:d.risk_acknowledged===true,subject:plain(d.subject,'subject',200),body:plain(d.body,'body'),previous_id:d.previous_id||'',delay_days:d.delay_days||0,...(d.daily_key?{daily_key:plain(d.daily_key,'daily key',200)}:{})});
  }
  if(action==='test-message') return call('stage',{lead_id:'controlled-test',lead_name:'Controlled mailbox test',to_email:checkEmail(d.email),source_url:'https://kiratcreations.com',verification:'unknown',risk_acknowledged:true,test_message:true,subject:'Kirat Creations — mailbox setup test',body:'This is a controlled test of Kirat Lead Desk email sending and the company signature. Please check that the logo, website and contact details display correctly.'});
  if(action==='reply') {
   const state=await call('status'),incoming=state.inbound.find(m=>m.id===d.reply_id);
   if(!incoming||incoming.is_bounce)throw new Error('Choose a matched lead reply.');
   if(state.suppressed.some(s=>s.email===incoming.to_email))throw new Error('Recipient is suppressed.');
   return call('stage',{lead_id:incoming.lead_id,lead_name:'Conversation reply',to_email:incoming.to_email,source_url:'https://kiratcreations.com',verification:'unknown',risk_acknowledged:true,reply_id:incoming.id,subject:plain(d.subject,'subject',200),body:plain(d.body,'body')});
  }
  if(action==='configure') {
   if(Object.keys(d).some(k=>!['password','sender_name','sent_folder'].includes(k)))throw new Error('Unknown mailbox setting.');
   if('password'in d)plain(d.password,'mailbox password',1000);
  } else if(['approve','edit','reject','preview','reconcile'].includes(action)) {
   revision(d);if(action==='edit'){plain(d.subject,'subject',200);plain(d.body,'body');}
  } else if(action==='enable') {
   if(typeof d.enabled!=='boolean'||(d.enabled&&d.readiness_confirmed!==true))throw new Error('Confirm mailbox readiness before enabling sending.');
  } else if(action==='incoming'){plain(d.id,'reply ID',200);return call('incoming',d);
  } else if(action==='match-reply'){plain(d.id,'reply ID',200);plain(d.lead_id,'lead ID',200);return call('match_reply',d);
  } else if(action==='suppress')checkEmail(d.email);
  else if(!['disconnect','test','sync'].includes(action))throw new Error('Unknown mail operation.');
  return call(action,d);
 }
 if(!invoke&&startup)call('startup').catch(()=>{});
 if(poll){timer=setInterval(()=>{if(!busy&&!stopped)call(Date.now()-lastPresence>15000?'startup':'tick').catch(()=>{});},30000);timer.unref();}
 return {request,stop(){stopped=true;clearInterval(timer);if(child)child.kill('SIGTERM');},async pause(){await call('enable',{enabled:false});},get busy(){return busy;}};
}
module.exports={createMail};
