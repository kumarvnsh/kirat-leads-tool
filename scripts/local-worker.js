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
    const help=spawnSync('codex',['exec','--help'],{encoding:'utf8',timeout:15000});
    if (help.status!==0 || !help.stdout.includes('--ignore-user-config')) throw new Error('A current Codex CLI is required. Open Codex and sign in, then retry. The manual prompt is saved in .local/research-prompt.txt.');
    const login=spawnSync('codex',['login','status'],{encoding:'utf8',timeout:15000});
    if (login.status!==0) throw new Error('Codex is not signed in. Open Codex and sign in, then retry research.');
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kirat-research-'));
    try {
      const output=path.join(temp,'result.json');
      const features=['apps','plugins','remote_plugin','hooks','memories','multi_agent','multi_agent_v2','shell_tool','unified_exec','code_mode','code_mode_only','browser_use','browser_use_external','computer_use','in_app_browser','skill_search','skill_mcp_dependency_install','goals','artifact','image_generation','view_image'];
      const args=['exec','--ignore-user-config','--ignore-rules','--ephemeral','--skip-git-repo-check','-C',temp,'-s','read-only','-c','approval_policy="never"','-c','web_search="live"','-c','features.code_mode_host=true','-c','project_doc_max_bytes=0','-c','skills.include_instructions=false','-c','skills.bundled.enabled=false','-c','agents.enabled=false','-c','forced_login_method="chatgpt"','-c','notify=[]','--color','never','-o',output];
      for (const feature of features) args.push('--disable',feature);
      args.push('-');
      console.log('Researching current sources with your local Codex login. This may take several minutes.');
      const result=spawnSync('codex',args,{input:prompt,encoding:'utf8',cwd:temp,timeout:10*60*1000,maxBuffer:4*1024*1024});
      if (result.status!==0) throw new Error('Codex research did not complete: '+(result.error?.message || result.stderr || 'unknown failure').slice(-5000)+'\nManual prompt retained at .local/research-prompt.txt.');
      const text=fs.readFileSync(output,'utf8').trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
      const batch=R.validateResearchResult(text);
      R.atomicWrite(path.join(root,'.local/jobs',input.id+'.json'),JSON.stringify(batch,null,2));
      R.atomicWrite(path.join(root,'.local/research-batch.json'),JSON.stringify(batch,null,2));
      console.log(batch.leads.length+' researched lead record(s) ready for your review. Validation checks format; open the sources before import.');
    } finally {fs.rmSync(temp,{recursive:true,force:true});}
  } else throw new Error('Unknown worker operation');
} catch (e) {console.error(e.message);process.exitCode=1;}
