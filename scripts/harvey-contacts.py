"""Pinned Harvey Scout public-site collection and independent contact-source checks."""
import asyncio
import json
import sys
from pathlib import Path
from urllib.parse import urlparse,urljoin
from contact_evidence import parse_page,parse_document,attest,clean,excerpt

async def main():
    checkout=Path(sys.argv[1]).resolve();sys.path.insert(0,str(checkout))
    from harvey.agents.scout import Scout
    from harvey.config import load_config,EnvConfig
    from harvey.public_http import public_http_client
    payload=json.load(sys.stdin)
    if sys.argv[2]=='attest':
        pages={};accepted=[];rejected=[]
        async with public_http_client(timeout=12) as client:
            for c in payload['contacts']:
                url=c['source_url']
                if url not in pages:
                    try:
                        r=await client.get(url);r.raise_for_status()
                        if len(r.content)>2*1024*1024:raise ValueError('Source page too large')
                        pages[url]=parse_document(r.content,r.headers.get('content-type',''),url)
                    except Exception:pages[url]=None
                page=pages[url]
                ok,reason=attest(c,page) if page else (False,'Source could not be opened or read')
                if ok:accepted.append(c)
                else:rejected.append({'type':c['type'],'value':c['value'],'source_url':c['source_url'],'reason':reason})
        print(json.dumps({'contacts':accepted,'rejected':rejected}));return
    config=load_config(str(checkout/'harvey.local.yaml'))
    if config.channels.email.enabled or config.channels.linkedin.enabled:raise ValueError('Email and LinkedIn must remain disabled')
    class PublicScout(Scout):
        def __init__(self):
            super().__init__(None,None,config,EnvConfig());self.pages={};self.responses={};self.attempts=0
        async def _fetch(self,url,**kwargs):
            if url in self.responses:return self.responses[url]
            if self.attempts>=14:return None
            self.attempts+=1
            response=await super()._fetch(url,timeout=8,retries=1)
            self.responses[url]=response
            if response is not None and len(response.content)<=2*1024*1024:
                self.pages[url]=parse_page(response.text,str(response.url));return response
            return None
        async def _learn_pattern_from_page(self,*args):
            return  # This integration never guesses or learns personal email patterns.
    scout=PublicScout()
    website=payload.get('website') or ('https://'+payload.get('domain',''))
    parsed=urlparse(website)
    if parsed.scheme not in ('http','https') or not parsed.hostname:raise ValueError('A public company website is required')
    domain=parsed.hostname
    response=await scout._fetch(website)
    paths=[]
    if response is not None:
        soup=scout._safe_soup(response.text)
        for a in soup.find_all('a',href=True) if soup else []:
            href=urljoin(str(response.url),str(a['href']))
            if urlparse(href).hostname==urlparse(str(response.url)).hostname and any(w in (a.get_text()+' '+href).lower() for w in ['contact','customer-service','customer-care']):paths.append(href)
    paths+=['https://'+domain+'/contact-us','https://'+domain+'/contact']
    for url in list(dict.fromkeys(paths))[:3]:await scout._fetch(url)
    members=await scout._scrape_team_page(domain)
    contacts=[]
    for page in scout.pages.values():contacts.extend(page['contacts'])
    for member in members:
        name=clean(member['first_name']+' '+member['last_name']);role=clean(member['title'])
        if not role:continue
        for page in scout.pages.values():
            quote=excerpt(page['text'],name)
            if name.lower() in quote.lower() and role.lower() in quote.lower():
                contacts.append({'type':'person','value':name,'role':role,'source_url':page['url'],'source_excerpt':quote,'verification':'published_only'});break
    unique={}
    for c in contacts:unique.setdefault((c['type'],c['value'].lower()),c)
    print(json.dumps({'contacts':list(unique.values())[:12],'pages_opened':len(scout.pages),'method':'Harvey Scout public company/contact/team pages','pages':[{'url':p['url'],'text':p['text'][:3500]} for p in list(scout.pages.values())[:5]]}))

if __name__=='__main__':asyncio.run(main())
