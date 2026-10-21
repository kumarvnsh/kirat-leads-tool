import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'scripts'))
from contact_evidence import parse_page,attest
html='''<div>Asha Test, Projects Manager, asha@fictional.example, +91 98765 43210</div><a href="mailto:info@fictional.example">Business enquiries</a><a href="tel:+919876543210">Call office</a><script>secret@hidden.example</script>'''
p=parse_page(html,'https://fictional.example/team')
assert 'secret@hidden.example' not in p['emails']
assert 'info@fictional.example' in p['emails']
c={'type':'email','value':'asha@fictional.example','scope':'direct','person_name':'Asha Test','role':'Projects Manager','source_excerpt':'Asha Test, Projects Manager, asha@fictional.example, +91 98765 43210'}
assert attest(c,p)[0]
assert not attest(dict(c,value='guessed@fictional.example'),p)[0]
assert not attest(dict(c,person_name='Wrong Person'),p)[0]
assert not attest(dict(c,source_excerpt='Imagined evidence'),p)[0]
assert any(c['scope']=='company' for c in p['contacts'] if c['value']=='info@fictional.example')
print('contact evidence: published email/phone extraction, hidden-script exclusion and direct association checks passed')

person={'type':'person','value':'Asha Test','role':'Projects Manager','source_excerpt':'Model reformatted this incorrectly'}
assert attest(person,p)[0]
assert person['source_excerpt'] in p['text']

# Public agendas may be PDFs behind URLs without a .pdf extension.
from io import BytesIO
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject,NameObject,DecodedStreamObject
from contact_evidence import parse_document
writer=PdfWriter();page=writer.add_blank_page(width=612,height=792)
font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):writer._add_object(font)})})
stream=DecodedStreamObject();stream.set_data(b'BT /F1 12 Tf 40 750 Td (Asha Test, Projects Manager, asha@fictional.example) Tj ET')
page[NameObject('/Contents')]=writer._add_object(stream)
output=BytesIO();writer.write(output)
pdf=parse_document(output.getvalue(),'application/octet-stream','https://fictional.example/agenda')
assert 'asha@fictional.example' in pdf['emails']
assert attest({'type':'person','value':'Asha Test','role':'Projects Manager','source_excerpt':'Asha Test, Projects Manager, asha@fictional.example'},pdf)[0]
print('contact evidence: PDF signature detection and text attestation passed')
