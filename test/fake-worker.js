'use strict';
const fs=require('node:fs'),path=require('node:path');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
console.log('Fake worker started');
if(input.city==='Noida, India') setTimeout(()=>{},60000);
else {
  if(['draft','verify'].includes(process.argv[2])) {
    const result={source_snapshot:require('../lead-core').draftSourceKey(input.lead),kind:process.argv[2],target_id:input.lead.id,target_key:require('../lead-core').dupKey(input.lead),
      draft:{generated_on:'2026-10-21',emails:[{subject:'Signage enquiry',body:'Hello team, may Kirat share services?'},{subject:'Following up',body:'Can you direct us to the projects team?'},{subject:'Closing the loop',body:'Please let us know if this is relevant.'}]},
      email:input.email,delivery_check:{provider:'Hunter',status:'risky',raw_status:'accept_all',checked_on:'2026-10-21',verified_on:null,evidence:'Fictional catch-all result for test.'}};
    if(input.city==='Faridabad, India')delete result.delivery_check;
    const dir=path.join(__dirname,'../.local/jobs');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,input.id+'.quality.json'),JSON.stringify(result));
  }
  if(process.argv[2]==='contacts') {
    const c={type:'person',value:'Asha Test',role:'Projects Manager',source_url:'https://fictional.example/team',source_excerpt:'Asha Test, Projects Manager',verification:'published_only',checked_on:'2026-10-21'};
    const result={contacts:[c],target_id:input.lead.id,target_key:require('../lead-core').dupKey(input.lead),checked_on:'2026-10-21',note:'Fictional contact for UI test'};
    const dir=path.join(__dirname,'../.local/jobs');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,input.id+'.contacts.json'),JSON.stringify(result));
  }
  if(process.argv[2]==='research') {
    const batch=JSON.parse(fs.readFileSync(path.join(__dirname,'fixture-batch.json'),'utf8'));batch.leads=batch.leads.slice(0,1);batch.leads[0].project_stage={stage:'planned',source_url:batch.leads[0].evidence[0].url,checked_on:'2026-10-21',reason:'Fictional future opening, vendor selection unknown.'};
    const dir=path.join(__dirname,'../.local/jobs');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,input.id+'.json'),JSON.stringify(batch));
  }
  setTimeout(()=>{},150);
}
