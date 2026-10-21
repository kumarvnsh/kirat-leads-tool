/* Served only by the Mac's loopback service; never deployed to Pages. */
(function () {
  'use strict';
  const html=htm.bind(React.createElement);
    async function api(route,body) {
      const response=await fetch('/api/'+route,body?{method:'POST',headers:{'Content-Type':'application/json','X-Kirat-Local':'1'},body:JSON.stringify(body)}:{});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Local service request failed');return data;
    }
  window.KiratLocalPanel=function({getRegister,onReview}) {
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
      <h2>Research on your Mac</h2>
      ${stopped?html`<p>Local service stopped. Reopen Kirat Lead Desk.app to start again.</p>`:html`
      <p class="muted">${state?(state.ready?'Setup ready. Find leads runs Harvey discovery and Codex web research.':'Setup is required before discovery.'):'Checking setup…'} Results always wait for your review.</p>
      <div class="actions">
        <select aria-label="Research city" value=${city} onChange=${e=>setCity(e.target.value)} style=${{width:'auto'}} disabled=${busy}>${cities.map(c=>html`<option key=${c}>${c}</option>`)}</select>
        <button class="primary" disabled=${busy||!state||!state.ready} onClick=${()=>start('research')}>Find leads</button>
        <button disabled=${busy||!state||!state.ready} onClick=${()=>start('discover')}>Find candidates only</button>
        <button disabled=${busy} onClick=${()=>start('setup')}>${state&&state.ready?'Repair setup':'Set up'}</button>
        ${busy?html`<button onClick=${async()=>{try{const d=await api('stop',{});setState(s=>({...s,job:d.job}));}catch(e){setError(e.message);}}}>Stop</button>`:null}
        <button class="ghost" disabled=${busy} onClick=${async()=>{try{await api('quit',{});setStopped(true);}catch(e){setError(e.message);}}}>Quit local service</button>
      </div>
      ${batch&&!busy?html`<p><button class="primary" onClick=${()=>onReview(batch)}>Review ${batch.leads.length} researched lead(s)</button></p>`:null}
      ${job?html`<p role="status"><b>${job.status==='running'?'Working…':job.status}</b> · ${job.message}</p>
        <details><summary>Job details</summary><pre style=${{whiteSpace:'pre-wrap',maxHeight:'240px',overflow:'auto'}}>${job.log||'Starting…'}</pre></details>`:null}
      ${error?html`<p role="alert" class="err">${error}. If the service was closed, reopen the Mac app.</p>`:null}`}
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
