'use strict';
const {spawn} = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const CITIES = ['New Delhi, India','Noida, India','Gurugram, India','Faridabad, India','Ghaziabad, India','Greater Noida, India'];
function createJobs({worker = path.join(__dirname,'../scripts/local-worker.js'), timeout = 12*60*1000} = {}) {
  let job = null, child = null, timer = null;
  const snapshot = () => job ? {...job} : null;
  function stop(reason = 'Stopped by you') {
    if (!child) return snapshot();
    const active = child;
    job.status = 'cancelled'; job.message = reason;
    clearTimeout(timer); child = null;
    try {process.kill(-active.pid,'SIGTERM');} catch (_) {}
    const kill = setTimeout(() => {try {process.kill(-active.pid,'SIGKILL');} catch (_) {}},2000);
    kill.unref();
    return snapshot();
  }
  function start(kind, input = {}) {
    if (child) throw new Error('A job is already running. Stop it or wait for completion.');
    if (!['setup','discover','research','contacts','draft','verify'].includes(kind)) throw new Error('Unknown operation');
    if (!CITIES.includes(input.city || CITIES[0])) throw new Error('Choose a supported NCR city');
    if (kind === 'research') {
      if (!input.register || !Array.isArray(input.register.leads)) throw new Error('A register is required for exclusions');
      require('./research').validateBatch(JSON.stringify(input.register));
    }
    if (['contacts','draft','verify'].includes(kind)) {
      const checked=require('../lead-core').validateLead(input.lead,'backup');
      if(checked.errors.length)throw new Error('A valid saved lead is required: '+checked.errors.join('; '));
    }
    if (kind === 'verify' && !input.lead.contacts.some(c=>c.type==='email'&&c.value===input.email)) throw new Error('Select an existing saved email contact.');
    job = {id:crypto.randomUUID(),kind,status:'running',log:'',message:'Starting '+kind,started_at:new Date().toISOString(),target_id:input.lead?input.lead.id:null};
    const id = job.id;
    child = spawn(process.execPath,[worker,kind], {cwd:path.resolve(__dirname,'..'),detached:true,stdio:['pipe','pipe','pipe']});
    const active = child;
    const append = data => {if (job.id === id) job.log=(job.log+data.toString()).slice(-24000);};
    active.stdout.on('data',append); active.stderr.on('data',append);
    active.stdin.on('error',()=>{});
    active.stdin.end(JSON.stringify({...input,city:input.city || CITIES[0],id}));
    const finish = (status,message) => {
      if (child !== active || job.id !== id) return;
      clearTimeout(timer); child = null;
      job.status=status;job.message=message;
      if(status==='complete'&&['draft','verify'].includes(kind)) {
        try {
          const result=JSON.parse(require('node:fs').readFileSync(path.join(__dirname,'../.local/jobs',id+'.quality.json'),'utf8'));
          if(result.target_id!==input.lead.id||result.target_key!==require('../lead-core').dupKey(input.lead)||result.kind!==kind)throw new Error('Result does not match lead');
          if(kind==='draft'){if(result.source_snapshot!==require('../lead-core').draftSourceKey(input.lead))throw new Error('Draft source facts do not match');result.draft=require('./outreach').validateDraft(result.draft);}
          else {
            if(!result.delivery_check||typeof result.delivery_check!=='object')throw new Error('Missing delivery check');
            if(result.email!==input.email)throw new Error('Result does not match email');
            const lead={...input.lead,contacts:input.lead.contacts.map(c=>c.type==='email'&&c.value===input.email?{...c,delivery_check:result.delivery_check}:c)};
            if(require('../lead-core').validateLead(lead,'backup').errors.length)throw new Error('Invalid verification result');
          }
          job.quality_result=result;
        } catch(e){job.status='failed';job.message='Result could not load: '+e.message;}
      }
      if(status==='complete'&&kind==='contacts') {
        try {job.contact_result=JSON.parse(require('node:fs').readFileSync(path.join(__dirname,'../.local/jobs',id+'.contacts.json'),'utf8'));}
        catch(e){job.status='failed';job.message='Contact output could not load: '+e.message;}
      }
      if (status === 'complete' && kind === 'research') {
        try {job.batch=JSON.parse(require('node:fs').readFileSync(path.join(__dirname,'../.local/jobs',id+'.json'),'utf8'));}
        catch (e) {job.status='failed';job.message='Research output could not be loaded: '+e.message;}
      }
    };
    active.on('error',e => finish('failed',e.message));
    active.on('exit',(code,signal) => finish(code === 0?'complete':'failed',code === 0?'Finished. Review the results before importing.':'Job failed'+(signal?' ('+signal+')':'')+'. See details below.'));
    timer = setTimeout(() => stop('Job exceeded its time limit. Previous results were retained.'),timeout);
    timer.unref();
    return snapshot();
  }
  return {start,stop,snapshot};
}
module.exports = {createJobs,CITIES};
