"""Kirat's bounded, non-destructive standard-library mail transport.

Diagnostics deliberately contain categories only; provider text can echo secrets.
Sync failures raise RuntimeError and MUST pause sending without moving a checkpoint.
"""
import html
import imaplib
import re
import smtplib
import ssl
import struct
import zlib
import time
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser
from email.utils import formataddr, formatdate, getaddresses, parseaddr

TIMEOUT = 25
MAX_MESSAGE = 10 * 1024 * 1024
MAX_SYNC = 10000
INITIAL_SCAN = 100


def _header(value):
    value = str(value)
    if any(c in value for c in '\r\n\x00'):
        raise ValueError('Invalid mail header')
    return value


def _address(value):
    value = _header(value)
    if not re.fullmatch(r'[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+', value):
        raise ValueError('Invalid email address')
    return value


def _validate_png(data):
    if not data.startswith(b'\x89PNG\r\n\x1a\n') or len(data)>2*1024*1024:
        raise ValueError('Invalid PNG logo')
    offset=8
    seen_header=False
    seen_image=False
    compressed=bytearray()
    while offset+12<=len(data):
        size=struct.unpack('>I',data[offset:offset+4])[0]
        kind=data[offset+4:offset+8]
        end=offset+8+size
        if end+4>len(data): raise ValueError('Truncated PNG')
        chunk=data[offset+8:end]
        crc=struct.unpack('>I',data[end:end+4])[0]
        if zlib.crc32(kind+chunk)&0xffffffff != crc: raise ValueError('Corrupt PNG')
        if not seen_header:
            if kind!=b'IHDR' or size!=13: raise ValueError('Invalid PNG header')
            width,height=struct.unpack('>II',chunk[:8])
            if not 1<=width<=10000 or not 1<=height<=10000 or width*height>20000000:
                raise ValueError('Invalid PNG dimensions')
            depth,color,compression,filter_method,interlace=chunk[8:]
            depths={0:(1,2,4,8,16),2:(8,16),3:(1,2,4,8),4:(8,16),6:(8,16)}
            if color not in depths or depth not in depths[color] or compression or filter_method or interlace not in (0,1):
                raise ValueError('Unsupported PNG format')
            channels={0:1,2:3,3:1,4:2,6:4}[color]
            passes=[(0,0,1,1)] if not interlace else [(0,0,8,8),(4,0,8,8),(0,4,4,8),(2,0,4,4),(0,2,2,4),(1,0,2,2),(0,1,1,2)]
            rows=[]
            for x,y,dx,dy in passes:
                pw=max(0,(width-x+dx-1)//dx)
                ph=max(0,(height-y+dy-1)//dy)
                if pw and ph: rows.extend([1+(pw*depth*channels+7)//8]*ph)
            decoded_size=sum(rows)
            if decoded_size>32*1024*1024: raise ValueError('PNG decoded image too large')
            seen_header=True
        if kind==b'IDAT':
            seen_image=True
            compressed.extend(chunk)
        if kind==b'IEND':
            if size or end+4!=len(data) or not seen_image: raise ValueError('Invalid PNG end')
            try:
                decoder=zlib.decompressobj()
                decoded=decoder.decompress(compressed,decoded_size+1)
                if len(decoded)!=decoded_size or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
                    raise ValueError('Invalid PNG image stream')
                row_offset=0
                for row_size in rows:
                    if decoded[row_offset]>4: raise ValueError('Invalid PNG scanline filter')
                    row_offset+=row_size
            except zlib.error:
                raise ValueError('Invalid PNG compressed data') from None
            return
        offset=end+4
    raise ValueError('Incomplete PNG')


def render_message(item, profile, logo_bytes):
    for key in ('to_email', 'subject', 'message_id', 'in_reply_to', 'references', 'date'):
        if item.get(key): _header(item[key])
    for value in profile.values(): _header(value)
    _validate_png(logo_bytes)
    msg = EmailMessage(policy=policy.SMTP)
    msg['From'] = formataddr((profile['sender_name'], _address(profile['email'])))
    msg['To'] = _address(item['to_email'])
    msg['Subject'] = item['subject']
    msg['Message-ID'] = item['message_id']
    msg['Date'] = item.get('date') or formatdate(localtime=False)
    for source, target in [('in_reply_to','In-Reply-To'), ('references','References')]:
        if item.get(source): msg[target] = item[source]
    signature = '\n'.join(profile.get(k,'') for k in ('sender_name','company','phone','email','website','tagline'))
    msg.set_content(item['body'] + '\n\n' + signature)
    esc = lambda s: html.escape(str(s), quote=True)
    website = profile['website']
    if not website.startswith('https://'): raise ValueError('Website must use HTTPS')
    signature_html = '<br>'.join(esc(profile.get(k,'')) for k in ('sender_name','company','phone','email'))
    msg.add_alternative('<html><body><div>' + esc(item['body']).replace('\n','<br>') + '</div><br><div>' + signature_html + '<br><a href="' + esc(website) + '">' + esc(website) + '</a><br><img src="cid:kirat-logo" width="300" style="width:300px;max-width:100%;height:auto" alt="Kirat Creations"><br>' + esc(profile.get('tagline','')) + '</div></body></html>', subtype='html')
    msg.get_payload()[-1].add_related(logo_bytes, maintype='image', subtype='png', cid='<kirat-logo>', disposition='inline', filename='kirat-logo.png')
    return msg.as_bytes()


def _smtp(config, password):
    smtp = smtplib.SMTP_SSL(config['host'], int(config.get('smtp_port',465)), timeout=TIMEOUT, context=ssl.create_default_context())
    try: smtp.login(config['username'], password)
    except Exception:
        smtp.close()
        raise
    return smtp


def _imap(config, password):
    conn = imaplib.IMAP4_SSL(config['host'], int(config.get('imap_port',993)), ssl_context=ssl.create_default_context(), timeout=TIMEOUT)
    try: conn.login(config['username'], password)
    except Exception:
        _close(conn)
        raise
    return conn


def _close(conn):
    if conn:
        try: conn.logout()
        except Exception: pass


def _sent_folder(conn, config):
    if config.get('sent_folder'): return _header(config['sent_folder'])
    status, rows = conn.list()
    if status != 'OK': raise RuntimeError('Sent folder discovery failed')
    for row in rows or []:
        text = row.decode('utf-8', errors='replace') if isinstance(row,bytes) else str(row)
        if re.search(r'\\Sent\b', text, re.I):
            match = re.match(r'\([^)]*\)\s+(?:"[^"]*"|NIL)\s+(.*)$', text)
            if match: return match[1].strip('"').replace('\\"','"')
    raise RuntimeError('Choose a Sent folder in mailbox setup')


def test_connection(config, password):
    conn = smtp = None
    try:
        smtp = _smtp(config,password)
        conn = _imap(config,password)
        folder = _sent_folder(conn,config)
        _selected(conn,folder)
        return {'ok':True,'sent_folder':folder}
    except Exception: return {'ok':False,'error':'Mailbox connection or Sent folder check failed'}
    finally:
        if smtp:
            try: smtp.quit()
            except Exception: smtp.close()
        _close(conn)


def submit(config, password, raw):
    smtp = None
    attempted = False
    try:
        if len(raw) > MAX_MESSAGE: raise ValueError('Message too large')
        msg = BytesParser(policy=policy.default).parsebytes(raw)
        sender = _address(parseaddr(str(msg['From']))[1])
        recipients = [_address(address) for _,address in getaddresses(msg.get_all('To',[]))]
        if len(recipients) != 1: raise ValueError('One recipient required')
        smtp = _smtp(config,password)
        code,_ = smtp.mail(sender)
        if code != 250: return {'status':'failed','error':'SMTP sender rejected'}
        code,_ = smtp.rcpt(recipients[0])
        if code not in (250,251): return {'status':'failed','error':'SMTP recipient rejected'}
        attempted = True
        code,_ = smtp.data(raw)
        if code != 250: return {'status':'failed','error':'SMTP message rejected'}
        return {'status':'sent'}
    except smtplib.SMTPResponseException:
        return {'status':'failed','error':'SMTP rejected submission'}
    except Exception:
        return {'status':'delivery_unknown' if attempted else 'failed','error':'SMTP outcome uncertain' if attempted else 'SMTP preflight failed'}
    finally:
        if smtp:
            try: smtp.quit()
            except Exception: smtp.close()


def _selected(conn, folder):
    # Quoting protects folder names with spaces and IMAP metacharacters.
    quoted = '"' + folder.replace('\\','\\\\').replace('"','\\"') + '"'
    status,_ = conn.select(quoted,readonly=True)
    if status != 'OK': raise RuntimeError('Mailbox selection failed')


def save_sent(config, password, raw):
    conn = None
    try:
        msg = BytesParser(policy=policy.default).parsebytes(raw)
        mid = _header(msg['Message-ID'])
        if not re.fullmatch(r'<[^\s<>"\\]+>',mid): raise ValueError('Invalid Message-ID')
        conn = _imap(config,password)
        folder = _sent_folder(conn,config)
        _selected(conn,folder)
        status,rows = conn.uid('search',None,'HEADER','Message-ID','"'+mid+'"')
        if status != 'OK': raise RuntimeError('Sent reconciliation failed')
        if rows and rows[0]: return {'ok':True}
        quoted = '"' + folder.replace('\\','\\\\').replace('"','\\"') + '"'
        status,_ = conn.append(quoted,'\\Seen',imaplib.Time2Internaldate(time.time()),raw)
        if status != 'OK': raise RuntimeError('Sent append failed')
        return {'ok':True}
    except Exception: return {'ok':False,'error':'Sent copy could not be confirmed; reconcile before retrying'}
    finally: _close(conn)


def _normalize(uid, raw):
    msg = BytesParser(policy=policy.default).parsebytes(raw)
    body = msg.get_body(preferencelist=('plain','html'))
    text = body.get_content() if body else ''
    if not isinstance(text,str): text = ''
    bounce = msg.get_content_type() == 'multipart/report' or any(p.get_content_type()=='message/delivery-status' for p in msg.walk())
    result = {'uid':uid,'message_id':str(msg.get('Message-ID','')),'in_reply_to':str(msg.get('In-Reply-To','')),'references':str(msg.get('References','')),'from_email':parseaddr(str(msg.get('From','')))[1].lower(),'subject':str(msg.get('Subject','')),'body':text,'is_bounce':bounce,'is_opt_out':bool(re.search(r'\b(unsubscribe|remove me|stop (?:emailing|contacting)|do not contact|opt out)\b',text,re.I))}
    for part in msg.walk():
        if part.get_content_type() == 'message/delivery-status':
            for block in part.get_payload():
                recipient = block.get('Final-Recipient') or block.get('Original-Recipient')
                if recipient:
                    result['bounced_address'] = str(recipient).split(';')[-1].strip().lower()
    return result


def sync_inbox(config, password, checkpoint):
    started = time.monotonic()
    conn = None
    try:
        conn = _imap(config,password)
        _selected(conn,'INBOX')
        _,values = conn.response('UIDVALIDITY')
        if not values or not values[0]: raise RuntimeError('Missing UIDVALIDITY')
        validity = values[0].decode() if isinstance(values[0],bytes) else str(values[0])
        checkpoint = checkpoint or {}
        reset = bool(checkpoint.get('uidvalidity') and str(checkpoint['uidvalidity']) != validity)
        initial = not checkpoint or reset
        _,next_values = conn.response('UIDNEXT')
        if not next_values or not next_values[0]: raise RuntimeError('Missing UIDNEXT')
        next_uid = int(next_values[0])
        low = max(1,next_uid-INITIAL_SCAN) if initial else int(checkpoint.get('last_uid',0)) + 1
        if low >= next_uid:
            if time.monotonic() - started > 60: raise RuntimeError('Inbox sync deadline exceeded')
            return {'uidvalidity':validity,'last_uid':int(checkpoint.get('last_uid',0)) if not initial else max(0,next_uid-1),'messages':[],'complete':True,'reset':reset}
        status,rows = conn.uid('search',None,'UID',f'{low}:{next_uid-1}')
        if status != 'OK': raise RuntimeError('Inbox UID search failed')
        uids = sorted(set(int(v) for v in (rows[0] or b'').split() if int(v)>=low))
        if initial: uids = uids[-INITIAL_SCAN:]
        if len(uids)>MAX_SYNC: raise RuntimeError('Inbox backlog exceeds safe sync bound')
        messages=[]
        for uid in uids:
            if time.monotonic() - started > 60:
                raise RuntimeError('Inbox sync deadline exceeded')
            size_status,size_parts = conn.uid('fetch',str(uid),'(UID RFC822.SIZE)')
            metadata = b' '.join(p for p in size_parts or [] if isinstance(p,bytes))
            size_match = re.search(rb'RFC822.SIZE (\d+)',metadata)
            if size_status != 'OK' or not size_match or int(size_match[1])>MAX_MESSAGE:
                raise RuntimeError('Missing size or oversized inbox message')
            status,parts = conn.uid('fetch',str(uid),'(UID BODY.PEEK[])')
            if status != 'OK': raise RuntimeError('Incomplete inbox sync')
            payloads = [p[1] for p in parts or [] if isinstance(p,tuple) and isinstance(p[1],bytes)]
            if len(payloads)!=1 or len(payloads[0])>MAX_MESSAGE: raise RuntimeError('Incomplete or oversized inbox message')
            messages.append(_normalize(uid,payloads[0]))
        if time.monotonic() - started > 60:
            raise RuntimeError('Inbox sync deadline exceeded')
        return {'uidvalidity':validity,'last_uid':max(uids,default=0 if initial else int(checkpoint.get('last_uid',0))),'messages':messages,'complete':True,'reset':reset}
    except Exception:
        raise RuntimeError('Inbox sync failed; sending must remain paused') from None
    finally: _close(conn)
