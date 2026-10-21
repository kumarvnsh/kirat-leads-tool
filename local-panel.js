/* Served only by the Mac's loopback service; never deployed to Pages. */
(function () {
  'use strict';
  const html=htm.bind(React.createElement);
  window.KiratLocalPanel=function({getRegister,onReview}) {
    const [state,setState]=React.useState(null),[error,setError]=React.useState(''),[city,setCity]=React.useState('New Delhi, India');
    const [stopped,setStopped]=React.useState(false);
    const cities=['New Delhi, India','Noida, India','Gurugram, India','Faridabad, India','Ghaziabad, India','Greater Noida, India'];
    async function api(route,body) {
      const response=await fetch('/api/'+route,body?{method:'POST',headers:{'Content-Type':'application/json','X-Kirat-Local':'1'},body:JSON.stringify(body)}:{});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Local service request failed');return data;
    }
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
})();
