'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createJobs} = require('./local-jobs');
const root=path.resolve(__dirname,'..');
const identity=crypto.createHash('sha256').update(root).digest('hex').slice(0,16);
function start({port=4173,jobs=createJobs(),autoSetup=true,settingsPath,mail=require('./mail').createMail(),daily,dailyDirectory}={}) {
  if (!Number.isInteger(port)||port<1024||port>65535) throw new Error('Invalid port');
  const isolatedDaily=!daily&&!dailyDirectory&&port!==4173?fs.mkdtempSync(path.join(require('node:os').tmpdir(),'kirat-daily-server-')):null;
  daily=daily||require('./daily').createDaily({directory:dailyDirectory||isolatedDaily||undefined,mail});
  if(isolatedDaily)daily.settings({enabled:false});
  const token=crypto.randomBytes(32).toString('hex');
  const origin='http://127.0.0.1:'+port;
  const assets={'/':'kirat-lead-desk.html','/index.html':'kirat-lead-desk.html','/lead-core.js':'lead-core.js','/browser-store.js':'browser-store.js','/local-panel.js':'local-panel.js','/mail-panel.js':'mail-panel.js','/daily-panel.js':'daily-panel.js','/assets/kirat-email-logo.png':'assets/kirat-email-logo.png','/assets/kirat-logo.svg':'assets/kirat-logo.svg','/assets/kirat-icon.png':'assets/kirat-icon.png','/assets/vendor/react.production.min.js':'assets/vendor/react.production.min.js','/assets/vendor/react-dom.production.min.js':'assets/vendor/react-dom.production.min.js','/assets/vendor/htm.umd.js':'assets/vendor/htm.umd.js'};
  function ready() {return fs.existsSync(path.join(root,'.local/venv/bin/python'))&&fs.existsSync(path.join(root,'.local/harvey/harvey.local.yaml'));}
  function json(res,status,data) {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
  const server=http.createServer(async(req,res)=>{
    try {
      if (req.headers.host!=='127.0.0.1:'+port) return json(res,403,{error:'Invalid host'});
      if (req.headers.origin && req.headers.origin!==origin) return json(res,403,{error:'Invalid origin'});
      const url=req.url.split('?')[0];
      if (url==='/health'&&req.method==='GET') return json(res,200,{app:'kirat-local-app-v1',identity});
      if (url.startsWith('/api/')) {
        if (!(req.headers.cookie||'').split(';').some(c=>c.trim()==='kirat_session='+token)) return json(res,401,{error:'Open the app homepage first.'});
        if (req.method==='GET'&&url==='/api/status') {
          let lastBatch=null;
          try {const text=fs.readFileSync(path.join(root,'.local/research-batch.json'),'utf8');lastBatch=require('./research').validateBatch(text);if(lastBatch.status==='blocked'||lastBatch.reason)lastBatch=null;}catch(_){}
          let lastContact=null;try{lastContact=JSON.parse(fs.readFileSync(path.join(root,'.local/last-contact-result.json'),'utf8'));}catch(_){}
          return json(res,200,{ready:ready(),job:jobs.snapshot(),lastBatch,lastContact,providers:require('./providers').settingsStatus(settingsPath)});
        }
        if (req.method==='GET'&&url==='/api/daily/status') return json(res,200,daily.status());
        if (req.method==='GET'&&url==='/api/mail/status') return json(res,200,await mail.request('status'));
        if (req.method!=='POST') return json(res,405,{error:'Method not allowed'});
        if (req.headers['x-kirat-local']!=='1'||req.headers.origin!==origin||req.headers['content-type']!=='application/json') return json(res,403,{error:'Local app request required'});
        let body='';
        for await (const chunk of req) {
          body+=chunk;
          if (Buffer.byteLength(body)>5*1024*1024) return json(res,413,{error:'Request exceeds 5 MB'});
        }
        let input;try{input=JSON.parse(body||'{}');}catch(_){throw new Error('Request must contain valid JSON.');}
        if(url==='/api/daily/sync'){if(req.headers['x-kirat-native']!=='1')return json(res,403,{error:'Native register sync required'});const synced=daily.sync(input);json(res,200,synced);if(jobs.snapshot()?.status!=='running')daily.run().catch(()=>{});return;}
        if(url==='/api/daily/settings')return json(res,200,daily.settings(input));
        if(url==='/api/daily/run'){if(jobs.snapshot()?.status==='running')throw new Error('Wait for the current research job to finish.');daily.run({...input,manual:true}).catch(()=>{});return json(res,200,daily.status());}
        if(url==='/api/daily/dismiss')return json(res,200,daily.dismiss(input));
        if(url==='/api/daily/cancel')return json(res,200,daily.cancel());
        if(url==='/api/daily/stage')return json(res,200,await daily.stage(input));
        if (url.startsWith('/api/mail/')) return json(res,200,await mail.request(url.slice('/api/mail/'.length),input));
        if (url==='/api/settings') return json(res,200,{providers:require('./providers').saveSettings(input,settingsPath)});
        if (url==='/api/job'){if(daily.status().run?.status==='running'&&['research','contacts','draft'].includes(input.kind))throw new Error('Wait for daily preparation to finish.');return json(res,200,{job:jobs.start(input.kind,input)});}
        if (url==='/api/stop') return json(res,200,{job:jobs.stop()});
        if (url==='/api/quit') {await mail.pause().catch(()=>{});daily.stop();mail.stop();jobs.stop();json(res,200,{message:'Local service stopped. Reopen the Mac app to start again.'});server.close();return;}
        return json(res,404,{error:'Unknown route'});
      }
      if (!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'Method not allowed'});
      const asset=assets[url];
      if (!asset) return json(res,404,{error:'Not found'});
      const headers={'Content-Type':asset.endsWith('.png')?'image/png':asset.endsWith('.svg')?'image/svg+xml':asset.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
      if(url==='/'||url==='/index.html') headers['Set-Cookie']='kirat_session='+token+'; HttpOnly; SameSite=Strict; Path=/';
      let text=fs.readFileSync(path.join(root,asset));
      if (asset==='kirat-lead-desk.html') text=text.toString('utf8').replace('<script src="browser-store.js"></script>','<script src="browser-store.js"></script>\n<script src="local-panel.js"></script>\n<script src="mail-panel.js"></script>\n<script src="daily-panel.js"></script>');
      res.writeHead(200,headers);res.end(req.method==='HEAD'?'':text);
    } catch(e) {json(res,400,{error:e.message});}
  });
  server.on('error',e=>{console.error(e.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>{
    console.log('Kirat app: '+origin);
    if(autoSetup&&!ready())jobs.start('setup');
  });
  const shutdown=()=>{daily.stop();mail.stop();jobs.stop('Local service stopped');server.close();server.closeAllConnections();};
  process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
  server.on('close',()=>{daily.stop();if(isolatedDaily)fs.rmSync(isolatedDaily,{recursive:true,force:true});mail.stop();jobs.stop();process.removeListener('SIGTERM',shutdown);process.removeListener('SIGINT',shutdown);});
  return server;
}
module.exports={start,identity};
if(require.main===module) start();
