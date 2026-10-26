'use strict';
const assert=require('node:assert/strict'),os=require('node:os'),path=require('node:path'),fs=require('node:fs');
const {createMail}=require('../lib/mail');
const {start}=require('../lib/local-server');
(async()=>{
 const calls=[];const mail=createMail({invoke:async(action,data)=>{calls.push({action,data});return action==='status'?{configured:false,items:[],inbound:[]}:data;},poll:false});
 const lead={...JSON.parse(fs.readFileSync(path.join(__dirname,'fixture-batch.json'))).leads[0],id:'mail-lead'};
 const port=48000+Math.floor(Math.random()*1000);const base='http://127.0.0.1:'+port;
 const server=start({port,mail,autoSetup:false,settingsPath:path.join(os.tmpdir(),'kirat-mail-unused-settings')});await new Promise(r=>server.once('listening',r));
 try {
  assert.equal((await fetch(base+'/api/mail/status')).status,401);
  const page=await fetch(base);const cookie=page.headers.get('set-cookie').split(';')[0];assert((await page.text()).includes('mail-panel.js'));
  const headers={Cookie:cookie,Origin:base,'Content-Type':'application/json','X-Kirat-Local':'1'};
  const post=(action,data)=>fetch(base+'/api/mail/'+action,{method:'POST',headers,body:JSON.stringify(data)});
  assert.equal((await fetch(base+'/api/mail/configure',{method:'POST',headers:{Cookie:cookie},body:'{}'})).status,403);
  assert.equal((await post('approve-all',{})).status,400);
  assert.equal((await post('stage',{lead,email:'invented@example.com',subject:'Hi',body:'Hello'})).status,400);
  assert.equal((await post('stage',{lead,email:lead.contacts[0].value,subject:'Hi',body:'Hello',risk_acknowledged:true})).status,200);
  const call=calls.at(-1);assert.equal(call.action,'stage');assert.equal(call.data.lead_id,'mail-lead');assert.equal(call.data.to_email,lead.contacts[0].value);assert.equal(call.data.source_url,lead.contacts[0].source_url);
  assert.equal((await post('configure',{password:'secret',host:'evil.example'})).status,400);
  assert.equal((await post('approve',{id:'x'})).status,400);
  assert.equal((await post('enable',{enabled:true})).status,400);
  assert.equal((await post('test-message',{email:'owner@example.com'})).status,200);assert.equal(calls.at(-1).data.test_message,true);
  assert.equal((await fetch(base+'/scripts/kirat_mail.py')).status,404);
  console.log('mail API: authenticated local routes, selected contact validation, revision guards and private assets passed');
 }finally{mail.stop();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
