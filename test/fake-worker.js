'use strict';
const fs=require('node:fs'),path=require('node:path');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
console.log('Fake worker started');
if(input.city==='Noida, India') setTimeout(()=>{},60000);
else {
  if(process.argv[2]==='contacts') {
    const c={type:'person',value:'Asha Test',role:'Projects Manager',source_url:'https://fictional.example/team',source_excerpt:'Asha Test, Projects Manager',verification:'published_only',checked_on:'2026-10-21'};
    const result={contacts:[c],target_id:input.lead.id,target_key:require('../lead-core').dupKey(input.lead),checked_on:'2026-10-21',note:'Fictional contact for UI test'};
    const dir=path.join(__dirname,'../.local/jobs');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,input.id+'.contacts.json'),JSON.stringify(result));
  }
  if(process.argv[2]==='research') {
    const batch=JSON.parse(fs.readFileSync(path.join(__dirname,'fixture-batch.json'),'utf8'));batch.leads=batch.leads.slice(0,1);
    const dir=path.join(__dirname,'../.local/jobs');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,input.id+'.json'),JSON.stringify(batch));
  }
  setTimeout(()=>{},150);
}
