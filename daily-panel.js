/* Daily preparation is local; sending approval remains in Emails. */
(function(){
 'use strict';
 const html=htm.bind(React.createElement);
 async function api(action,data){const r=await fetch('/api/daily/'+action,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Kirat-Local':'1','X-Kirat-Native':window.KiratNative?'1':'0'},body:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw new Error(v.error||'Daily preparation failed');return v;}
 function Card({card,run,busy,onNavigate,onOpenLead}){
  const [ack,setAck]=React.useState(false),[expanded,setExpanded]=React.useState(false);
  const serviceContact=/^(support|care|customercare|customer[._-]?service|help)@/i.test(card.recipient?.value||'');
  const held=['duplicate','needs_contact','failed','dismissed'].includes(card.status)||serviceContact,queued=!!card.mail_id;
  const status=queued?'Needs email approval':serviceContact?'Business contact needed':({needs_contact:'Contact needed',needs_contact_review:'Review contact and email',ready:'Ready for email review',duplicate:'Already in outreach',failed:'Needs attention',dismissed:'Skipped'}[card.status]||'Needs review');
  async function stage(){const item=await run('stage',{id:card.id,risk_acknowledged:ack});if(item)onNavigate?.('emails',item.id);}
  return html`<article class="box daily-row" aria-label=${'Daily lead '+card.lead.company}>
   <div class="daily-summary"><div><b>${card.lead.company}</b> · ${card.lead.city}<p class="daily-opportunity">${card.lead.opportunity||card.lead.branch_project}</p></div><span class="daily-status">${status}</span><div class="actions">${queued?html`<button onClick=${()=>onNavigate?.('emails',card.mail_id)}>Go to Emails</button>`:held?html`<button onClick=${()=>onOpenLead?.(card.lead.id)}>Open lead</button>`:html`<button onClick=${()=>setExpanded(!expanded)} aria-expanded=${expanded}>${expanded?'Hide email':'Review email'}</button>`}${held||queued?html`<button class="ghost" onClick=${()=>setExpanded(!expanded)} aria-expanded=${expanded}>${expanded?'Hide details':'Show details'}</button>`:null}</div></div>
   ${serviceContact?html`<p class="muted">Customer-service contact held. Open the lead to find an appropriate business contact before preparing an email.</p>`:null}
   ${expanded?html`<div class="daily-details"><p>${card.lead.branch_project}</p><p><b>${card.recipient?.value||'Contact needed'}</b> · ${card.recipient?.delivery_check?.status||'Not verified'}<br/><span role="status">${card.reason}</span></p>
    <details><summary>Sources and contact evidence</summary><p><a href=${card.lead.evidence?.[0]?.url||card.lead.website} target="_blank" rel="noopener noreferrer">Opportunity evidence</a>${card.recipient?html` · <a href=${card.recipient.source_url} target="_blank" rel="noopener noreferrer">Published contact source</a>`:null}</p>${card.recipient?.source_excerpt?html`<blockquote>${card.recipient.source_excerpt}</blockquote>`:null}</details>
    ${card.draft.emails.map((e,i)=>html`<details key=${i} open=${i===0}><summary>${['Initial inquiry','Optional follow-up 1','Optional follow-up 2'][i]}: ${e.subject}</summary><p style=${{whiteSpace:'pre-wrap'}}>${e.body}</p></details>`)}<p class="muted">Your Kirat signature and website are included in the complete Emails preview. Follow-ups require separate review.</p>
    ${!held&&!queued?html`<div>${card.status==='needs_contact_review'?html`<label class="check"><input type="checkbox" checked=${ack} onChange=${e=>setAck(e.target.checked)}/>I reviewed this published business contact and accept its unverified delivery risk.</label>`:null}<button disabled=${busy||(card.status==='needs_contact_review'&&!ack)} onClick=${stage}>Move initial email to Emails review</button><p class="muted">This only creates an email needing approval. Review and approve it individually in Emails.</p></div>`:null}
    ${held&&!queued?html`<p class="muted">Open this lead to research an appropriate business contact. Prepare its email there once the contact is saved.</p>`:null}
    ${!queued&&card.status!=='dismissed'?html`<button class="ghost" disabled=${busy} onClick=${()=>run('dismiss',{id:card.id})}>Skip this opportunity</button>`:null}
   </div>`:null}
  </article>`;
 }
 window.KiratDailyPanel=function({getRegister,onAdditions,ready,view='today',onNavigate,onOpenLead}){
  const [settingsTarget,setSettingsTarget]=React.useState(null);
  React.useEffect(()=>setSettingsTarget(document.getElementById('daily-settings-slot')),[]);
  const [state,setState]=React.useState(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);
  const props=React.useRef({getRegister,onAdditions,ready});props.current={getRegister,onAdditions,ready};
  React.useEffect(()=>{let live=true,pending=false;
   async function load(){if(pending)return;pending=true;try{let s=await api('status');if(window.KiratNative&&props.current.ready){const r=await api('sync',{register:props.current.getRegister()});s=r.status;if(r.additions.length){const acknowledged=await props.current.onAdditions(r.additions);s=(await api('sync',{register:props.current.getRegister(),acknowledged})).status;}}if(live){setState(s);setError('');}}catch(e){if(live)setError(e.message);}finally{pending=false;}}
   load();const t=setInterval(load,5000);return()=>{live=false;clearInterval(t);};},[]);
  async function run(action,data){setBusy(true);setError('');try{const result=await api(action,data);setState(await api('status'));return result;}catch(e){setError(e.message);return false;}finally{setBusy(false);}}
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const todayRun=state?.run?.day===today;
  return html`<div>
   <section class="local-panel" aria-label="Today" hidden=${view!=='today'}><div class="box"><h2>Today</h2><p>Review today’s opportunities, then approve each email in Emails.</p><ol class="flow-steps"><li>Review a lead</li><li>Preview and approve email</li><li>Track replies</li></ol>
    ${error?html`<p class="err" role="alert">${error}</p>`:null}
    ${state?html`<p><b>${state.run?state.run.day+' · '+state.run.status:'No batch prepared yet'}</b></p><p role="status">${state.run?.message||'Ready for the next scheduled run.'}</p>
     ${todayRun&&state.run.status==='completed'?html`<p class="daily-status">Complete — review today’s leads below.</p>`:null}
     ${todayRun&&state.run.status==='held'?html`<p class="muted">Review your backlog of leads and emails before preparing more.</p>`:null}
     <div class="actions">${!todayRun&&state.run?.status!=='running'?html`<button disabled=${busy||!state.enabled} onClick=${()=>run('run',{manual:true})}>Prepare today’s batch</button>`:null}${state.run?.status==='running'?html`<button disabled=${busy} onClick=${()=>run('cancel',{})}>Cancel preparation</button>`:null}${todayRun&&['failed','cancelled'].includes(state.run?.status)?html`<button disabled=${busy||!state.enabled} onClick=${()=>run('run',{manual:true,retry:true})}>Retry remaining preparation</button>`:null}</div>
     ${!state.enabled?html`<p class="muted">Daily preparation is paused. Resume it in Settings.</p>`:null}
     ${state.cards.length?html`<div>${[...state.cards].reverse().map(c=>html`<${Card} key=${c.id} card=${c} run=${run} busy=${busy} onNavigate=${onNavigate} onOpenLead=${onOpenLead}/>` )}</div>`:html`<p class="muted">Prepared leads and drafts will appear here.</p>`}
    `:html`<p>Loading daily preparation…</p>`}</div></section>
   ${settingsTarget?ReactDOM.createPortal(html`<section class="local-panel" aria-label="Daily preparation settings" hidden=${view!=='settings'}><div class="box"><h2>Daily preparation</h2><p>Every day at <b>9:00 AM IST</b>: up to five new opportunities with personalized inquiry drafts. Each email needs your approval in Emails.</p>
    ${error?html`<p class="err" role="alert">${error}</p>`:null}
    ${state?html`<p><b>${state.enabled?'Daily preparation on':'Daily preparation paused'}</b></p><p class="muted">This Mac must be awake with Codex running. Fewer than five leads may qualify. Sending stays under separate approval controls.</p><button disabled=${busy} onClick=${()=>run('settings',{enabled:!state.enabled})}>${state.enabled?'Pause daily preparation':'Resume daily preparation'}</button>
     <label class="field">Maximum paid Hunter checks per day<select value=${state.verification_budget} disabled=${busy} onChange=${e=>run('settings',{verification_budget:Number(e.target.value)})}>${[0,1,2,3,4,5].map(n=>html`<option key=${n} value=${n}>${n===0?'0 — no paid checks':n}</option>`)}</select></label><p class="muted">Requires a configured Hunter account. Unverified addresses need contact review before queueing.</p>
    `:html`<p>Loading daily preparation…</p>`}</div></section>`,settingsTarget):null}
  </div>`;
 };
})();
