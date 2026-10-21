"""Public contact extraction and source checks. Never infer an address pattern."""
import re
from urllib.parse import unquote
from bs4 import BeautifulSoup

EMAIL=re.compile(r'[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}',re.I)
GENERAL={'info','hello','contact','contactus','office','sales','support','help','care','customercare','service','enquiries','inquiries','press','media','team','marketing','projects','procurement'}
def clean(text):
    return re.sub(r'\s+',' ',text or '').strip()
def digits(text):
    return re.sub(r'\D','',text or '')
def excerpt(text,value):
    at=text.lower().find(value.lower())
    return text[max(0,at-100):at+len(value)+160] if at>=0 else text[:260]
def parse_page(html,url):
    soup=BeautifulSoup(html,'html.parser')
    for tag in soup(['script','style','noscript']):tag.decompose()
    text=clean(soup.get_text(' ',strip=True))
    addresses=set(EMAIL.findall(text))
    phones=set()
    contacts=[]
    for a in soup.find_all('a',href=True):
        href=unquote(str(a['href']))
        if href.lower().startswith('mailto:'):
            addresses.update(EMAIL.findall(href[7:].split('?')[0]))
        if href.lower().startswith('tel:'):
            value=href[4:].split('?')[0].strip()
            if 7<=len(digits(value))<=15 and re.fullmatch(r'\+?[\d\s().-]+',value):
                phones.add(value)
                context=clean(a.parent.get_text(' ',strip=True))[:550] or excerpt(text,value)
                contacts.append({'type':'phone','value':value,'scope':'company' if re.search(r'office|switchboard|customer|support|help|general',context,re.I) else 'unknown','source_url':url,'source_excerpt':context,'verification':'published_only'})
    # Inline numbers are attested too, but are not collected automatically to avoid fax/order IDs.
    inline_phones=set(re.findall(r'\+?\d[\d\s().-]{6,25}\d',text))
    for address in sorted(addresses):
        scope='company' if address.partition('@')[0].lower() in GENERAL else 'unknown'
        context=excerpt(text,address)
        if address.lower() not in text.lower():
            link=next((a for a in soup.find_all('a',href=True) if address.lower() in unquote(str(a['href'])).lower()),None)
            if link is not None:context=clean(link.parent.get_text(' ',strip=True))[:550] or text[:260]
        if context:contacts.append({'type':'email','value':address.lower(),'scope':scope,'source_url':url,'source_excerpt':context,'verification':'published_only','email_status':'published_only'})
    return {'url':url,'text':text,'emails':{a.lower() for a in addresses},'phones':{digits(p) for p in phones|inline_phones},'contacts':contacts}
def parse_document(content,content_type,url):
    if 'pdf' in (content_type or '').lower() or content.lstrip().startswith(b'%PDF'):
        from io import BytesIO
        from html import escape
        from pypdf import PdfReader
        reader=PdfReader(BytesIO(content),strict=False)
        if len(reader.pages)>20:raise ValueError('Source PDF exceeds 20 pages')
        text=' '.join(page.extract_text() or '' for page in reader.pages)
        if not text.strip():raise ValueError('PDF contains no extractable text')
        return parse_page('<p>'+escape(text)+'</p>',url)
    return parse_page(content.decode('utf-8',errors='replace'),url)

def attest(contact,page):
    text=clean(page['text']).lower();quote=clean(contact.get('source_excerpt','')).lower()
    kind=contact['type'];value=contact['value']
    if not quote or quote not in text:
        # Recover a literal person/title passage when the model reformatted a valid source.
        name=clean(value).lower();role=clean(contact.get('role','')).lower()
        at=text.find(name) if kind=='person' else -1
        passage=clean(page['text'])[max(0,at-80):at+len(name)+450] if at>=0 else ''
        if kind=='person' and role and role in passage.lower():
            contact['source_excerpt']=passage;quote=passage.lower()
        else:return False,'Supporting passage was not found on the source page'
    if kind=='email' and value.lower() not in page['emails']:return False,'Email is not published on that page'
    if kind=='phone' and digits(value) not in page['phones']:return False,'Phone is not published on that page'
    if kind=='person' and (clean(value).lower() not in quote or clean(contact.get('role','')).lower() not in quote):return False,'Person and stated job title are not together in the passage'
    if contact.get('scope')=='direct':
        if clean(contact.get('person_name','')).lower() not in quote or clean(contact.get('role','')).lower() not in quote:return False,'Direct contact association is unsupported'
        if kind=='email' and value.lower() not in quote:return False,'Direct address is not associated in the passage'
        if kind=='phone' and digits(value) not in digits(quote):return False,'Direct number is not associated in the passage'
    return True,''
