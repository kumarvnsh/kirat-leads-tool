'use strict';
const fs=require('node:fs'),path=require('node:path');
const K=require('../lead-core'),{atomicWrite}=require('./research');
const settingsFile=path.join(__dirname,'../.local/provider-settings.json');
function loadSettings(file=settingsFile) {
  try {const data=JSON.parse(fs.readFileSync(file,'utf8'));return {serper:data.serper||'',hunter:data.hunter||''};}
  catch(e){if(e.code==='ENOENT')return {serper:'',hunter:''};throw new Error('Local provider settings could not be read.');}
}
function settingsStatus(file=settingsFile) {const s=loadSettings(file);return {serper:!!s.serper,hunter:!!s.hunter};}
function saveSettings(input,file=settingsFile) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['serper','hunter'].includes(k)))throw new Error('Unknown provider setting.');
  const next=loadSettings(file);
  for(const [key,value] of Object.entries(input)) {
    if(typeof value!=='string'||value.length>500||/[^\x21-\x7E]/.test(value))throw new Error('Invalid provider credential.');
    next[key]=value;
  }
  atomicWrite(file,JSON.stringify(next));return settingsStatus(file);
}
async function requestJSON(url,options) {
  try {
    const r=await fetch(url,{...options,signal:AbortSignal.timeout(30000),redirect:'error'});
    if(r.status===202)return {data:{status:'pending'}};
    if(!r.ok)throw new Error('HTTP '+r.status);
    const chunks=[];let size=0;
    for await(const chunk of r.body){size+=chunk.length;if(size>1024*1024)throw new Error('Response too large');chunks.push(Buffer.from(chunk));}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch(_) {throw new Error('Provider request failed. Check the credential, quota or connection; no automatic retry was made.');}
}
async function verifyEmail(email,key,request=requestJSON) {
  if(typeof email!=='string'||email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))throw new Error('Select a valid saved email address.');
  if(!key)throw new Error('Add a Hunter API key in Local provider settings first.');
  // Header authentication keeps credentials out of URLs and request diagnostics.
  let response;
  try {response=await request('https://api.hunter.io/v2/email-verifier?email='+encodeURIComponent(email),{headers:{'X-API-KEY':key}});}
  catch(_){throw new Error('Hunter verification failed. Check the credential, quota or connection. Existing evidence was retained.');}
  const d=response?.data;
  if(!d||typeof d.status!=='string'||(d.email&&d.email.toLowerCase()!==email.toLowerCase()))throw new Error('Invalid Hunter response; existing evidence was retained.');
  const allowed=['valid','invalid','accept_all','webmail','disposable','unknown','pending'];
  if(!allowed.includes(d.status))throw new Error('Unrecognized Hunter response; existing evidence was retained.');
  let status={valid:'deliverable',invalid:'undeliverable',accept_all:'risky',webmail:'unknown',disposable:'risky',unknown:'unknown',pending:'pending'}[d.status];
  if(d.accept_all===true||d.disposable===true)status='risky';
  if(d.block===true&&status==='deliverable')status='unknown';
  const checked_on=K.todayInKolkata();
  return {provider:'Hunter',status,raw_status:d.status,checked_on,
    verified_on:K.isISODate(d.verification?.date)?d.verification.date:null,
    evidence:'Hunter email-verifier returned '+d.status+(d.accept_all?' (catch-all)':'')+'. Requested '+checked_on+'. This is a deliverability assessment, not a guarantee.'};
}
function discoveryQueries(city) {
  return ['India retail announced upcoming store openings expansion rollout',city+' retail new store upcoming fit out',
    'India retail brand renovation rebranding store projects',city+' retail expansion projects manager hiring',
    'India retail franchise store expansion planned next year'];
}
async function discover(city,key,request=requestJSON) {
  if(!key)throw new Error('Serper is not configured.');
  const out=[],seen=new Set();
  for(const q of discoveryQueries(city)) {
    let data;try{data=await request('https://google.serper.dev/search',{method:'POST',headers:{'X-API-KEY':key,'Content-Type':'application/json'},body:JSON.stringify({q,gl:'in',hl:'en',num:10,tbs:'qdr:m3'})});}
    catch(_){throw new Error('Serper discovery failed. Check the credential, quota or connection; continuing with web research.');}
    if(!Array.isArray(data.organic))throw new Error('Serper returned an invalid response; continuing with web research.');
    for(const row of data.organic.slice(0,10)) {
      if(!K.isHttpUrl(row.link)||seen.has(row.link))continue;seen.add(row.link);
      out.push({title:String(row.title||'').slice(0,300),source_url:row.link,notes:String(row.snippet||'').slice(0,1000),source:'Serper',qualified:false});
    }
  }
  return out;
}
module.exports={loadSettings,settingsStatus,saveSettings,requestJSON,verifyEmail,discover,discoveryQueries};
