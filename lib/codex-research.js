'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
function runCodexUnlocked(prompt,{web=true}={}) {
  const help=spawnSync('codex',['exec','--help'],{encoding:'utf8',timeout:15000});
    if (help.status!==0 || !help.stdout.includes('--ignore-user-config')) throw new Error('A current Codex CLI is required. Open Codex and sign in, then retry.');
    const login=spawnSync('codex',['login','status'],{encoding:'utf8',timeout:15000});
    if (login.status!==0) throw new Error('Codex is not signed in. Open Codex and sign in, then retry research.');
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kirat-research-'));
    try {
      const output=path.join(temp,'result.json');
      const features=['apps','plugins','remote_plugin','hooks','memories','multi_agent','multi_agent_v2','shell_tool','unified_exec','code_mode','code_mode_only','browser_use','browser_use_external','computer_use','in_app_browser','skill_search','skill_mcp_dependency_install','goals','artifact','image_generation','view_image'];
      const args=['exec','--ignore-user-config','--ignore-rules','--ephemeral','--skip-git-repo-check','-C',temp,'-s','read-only','-c','approval_policy="never"','-c',web?'web_search="live"':'web_search="disabled"','-c','features.code_mode_host=true','-c','project_doc_max_bytes=0','-c','skills.include_instructions=false','-c','skills.bundled.enabled=false','-c','agents.enabled=false','-c','forced_login_method="chatgpt"','-c','notify=[]','--color','never','-o',output];
      for (const feature of features) args.push('--disable',feature);
      args.push('-');
      console.log(web?'Researching current sources with your local Codex login. This may take several minutes.':'Writing drafts from saved evidence with your local Codex login.');
      const result=spawnSync('codex',args,{input:prompt,encoding:'utf8',cwd:temp,timeout:10*60*1000,maxBuffer:4*1024*1024});
      if (result.status!==0) throw new Error('Codex research did not complete: '+(result.error?.message || result.stderr || 'unknown failure').slice(-5000));
      const text=fs.readFileSync(output,'utf8').trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
      return text;
    } finally {fs.rmSync(temp,{recursive:true,force:true});}
}
function claimModel(file=path.resolve(__dirname,'../.local/model.lock')) {
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  for(let attempt=0;attempt<3;attempt++) {
    try {fs.symlinkSync(String(process.pid),file);return ()=>{try{if(fs.readlinkSync(file)===String(process.pid))fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}};}
    catch(e) {
      if(e.code!=='EEXIST')throw e;
      let pid;try{pid=Number(fs.readlinkSync(file));}catch{throw new Error('Another model job is already running; retry after it finishes.');}
      if(!Number.isSafeInteger(pid)||pid<1)throw new Error('Another model job is already running; inspect the local model claim.');
      try {process.kill(pid,0);throw new Error('Another model job is already running; retry after it finishes.');}
      catch(e){if(e.code!=='ESRCH')throw e;try{if(fs.readlinkSync(file)===String(pid))fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}}
    }
  }
  throw new Error('Another model job is already running; retry shortly.');
}
function runCodex(prompt,options) {const release=claimModel();try{return runCodexUnlocked(prompt,options);}finally{release();}}
module.exports={runCodex,claimModel};
