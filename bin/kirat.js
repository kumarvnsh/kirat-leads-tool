#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const R = require('../lib/research');
function file(arg) { if (!arg) throw new Error('A file path is required. Run help for usage.'); return path.resolve(arg); }
function doctor() {
  console.log('Node '+process.version+'; dashboard data stays in your browser.');
  for (const [cmd,args] of [['python3.12',['--version']],['codex',['login','status']],['claude',['auth','status']]]) {
    const r = spawnSync(cmd,args,{encoding:'utf8',timeout:15000});
    // Auth status may contain account information: report readiness only.
    console.log(cmd+': '+(r.status === 0 ? 'available / status check passed' : 'not ready; run '+cmd+' '+args.join(' ')+' locally'));
  }
  console.log('Harvey: '+(fs.existsSync(path.join(root,'.local/venv/bin/python'))?'installed':'run node bin/kirat.js harvey-setup'));
  console.log('Web research tools are session-dependent. Open the generated prompt in a web-enabled Codex/Claude session; if unavailable, use the Claude Project. No API fallback is enabled.');
}
function serve(port = 4173) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port must be 1024–65535');
  const assets = {'/':'kirat-lead-desk.html','/index.html':'kirat-lead-desk.html','/lead-core.js':'lead-core.js','/browser-store.js':'browser-store.js','/assets/kirat-logo.svg':'assets/kirat-logo.svg','/assets/kirat-icon.png':'assets/kirat-icon.png','/assets/vendor/react.production.min.js':'assets/vendor/react.production.min.js','/assets/vendor/react-dom.production.min.js':'assets/vendor/react-dom.production.min.js','/assets/vendor/htm.umd.js':'assets/vendor/htm.umd.js'};
  const server = http.createServer((req,res) => {
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
    if (req.headers.host !== '127.0.0.1:'+port && req.headers.host !== 'localhost:'+port) {res.writeHead(403);res.end();return;}
    const asset = assets[req.url.split('?')[0]];
    if (!asset) {res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':asset.endsWith('.png')?'image/png':asset.endsWith('.svg')?'image/svg+xml':asset.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD'?'':fs.readFileSync(path.join(root,asset)));
  });
  server.on('error',e => { console.error('Server: '+e.message);process.exitCode=1; });
  server.listen(port,'127.0.0.1',() => console.log(`Lead Desk: http://127.0.0.1:${port} (Ctrl+C to stop). Only app assets are served.`));
}
try {
  const [command='help',...args] = process.argv.slice(2);
  if (command === 'app') require('../lib/local-server').start();
  else if (command === 'serve') serve(args[0] ? Number(args[0]):4173);
  else if (command === 'doctor') doctor();
  else if (command === 'validate') {
    const batch = R.validateBatch(fs.readFileSync(file(args[0]),'utf8'));
    console.log(`Valid: ${batch.leads.length} lead(s). Source accuracy still requires human review.`);
  } else if (command === 'candidates') {
    const candidates = R.candidatesFromCsv(R.parseCsv(fs.readFileSync(file(args[0]),'utf8')));
    const output = args[1] ? file(args[1]) : path.join(root,'.local/candidates.json');
    R.atomicWrite(output,JSON.stringify({source:'Harvey CSV',candidates},null,2));
    console.log('Unqualified candidates: '+output);
  } else if (command === 'prompt') {
    const register = args[0] && args[0] !== '-' ? R.validateBatch(fs.readFileSync(file(args[0]),'utf8')) : {leads:[]};
    const input = args[1] ? JSON.parse(fs.readFileSync(file(args[1]),'utf8')) : {candidates:[]};
    if (!Array.isArray(input.candidates)) throw new Error('Candidates file must contain a candidates array');
    const output = args[2] ? file(args[2]) : path.join(root,'.local/research-prompt.txt');
    R.atomicWrite(output,R.researchPrompt(register,input.candidates));
    console.log('Research prompt: '+output+'\nOpen in a web-enabled local research session. Save final JSON, validate, then import manually.');
  } else if (command === 'harvey-setup') require('../lib/harvey').setup(args[0]);
  else if (command === 'discover') require('../lib/harvey').discover(args[0],args[1]?Number(args[1]):5);
  else if (command === 'harvey-export') require('../lib/harvey').discover('',args[0]?Number(args[0]):25,true);
  else if (command === 'help') console.log(`Kirat Lead Tool\n  serve [port]                           Open local dashboard\n  doctor                                 Check runtimes and CLI login status\n  harvey-setup [python-command]           Install pinned Harvey; disable outreach\n  discover [city] [limit:1-25]            Free OSM discovery + website profiling\n  harvey-export [limit:1-25]              Read existing Harvey company candidates\n  candidates input.csv [output.json]     Convert Harvey CSV without qualification\n  prompt register.json|- [candidates.json] [output.txt]\n  validate batch.json                    Reject malformed research output\n\nNo command sends messages. Research requires source checks in a web-enabled session.`);
  else throw new Error('Unknown command: '+command);
} catch (e) { console.error(e.message);process.exitCode=1; }
