'use strict';
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const path = require('node:path');
(async () => {
  const port = 42000 + Math.floor(Math.random()*10000);
  const child = spawn(process.execPath,[path.join(__dirname,'../bin/kirat.js'),'serve',String(port)], {stdio:['ignore','pipe','pipe']});
  try {
    await new Promise((resolve,reject) => {
      const timer=setTimeout(() => reject(new Error('Server startup timeout')),10000);
      child.stdout.once('data', () => {clearTimeout(timer);resolve();});
      child.once('exit',code => {clearTimeout(timer);reject(new Error('Server exited '+code));});
    });
    const base='http://127.0.0.1:'+port;
    assert.equal((await fetch(base)).status,200);
    assert.equal((await fetch(base+'/lead-core.js')).status,200);
    for (const file of ['/research/2026-10-19-batch.json','/.local/candidates.json','/.env','/README.md']) assert.equal((await fetch(base+file)).status,404);
    assert.equal((await fetch(base,{method:'POST'})).status,405);
    const guarded = await new Promise((resolve,reject) => {
      require('node:http').get(base,{headers:{Host:'attacker.example'}}, res => {res.resume();resolve(res.statusCode);}).on('error',reject);
    });
    assert.equal(guarded,403);
    console.log('server: loopback assets, private-file exclusions, methods and Host guard passed');
  } finally {child.kill();}
})().catch(e => {console.error(e);process.exitCode=1;});
