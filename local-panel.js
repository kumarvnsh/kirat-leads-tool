/* Served only by the Mac's loopback service; never deployed to Pages. */
(function () {
  'use strict';
  const html=htm.bind(React.createElement);
    async function api(route,body) {
      const response=await fetch('/api/'+route,body?{method:'POST',headers:{'Content-Type':'application/json','X-Kirat-Local':'1'},body:JSON.stringify(body)}:{});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Local service request failed');return data;
    }
  window.KiratLocalPanel=function({getRegister,onReview,mode='research'}) {
    const [state,setState]=React.useState(null),[error,setError]=React.useState(''),[city,setCity]=React.useState('New Delhi, India');
    const [stopped,setStopped]=React.useState(false);
    const cities=['New Delhi, India','Noida, India','Gurugram, India','Faridabad, India','Ghaziabad, India','Greater Noida, India'];
    React.useEffect(()=>{
      let live=true;
      const load=()=>api('status').then(s=>{if(live){setState(s);setError('');}}).catch(e=>{if(live)setError(e.message);});
      load();const timer=setInterval(load,2000);return()=>{live=false;clearInterval(timer);};
    },[]);
    async function start(kind) {
      try {setError('');const data=await api('job',{kind,city,register:getRegister()});setState(s=>({...s,job:data.job}));}
      catch(e){setError(e.message);}
    }
    const job=state&&state.job,busy=job&&job.status==='running';
    const batch=job&&job.status==='complete'&&job.batch?job.batch:state&&state.lastBatch;
    return html`<section class="box" aria-label="Local research" style=${{marginTop:'16px'}}>
      <h2>${mode==='advanced'?'Local service':'Find new leads'}</h2>
      ${stopped?html`<p>Local service stopped. Reopen Kirat Lead Desk.app to start again.</p>`:html`
      <p class="muted">${state?(state.ready?'Setup ready. Find leads runs Harvey discovery and Codex web research.':'Setup is required before discovery.'):'Checking setup…'} Results always wait for your review. Upcoming and ongoing projects are prioritized; procurement availability still needs confirmation.</p>
      <div class="actions">
        <select aria-label=${mode==='advanced'?'Candidate city':'Research city'} value=${city} onChange=${e=>setCity(e.target.value)} style=${{width:'auto'}} disabled=${busy}>${cities.map(c=>html`<option key=${c}>${c}</option>`)}</select>
        <button hidden=${mode==='advanced'} class="primary" disabled=${busy||!state||!state.ready} onClick=${()=>start('research')}>Start research</button>
        <button hidden=${mode!=='advanced'} disabled=${busy||!state||!state.ready} onClick=${()=>start('discover')}>Find candidates only</button>
        <button hidden=${mode!=='advanced'} disabled=${busy} onClick=${()=>start('setup')}>${state&&state.ready?'Repair setup':'Set up'}</button>
        ${busy?html`<button onClick=${async()=>{try{const d=await api('stop',{});setState(s=>({...s,job:d.job}));}catch(e){setError(e.message);}}}>Stop</button>`:null}
        <button hidden=${mode!=='advanced'} class="ghost" disabled=${busy} onClick=${async()=>{try{await api('quit',{});setStopped(true);}catch(e){setError(e.message);}}}>Quit local service</button>
      </div>
      ${batch&&!busy&&mode!=='advanced'?html`<p><button class="primary" onClick=${()=>onReview(batch)}>Review ${batch.leads.length} researched lead(s)</button></p>`:null}
      ${job?html`<p role="status"><b>${job.status==='running'?'Working…':job.status}</b> · ${job.message}</p>
        <details hidden=${mode!=='advanced'}><summary>Job details</summary><pre style=${{whiteSpace:'pre-wrap',maxHeight:'240px',overflow:'auto'}}>${job.log||'Starting…'}</pre></details>`:null}
      ${error?html`<p role="alert" class="err">${error}. If the service was closed, reopen the Mac app.</p>`:null}`}
    </section>`;
  };
  function ProviderSettings() {
    const [status,setStatus]=React.useState(null),[serper,setSerper]=React.useState(''),[hunter,setHunter]=React.useState(''),[message,setMessage]=React.useState(''),[saving,setSaving]=React.useState(false);
    React.useEffect(()=>{api('status').then(s=>setStatus(s.providers)).catch(()=>setMessage('Settings unavailable. Reopen the Mac app.'));},[]);
    async function save(input) {
      try {setSaving(true);setMessage('');const d=await api('settings',input);setStatus(d.providers);setSerper('');setHunter('');setMessage('Settings saved on this Mac.');}
      catch(e){setMessage(e.message);}finally{setSaving(false);}
    }
    return html`<details class="box"><summary>Local provider settings (optional)</summary>
      <p>Research and drafts use your existing Codex login. Serper adds up to five searches per research run. Hunter checks one selected email per action. Provider credits may be charged. Keys stay on this Mac and are excluded from backups.</p>
      <label class="field">Serper API key · ${status&&status.serper?'configured':'not configured'}<input type="password" autoComplete="off" value=${serper} onChange=${e=>setSerper(e.target.value)} placeholder="Paste a new key to add or replace" /></label>
      <label class="field">Hunter API key · ${status&&status.hunter?'configured':'not configured'}<input type="password" autoComplete="off" value=${hunter} onChange=${e=>setHunter(e.target.value)} placeholder="Paste a new key to add or replace" /></label>
      <div class="actions"><button disabled=${saving||(!serper&&!hunter)} onClick=${()=>save({...serper?{serper}:{},...hunter?{hunter}:{}})}>Save provider keys</button>
      <button disabled=${saving||!status||!status.serper} onClick=${()=>save({serper:''})}>Remove Serper key</button>
      <button disabled=${saving||!status||!status.hunter} onClick=${()=>save({hunter:''})}>Remove Hunter key</button></div>
      <p role="status">${message}</p>
    </details>`;
  }
  window.KiratProviderSettings=ProviderSettings;
  window.KiratQualityPanel=function({lead,onApply}) {
    const [state,setState]=React.useState(null),[error,setError]=React.useState(''),[applied,setApplied]=React.useState(''),[confirm,setConfirm]=React.useState(false);
    React.useEffect(()=>{let live=true;const load=()=>api('status').then(s=>{if(live)setState(s);}).catch(e=>{if(live)setError(e.message);});load();const t=setInterval(load,2000);return()=>{live=false;clearInterval(t);};},[lead.id]);
    const job=state&&state.job,busy=job&&job.status==='running',active=job&&['draft','verify'].includes(job.kind)&&job.target_id===lead.id;
    const result=active&&job.status==='complete'&&job.quality_result;
    const match=result&&result.target_key===window.KiratCore.dupKey(lead)&&
      (result.kind==='draft'?result.source_snapshot===window.KiratCore.draftSourceKey(lead):lead.contacts.some(c=>c.type==='email'&&c.value===result.email));
    async function start(kind,email) {
      try {setError('');setConfirm(false);const d=await api('job',{kind,lead,email});setState(s=>({...s,job:d.job}));}
      catch(e){setError(e.message);}
    }
    function apply() {
      if(!match)return;
      if(result.kind==='draft')onApply({outreach_draft:result.draft});
      else onApply({contacts:lead.contacts.map(c=>c.type==='email'&&c.value===result.email?{...c,delivery_check:result.delivery_check}:c)});
      setApplied(job.id);setConfirm(false);
    }
    return html`<section class="box" aria-label="Lead quality tools">
      <h3>Outreach preparation</h3>
      <p class="muted">Drafts use saved evidence. Review and edit before contacting anyone. Nothing is sent automatically.</p>
      <button disabled=${busy||!state} onClick=${()=>start('draft')}>${lead.outreach_draft?'Generate replacement draft':'Draft outreach'}</button>
      <h4>Email deliverability</h4>
      <p class="muted">${state&&state.providers&&state.providers.hunter?'Hunter configured. Each check sends the selected address to Hunter and may use credits.':'Add a Hunter key in Local provider settings to enable checks.'}</p>
      ${lead.contacts.filter(c=>c.type==='email').map(c=>html`<div class="contact" key=${c.value}>
        <span>${c.value}</span> <button disabled=${busy||!state||!state.providers||!state.providers.hunter} onClick=${()=>start('verify',c.value)}>Verify ${c.value}</button>
        ${c.delivery_check?html`<p>Hunter: ${c.delivery_check.status} · requested ${c.delivery_check.checked_on}${c.delivery_check.verified_on?' · provider checked '+c.delivery_check.verified_on:''}</p>`:html`<p class="muted">Delivery not checked.</p>`}
      </div>`)}
      ${active?html`<p role="status">${job.status==='running'?'Working…':job.message}</p>`:null}
      ${busy&&active?html`<button onClick=${async()=>{try{const d=await api('stop',{});setState(s=>({...s,job:d.job}));}catch(e){setError(e.message);}}}>Stop preparation</button>`:null}
      ${match&&applied!==job.id?html`<div class="ev"><h4>Review ${result.kind==='draft'?'generated drafts':'verification result'}</h4>
        ${result.kind==='draft'?result.draft.emails.map((e,i)=>html`<details key=${i}><summary>${i===0?'Initial email':'Follow-up '+i}: ${e.subject}</summary><p style=${{whiteSpace:'pre-wrap'}}>${e.body}</p></details>`):html`<p>${result.email}: <b>${result.delivery_check.status}</b><br/>${result.delivery_check.evidence}</p>`}
        ${result.kind==='draft'&&lead.outreach_draft&&!confirm?html`<button onClick=${()=>setConfirm(true)}>Replace existing draft…</button>`:
          html`${confirm?html`<p>This replaces all three saved emails and any unsaved edits in the editor below.</p>`:null}<button class="primary" onClick=${apply}>${confirm?'Confirm replacement':result.kind==='draft'?'Save generated drafts':'Save verification result'}</button>${confirm?html`<button onClick=${()=>setConfirm(false)}>Keep existing draft</button>`:null}`}
      </div>`:null}
      ${result&&!match?html`<p role="status">These results use older lead facts or a removed contact. Run preparation again.</p>`:null}
      ${match&&applied===job.id?html`<p role="status">${result.kind==='draft'?'Drafts saved. Edit them below.':'Verification result saved.'}</p>`:null}
      ${error?html`<p class="err" role="alert">${error}</p>`:null}
    </section>`;
  };
  window.KiratContactPanel=function({lead,onApply}) {
    const [state,setState]=React.useState(null),[error,setError]=React.useState(''),[picked,setPicked]=React.useState([]),[applied,setApplied]=React.useState(false);
    const seen=React.useRef('');
    React.useEffect(()=>{
      let live=true;
      const load=()=>api('status').then(s=>{if(live)setState(s);}).catch(e=>{if(live)setError(e.message);});
      load();const timer=setInterval(load,2000);return()=>{live=false;clearInterval(timer);};
    },[lead.id]);
    const job=state&&state.job,busy=job&&job.status==='running';
    const active=job&&job.kind==='contacts'&&job.target_id===lead.id;
    const result=active&&job.contact_result?job.contact_result:state&&state.lastContact&&state.lastContact.target_id===lead.id?state.lastContact:null;
    const match=result&&result.target_key===window.KiratCore.dupKey(lead);
    React.useEffect(()=>{
      const key=result?result.target_id+':'+result.checked_on+':'+JSON.stringify(result.contacts):'';
      if(key!==seen.current){seen.current=key;setPicked(result?result.contacts.map((_,i)=>i):[]);setApplied(false);}
    },[result]);
    async function start(){try{setError('');setApplied(false);const d=await api('job',{kind:'contacts',lead});setState(s=>({...s,job:d.job}));}catch(e){setError(e.message);}}
    return html`<div class="box" aria-label="Find contacts">
      <div class="actions"><button class="primary" disabled=${busy||!state||!state.ready} onClick=${start}>Find contacts</button>
      ${busy&&active?html`<button onClick=${async()=>{try{const d=await api('stop',{});setState(s=>({...s,job:d.job}));}catch(e){setError(e.message);}}}>Stop contact lookup</button>`:null}</div>
      <p class="muted">Public work contacts only. Business inboxes and switchboards stay separate from named people. No email guessing or paid services.</p>
      ${active?html`<p role="status">${job.status==='running'?'Finding and checking public contacts…':job.message}</p><details><summary>Contact lookup details</summary><pre style=${{whiteSpace:'pre-wrap',maxHeight:'180px',overflow:'auto'}}>${job.log}</pre></details>`:null}
      ${match&&!busy?html`<h4>Review found contacts</h4><p>${result.note||'Check each source before adding these contacts.'}</p>
        ${result.contacts.length?result.contacts.map((c,i)=>html`<div class="contact" key=${i}>
          <label class="check"><input type="checkbox" checked=${picked.includes(i)} onChange=${e=>setPicked(p=>e.target.checked?p.concat(i):p.filter(x=>x!==i))} /><b>${c.value}</b></label>
          <div>${c.type==='person'?c.role:c.scope==='direct'?'Direct work contact for '+c.person_name+' · '+c.role:c.scope==='company'?'General company channel':'Contact owner not established'}</div>
          <div class="muted">Published only · checked ${c.checked_on}${c.type==='email'?' · email delivery not verified':''}</div>
          <a href=${c.source_url} target="_blank" rel="noopener noreferrer">Open supporting source ↗</a>
          <details><summary>Supporting passage</summary><p>${c.source_excerpt}</p></details>
        </div>`):html`<p>No usable public contact was found. Existing contacts are unchanged.</p>`}
        ${result.contacts.length?html`<button class="primary" disabled=${!picked.length||applied} onClick=${()=>{onApply(result.contacts.filter((_,i)=>picked.includes(i)));setApplied(true);}}>${applied?'Contacts added':'Add selected contacts'}</button>`:null}
      `:null}
      ${match&&result.rejected&&result.rejected.length?html`<details><summary>Excluded contacts</summary><ul>${result.rejected.map((r,i)=>html`<li key=${i}>${r.type}: ${r.value} · ${r.reason}</li>`)}</ul></details>`:null}
      ${error?html`<p class="err" role="alert">${error}</p>`:null}
    </div>`;
  };
})();
