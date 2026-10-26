"""Kirat-only approval bridge over a separate pinned Harvey outbox. JSON on stdin/stdout."""
import asyncio
import base64
import contextlib
import fcntl
import json
import os
import re
import sqlite3
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone
from email.utils import make_msgid
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
PIN='0041b6a3a9930426fb8f9beba64eb62438c96711'
HOST='sg2plzcpnl507296.prod.sin2.secureserver.net'
EMAIL='sales@kiratcreations.com'
PROFILE={'sender_name':'Business Development Team','email':EMAIL,'company':'Kirat Creations','phone':'+91 99993 02167','website':'https://kiratcreations.com','tagline':'Signage | Graphics | Display Units | Turnkey Solutions'}
ZONE=ZoneInfo('Asia/Kolkata')
ACTIVE=('pending_review','approved')

def address(value):
    if not isinstance(value,str) or len(value)>254 or not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}",value):
        raise ValueError('A single valid email address is required.')
    return value.lower()

def text(value,name,limit=10000,header=False):
    if not isinstance(value,str) or not value.strip() or len(value)>limit or '\0' in value or (header and ('\n' in value or '\r' in value)):
        raise ValueError('Invalid '+name+'.')
    return value.strip()

def business_after(value,days):
    count=0
    while count<days:
        value+=timedelta(days=1)
        if value.astimezone(ZONE).weekday()<5: count+=1
    return value

class Keychain:
    def __init__(self,root=ROOT): self.helper=root/'.local/bin/kirat-keychain'
    def call(self,action,password=''):
        if not self.helper.is_file(): raise ValueError('Keychain helper missing. Run npm run install:mac.')
        try:
            r=subprocess.run([str(self.helper)],input=json.dumps({'action':action,'password':password}),capture_output=True,text=True,timeout=20)
            result=json.loads(r.stdout)
            if r.returncode or not result.get('ok'): raise ValueError('Keychain access failed. Allow Kirat access in the macOS prompt.')
            return result.get('password','')
        except (subprocess.SubprocessError,json.JSONDecodeError): raise ValueError('Keychain access unavailable.') from None
    def get(self): return self.call('get')
    def set(self,password): self.call('set',password)
    def delete(self): self.call('delete')

class MailService:
    def __init__(self,directory,transport=None,credentials=None,clock=None):
        self.directory=Path(directory); self.directory.mkdir(mode=0o700,parents=True,exist_ok=True)
        os.chmod(self.directory,0o700)
        self.clock=clock or (lambda:datetime.now(timezone.utc))
        self.credentials=credentials or Keychain()
        if transport is None:
            import kirat_mail_transport as transport
        self.transport=transport
        filename=self.directory/'harvey.db'
        if not filename.exists():
            checkout=ROOT/'.local/harvey'
            actual=subprocess.run(['git','-C',str(checkout),'rev-parse','HEAD'],capture_output=True,text=True).stdout.strip()
            if actual!=PIN: raise ValueError('Install the pinned Harvey version using Repair setup before email setup.')
            sys.path.insert(0,str(checkout))
            from harvey.state import StateManager
            asyncio.run(StateManager(str(filename)).init_db())
        os.chmod(filename,0o600)
        self.db=sqlite3.connect(filename,timeout=10); self.db.row_factory=sqlite3.Row
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS kirat_meta (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, approved_revision INTEGER, lead_id TEXT, lead_name TEXT, source_url TEXT, verification TEXT, risk_acknowledged INTEGER, previous_id TEXT, delay_days INTEGER, mime TEXT, profile_json TEXT, warning TEXT DEFAULT '', approval_at TEXT);
        CREATE TABLE IF NOT EXISTS kirat_inbound (id TEXT PRIMARY KEY, data TEXT NOT NULL, lead_id TEXT, to_email TEXT, received_at TEXT);
        CREATE TABLE IF NOT EXISTS kirat_suppression (email TEXT PRIMARY KEY, reason TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS kirat_daily (daily_key TEXT PRIMARY KEY, item_id TEXT NOT NULL, payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS kirat_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
        ''')
        if self.setting('profile') is None: self.set_setting('profile',PROFILE)
        self.db.commit()
    def setting(self,key,default=None):
        r=self.db.execute('SELECT value FROM kirat_settings WHERE key=?',(key,)).fetchone()
        return json.loads(r[0]) if r else default
    def set_setting(self,key,value):
        self.db.execute('INSERT OR REPLACE INTO kirat_settings VALUES (?,?)',(key,json.dumps(value)))
    def now(self): return self.clock().astimezone(timezone.utc)
    def config(self): return self.setting('config',{'host':HOST,'smtp_port':465,'imap_port':993,'username':EMAIL})
    def profile(self): return self.setting('profile',PROFILE)
    def item(self,item_id):
        r=self.db.execute('SELECT o.*,m.revision,m.approved_revision,m.lead_id,m.lead_name,m.source_url,m.verification,m.risk_acknowledged,m.previous_id,m.delay_days,m.profile_json,m.warning,m.approval_at FROM outbox o JOIN kirat_meta m ON m.id=o.id WHERE o.id=?',(item_id,)).fetchone()
        if not r: raise ValueError('Email item not found.')
        out=dict(r); daily=self.db.execute('SELECT daily_key FROM kirat_daily WHERE item_id=?',(item_id,)).fetchone(); out['daily_key']=daily[0] if daily else None; out['profile']=json.loads(out.pop('profile_json')); return out
    def status(self):
        ids=[r[0] for r in self.db.execute("SELECT m.id FROM kirat_meta m JOIN outbox o ON o.id=m.id WHERE o.status IN ('pending_review','approved','sending','delivery_unknown','failed') ORDER BY m.rowid DESC")]
        ids += [r[0] for r in self.db.execute("SELECT m.id FROM kirat_meta m JOIN outbox o ON o.id=m.id WHERE o.status NOT IN ('pending_review','approved','sending','delivery_unknown','failed') ORDER BY m.rowid DESC LIMIT 50")]
        incoming=[]
        for r in self.db.execute('SELECT * FROM kirat_inbound ORDER BY rowid DESC LIMIT 100'):
            full=json.loads(r['data']); m={k:full.get(k) for k in ('uid','is_bounce','is_opt_out','ambiguous','candidates') if k in full}
            for key,limit in [('from_email',254),('subject',200),('body',2000),('message_id',500),('in_reply_to',500),('references',2000)]: m[key]=str(full.get(key,''))[:limit]
            m.update(id=r['id'],lead_id=r['lead_id'],to_email=r['to_email'],truncated=len(full.get('body',''))>2000); incoming.append(m)
        return {'configured':self.setting('configured',False),'tested':self.setting('tested',False),'enabled':self.setting('enabled',False),'readiness_confirmed':self.setting('readiness',False),'profile':self.profile(),'config':self.config(),'items':[self.item(i) for i in ids], 'inbound':incoming,'suppressed':[dict(r) for r in self.db.execute('SELECT * FROM kirat_suppression ORDER BY email')],'last_sync':self.setting('last_sync'),'notice':self.setting('notice','Sending starts paused. Every email needs individual approval.'),'daily_cap':10,'interval_minutes':5,'window':'Weekdays 10:00–17:00 Asia/Kolkata; app open and Mac awake.'}
    def configure(self,data):
        allowed={'password','sender_name','sent_folder'}
        if set(data)-allowed: raise ValueError('Unknown mailbox setting.')
        self.set_setting('enabled',False); self.set_setting('tested',False); self.set_setting('readiness',False)
        profile=self.profile()
        if 'sender_name' in data: profile['sender_name']=text(data['sender_name'],'sender name',100,True)
        if 'password' in data:
            password=data['password']
            if not isinstance(password,str) or not 1<=len(password.encode('utf-8'))<=1000 or '\0' in password: raise ValueError('Enter the mailbox password.')
            self.credentials.set(password); self.set_setting('configured',True)
        if 'sent_folder' in data:
            config=self.config(); config['sent_folder']=text(data['sent_folder'],'Sent folder',200,True); self.set_setting('config',config)
        self.set_setting('profile',profile)
        for r in self.db.execute("SELECT o.id FROM outbox o JOIN kirat_meta m ON m.id=o.id WHERE o.status IN ('pending_review','approved')").fetchall():
            self.db.execute("UPDATE outbox SET status='pending_review' WHERE id=?",(r[0],))
            self.db.execute('UPDATE kirat_meta SET revision=revision+1,approved_revision=NULL,profile_json=?,mime=NULL WHERE id=?',(json.dumps(profile),r[0]))
        for r in self.db.execute("SELECT o.id FROM outbox o JOIN kirat_meta m ON m.id=o.id WHERE o.status='pending_review'").fetchall(): self.snapshot_mime(r[0])
        self.db.commit(); return self.status()
    def disconnect(self):
        self.credentials.delete(); self.set_setting('configured',False); self.set_setting('enabled',False); self.set_setting('tested',False); self.set_setting('readiness',False); self.db.commit(); return self.status()
    def password(self):
        if not self.setting('configured',False): raise ValueError('Connect your mailbox first.')
        p=self.credentials.get()
        if not p: raise ValueError('Mailbox credential is unavailable. Reconnect the mailbox.')
        return p
    def test(self):
        try:
            result=self.transport.test_connection(self.config(),self.password())
            if not result.get('ok'): raise ValueError('Connection failed')
            config=self.config()
            if result.get('sent_folder'): config['sent_folder']=result['sent_folder']; self.set_setting('config',config)
            self.set_setting('tested',True); self.set_setting('notice','Mailbox login verified. Approve a controlled test email before enabling lead sending.'); self.db.commit()
            return {'ok':True,'message':'SMTP and IMAP login verified. No email was sent.'}
        except Exception:
            self.set_setting('tested',False); self.set_setting('enabled',False); self.db.commit(); return {'ok':False,'error':'SMTP or IMAP login failed. Check the mailbox password, server access and Sent folder.'}
    def enable(self,data):
        if data.get('enabled') is True:
            if not self.setting('tested') or data.get('readiness_confirmed') is not True: raise ValueError('Test connection and confirm sender/domain/provider readiness first.')
            if self.db.execute("SELECT 1 FROM outbox o JOIN kirat_meta m ON m.id=o.id WHERE o.status='delivery_unknown'").fetchone(): raise ValueError('Resolve delivery-unknown messages before resuming.')
            # A controlled test may be approved and sent before the readiness confirmation.
            if not self.setting('test_sent') and not data.get('test_only'): raise ValueError('Send an individually approved controlled test email first.')
            self.set_setting('readiness',not data.get('test_only')); self.set_setting('test_only',bool(data.get('test_only')))
        self.set_setting('enabled',data.get('enabled') is True); self.db.commit(); return self.status()
    def suppressed(self,email): return bool(self.db.execute('SELECT 1 FROM kirat_suppression WHERE email=?',(email,)).fetchone())
    def stage(self,data):
        daily_key=data.get('daily_key')
        payload=json.dumps({k:v for k,v in data.items() if k!='daily_key'},sort_keys=True,separators=(',',':'))
        if daily_key is not None:
            text(daily_key,'daily key',200,True)
            replay=self.db.execute('SELECT item_id,payload FROM kirat_daily WHERE daily_key=?',(daily_key,)).fetchone()
            if replay:
                if replay['payload']!=payload: raise ValueError('Daily key already belongs to a different email request.')
                return self.item(replay['item_id'])
        if self.db.execute("SELECT COUNT(*) FROM outbox o JOIN kirat_meta m ON m.id=o.id WHERE status IN ('pending_review','approved','sending','delivery_unknown','failed')").fetchone()[0]>=200: raise ValueError('Review or close existing Outbox items before adding more (200 active maximum).')
        email=address(data.get('to_email'))
        if self.suppressed(email): raise ValueError('This address has opted out or is suppressed.')
        subject=text(data.get('subject'),'subject',200,True); body=text(data.get('body'),'body',15000)
        lead_id=text(data.get('lead_id'),'lead',200,True); name=text(data.get('lead_name'),'lead name',300,True)
        source=data.get('source_url','')
        if not isinstance(source,str) or len(source)>2000 or not re.match(r'^https?://[^\s]+$',source): raise ValueError('A published contact source URL is required.')
        verification=data.get('verification','unknown')
        if verification not in ['deliverable','unknown','risky','pending']: raise ValueError('Undeliverable or invalid contact cannot be queued.')
        if verification!='deliverable' and data.get('risk_acknowledged') is not True: raise ValueError('Acknowledge the unverified or risky recipient before staging.')
        previous=data.get('previous_id',''); delay=data.get('delay_days',0)
        kind='test' if data.get('test_message') is True else 'sequence'
        if previous:
            p=self.item(previous)
            if p['to_email']!=email or p['lead_id']!=lead_id or p['kind']=='test': raise ValueError('Follow-up must reference the same lead and recipient.')
            if delay not in (3,7): raise ValueError('Follow-ups need a three or seven business-day interval.')
            kind='sequence'
            if self.db.execute('SELECT 1 FROM kirat_meta m JOIN outbox o ON o.id=m.id WHERE previous_id=? AND o.status NOT IN (\'rejected\',\'cancelled\')',(previous,)).fetchone(): raise ValueError('This follow-up is already queued.')
        elif delay: raise ValueError('Choose the preceding email first.')
        if kind=='sequence' and not data.get('reply_id') and self.db.execute('SELECT 1 FROM kirat_inbound WHERE to_email=?',(email,)).fetchone(): raise ValueError('This lead has replied. Review the conversation and draft a reply instead.')
        if kind=='sequence' and not data.get('reply_id') and not previous and self.db.execute("SELECT 1 FROM outbox o JOIN kirat_meta m ON m.id=o.id WHERE o.to_email=? AND m.lead_id=? AND o.kind='sequence' AND (m.previous_id='' OR m.previous_id IS NULL) AND o.status NOT IN ('rejected','cancelled')",(email,lead_id)).fetchone(): raise ValueError('An initial email already exists for this lead and recipient. Review it or choose a follow-up.')
        in_reply_to=self.item(previous)['message_id'] if previous else ''
        if data.get('reply_id'):
            inbound=self.db.execute('SELECT * FROM kirat_inbound WHERE id=?',(data['reply_id'],)).fetchone()
            if not inbound or inbound['to_email']!=email or inbound['lead_id']!=lead_id: raise ValueError('Reply does not match this lead.')
            incoming=json.loads(inbound['data']); in_reply_to=incoming.get('message_id','')
            kind='reply'
        item_id=uuid.uuid4().hex; message_id=make_msgid(domain='kiratcreations.com'); now=self.now().isoformat()
        self.db.execute('INSERT INTO outbox (id,prospect_id,to_email,subject,body,status,send_at,provider,message_id,kind,in_reply_to,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',(item_id,lead_id,email,subject,body,'pending_review',now,'smtp',message_id,kind,in_reply_to,now,now))
        self.db.execute('INSERT INTO kirat_meta (id,revision,lead_id,lead_name,source_url,verification,risk_acknowledged,previous_id,delay_days,profile_json) VALUES (?,?,?,?,?,?,?,?,?,?)',(item_id,1,lead_id,name,source,verification,int(data.get('risk_acknowledged') is True),previous,delay,json.dumps(self.profile())))
        if daily_key is not None: self.db.execute('INSERT INTO kirat_daily VALUES (?,?,?)',(daily_key,item_id,payload))
        self.snapshot_mime(item_id)
        self.db.commit(); return self.item(item_id)
    def snapshot_mime(self,item_id):
        from email.utils import format_datetime
        i=self.item(item_id); i['date']=format_datetime(datetime.fromisoformat(i['created_at']))
        chain=[]; parent=i['previous_id']
        while parent and len(chain)<50:
            p=self.item(parent); chain.insert(0,p['message_id']); parent=p['previous_id']
        i['references']=' '.join(chain) if chain else i['in_reply_to']
        raw=self.transport.render_message(i,i['profile'],(ROOT/'assets/kirat-email-logo.png').read_bytes())
        self.db.execute('UPDATE kirat_meta SET mime=? WHERE id=?',(base64.b64encode(raw).decode(),item_id))
    def revision(self,data):
        i=self.item(data.get('id'))
        if type(data.get('revision')) is not int or data['revision']!=i['revision']: raise ValueError('This email changed. Reload and review the latest revision.')
        return i
    def edit(self,data):
        i=self.revision(data)
        if i['status'] not in ACTIVE: raise ValueError('Only unsent reviewable emails can be edited.')
        subject=text(data.get('subject'),'subject',200,True); body=text(data.get('body'),'body',15000)
        self.db.execute("UPDATE outbox SET subject=?,body=?,status='pending_review',updated_at=? WHERE id=?",(subject,body,self.now().isoformat(),i['id']))
        self.db.execute('UPDATE kirat_meta SET revision=revision+1,approved_revision=NULL,mime=NULL,approval_at=NULL WHERE id=?',(i['id'],)); self.snapshot_mime(i['id']); self.db.commit(); return self.item(i['id'])
    def approve(self,data):
        i=self.revision(data)
        if i['status']!='pending_review' or self.suppressed(i['to_email']): raise ValueError('This email cannot be approved.')
        if not self.db.execute('SELECT mime FROM kirat_meta WHERE id=?',(i['id'],)).fetchone()[0]: raise ValueError('Preview snapshot missing. Edit and review this email again.')
        self.db.execute('UPDATE kirat_meta SET approved_revision=revision,approval_at=? WHERE id=?',(self.now().isoformat(),i['id']))
        self.db.execute("UPDATE outbox SET status='approved' WHERE id=?",(i['id'],)); self.db.commit(); return self.item(i['id'])
    def reject(self,data):
        i=self.revision(data)
        if i['status'] not in ACTIVE: raise ValueError('This email can no longer be cancelled.')
        self.db.execute("UPDATE outbox SET status='rejected' WHERE id=?",(i['id'],)); self.db.commit(); return self.item(i['id'])
    def cancel_address(self,email,reason):
        self.db.execute("UPDATE outbox SET status='cancelled',error=? WHERE to_email=? AND id IN (SELECT id FROM kirat_meta) AND status IN ('pending_review','approved') AND kind!='reply'",(reason,email))
    def suppress(self,data):
        email=address(data.get('email')); self.db.execute('INSERT OR REPLACE INTO kirat_suppression VALUES (?,?)',(email,'Opt-out / manual suppression'))
        self.db.execute("UPDATE outbox SET status='cancelled',error='Suppressed recipient' WHERE to_email=? AND id IN (SELECT id FROM kirat_meta) AND status IN ('pending_review','approved')",(email,)); self.db.commit(); return self.status()
    def sync(self):
        result=self.transport.sync_inbox(self.config(),self.password(),self.setting('checkpoint',{}))
        if result.get('complete') is not True: raise ValueError('Inbox sync is incomplete.')
        checkpoint=self.setting('checkpoint',{})
        if checkpoint and str(checkpoint.get('uidvalidity'))!=str(result['uidvalidity']):
            self.set_setting('enabled',False); self.set_setting('notice','Inbox identity changed. Recent mail was rescanned; review conversations before resuming.')
        for m in result.get('messages',[]):
            from_email=m.get('from_email','').lower()
            refs=' '.join([str(m.get('in_reply_to','')),str(m.get('references',''))])
            matches=re.findall(r'<[^<>\s]+>',refs)
            item=None
            for ref in matches:
                r=self.db.execute("SELECT o.id FROM outbox o JOIN kirat_meta k ON k.id=o.id WHERE message_id=? AND status IN ('sent','delivery_unknown')",(ref,)).fetchone()
                if r: item=self.item(r[0]); break
            if item and from_email!=item['to_email'] and not m.get('is_bounce'): item=None
            target=m.get('bounced_address','').lower() if m.get('is_bounce') else from_email
            if not item and target:
                rows=self.db.execute("SELECT o.id FROM outbox o JOIN kirat_meta k ON k.id=o.id WHERE to_email=? AND status IN ('sent','delivery_unknown') ORDER BY sent_at DESC",(target,)).fetchall()
                leads={self.item(r[0])['lead_id'] for r in rows}
                if len(leads)==1 and rows: item=self.item(rows[0][0])
                elif len(leads)>1:
                    identity=str(result['uidvalidity'])+':'+str(m['uid'])
                    m['ambiguous']=True
                    m['candidates']=list({self.item(r[0])['lead_id']:{'lead_id':self.item(r[0])['lead_id'],'lead_name':self.item(r[0])['lead_name']} for r in rows}.values())
                    self.db.execute('INSERT OR IGNORE INTO kirat_inbound VALUES (?,?,?,?,?)',(identity,json.dumps(m),'',target,self.now().isoformat()))
                    self.cancel_address(target,'Ambiguous reply association; manual review required')
                    self.set_setting('enabled',False); self.set_setting('notice','An incoming message matches multiple leads. Sending paused for manual review.')
            stop=m.get('is_bounce') or m.get('is_opt_out') or re.search(r'\b(unsubscribe|remove me|stop emailing|do not contact|don.t contact)\b',m.get('body',''),re.I)
            if stop and (item or m.get('ambiguous')):
                stopped_email=item['to_email'] if item else target
                self.db.execute('INSERT OR REPLACE INTO kirat_suppression VALUES (?,?)',(stopped_email,'Bounce or opt-out'))
                self.db.execute("UPDATE outbox SET status='cancelled',error='Bounce or opt-out' WHERE to_email=? AND id IN (SELECT id FROM kirat_meta) AND status IN ('pending_review','approved')",(stopped_email,))
            if not item: continue
            identity=str(result['uidvalidity'])+':'+str(m['uid'])
            self.db.execute('INSERT OR IGNORE INTO kirat_inbound VALUES (?,?,?,?,?)',(identity,json.dumps(m),item['lead_id'],item['to_email'],self.now().isoformat()))
            self.cancel_address(item['to_email'],'Inbound reply or bounce received')
        self.set_setting('checkpoint',{'uidvalidity':str(result['uidvalidity']),'last_uid':result['last_uid']}); self.set_setting('last_sync',self.now().isoformat()); self.db.commit(); return result
    def recover(self):
        r=self.db.execute("UPDATE outbox SET status='delivery_unknown',error='Sending was interrupted. Check Sent and reconcile; do not resend.' WHERE status='sending' AND id IN (SELECT id FROM kirat_meta)")
        if r.rowcount: self.set_setting('enabled',False); self.set_setting('notice','Interrupted sending requires reconciliation.')
        self.db.commit()
    def tick(self):
        if not self.setting('enabled'): return self.status()
        try:
            self.sync()
        except Exception:
            self.set_setting('enabled',False); self.set_setting('notice','Sending paused: inbox sync failed or was incomplete. Check connection and resume.'); self.db.commit(); return self.status()
        if not self.setting('enabled'): return self.status()
        now=self.now(); local=now.astimezone(ZONE)
        if local.weekday()>4 or not 10<=local.hour<17: return self.status()
        attempts=self.setting('attempts',[])
        day=local.date().isoformat()
        if len([a for a in attempts if datetime.fromisoformat(a).astimezone(ZONE).date().isoformat()==day])>=10: return self.status()
        if attempts and (now-datetime.fromisoformat(attempts[-1])).total_seconds()<300: return self.status()
        for r in self.db.execute("SELECT o.id FROM outbox o JOIN kirat_meta m ON m.id=o.id WHERE status='approved' ORDER BY o.created_at,o.id").fetchall():
            i=self.item(r[0])
            if self.setting('test_only') and i['kind']!='test': continue
            if i['approved_revision']!=i['revision'] or self.suppressed(i['to_email']): continue
            if i['previous_id']:
                previous=self.item(i['previous_id'])
                if previous['status']!='sent': continue
                if now<business_after(datetime.fromisoformat(previous['sent_at']),i['delay_days']): continue
            rawrow=self.db.execute('SELECT mime FROM kirat_meta WHERE id=?',(i['id'],)).fetchone()
            if not rawrow[0]: continue
            raw=base64.b64decode(rawrow[0]); password=self.password()
            self.db.execute('BEGIN IMMEDIATE')
            claimed=self.db.execute("UPDATE outbox SET status='sending' WHERE id=? AND status='approved'",(i['id'],)).rowcount
            if not claimed: self.db.rollback(); continue
            self.set_setting('attempts',(attempts+[now.isoformat()])[-1000:]); self.db.commit()
            try: outcome=self.transport.submit(self.config(),password,raw)
            except Exception: outcome={'status':'delivery_unknown'}
            status=outcome.get('status')
            if status not in ('sent','failed','delivery_unknown'): status='delivery_unknown'
            error='' if status=='sent' else 'Delivery uncertain. Check Sent before reconciling.' if status=='delivery_unknown' else 'SMTP rejected or failed before submission. Review connection and recipient.'
            self.db.execute('UPDATE outbox SET status=?,sent_at=?,error=? WHERE id=?',(status,now.isoformat() if status=='sent' else None,error,i['id']))
            if status=='delivery_unknown': self.set_setting('enabled',False); self.set_setting('notice',error)
            if status=='sent' and i['kind']=='test': self.set_setting('test_sent',True); self.set_setting('enabled',False); self.set_setting('notice','Controlled test accepted by SMTP. Check receipt before enabling lead sending.')
            self.db.commit()
            if status=='sent':
                try: copy=self.transport.save_sent(self.config(),password,raw)
                except Exception: copy={'ok':False}
                if not copy.get('ok'): self.db.execute('UPDATE kirat_meta SET warning=? WHERE id=?',('SMTP accepted; saving Sent copy failed. Email will not be resent.',i['id'])); self.db.commit()
            break
        return self.status()
    def incoming(self,data):
        row=self.db.execute('SELECT data FROM kirat_inbound WHERE id=?',(data.get('id'),)).fetchone()
        if not row: raise ValueError('Incoming message not found.')
        message=json.loads(row[0]); body=message.get('body','')
        return {'body':body[:100000],'truncated':len(body)>100000}
    def match_reply(self,data):
        row=self.db.execute('SELECT * FROM kirat_inbound WHERE id=?',(data.get('id'),)).fetchone()
        if not row: raise ValueError('Incoming message not found.')
        message=json.loads(row['data'])
        if not message.get('ambiguous') or data.get('lead_id') not in [c['lead_id'] for c in message.get('candidates',[])]: raise ValueError('Choose a matching lead.')
        message['ambiguous']=False
        self.db.execute('UPDATE kirat_inbound SET data=?,lead_id=? WHERE id=?',(json.dumps(message),data['lead_id'],row['id'])); self.db.commit(); return self.status()
    def reconcile(self,data):
        i=self.revision(data)
        if i['status'] not in ('delivery_unknown','failed'): raise ValueError('Only failed or delivery-unknown messages can be reconciled.')
        resolution=data.get('resolution')
        if resolution not in ('sent','not_sent'): raise ValueError('Choose confirmed sent or confirmed not sent after checking the mailbox.')
        if data.get('confirmed') is not True: raise ValueError('Confirm the mailbox was checked first.')
        self.db.execute('UPDATE outbox SET status=?,sent_at=?,error=? WHERE id=?',('sent' if resolution=='sent' else 'rejected',self.now().isoformat() if resolution=='sent' else None,'Manually reconciled; no automatic retry',i['id']))
        if resolution=='sent' and i['kind']=='test': self.set_setting('test_sent',True)
        self.db.commit(); return self.item(i['id'])
    def preview(self,data):
        from email import policy
        from email.parser import BytesParser
        i=self.revision(data)
        stored=self.db.execute('SELECT mime FROM kirat_meta WHERE id=?',(i['id'],)).fetchone()[0]
        raw=base64.b64decode(stored) if stored else self.transport.render_message(i,i['profile'],(ROOT/'assets/kirat-email-logo.png').read_bytes())
        message=BytesParser(policy=policy.default).parsebytes(raw)
        html=message.get_body(preferencelist=('html',))
        if html is None: raise ValueError('HTML preview unavailable.')
        rendered=html.get_content()
        for part in message.walk():
            cid=str(part.get('Content-ID','')).strip('<>')
            if cid and part.get_content_type()=='image/png': rendered=rendered.replace('cid:'+cid,'data:image/png;base64,'+base64.b64encode(part.get_payload(decode=True)).decode())
        return {'html':rendered,'revision':i['revision'],'subject':i['subject'],'to_email':i['to_email'],'message_id':i['message_id']}
    def dispatch(self,action,data):
        if action=='startup':
            self.set_setting('enabled',False); self.db.commit(); return self.status()
        if action=='status': return self.status()
        if action=='disconnect': return self.disconnect()
        if action=='test': return self.test()
        if action=='tick': return self.tick()
        if action=='sync':
            try: self.sync(); return self.status()
            except Exception:
                self.set_setting('enabled',False); self.set_setting('notice','Inbox sync failed; sending paused.'); self.db.commit(); raise ValueError('Inbox sync failed. Check connection.') from None
        if action in ('configure','enable','stage','edit','approve','reject','suppress','reconcile','preview','match_reply','incoming'): return getattr(self,action)(data)
        raise ValueError('Unknown mail operation.')

@contextlib.contextmanager
def mail_lock(directory):
    directory=Path(directory); directory.mkdir(mode=0o700,parents=True,exist_ok=True)
    with (directory/'lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        yield

def main():
    os.umask(0o077)
    directory=ROOT/'.local/mail'; directory.mkdir(mode=0o700,parents=True,exist_ok=True)
    with mail_lock(directory):
        request=json.load(sys.stdin)
        service=MailService(directory)
        service.recover()
        result=service.dispatch(request.get('action'),request.get('data',{}))
        print(json.dumps({'ok':True,'data':result}))
if __name__=='__main__':
    try: main()
    except ValueError as e: print(json.dumps({'ok':False,'error':str(e)})); sys.exit(1)
    except Exception: print(json.dumps({'ok':False,'error':'Mail service unavailable. Repair setup or check the mailbox connection.'})); sys.exit(1)
