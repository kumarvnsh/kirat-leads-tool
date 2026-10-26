/* Local Mac service only. No credentials or mail controls enter the static build. */
(function(){
 'use strict';
 const html=htm.bind(React.createElement);
 window.addEventListener('pagehide',()=>{fetch('/api/mail/enable',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','X-Kirat-Local':'1'},body:JSON.stringify({enabled:false})}).catch(()=>{});});
 async function api(action,data){const r=await fetch('/api/mail/'+action,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Kirat-Local':'1'},body:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw new Error(v.error||'Mail request failed.');return v;}
 const MailContext=React.createContext(null);
 function useMailState(){
  const [state,setState]=React.useState(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);
  React.useEffect(()=>{let live=true,pending=false;async function load(){if(pending)return;pending=true;try{const s=await api('status');if(live)setState(s);}catch(e){if(live)setError(e.message);}finally{pending=false;}}load();const t=setInterval(load,5000);return()=>{live=false;clearInterval(t);};},[]);
  async function run(action,data={}){setBusy(true);setError('');try{const result=await api(action,data);setState(await api('status'));return result;}catch(e){setError(e.message);return null;}finally{setBusy(false);}}
  return {state,error,busy,run};
 }
 function useMail(){const shared=React.useContext(MailContext);return shared||useMailState();}
 window.KiratMailProvider=function({children}){const mail=useMailState();return html`<${MailContext.Provider} value=${mail}>${children}<//>`;};
 window.KiratMailBadge=function({kind}){const {state}=useMail();const count=kind==='replies'?state?.inbound.length:state?.items.filter(i=>i.status==='pending_review').length;return count?html`<span aria-hidden="true"> (${count})</span>`:null;};
 window.KiratMailStatus=function({onNavigate}){const {state}=useMail();return html`<button class="mail-status" onClick=${()=>onNavigate?.('settings')}>${state?.enabled?'Sending enabled':'Sending paused'}</button>`;};
 function segmentFor(item){if(item.status==='pending_review')return 'approval';if(['approved','sending'].includes(item.status))return 'scheduled';if(item.status==='sent')return 'sent';return 'attention';}
 function Signature({profile}) {return html`<div style=${{borderTop:'1px solid #ddd',paddingTop:'10px',marginTop:'12px'}}><b>${profile.sender_name}</b><br/>${profile.company}<br/>${profile.phone}<br/>${profile.email}<br/><a href=${profile.website} target="_blank" rel="noopener noreferrer">${profile.website}</a><br/><img src="/assets/kirat-email-logo.png" alt="Kirat Creations logo" style=${{width:'250px',maxWidth:'100%',height:'auto'}}/><br/><small>${profile.tagline}</small></div>`;}
 function QueueItem({item,run,busy}) {
  const [subject,setSubject]=React.useState(item.subject),[body,setBody]=React.useState(item.body),[preview,setPreview]=React.useState(null),[checked,setChecked]=React.useState(false);
  React.useEffect(()=>{setSubject(item.subject);setBody(item.body);setPreview(null);setChecked(false);},[item.revision]);
  const changed=subject!==item.subject||body!==item.body,editable=['pending_review','approved'].includes(item.status);
  const input={id:item.id,revision:item.revision};
  return html`<article class="box" aria-label=${'Email to '+item.to_email}>
    <p><b>${item.lead_name}</b> · ${item.to_email}<br/><span role="status">${item.status.replaceAll('_',' ')}</span> · revision ${item.revision} · ${item.kind==='test'?'Controlled test':item.kind==='reply'?'Conversation reply':item.previous_id?'Follow-up':'Initial email'}</p>
    <p class="muted">${item.previous_id?'After preceding email is sent + '+item.delay_days+' business days':'Next eligible sending slot after approval'} · Recipient: ${item.verification}</p>
    <a href=${item.source_url} target="_blank" rel="noopener noreferrer">Contact source</a>
    <label class="field">Queued email subject<input value=${subject} disabled=${!editable||busy} maxLength="200" onChange=${e=>{setSubject(e.target.value);setPreview(null);}}/></label>
    <label class="field">Queued email body<textarea aria-label="Queued email body" value=${body} disabled=${!editable||busy} rows="6" onChange=${e=>{setBody(e.target.value);setPreview(null);}}/></label>
    ${changed?html`<p>Unsaved changes. Saving returns this email to individual review.</p><button disabled=${busy} onClick=${()=>run('edit',{...input,subject,body})}>Save queued email edits</button>`:null}
    <div class="actions"><button disabled=${busy||changed} onClick=${async()=>{const p=await run('preview',input);if(p)setPreview(p);}}>Preview complete email</button>
    ${item.status==='pending_review'?html`<button class="primary" disabled=${busy||changed||!preview||preview.revision!==item.revision} onClick=${()=>run('approve',input)}>Approve this email</button>`:null}
    ${editable?html`<button disabled=${busy} onClick=${()=>run('reject',input)}>Cancel this email</button>`:null}</div>
    ${preview?html`<div><p><b>To:</b> ${preview.to_email}<br/><b>Subject:</b> ${preview.subject}</p><iframe title=${'Complete email preview '+item.id} sandbox="" srcDoc=${preview.html} style=${{width:'100%',height:'430px',border:'1px solid #ddd',background:'white'}}/></div>`:null}
    ${item.error?html`<p class="err">${item.error}</p>`:null}${item.warning?html`<p class="err">${item.warning}</p>`:null}
    ${['delivery_unknown','failed'].includes(item.status)?html`<label class="check"><input type="checkbox" checked=${checked} onChange=${e=>setChecked(e.target.checked)}/>I checked the mailbox and confirmed the outcome.</label><div class="actions"><button disabled=${busy||!checked} onClick=${()=>run('reconcile',{...input,resolution:'sent',confirmed:true})}>Record confirmed sent</button><button disabled=${busy||!checked} onClick=${()=>run('reconcile',{...input,resolution:'not_sent',confirmed:true})}>Record not sent; close item</button></div><p class="muted">Nothing is retried automatically. After confirming not sent, stage a replacement from the lead if needed.</p>`:null}
  </article>`;
 }
 function InboxReply({message,run,busy,onNavigate,leadName}){
  const [writing,setWriting]=React.useState(false),[subject,setSubject]=React.useState('Re: '+message.subject),[body,setBody]=React.useState(''),[match,setMatch]=React.useState(message.candidates?.[0]?.lead_id||''),[detail,setDetail]=React.useState(null);
  return html`<details class="box"><summary>${message.is_bounce?'Bounce':'Reply'} · ${message.from_email} · ${message.subject}</summary><p>${leadName||'Conversation awaiting association'}${message.is_bounce?' · Delivery blocked; queued follow-ups stopped.':''}</p><p style=${{whiteSpace:'pre-wrap'}}>${detail?detail.body:message.body}</p>${message.truncated&&!detail?html`<button disabled=${busy} onClick=${async()=>{const value=await run('incoming',{id:message.id});if(value)setDetail(value);}}>Read more of this reply</button>`:null}${detail?.truncated?html`<p>Reply is very long. Open it in Mac Mail to read the remainder.</p>`:null}
   <button disabled=${busy} onClick=${()=>run('suppress',{email:message.to_email})}>Suppress this recipient</button>
   ${message.ambiguous?html`<p class="err">This message matches multiple leads. Choose its conversation before drafting a reply.</p><label class="field">Match incoming reply to lead<select value=${match} onChange=${e=>setMatch(e.target.value)}>${message.candidates.map(c=>html`<option key=${c.lead_id} value=${c.lead_id}>${c.lead_name}</option>`)}</select></label><button disabled=${busy||!match} onClick=${()=>run('match-reply',{id:message.id,lead_id:match})}>Match to selected lead</button>`:null}
   ${!message.is_bounce&&!message.ambiguous?html`<button disabled=${busy} onClick=${()=>setWriting(!writing)}>Draft a reply</button>`:null}
   ${writing?html`<label class="field">Reply subject<input value=${subject} onChange=${e=>setSubject(e.target.value)}/></label><label class="field">Reply body<textarea value=${body} rows="6" onChange=${e=>setBody(e.target.value)}/></label><button disabled=${busy||!body.trim()} onClick=${async()=>{if(await run('reply',{reply_id:message.id,subject,body})){setWriting(false);setBody('');onNavigate?.('emails');}}}>Queue reply for individual approval</button>`:null}</details>`;
 }
 window.KiratMailPanel=function({view,onNavigate}={}){
  const {state,error,busy,run}=useMail();
  const [password,setPassword]=React.useState(''),[sender,setSender]=React.useState('Business Development Team'),[folder,setFolder]=React.useState(''),[ready,setReady]=React.useState(false),[testTo,setTestTo]=React.useState(''),[suppressTo,setSuppressTo]=React.useState(''),[message,setMessage]=React.useState('');
  const [segment,setSegment]=React.useState('approval'),[selected,setSelected]=React.useState(null),[requested,setRequested]=React.useState(null);
  React.useEffect(()=>{if(view!=='emails')return;const open=e=>setRequested(e.detail?.id||null);window.addEventListener('kirat-open-email',open);return()=>window.removeEventListener('kirat-open-email',open);},[view]);
  React.useEffect(()=>{if(!requested||!state)return;const item=state.items.find(i=>i.id===requested);if(item){setSegment(segmentFor(item));setSelected(item.id);setRequested(null);}},[requested,state]);
  async function action(name,data){const result=await run(name,data);if(result&&name==='test')setMessage(result.ok?result.message:result.error);return result;}
  return html`<section class="box" aria-label=${view==='settings'?'Email settings':view==='replies'?'Replies':view==='emails'?'Emails':'Email sending'} style=${{marginTop:'16px'}}><h2>${view==='settings'?'Email settings':view==='replies'?'Replies':view==='emails'?'Emails':'Email sending'}</h2>
   <p hidden=${!!view}>Each initial email, follow-up and reply needs its own approval. Sending runs while Kirat Lead Desk is open and this Mac is awake.</p>
   ${error?html`<p role="alert" class="err">${error}</p>`:null}
   ${!state?html`<p>Loading local mailbox setup…</p>`:html`
   <div hidden=${!!view&&view!=='settings'}><p role="status"><b>${state.enabled?'Sending enabled':'Sending paused'}</b> · ${state.notice}</p><p class="muted">${state.window} Maximum ${state.daily_cap} attempts/day, at least ${state.interval_minutes} minutes apart. Last inbox sync: ${state.last_sync||'not yet checked'}.</p>
   <details class="box"><summary>Mailbox setup · ${state.configured?'connected credentials':'not configured'}</summary>
    <p>sales@kiratcreations.com<br/>SMTP: ${state.config.host}:465 TLS<br/>IMAP: ${state.config.host}:993 TLS</p>
    <label class="field">Sender display name<input value=${sender} maxLength="100" onChange=${e=>setSender(e.target.value)}/></label>
    <label class="field">Mailbox password<input type="password" autoComplete="new-password" value=${password} onChange=${e=>setPassword(e.target.value)} placeholder="Stored in macOS Keychain"/></label>
    <label class="field">Sent folder (optional)<input value=${folder} onChange=${e=>setFolder(e.target.value)} placeholder="Auto-discover the Sent folder"/></label>
    <div class="actions"><button disabled=${busy||(!password&&!state.configured)} onClick=${async()=>{if(await action('configure',{sender_name:sender,...password?{password}:{},...folder?{sent_folder:folder}:{}})){setPassword('');setMessage('Saved in Keychain. Sending paused; test connection next.');}}}>Save mailbox settings</button>
    <button disabled=${busy||!state.configured} onClick=${()=>action('test',{})}>Test connection without sending</button>
    <button disabled=${busy||!state.configured} onClick=${()=>action('disconnect',{})}>Disconnect Kirat mailbox</button></div><p role="status">${message}</p>
   </details>
   <details class="box"><summary>Signature</summary><${Signature} profile=${state.profile}/></details>
   <details class="box"><summary>Controlled test and sending readiness</summary><p>First test SMTP/IMAP login above, then queue a test to an address you control. Preview and approve it in Emails. Test mode sends only an approved controlled test and then pauses.</p>
    <label class="field">Controlled test recipient<input type="email" value=${testTo} onChange=${e=>setTestTo(e.target.value)}/></label>
    <div class="actions"><button disabled=${busy||!state.tested||!testTo} onClick=${()=>action('test-message',{email:testTo})}>Queue controlled test for approval</button><button disabled=${busy||!state.tested} onClick=${()=>action('enable',{enabled:true,readiness_confirmed:true,test_only:true})}>Enable approved test only</button></div>
    <label class="check"><input type="checkbox" checked=${ready} onChange=${e=>setReady(e.target.checked)}/>I received the controlled test, checked the sender and signature, and reviewed SPF, DKIM, DMARC and my hosting provider's sending policy.</label>
    <button disabled=${busy||!state.tested||!ready} onClick=${()=>action('enable',{enabled:true,readiness_confirmed:true})}>Enable individually approved sending</button>
   </details>
   <div class="actions"><button disabled=${busy||!state.enabled} onClick=${()=>action('enable',{enabled:false})}>Pause sending</button><button disabled=${busy||!state.configured} onClick=${()=>action('sync',{})}>Check replies now</button></div>
   <details class="box"><summary>Suppressed recipients (${state.suppressed.length})</summary><p>Bounced and opted-out recipients cannot receive further email.</p><label class="field">Suppress email address<input type="email" value=${suppressTo} onChange=${e=>setSuppressTo(e.target.value)}/></label><button disabled=${busy||!suppressTo} onClick=${async()=>{if(await action('suppress',{email:suppressTo}))setSuppressTo('');}}>Add suppression</button>${state.suppressed.map(s=>html`<p key=${s.email}>${s.email} · ${s.reason}</p>`)}</details>
   </div><div hidden=${!!view&&view!=='emails'}>
   ${view?html`<p>${state.enabled?'Individually approved messages send in the sending window.':'Sending is paused. Approved emails wait until sending is enabled.'} <button onClick=${()=>onNavigate?.('settings')}>Sending settings</button></p><div class="actions" aria-label="Email segments">${[['approval','Needs approval'],['scheduled','Scheduled'],['sent','Sent'],['attention','Needs attention']].map(([id,label])=>html`<button key=${id} aria-label=${label} aria-pressed=${segment===id} onClick=${()=>setSegment(id)}>${label}<span class="muted"> (${state.items.filter(i=>segmentFor(i)===id).length})</span></button>`)}</div>`:null}
   ${view&&!state.items.some(i=>segmentFor(i)===segment)?html`<p>No emails in this segment.</p>`:null}
   <h3 hidden=${!!view}>Outbox and recent history (${state.items.length})</h3><p class="muted" hidden=${!!view}>All active items and the latest 50 closed items are shown. Mailbox history remains in Mac Mail.</p>${state.items.length?state.items.map(i=>html`<div key=${i.id} hidden=${!!view&&segmentFor(i)!==segment}>${view?html`<button class="email-row" aria-label=${'Open email to '+i.to_email} aria-expanded=${selected===i.id} onClick=${()=>setSelected(selected===i.id?null:i.id)}><b>${i.lead_name}</b> · ${i.to_email} · ${i.subject} · ${i.status.replaceAll('_',' ')}</button>`:null}<div hidden=${!!view&&selected!==i.id}><${QueueItem} item=${i} run=${action} busy=${busy}/></div></div>`):html`<p>No emails queued. Open a saved lead and select a draft to prepare an email.</p>`}
   </div><div hidden=${!!view&&view!=='replies'}><h3>Lead replies</h3><button disabled=${busy||!state.configured} onClick=${()=>action('sync',{})}>Check replies now</button>${state.inbound.length?state.inbound.map(m=>html`<${InboxReply} key=${m.id} message=${m} run=${action} busy=${busy} onNavigate=${onNavigate} leadName=${state.items.find(i=>i.lead_id===m.lead_id)?.lead_name}/>`):html`<p>No matched replies. Replies and opt-outs stop queued follow-ups.</p>`}</div>`}
  </section>`;
 };
 window.KiratMailLeadPanel=function({lead,onNavigate,onSaveDraft}){
  const {state,error,busy,run}=useMail(); const contacts=lead.contacts.filter(c=>c.type==='email');
  const [draftIndex,setDraftIndex]=React.useState(0),[email,setEmail]=React.useState(contacts[0]?.value||''),[subject,setSubject]=React.useState(lead.outreach_draft?.emails?.[0]?.subject||''),[body,setBody]=React.useState(lead.outreach_draft?.emails?.[0]?.body||''),[risk,setRisk]=React.useState(false),[previous,setPrevious]=React.useState(''),[delay,setDelay]=React.useState(3),[message,setMessage]=React.useState('');
  React.useEffect(()=>{if(!contacts.some(c=>c.value===email)){setEmail(contacts[0]?.value||'');setRisk(false);setPrevious('');}},[lead.contacts,email]);
  const draftKey=JSON.stringify(lead.outreach_draft?.emails||[]),savedDraftKey=React.useRef(draftKey);
  React.useLayoutEffect(()=>{if(savedDraftKey.current===draftKey)return;savedDraftKey.current=draftKey;const drafts=lead.outreach_draft?.emails||[],index=drafts[draftIndex]?draftIndex:0;setDraftIndex(index);setSubject(drafts[index]?.subject||'');setBody(drafts[index]?.body||'');},[draftKey]);
  const selected=contacts.find(c=>c.value===email),verification=selected?.delivery_check?.status||'unknown';
  const previousOptions=state?.items.filter(i=>i.lead_id===lead.id&&i.to_email===email&&!['cancelled','rejected','failed','delivery_unknown'].includes(i.status)&&i.kind==='sequence')||[];
  return html`<section class="box" aria-label="Prepare email to lead"><h3>Prepare email for approval</h3><p>Review this draft before queuing it for individual approval. Queuing does not send it.</p>
   ${!contacts.length?html`<p>Add a published business email contact first.</p>`:html`
   <label class="field">Lead email recipient<select aria-label="Lead email recipient" value=${email} onChange=${e=>{setEmail(e.target.value);setRisk(false);setPrevious('');}}>${contacts.map(c=>html`<option key=${c.value} value=${c.value}>${c.value}</option>`)}</select></label>
   <p>Delivery check: ${verification} · <a href=${selected?.source_url} target="_blank" rel="noopener noreferrer">Published contact source</a></p>
   ${verification!=='deliverable'?html`<label class="check"><input type="checkbox" checked=${risk} onChange=${e=>setRisk(e.target.checked)}/>I reviewed this published contact and acknowledge its delivery is unverified or risky.</label>`:null}
   ${lead.outreach_draft?html`<div class="actions"><button onClick=${()=>{setDraftIndex(0);setSubject(lead.outreach_draft.emails[0].subject);setBody(lead.outreach_draft.emails[0].body);}}>Use initial draft</button><details><summary>Optional follow-up drafts</summary>${lead.outreach_draft.emails.slice(1).map((draft,index)=>html`<button key=${index} onClick=${()=>{setDraftIndex(index+1);setSubject(draft.subject);setBody(draft.body);}}>Use follow-up ${index+1} draft</button>`)}</details></div>`:html`<p>Generate outreach drafts or write an email below.</p>`}
   <label class="field">Prepared email subject<input value=${subject} maxLength="200" onChange=${e=>setSubject(e.target.value)}/></label><label class="field">Prepared email body<textarea aria-label="Prepared email body" rows="7" value=${body} onChange=${e=>setBody(e.target.value)}/></label>
   ${onSaveDraft&&lead.outreach_draft?html`<button disabled=${busy||!subject.trim()||!body.trim()} onClick=${()=>onSaveDraft({...lead.outreach_draft,emails:lead.outreach_draft.emails.map((draft,index)=>index===draftIndex?{...draft,subject,body}:draft)})}>Save selected draft edits</button>`:null}
   <details><summary>Follow-up options</summary><label class="field">Email sequence<select value=${previous} onChange=${e=>setPrevious(e.target.value)}><option value="">Initial email</option>${previousOptions.map(i=>html`<option key=${i.id} value=${i.id}>Follow up after: ${i.subject} (${i.status})</option>`)}</select></label>
   ${previous?html`<label class="field">Follow-up interval<select value=${delay} onChange=${e=>setDelay(Number(e.target.value))}><option value="3">3 business days</option><option value="7">7 business days</option></select></label>`:null}
   </details><button class="primary" disabled=${busy||!state||!subject.trim()||!body.trim()||verification==='undeliverable'||(verification!=='deliverable'&&!risk)} onClick=${async()=>{const result=await run('stage',{lead,email,subject,body,risk_acknowledged:risk,previous_id:previous,delay_days:previous?delay:0});if(result){setMessage('Queued for individual review. Open Emails to preview and approve.');onNavigate?.('emails');}}}>Queue this email for review</button>`}
   ${message?html`<p role="status">${message}</p>`:null}${error?html`<p class="err" role="alert">${error}</p>`:null}
  </section>`;
 };
})();
