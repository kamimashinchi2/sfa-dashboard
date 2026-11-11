#!/usr/bin/env python3
"""Echo box client. API key only from environment; no prints, files or query params."""
import argparse,json,os,sys
from pathlib import Path
from urllib.parse import quote,urlparse
import requests
from jsonschema import Draft202012Validator
PACKAGE_ROOT=Path(__file__).resolve().parent
if not (PACKAGE_ROOT/'quiz-decision.schema.json').is_file(): PACKAGE_ROOT=PACKAGE_ROOT/'sfa-academy-v6'
sys.path.insert(0,str(PACKAGE_ROOT))
from sfa_api.contracts import canonical

def validate_envelope(p):
    if not {'requestId','leaseToken','decision'}<=set(p)<= {'requestId','leaseToken','decision','riskEvidence'}: raise ValueError('Use {requestId,leaseToken,decision}')
    d=p['decision']; kind={'sfa-quiz-decision':'quiz','sfa-practical-decision':'practical'}.get(d.get('format'))
    if not kind: raise ValueError('Unsupported decision format')
    schema=json.loads((PACKAGE_ROOT/(kind+'-decision.schema.json')).read_text())
    Draft202012Validator(schema).validate(d)
    if kind=='practical':
        from sfa_api.risk import hard_block
        if hard_block(p.get('riskEvidence')) is not d['finalHardBlock']: raise ValueError('Risk hard-block mismatch')
    expected=kind+':'+d['attemptId' if kind=='quiz' else 'submissionId']
    if p['requestId']!=expected: raise ValueError('Request target mismatch')
    return p

class Client:
    def __init__(self,url=None,key=None):
        self.url=(url or os.environ.get('ECHO_ACADEMY_URL','https://92-5-230-55.sslip.io')).rstrip('/')
        self.key=key or os.environ['ECHO_ACADEMY_API_KEY']
        u=urlparse(self.url)
        if u.scheme!='https' and not (u.scheme=='http' and u.hostname in ('127.0.0.1','localhost','::1')): raise ValueError('HTTPS required')
        if u.username or u.query or u.fragment or u.path: raise ValueError('Root URL required')
        if len(self.key)<32: raise ValueError('API key missing/short')
    def call(self,method,path,body=None,stream=False):
        r=requests.request(method,self.url+'/echo/v1/'+path,headers={'Authorization':'Bearer '+self.key},json=body,timeout=(5,90),allow_redirects=False,stream=stream)
        if not 200<=r.status_code<300: raise ValueError('Academy API HTTP '+str(r.status_code))
        return r if stream else r.json()
    def submit(self,p): return self.call('POST','decisions',validate_envelope(p))

def main():
    p=argparse.ArgumentParser(); sub=p.add_subparsers(dest='command',required=True)
    sub.add_parser('queue'); sub.add_parser('report').add_argument('student')
    f=sub.add_parser('fetch'); f.add_argument('fileId'); f.add_argument('out')
    sub.add_parser('claim').add_argument('requestId'); sub.add_parser('submit').add_argument('decision')
    a=p.parse_args(); c=Client()
    if a.command=='fetch':
        r=c.call('GET','files/'+quote(a.fileId,safe=''),stream=True)
        # Private local file only; never overwrite an existing original.
        fd=os.open(a.out,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'wb') as f:
            for chunk in r.iter_content(65536): f.write(chunk)
        print('Saved original; verify sha256 against queue.'); return
    if a.command=='queue': result=c.call('GET','queue')
    elif a.command=='report': result=c.call('GET','students/'+quote(a.student,safe='')+'/report')
    elif a.command=='claim': result=c.call('POST','claims/'+quote(a.requestId,safe=''),{})
    else: result=c.submit(json.loads(Path(a.decision).read_text()))
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':
    try: main()
    except Exception as e:
        # No raw requests exceptions: they may carry authorization context.
        print('Echo client failed: '+(str(e) if isinstance(e,ValueError) else type(e).__name__),file=sys.stderr); sys.exit(1)
