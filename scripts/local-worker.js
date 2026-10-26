'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const R = require('../lib/research');
const root = path.resolve(__dirname,'..');
const mode = process.argv[2];
const input = JSON.parse(fs.readFileSync(0,'utf8'));
function python() {
  for (const cmd of ['python3.13','python3.12','python3.11','python3']) {
    const r=spawnSync(cmd,['-c','import sys; assert sys.version_info >= (3,11)'],{timeout:10000});
    if (r.status===0) return cmd;
  }
  throw new Error('Python 3.11+ is required. Install Python, then choose Set up again.');
}
(async()=>{try {
  if (mode === 'setup') require('../lib/harvey').setup(python());
  else if (mode === 'contacts') require('../lib/contact-job').run(input);
  else if (mode === 'draft' || mode === 'verify') {
    const K=require('../lead-core'),P=require('../lib/providers'),O=require('../lib/outreach');
    const result={kind:mode,target_id:input.lead.id,target_key:K.dupKey(input.lead)};
    if(mode==='draft') {
      result.source_snapshot=K.draftSourceKey(input.lead);
      console.log('Preparing three editable drafts from saved project evidence. Nothing will be sent.');
      result.draft=O.validateDraft(require('../lib/codex-research').runCodex(O.draftPrompt(input.lead),{web:false}));
    } else {
      console.log('Checking the selected email with Hunter. One request; no automatic retries.');
      result.email=input.email;
      result.delivery_check=await P.verifyEmail(input.email,P.loadSettings().hunter);
    }
    R.atomicWrite(path.join(root,'.local/jobs',input.id+'.quality.json'),JSON.stringify(result,null,2));
    console.log('Ready for review. Saved lead data is unchanged until you apply the result.');
  }
  else if (mode === 'discover') {
    const P=require('../lib/providers'),key=P.loadSettings().serper;
    const base=key?await P.discover(input.city,key):require('../lib/harvey').discover(input.city,5),candidates=base.concat(await P.freeSignals(input.city));
    R.atomicWrite(path.join(root,'.local/candidates.json'),JSON.stringify({source:(key?'Serper':'Harvey')+' + Google News + GeM',candidates},null,2));console.log(candidates.length+' discovery candidates saved; not yet qualified.');
  }
  else if (mode === 'research') {
    const P=require('../lib/providers'),key=P.loadSettings().serper;
    let candidates=[];
    console.log(key?'Finding project signals with Serper (up to five searches)…':'Finding local business candidates with Harvey…');
    try {candidates=key?await P.discover(input.city,key):require('../lib/harvey').discover(input.city,5);}
    catch(e){console.log('Discovery unavailable: '+e.message+'\nContinuing with fresh web research; no previous candidates reused.');}
    candidates=candidates.concat(await P.freeSignals(input.city));
    const prompt=R.researchPrompt(input.register,candidates)+
      '\nReturn ONLY the final JSON object in your last response, with no Markdown fences or commentary. Do not write files or use shell tools. Use native web search to open and check sources. Never guess source contents. Stop after this one batch. If the candidate listings are weak, find better national/NCR opportunities using web search. Empty leads is valid when nothing qualifies.';
    R.atomicWrite(path.join(root,'.local/research-prompt.txt'),prompt);
    const text=require('../lib/codex-research').runCodex(prompt);
      const batch=R.validateResearchResult(text);
      R.atomicWrite(path.join(root,'.local/jobs',input.id+'.json'),JSON.stringify(batch,null,2));
      R.atomicWrite(path.join(root,'.local/research-batch.json'),JSON.stringify(batch,null,2));
      console.log(batch.leads.length+' researched lead record(s) ready for your review. Validation checks format; open the sources before import.');

  } else throw new Error('Unknown worker operation');
} catch (e) {console.error(e.message);process.exitCode=1;} })();
