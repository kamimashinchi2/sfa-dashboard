import hashlib,io,json,secrets,threading,time
from pathlib import Path
import pytest
from werkzeug.serving import make_server
import sfa_api.app as module
from sfa_api.security import sign
from echo_client import Client,validate_envelope
from .test_units import grade_quiz,practical,risk_evidence
from .vectors import pdecision

@pytest.fixture
def app(monkeypatch,svc):
    monkeypatch.setattr(module,'Service',lambda _:svc);return module.create_app(svc.config)
@pytest.fixture
def client(app):return app.test_client()
def signed(cfg,path,body=b'',method='GET',token=None,nonce=None):
    t=str(int(time.time()));n=nonce or secrets.token_urlsafe(18)
    h={'X-SFA-Timestamp':t,'X-SFA-Nonce':n,'X-SFA-Signature':sign(cfg.secret,t,method,path,body,n)}
    if token:h['Authorization']='Bearer '+token
    return h
@pytest.mark.parametrize('path',['/echo/v1/queue','/echo/v1/students/unknown/report','/echo/v1/files/unknown'])
def test_echo_auth(client,path):
    assert client.get(path).status_code==401
    assert client.get(path,headers={'Authorization':'Bearer '+'x'*48}).status_code==401

def test_health(client):assert client.get('/echo/v1/health').json=={'ok':True,'version':6}
def test_hmac_replay_body(client,cfg,account):
    path='/api/v1/me';h=signed(cfg,path,token=account[1]);assert client.get(path,headers=h).status_code==200;assert client.get(path,headers=h).status_code==400
    assert client.get(path).status_code==400

def test_admin_boundary(client,cfg,account):
    path='/api/v1/admin/students';assert client.get(path,headers=signed(cfg,path,token=account[1])).status_code==400

def test_cross_account_and_stage(client,cfg,account):
    path='/api/v1/authorize/8';assert client.get(path,headers=signed(cfg,path,token=account[1])).status_code==403

def test_multipart_hmac_stream(client,cfg,account,svc,bank):
    s,t=account;_,d,rid,lease=grade_quiz(svc,s);svc.decision(d,rid,lease);sid=svc.draft(s)
    boundary='sfa-test-boundary'
    raw=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="work.txt"\r\nContent-Type: text/plain\r\n\r\nEvidence for a structural stop\r\n--{boundary}--\r\n').encode()
    path='/api/v1/practicals/'+sid+'/files';h=signed(cfg,path,raw,'POST',t);h['Content-Type']='multipart/form-data; boundary='+boundary
    r=client.post(path,data=raw,headers=h);assert r.status_code==201,r.json;assert r.json['size']==30

def test_echo_client_dry_run_real_local_http(app,svc,account,bank,tmp_path):
    s,_=account;_,d,rid,_=grade_quiz(svc,s)
    # Allow the client to own a fresh lease in this test.
    with svc.db.tx() as c:c.execute('DELETE FROM claims')
    server=make_server('127.0.0.1',0,app,threaded=False);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:
        c=Client('http://127.0.0.1:'+str(server.server_port),'e'*48)
        assert c.call('GET','queue')['requests'][0]['requestId']==rid
        assert c.call('GET','students/'+s['student']+'/report')['markdown'].startswith('# Cumulative')
        lease=c.call('POST','claims/'+rid,{})['leaseToken'];envelope={'requestId':rid,'leaseToken':lease,'decision':d}
        assert c.submit(envelope)['state']=='DELIVERED';assert c.submit(envelope)['idempotent']
        sid=practical(svc,s);file=svc.file_list(sid)[0];data=c.call('GET','files/'+file['fileId'],stream=True).content
        assert hashlib.sha256(data).hexdigest()==file['digest']
        rid='practical:'+sid;lease=c.call('POST','claims/'+rid,{})['leaseToken'];decision=pdecision(svc,sid)
        assert c.submit({'requestId':rid,'leaseToken':lease,'decision':decision,'riskEvidence':risk_evidence(decision)})['state']=='DELIVERED'
    finally:server.shutdown();thread.join(5);server.server_close()

def test_echo_client_rejects_invalid_schema():
    with pytest.raises(Exception):validate_envelope({'requestId':'quiz:a','leaseToken':'x','decision':{'format':'sfa-quiz-decision'}})

def test_login_rate_limit(client,cfg):
    path='/api/v1/login';body=json.dumps({'email':'bad@example.test','password':'wrong'}).encode()
    for _ in range(10):assert client.post(path,data=body,content_type='application/json',headers=signed(cfg,path,body,'POST')).status_code==401
    assert client.post(path,data=body,content_type='application/json',headers=signed(cfg,path,body,'POST')).status_code==429
