'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {claimModel}=require('../lib/codex-research');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kirat-model-claim-')),file=path.join(directory,'model.lock');
try {
 assert.equal(typeof claimModel,'function','A shared model claim is required');
 const release=claimModel(file);
 assert.throws(()=>claimModel(file),/already running/);
 const other=spawnSync(process.execPath,['-e',`try { require(${JSON.stringify(path.resolve(__dirname,'../lib/codex-research'))}).claimModel(${JSON.stringify(file)}); process.exit(2); } catch(e) { if(!/already running/.test(e.message)) throw e; }`],{encoding:'utf8'});
 assert.equal(other.status,0,other.stderr);
 release();assert.equal(fs.existsSync(file),false);
 const dead=spawnSync(process.execPath,['-e',''],{encoding:'utf8'}).pid;
 fs.symlinkSync(String(dead),file);
 const recover=claimModel(file);recover();
 try { const done=claimModel(file);try {throw new Error('fixture failure');}finally{done();} }catch(e){assert.equal(e.message,'fixture failure');}
 assert.equal(fs.existsSync(file),false);
 console.log('model claim: cross-process exclusion, release, stale recovery and failure cleanup passed');
} finally { fs.rmSync(directory,{recursive:true,force:true}); }
