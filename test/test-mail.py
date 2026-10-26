"""Queue safety tests. No real mailbox credentials or network."""
import sys, tempfile, unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from kirat_mail import MailService, mail_lock

class Credentials:
    value=''
    def get(self): return self.value
    def set(self,value): self.value=value
    def delete(self): self.value=''
class Transport:
    outcome='sent'; sync_error=False; messages=[]; sent_ok=True; count=0
    def test_connection(self,c,p): return {'ok':True,'sent_folder':'Sent'}
    def render_message(self,item,profile,logo): return ('Message-ID: '+item['message_id']+'\r\n\r\n'+item['body']).encode()
    def sync_inbox(self,c,p,checkpoint):
        if self.sync_error: raise RuntimeError('private credential must not escape')
        return {'uidvalidity':'1','last_uid':len(self.messages),'messages':self.messages,'complete':True}
    def submit(self,c,p,raw): self.count+=1; return {'status':self.outcome}
    def save_sent(self,c,p,raw): return {'ok':self.sent_ok}

class QueueTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.t=Transport(); self.t.messages=[]; self.t.count=0
        self.now=datetime(2026,10,23,5,0,tzinfo=timezone.utc)
        self.s=MailService(Path(self.tmp.name),transport=self.t,credentials=Credentials(),clock=lambda:self.now)
        self.s.configure({'password':'test-private-password'})
        self.assertTrue(self.s.test()['ok']); self.s.set_setting('test_sent',True); self.s.db.commit(); self.s.enable({'enabled':True,'readiness_confirmed':True})
    def tearDown(self): self.tmp.cleanup()
    def stage(self,**extra):
        data=dict(lead_id='lead1',lead_name='Example',to_email='buyer@example.com',subject='Signage enquiry',body='Hello team, may we share our work?',source_url='https://example.com/contact',verification='deliverable'); data.update(extra)
        return self.s.stage(data)
    def approve(self,item): return self.s.approve({'id':item['id'],'revision':item['revision']})
    def test_daily_key_replays_edited_and_sent_item(self):
        first=self.stage(daily_key='daily-fictional-1')
        self.assertEqual(self.stage(daily_key='daily-fictional-1')['id'],first['id'])
        edited=self.s.edit({'id':first['id'],'revision':first['revision'],'subject':'Edited subject','body':'Edited body'})
        self.assertEqual(self.stage(daily_key='daily-fictional-1')['subject'],'Edited subject')
        with self.assertRaises(ValueError): self.stage(daily_key='daily-fictional-1',subject='Different original request')
        self.approve(edited); self.s.tick()
        self.assertEqual(self.stage(daily_key='daily-fictional-1')['status'],'sent')
        self.assertEqual(self.t.count,1)
    def test_controlled_test_required_before_lead_sending(self):
        self.s.set_setting('test_sent',False); self.s.db.commit()
        with self.assertRaises(ValueError): self.s.enable({'enabled':True,'readiness_confirmed':True})
        self.s.enable({'enabled':True,'readiness_confirmed':True,'test_only':True})
        i=self.stage(test_message=True); self.approve(i); self.s.tick()
        self.assertEqual(self.t.count,1); self.assertFalse(self.s.status()['enabled'])
    def test_requires_exact_approval_and_persists(self):
        i=self.stage(); self.s.tick(); self.assertEqual(self.t.count,0)
        self.approve(i); self.s.tick(); self.assertEqual(self.t.count,1)
        self.assertEqual(self.s.status()['items'][0]['status'],'sent')
        self.s.tick(); self.assertEqual(self.t.count,1)
        self.assertNotIn('test-private-password',str(self.s.status()))
    def test_edit_revokes_approval_and_stale_revision_rejected(self):
        i=self.stage(); self.approve(i)
        j=self.s.edit({'id':i['id'],'revision':i['revision'],'subject':'Edited','body':'Changed content'})
        self.assertEqual(j['status'],'pending_review')
        with self.assertRaises(ValueError): self.approve(i)
        self.s.tick(); self.assertEqual(self.t.count,0)
    def test_sync_failure_prevents_send_and_redacts_error(self):
        self.approve(self.stage()); self.t.sync_error=True; self.s.tick()
        self.assertEqual(self.t.count,0); self.assertFalse(self.s.status()['enabled'])
        self.assertNotIn('private credential',str(self.s.status()))
    def test_read_reply_blocks_followup(self):
        first=self.stage(); self.approve(first); self.s.tick()
        follow=self.stage(previous_id=first['id'],delay_days=3)
        self.approve(follow)
        self.t.messages=[{'uid':1,'message_id':'<reply@example.com>','in_reply_to':first['message_id'],'references':'','from_email':'buyer@example.com','subject':'Re','body':'Interested','is_bounce':False}]
        self.now+=timedelta(days=5); self.s.tick()
        self.assertEqual(self.t.count,1); self.assertEqual(self.s.item(follow['id'])['status'],'cancelled')
    def test_ambiguous_send_never_retries(self):
        self.approve(self.stage()); self.t.outcome='delivery_unknown'; self.s.tick(); self.s.tick()
        self.assertEqual(self.t.count,1); self.assertFalse(self.s.status()['enabled'])
        self.assertEqual(self.s.status()['items'][0]['status'],'delivery_unknown')
    def test_sent_copy_failure_does_not_resend(self):
        self.approve(self.stage()); self.t.sent_ok=False; self.s.tick(); self.s.tick()
        self.assertEqual(self.t.count,1); self.assertEqual(self.s.status()['items'][0]['status'],'sent')
        self.assertTrue(self.s.status()['items'][0]['warning'])
    def test_suppression_cancels_all_and_blocks_staging(self):
        i=self.stage(); self.approve(i); self.s.suppress({'email':'buyer@example.com'})
        self.assertEqual(self.s.item(i['id'])['status'],'cancelled')
        with self.assertRaises(ValueError): self.stage()
    def test_unknown_verification_requires_acknowledgement(self):
        data=dict(lead_id='a',lead_name='A',to_email='a@example.com',subject='Hi',body='Hi',source_url='https://example.com',verification='unknown')
        with self.assertRaises(ValueError): self.s.stage(data)
        self.assertEqual(self.s.stage(dict(data,risk_acknowledged=True))['status'],'pending_review')
    def test_pacing_and_outside_window(self):
        self.approve(self.stage()); self.approve(self.stage(to_email='second@example.com')); self.s.tick(); self.s.tick(); self.assertEqual(self.t.count,1)
        self.now+=timedelta(minutes=5); self.s.tick(); self.assertEqual(self.t.count,2)
        self.approve(self.stage(to_email='third@example.com')); self.now=datetime(2026,10,24,5,tzinfo=timezone.utc); self.s.tick(); self.assertEqual(self.t.count,2)
    def test_reply_prevents_new_sequence_and_incomplete_result_holds(self):
        first=self.stage(); self.approve(first); self.s.tick()
        self.t.messages=[{'uid':1,'message_id':'<reply@example.com>','in_reply_to':first['message_id'],'references':'','from_email':'buyer@example.com','subject':'Re','body':'Interested','is_bounce':False}]
        self.s.sync()
        with self.assertRaises(ValueError): self.stage()
    def test_duplicate_initial_rejected(self):
        self.stage()
        with self.assertRaises(ValueError): self.stage()
    def test_followup_threads_and_waits_business_days(self):
        i=self.stage(); self.approve(i); self.s.tick()
        j=self.stage(previous_id=i['id'],delay_days=3)
        self.assertEqual(j['in_reply_to'],i['message_id'])
        self.approve(j); self.now+=timedelta(days=4); self.s.tick(); self.assertEqual(self.t.count,1)
        self.now+=timedelta(days=1); self.s.tick(); self.assertEqual(self.t.count,2)
    def test_incomplete_sync_blocks_send(self):
        self.approve(self.stage())
        self.t.sync_inbox=lambda *args:{'complete':False}
        self.s.tick(); self.assertEqual(self.t.count,0); self.assertFalse(self.s.status()['enabled'])
    def test_preview_snapshot_kept_until_edit(self):
        i=self.stage(); raw=self.s.db.execute('SELECT mime FROM kirat_meta WHERE id=?',(i['id'],)).fetchone()[0]
        self.assertTrue(raw)
        self.t.render_message=lambda *args:b'Changed after review'
        self.approve(i)
        self.assertEqual(self.s.db.execute('SELECT mime FROM kirat_meta WHERE id=?',(i['id'],)).fetchone()[0],raw)
    def test_daily_cap_and_rollover(self):
        for n in range(11): self.approve(self.stage(to_email=f'buyer{n}@example.com'))
        for n in range(11): self.s.tick(); self.now+=timedelta(minutes=5)
        self.assertEqual(self.t.count,10)
        self.now+=timedelta(days=3); self.s.tick(); self.assertEqual(self.t.count,11)
    def test_distinct_leads_make_address_fallback_ambiguous(self):
        i=self.stage(); self.approve(i); self.s.tick()
        j=self.stage(lead_id='other-lead',lead_name='Other lead'); self.approve(j); self.now+=timedelta(minutes=5); self.s.tick()
        self.t.messages=[{'uid':1,'message_id':'<unthreaded@example.com>','in_reply_to':'','references':'','from_email':'buyer@example.com','subject':'Hello','body':'Interested','is_bounce':False}]
        self.s.sync(); status=self.s.status()
        self.assertTrue(status['inbound'][0]['ambiguous']); self.assertFalse(status['enabled'])
        self.s.match_reply({'id':status['inbound'][0]['id'],'lead_id':'other-lead'})
        self.assertFalse(self.s.status()['inbound'][0]['ambiguous'])
    def test_received_reply_can_be_drafted_and_individually_approved(self):
        first=self.stage(); self.approve(first); self.s.tick()
        self.t.messages=[{'uid':1,'message_id':'<reply@example.com>','in_reply_to':first['message_id'],'references':'','from_email':'buyer@example.com','subject':'Re','body':'Interested','is_bounce':False}]
        self.s.sync(); incoming=self.s.status()['inbound'][0]
        response=self.stage(reply_id=incoming['id'],body='Thank you. May we arrange a call?')
        self.assertEqual(response['kind'],'reply'); self.assertEqual(response['status'],'pending_review')
        self.assertEqual(response['in_reply_to'],'<reply@example.com>')
        self.approve(response); self.now+=timedelta(minutes=5); self.s.tick(); self.assertEqual(self.t.count,2)
    def test_ambiguous_optout_suppresses_address_and_all_drafts(self):
        i=self.stage(); self.approve(i); self.s.tick()
        j=self.stage(lead_id='other-lead',lead_name='Other lead'); self.approve(j); self.now+=timedelta(minutes=5); self.s.tick()
        import json
        older={'uid':0,'message_id':'<earlier@example.com>','from_email':'buyer@example.com','subject':'Earlier reply','body':'Hello','is_bounce':False}
        self.s.db.execute('INSERT INTO kirat_inbound VALUES (?,?,?,?,?)',('older',json.dumps(older),'lead1','buyer@example.com',self.now.isoformat())); self.s.db.commit()
        queued=self.stage(reply_id='older',body='Reply pending approval'); self.approve(queued)
        self.t.messages=[{'uid':1,'message_id':'<optout@example.com>','in_reply_to':'','references':'','from_email':'buyer@example.com','subject':'Stop','body':'Remove me','is_bounce':False,'is_opt_out':True}]
        self.s.sync(); self.assertTrue(self.s.suppressed('buyer@example.com')); self.assertEqual(self.s.item(queued['id'])['status'],'cancelled')
    def test_large_inbound_status_is_bounded(self):
        import json
        message={'uid':1,'message_id':'<large@example.com>','from_email':'buyer@example.com','body':'A'*(9*1024*1024),'subject':'Large reply','is_bounce':False}
        self.s.db.execute('INSERT INTO kirat_inbound VALUES (?,?,?,?,?)',('large',json.dumps(message),'lead1','buyer@example.com',self.now.isoformat())); self.s.db.commit()
        self.assertLess(len(json.dumps(self.s.status())),20000)
        self.assertTrue(self.s.status()['inbound'][0]['truncated'])
    def test_actionable_email_kept_beyond_recent_history(self):
        old=self.stage(); self.approve(old)
        for n in range(205):
            i=self.stage(to_email=f'archived{n}@example.com'); self.s.reject({'id':i['id'],'revision':i['revision']})
        self.assertIn(old['id'],[i['id'] for i in self.s.status()['items']])
    def test_concurrent_workers_obey_global_lock_and_pacing(self):
        import multiprocessing, time
        self.approve(self.stage()); self.approve(self.stage(to_email='second@example.com'))
        sent=Path(self.tmp.name)/'submissions.txt'
        directory=Path(self.tmp.name); now=self.now
        def worker():
            with mail_lock(directory):
                t=Transport(); creds=Credentials(); creds.set('fictional-password')
                def submit(*args):
                    with sent.open('a') as f: f.write('attempt\n')
                    time.sleep(0.1)
                    return {'status':'sent'}
                t.submit=submit
                service=MailService(directory,transport=t,credentials=creds,clock=lambda:now)
                service.recover(); service.tick(); service.db.close()
        context=multiprocessing.get_context('fork')
        children=[context.Process(target=worker) for _ in range(2)]
        for child in children: child.start()
        for child in children: child.join(10); self.assertEqual(child.exitcode,0)
        self.assertEqual(sent.read_text().splitlines(),['attempt'])
    def test_profile_change_invalidates_approvals(self):
        i=self.stage(); self.approve(i); self.s.configure({'sender_name':'Kirat Business Development'})
        self.assertEqual(self.s.item(i['id'])['status'],'pending_review')
    def test_recovery_holds_claimed_message(self):
        i=self.stage(); self.approve(i)
        self.s.db.execute("UPDATE outbox SET status='sending' WHERE id=?",(i['id'],)); self.s.db.commit()
        self.s.recover(); self.assertEqual(self.s.item(i['id'])['status'],'delivery_unknown')
    def test_header_injection_and_undeliverable_rejected(self):
        data=dict(lead_id='a',lead_name='A',to_email='a@example.com',subject='Hi\r\nBcc:x@example.com',body='Hi',source_url='https://example.com',verification='deliverable')
        with self.assertRaises(ValueError): self.s.stage(data)
        data.update(subject='Hi',verification='undeliverable')
        with self.assertRaises(ValueError): self.s.stage(data)

if __name__=='__main__': unittest.main()
