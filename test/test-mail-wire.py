"""Real TLS protocol tests against localhost-only fictional SMTP/IMAP servers."""
import json, socketserver, ssl, subprocess, sys, tempfile, threading, unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import kirat_mail_transport as T

class TLSLocalServer(socketserver.ThreadingTCPServer):
    allow_reuse_address=True; daemon_threads=True
    def get_request(self):
        sock,addr=super().get_request()
        return self.context.wrap_socket(sock,server_side=True),addr

class SMTP(socketserver.StreamRequestHandler):
    def handle(self):
        def say(s): self.wfile.write(s.encode()+b'\r\n'); self.wfile.flush()
        say('220 localhost fictional SMTP')
        while True:
            line=self.rfile.readline()
            if not line: break
            command=line.decode().strip().upper()
            if command.startswith('EHLO'): say('250-localhost\r\n250 AUTH PLAIN LOGIN')
            elif command.startswith('AUTH'): say('235 Authenticated')
            elif command.startswith('MAIL'): say('250 Sender OK')
            elif command.startswith('RCPT'): say('250 Recipient OK')
            elif command=='DATA':
                say('354 Send message')
                chunks=[]
                while True:
                    part=self.rfile.readline()
                    if not part or part==b'.\r\n': break
                    chunks.append(part)
                self.server.received.append(b''.join(chunks))
                if self.server.drop: return
                say('250 Accepted')
            elif command=='QUIT': say('221 Bye'); break
            else: say('250 OK')

class IMAP(socketserver.StreamRequestHandler):
    def handle(self):
        def say(s): self.wfile.write(s.encode()+b'\r\n'); self.wfile.flush()
        say('* OK fictional localhost IMAP')
        while True:
            line=self.rfile.readline()
            if not line: break
            text=line.decode().strip(); self.server.commands.append(text)
            tag,command,*rest=text.split(' '); cmd=command.upper(); args=' '.join(rest)
            if cmd=='CAPABILITY': say('* CAPABILITY IMAP4rev1'); say(tag+' OK CAPABILITY')
            elif cmd=='LOGIN': say(tag+' OK LOGIN')
            elif cmd=='LIST': say('* LIST (\\Sent) "/" "Sent"'); say(tag+' OK LIST')
            elif cmd=='EXAMINE':
                self.folder=args.strip('"'); say('* 1 EXISTS'); say('* OK [UIDVALIDITY 9] stable'); say('* OK [UIDNEXT 2] next'); say(tag+' OK [READ-ONLY] EXAMINE')
            elif cmd=='UID' and args.upper().startswith('SEARCH'):
                if 'HEADER' in args.upper(): say('* SEARCH'+(' 1' if self.server.saved else ''))
                else: say('* SEARCH 1')
                say(tag+' OK SEARCH')
            elif cmd=='UID' and 'FETCH' in args.upper():
                raw=self.server.inbound
                if 'RFC822.SIZE' in args.upper(): say('* 1 FETCH (UID 1 RFC822.SIZE '+str(len(raw))+')')
                else:
                    self.wfile.write(('* 1 FETCH (UID 1 BODY[] {'+str(len(raw))+'}\r\n').encode()+raw+b')\r\n');self.wfile.flush()
                say(tag+' OK FETCH')
            elif cmd=='APPEND':
                size=int(args.rsplit('{',1)[1].rstrip('}'));say('+ literal')
                raw=self.rfile.read(size); self.rfile.readline(); self.server.saved.append(raw);say(tag+' OK APPEND')
            elif cmd=='LOGOUT': say('* BYE');say(tag+' OK LOGOUT');break
            else: say(tag+' BAD unsupported')

class WireTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory(); p=Path(cls.tmp.name); cls.cert=p/'cert.pem'; key=p/'key.pem'
        subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(key),'-out',str(cls.cert),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],check=True,capture_output=True)
        context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); context.load_cert_chain(cls.cert,key)
        cls.client_context=ssl.create_default_context(cafile=str(cls.cert)); cls.servers=[]
        for handler in (SMTP,IMAP):
            server=TLSLocalServer(('127.0.0.1',0),handler);server.context=context;server.received=[];server.drop=False;server.saved=[];server.commands=[]
            server.inbound=b'From: buyer@example.com\r\nTo: sales@kiratcreations.com\r\nSubject: Interested\r\nMessage-ID: <reply@example.com>\r\nIn-Reply-To: <wire@kiratcreations.com>\r\nContent-Type: text/plain\r\n\r\nPlease send more information.\r\n'
            threading.Thread(target=server.serve_forever,daemon=True).start(); cls.servers.append(server)
        cls.config={'host':'localhost','smtp_port':cls.servers[0].server_address[1],'imap_port':cls.servers[1].server_address[1],'username':'sales@kiratcreations.com'}
    @classmethod
    def tearDownClass(cls):
        for s in cls.servers: s.shutdown();s.server_close()
        cls.tmp.cleanup()
    def test_tls_send_sync_and_sent_copy(self):
        with patch.object(T.ssl,'create_default_context',return_value=self.client_context):
            self.assertTrue(T.test_connection(self.config,'fictional-password')['ok'])
            root=Path(__file__).resolve().parents[1]
            profile={'sender_name':'Business Development Team','email':'sales@kiratcreations.com','company':'Kirat Creations','phone':'+91 99993 02167','website':'https://kiratcreations.com','tagline':'Signage | Graphics | Display Units | Turnkey Solutions'}
            raw=T.render_message({'to_email':'buyer@example.com','subject':'Local wire test','body':'Hello team','message_id':'<wire@kiratcreations.com>'},profile,(root/'assets/kirat-email-logo.png').read_bytes())
            self.assertEqual(T.submit(self.config,'fictional-password',raw)['status'],'sent')
            result=T.sync_inbox(self.config,'fictional-password',{})
            self.assertTrue(result['complete']);self.assertEqual(result['messages'][0]['from_email'],'buyer@example.com')
            self.assertTrue(any('BODY.PEEK[]' in c for c in self.servers[1].commands))
            self.assertFalse(any(' STORE ' in c or 'UNSEEN' in c for c in self.servers[1].commands))
            self.assertTrue(T.save_sent(self.config,'fictional-password',raw)['ok']);self.assertTrue(T.save_sent(self.config,'fictional-password',raw)['ok'])
            self.assertEqual(len(self.servers[1].saved),1)
            self.servers[0].drop=True
            self.assertEqual(T.submit(self.config,'fictional-password',raw)['status'],'delivery_unknown')
            self.assertEqual(len(self.servers[0].received),2)
            self.servers[0].drop=False
if __name__=='__main__': unittest.main()
