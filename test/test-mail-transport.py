import importlib.util
import pathlib
import unittest
from unittest.mock import patch
from email import policy
from email.parser import BytesParser
import smtplib
import struct
import zlib

PATH = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('transport', PATH / 'scripts/kirat_mail_transport.py')
m = importlib.util.module_from_spec(spec)
if spec.loader and pathlib.Path(spec.origin).exists(): spec.loader.exec_module(m)

CONFIG = {'host': 'mail.example.com', 'username': 'sales@kiratcreations.com'}
PROFILE = {'sender_name':'Business Development Team','email':'sales@kiratcreations.com','company':'Kirat Creations','phone':'+91 99993 02167','website':'https://kiratcreations.com','tagline':'Signage | Graphics | Display Units | Turnkey Solutions'}
ITEM = {'to_email':'person@example.com','subject':'Hello','body':'Hi <script> & hello','message_id':'<fixed@example.com>','date':'Fri, 23 Oct 2026 10:00:00 +0530'}

class SMTP:
    failure = None
    def __init__(self,*a,**k): self.data_called=False
    def login(self,*a):
        if self.failure == 'auth': raise smtplib.SMTPAuthenticationError(535,b'secret')
    def mail(self,*a): return 250,b'ok'
    def rcpt(self,*a): return 250,b'ok'
    def data(self,*a):
        self.data_called=True
        if self.failure == 'network': raise OSError('secret')
        if self.failure == 'reject': raise smtplib.SMTPDataError(550,b'no')
        return 250,b'ok'
    def quit(self): pass
    def close(self): pass

class IMAP:
    ids = list(range(1,206))
    calls=[]
    duplicate=False
    def __init__(self,*a,**k): pass
    def login(self,*a): return 'OK',[]
    def list(self): return 'OK',[b'(\\HasNoChildren \\Sent) "/" "Sent Mail"']
    def select(self,folder,readonly=False): self.calls.append(('select',folder,readonly)); return 'OK',[b'205']
    def response(self,key): return key,[b'206' if key=='UIDNEXT' else b'77']
    def uid(self,op,*args):
        self.calls.append((op,)+args)
        if op=='search':
            if 'HEADER' in args: return 'OK',[b'9' if self.duplicate else b'']
            low=int(args[-1].split(':')[0]); return 'OK',[' '.join(str(i) for i in self.ids if i>=low).encode()]
        uid=int(args[0])
        if args[-1] == '(UID RFC822.SIZE)': return 'OK',[f'1 (UID {uid} RFC822.SIZE 1000)'.encode()]
        raw=f'From: Person <person@example.com>\r\nMessage-ID: <{uid}@example.com>\r\nSubject: Reply\r\n\r\nPlease unsubscribe'.encode()
        return 'OK',[(f'1 (UID {uid} BODY[] {{{len(raw)}}}'.encode(),raw), b')']
    def append(self,*a): self.calls.append(('append',)+a); return 'OK',[]
    def logout(self): pass

class TransportTest(unittest.TestCase):
    def raw(self): return m.render_message(ITEM,PROFILE,(PATH/'assets/kirat-email-logo.png').read_bytes())
    def test_mime_and_injection(self):
        raw=self.raw(); msg=BytesParser(policy=policy.default).parsebytes(raw)
        self.assertEqual(msg['Message-ID'],ITEM['message_id']); self.assertEqual(str(msg['Date']),ITEM['date'])
        self.assertIn('&lt;script&gt;',msg.get_body(preferencelist=('html',)).get_content())
        self.assertIn('width="300"',msg.get_body(preferencelist=('html',)).get_content())
        self.assertTrue(any(p.get_content_type()=='image/png' and p['Content-ID'] for p in msg.walk()))
        with self.assertRaises(ValueError): m.render_message(dict(ITEM,subject='x\r\nBcc: x@y.com'),PROFILE,b'bad')
    @patch.object(smtplib,'SMTP_SSL',SMTP)
    def test_submit_outcomes(self):
        for failure,status in [(None,'sent'),('auth','failed'),('reject','failed'),('network','delivery_unknown')]:
            SMTP.failure=failure; self.assertEqual(m.submit(CONFIG,'secret',self.raw())['status'],status)
        SMTP.failure=None
    @patch('imaplib.IMAP4_SSL',IMAP)
    @patch.object(smtplib,'SMTP_SSL',SMTP)
    def test_connection_and_sent_reconcile(self):
        self.assertEqual(m.test_connection(CONFIG,'secret'),{'ok':True,'sent_folder':'Sent Mail'})
        IMAP.calls=[]; IMAP.duplicate=True
        self.assertTrue(m.save_sent(CONFIG,'secret',self.raw())['ok'])
        self.assertFalse(any(c[0]=='append' for c in IMAP.calls)); IMAP.duplicate=False
    @patch('imaplib.IMAP4_SSL',IMAP)
    def test_full_sync_readonly_and_rollover(self):
        IMAP.calls=[]
        result=m.sync_inbox(CONFIG,'secret',{'uidvalidity':'77','last_uid':0})
        self.assertEqual(len(result['messages']),205); self.assertTrue(result['complete']); self.assertEqual(result['last_uid'],205)
        self.assertTrue(all(c[2] for c in IMAP.calls if c[0]=='select'))
        self.assertTrue(all('BODY.PEEK[]' in c[-1] for c in IMAP.calls if c[0]=='fetch' and c[-1] != '(UID RFC822.SIZE)'))
        self.assertTrue(result['messages'][0]['is_opt_out'])
        self.assertTrue(m.sync_inbox(CONFIG,'secret',{'uidvalidity':'old','last_uid':900})['reset'])

class MoreTransportTest(unittest.TestCase):
    def test_dsn_recipient(self):
        raw = b"From: mailer-daemon@example.com\r\nContent-Type: multipart/report; report-type=delivery-status; boundary=x\r\n\r\n--x\r\nContent-Type: text/plain\r\n\r\nDelivery failed\r\n--x\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; example.com\r\n\r\nFinal-Recipient: rfc822; lost@example.com\r\nAction: failed\r\nStatus: 5.1.1\r\n\r\n--x--\r\n"
        result=m._normalize(5,raw)
        self.assertTrue(result['is_bounce']); self.assertEqual(result['bounced_address'],'lost@example.com')

    @patch('imaplib.IMAP4_SSL',IMAP)
    def test_fetch_failure_never_returns_complete(self):
        original=IMAP.uid
        def failing(instance,op,*args):
            if op=='fetch': return 'NO',[]
            return original(instance,op,*args)
        with patch.object(IMAP,'uid',failing):
            with self.assertRaisesRegex(RuntimeError,'remain paused'):
                m.sync_inbox(CONFIG,'secret',{'uidvalidity':'77','last_uid':0})

    @patch('imaplib.IMAP4_SSL',IMAP)
    def test_initial_search_is_bounded_before_query(self):
        IMAP.calls=[]
        m.sync_inbox(CONFIG,'secret',None)
        search=next(c for c in IMAP.calls if c[0]=='search')
        self.assertEqual(search[-1],'106:205')

    def test_corrupt_png_is_rejected(self):
        with self.assertRaises(ValueError):
            m.render_message(ITEM,PROFILE,b'\x89PNG\r\n\x1a\ninvalid')

    @patch('imaplib.IMAP4_SSL',IMAP)
    def test_sync_has_total_deadline(self):
        with patch.object(m.time,'monotonic',side_effect=[0,100]):
            with self.assertRaisesRegex(RuntimeError,'remain paused'):
                m.sync_inbox(CONFIG,'secret',{'uidvalidity':'77','last_uid':0})

class QualityTransportTest(unittest.TestCase):
    @patch('imaplib.IMAP4_SSL',IMAP)
    @patch.object(smtplib,'SMTP_SSL',SMTP)
    def test_connection_rejects_missing_sent_folder(self):
        with patch.object(IMAP,'select',return_value=('NO',[])):
            self.assertFalse(m.test_connection(dict(CONFIG,sent_folder='Missing'),'secret')['ok'])

    def test_png_decoded_stream_and_size(self):
        def png(payload):
            def chunk(kind,data):
                return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
            return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))+chunk(b'IDAT',payload)+chunk(b'IEND',b'')
        for payload in (b'invalid',zlib.compress(b'\0'*10000),zlib.compress(b'\0')):
            with self.assertRaises(ValueError): m._validate_png(png(payload))
        m._validate_png(png(zlib.compress(b'\0\xff\0\0')))

    @patch('imaplib.IMAP4_SSL',IMAP)
    def test_final_fetch_deadline_is_checked(self):
        with patch.object(IMAP,'ids',[205]),patch.object(m.time,'monotonic',side_effect=[0,0,100]):
            with self.assertRaisesRegex(RuntimeError,'remain paused'):
                m.sync_inbox(CONFIG,'secret',{'uidvalidity':'77','last_uid':204})

if __name__=='__main__': unittest.main()
