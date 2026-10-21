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
try {
  if (mode === 'setup') require('../lib/harvey').setup(python());
  else if (mode === 'contacts') require('../lib/contact-job').run(input);
  else if (mode === 'discover') require('../lib/harvey').discover(input.city,5);
  else if (mode === 'research') {
    console.log('Finding local business candidates with Harvey…');
    try {require('../lib/harvey').discover(input.city,5);}
    catch(e) {console.log('Discovery unavailable: '+e.message+'\nContinuing with web research; previous candidates retained.');}
    const file = path.join(root,'.local/candidates.json');
    const candidates = fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).candidates:[];
    const prompt=R.researchPrompt(input.register,candidates)+
      '\nReturn ONLY the final JSON object in your last response, with no Markdown fences or commentary. Do not write files or use shell tools. Use native web search to open and check sources. Never guess source contents. Stop after this one batch. If the candidate listings are weak, find better national/NCR opportunities using web search. Empty leads is valid when nothing qualifies.';
    R.atomicWrite(path.join(root,'.local/research-prompt.txt'),prompt);
    const text=require('../lib/codex-research').runCodex(prompt);
      const batch=R.validateResearchResult(text);
      R.atomicWrite(path.join(root,'.local/jobs',input.id+'.json'),JSON.stringify(batch,null,2));
      R.atomicWrite(path.join(root,'.local/research-batch.json'),JSON.stringify(batch,null,2));
      console.log(batch.leads.length+' researched lead record(s) ready for your review. Validation checks format; open the sources before import.');

  } else throw new Error('Unknown worker operation');
} catch (e) {console.error(e.message);process.exitCode=1;}
