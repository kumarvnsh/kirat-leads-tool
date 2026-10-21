'use strict';
const fs=require('node:fs'),path=require('node:path');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
console.log('Fake worker started');
if(input.city==='Noida, India') setTimeout(()=>{},60000);
else {
  if(process.argv[2]==='research') {
    const batch=JSON.parse(fs.readFileSync(path.join(__dirname,'fixture-batch.json'),'utf8'));batch.leads=batch.leads.slice(0,1);
    const dir=path.join(__dirname,'../.local/jobs');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,input.id+'.json'),JSON.stringify(batch));
  }
  setTimeout(()=>{},150);
}
