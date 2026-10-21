'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
const {createJobs}=require('../lib/local-jobs');
const {start}=require('../lib/local-server');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const jobs=createJobs({worker:path.join(__dirname,'fake-worker.js'),timeout:2000});
 const port=53000+Math.floor(Math.random()*5000),base='http://127.0.0.1:'+port;
 const server=start({port,jobs,autoSetup:false});await new Promise(r=>server.once('listening',r));
 try {
  assert.equal((await fetch(base+'/api/status')).status,401);
  const root=await fetch(base);const cookie=root.headers.get('set-cookie').split(';')[0];assert(root.headers.get('set-cookie').includes('HttpOnly'));
  const app=await root.text();assert(app.includes('src="local-panel.js"'));
  assert.equal((await fetch(base+'/api/status',{headers:{Cookie:cookie,Origin:'https://evil.example'}})).status,403);
  assert.equal((await fetch(base+'/api/job',{method:'POST',headers:{Cookie:cookie},body:'{}'})).status,403);
  const headers={Cookie:cookie,Origin:base,'X-Kirat-Local':'1','Content-Type':'application/json'};
  const post=(route,input)=>fetch(base+'/api/'+route,{method:'POST',headers,body:JSON.stringify(input)});
  assert.equal((await post('job',{kind:'exec'})).status,400);
  assert.equal((await post('job',{kind:'research',register:{leads:[{}]}})).status,400);
  assert.equal((await post('job',{kind:'discover',city:'Noida, India'})).status,200);
  assert.equal((await post('job',{kind:'setup'})).status,400);
  assert.equal((await post('stop',{})).status,200);assert.equal(jobs.snapshot().status,'cancelled');
  await sleep(100);
  assert.equal((await post('job',{kind:'research',register:{schema_version:1,batch_date:'2026-10-21',leads:[]}})).status,200);
  for(let i=0;i<30&&jobs.snapshot().status==='running';i++)await sleep(50);
  assert.equal(jobs.snapshot().status,'complete');assert.equal(jobs.snapshot().batch.leads.length,1);
  require('node:fs').rmSync(path.join(__dirname,'../.local/jobs',jobs.snapshot().id+'.json'),{force:true});
  assert.equal((await fetch(base+'/.local/candidates.json')).status,404);
  const invalid=await new Promise((resolve,reject)=>http.get(base,{headers:{Host:'evil.example'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject));assert.equal(invalid,403);
  console.log('local app: authentication, CSRF, fixed operations, register validation, busy jobs, cancellation and research result passed');
 }finally {jobs.stop();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
