"""Fictional mailbox fixture. No sockets, Keychain, credentials or email delivery."""
import json, sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from kirat_mail import MailService
import kirat_mail_transport as transport
folder=Path(sys.argv[1]); folder.mkdir(parents=True,exist_ok=True)
class Credentials:
    def get(self): return 'fictional-local-only-password'
    def set(self,p): pass
    def delete(self): pass
class FakeTransport:
    render_message=staticmethod(transport.render_message)
    def test_connection(self,c,p): return {'ok':True,'sent_folder':'Sent'}
    def sync_inbox(self,c,p,checkpoint): return {'uidvalidity':'1','last_uid':0,'messages':[],'complete':True}
    def submit(self,c,p,raw): return {'status':'sent'}
    def save_sent(self,c,p,raw): return {'ok':True}
try:
    req=json.load(sys.stdin)
    counter=folder/'clock.json'; n=json.loads(counter.read_text()) if counter.exists() else 0
    now=datetime(2026,10,26,5,0,tzinfo=timezone.utc)+timedelta(minutes=n)
    counter.write_text(json.dumps(n+5))
    service=MailService(folder,transport=FakeTransport(),credentials=Credentials(),clock=lambda:now)
    service.recover()
    if req['action']=='status': service.tick()
    result=service.dispatch(req['action'],req.get('data',{}))
    print(json.dumps({'ok':True,'data':result}))
except ValueError as e:
    print(json.dumps({'ok':False,'error':str(e)}));sys.exit(1)
