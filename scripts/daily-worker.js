'use strict';
// JSON stdin / newline JSON checkpoints only; never invokes mail or sending authority.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const K=require('../lead-core'),R=require('../lib/research'),{normalizeContacts}=require('../lib/contacts'),O=require('../lib/outreach');
const root=path.resolve(__dirname,'..');
async function run(input){
 if(!Number.isInteger(input.limit)||input.limit<0||input.limit>5)throw new Error('Invalid daily lead limit');
 if(!Number.isInteger(input.verification_budget)||input.verification_budget<0||input.verification_budget>5)throw new Error('Invalid verification budget');
 if(!input.limit)return {leads:[]};
 const codex=require('../lib/codex-research').runCodex;
 const prompt=R.researchPrompt(input.register,[],input.day)+'\nDAILY OVERRIDE: Return ONLY the final JSON, no shortlist or Markdown. Do not use local files or shell. Maximum '+input.limit+' leads. Every proposed contact requires source_excerpt with an EXACT quoted passage under 600 characters containing the contact and scope direct|company|unknown. Direct contacts also require person_name and role explicitly associated in that passage. Contacts lacking evidence must be omitted. Never claim deliverability or use paid search.';
 const result=R.validateResearchResult(codex(prompt));let used=0;
 const P=require('../lib/providers');const providers=input.verification_budget?P.loadSettings():{};
 for(const raw of result.leads.slice(0,input.limit)){
  let contacts=[];try{contacts=normalizeContacts({contacts:raw.contacts||[]},input.day).contacts;}catch{};
  if(contacts.length){const r=spawnSync(path.join(root,'.local/venv/bin/python'),[path.join(root,'scripts/harvey-contacts.py'),path.join(root,'.local/harvey'),'attest'],{input:JSON.stringify({contacts:contacts.slice(0,24)}),encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});contacts=r.status===0?normalizeContacts(JSON.parse(r.stdout),input.day).contacts:[];}
  for(const c of contacts){if(c.type==='email'&&providers.hunter&&used<input.verification_budget){used++;try{c.delivery_check=await P.verifyEmail(c.value,providers.hunter);}catch{}}}
  const lead={...raw,id:require('node:crypto').randomUUID(),contacts};const checked=K.validateLead(lead,'backup');if(checked.errors.length)throw new Error('Research lead failed validation');
  const draft=O.validateDraft(codex(O.draftPrompt(lead),{web:false}));
  process.stdout.write(JSON.stringify({type:'card',lead,draft})+'\n');
 }
 return {leads:[],verification_used:used};
}
if(require.main===module){let input='';process.stdin.on('data',b=>{input+=b;if(input.length>4*1024*1024)process.exit(1);});process.stdin.on('end',async()=>{const log=console.log;console.log=(...a)=>process.stderr.write(a.join(' ')+'\n');try{const result=await run(JSON.parse(input));process.stdout.write(JSON.stringify(result)+'\n');}catch(e){process.stdout.write(JSON.stringify({type:'error',message:String(e.message).slice(0,1000)})+'\n');process.exitCode=1;}finally{console.log=log;}});}
module.exports={run};
