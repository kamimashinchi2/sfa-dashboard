import copy,hashlib,hmac,io,json,secrets,time,zipfile
from pathlib import Path
import pytest
from sfa_api.contracts import Invalid,validate_quiz,validate_assignment,validate_decision
from sfa_api.grading import assess,numeric,verdict
from sfa_api.security import sign,verify,token_hash
from sfa_api.uploads import store,MAX_BYTES
from sfa_api.service import PASSWORDS,now
from .vectors import payload,key,assignment,qdecision,pdecision,weakness

@pytest.fixture
def bank(cfg):
    p=Path(cfg.answer_key_path);p.mkdir();(p/'synthetic.json').write_text(json.dumps(key()));return p
@pytest.mark.parametrize('score,expected',[(0,'NOT_APPROVED'),(59,'NOT_APPROVED'),(60,'PARTIALLY_APPROVED'),(79,'PARTIALLY_APPROVED'),(80,'APPROVED'),(100,'APPROVED')])
def test_quiz_thresholds(score,expected): assert verdict(score,80,60)==expected
@pytest.mark.parametrize('score,expected',[(0,'NOT_APPROVED'),(64,'NOT_APPROVED'),(65,'PARTIALLY_APPROVED'),(79,'PARTIALLY_APPROVED'),(80,'APPROVED'),(100,'APPROVED')])
def test_practical_thresholds(score,expected): assert verdict(score,80,65)==expected
@pytest.mark.parametrize('score',[0,60,65,79,80,100])
def test_hard_blocks(score): assert verdict(score,80,65,True)=='NOT_APPROVED'
@pytest.mark.parametrize('value,expected',[('۰٫۵۰','0.50'),('۱٬۰۰۰','1000'),('NaN',None),('inf',None),('-12.5','-12.5')])
def test_numeric(value,expected): assert (str(numeric(value)) if numeric(value) is not None else None)==expected
@pytest.mark.parametrize('count',[0,5,6,8,10])
def test_recomputation(cfg,bank,count): assert assess(payload(count),cfg)['score']==count*10
@pytest.mark.parametrize('drift',['missing','commit','hash','omitted','unknown','kind'])
def test_key_fail_closed(cfg,bank,drift):
    p=payload()
    if drift=='missing':cfg.answer_key_path='missing'
    if drift=='commit':p['buildCommit']='deadbee'
    if drift=='hash':p['items'][0]['itemHash']='b'*64
    if drift=='kind':p['items'][0]['kind']='order'
    if drift=='omitted':p['items'].pop()
    if drift=='unknown':p['items'][0]['itemId']='unknown'
    assert assess(p,cfg)['status']=='UNVERIFIED'
@pytest.mark.parametrize('field,value',[('schemaVersion',1),('schemaVersion',True),('stage',2),('score',True),('alias','bad alias'),('studentId','x@y.test'),('buildCommit','badcommit'),('readiness','PASS')])
def test_invalid_quiz(field,value):
    p=payload();p[field]=value
    with pytest.raises(Invalid):validate_quiz(p)
def test_order_untouched(cfg,bank):
    p=payload();p['items'][2]['touched']=False;assert assess(p,cfg)['correct']==9
@pytest.mark.parametrize('change',['path','body','nonce','method','stale'])
def test_hmac(change):
    t=str(now());n=secrets.token_urlsafe(18);h={'X-SFA-Timestamp':t,'X-SFA-Nonce':n,'X-SFA-Signature':sign('a'*64,t,'POST','/x',b'{}',n)}
    verify('a'*64,h,'POST','/x',b'{}')
    if change=='nonce':h['X-SFA-Nonce']='bad'
    with pytest.raises(Invalid): verify('a'*64,h,'GET' if change=='method' else 'POST','/y' if change=='path' else '/x',b'x' if change=='body' else b'{}',now=now()+1000 if change=='stale' else now())
@pytest.mark.parametrize('broken',['spiral','weakness','risk','stage'])
def test_assignment_contract(broken):
    a=assignment(2,2,['risk'])
    if broken=='spiral':a['spiralReview']=[]
    if broken=='weakness':a['weaknessDrills']=[]
    if broken=='risk':a['riskRules']['maxRiskPct']='2'
    if broken=='stage':a['stage']=3
    with pytest.raises(Invalid):validate_assignment(a,2,2,['risk'])
@pytest.mark.parametrize('name,data',[('safe.txt',b'plain text evidence\n'),('safe.md','شواهد آموزشی'.encode()),('safe.pdf',b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF')])
def test_upload_allowed(tmp_path,name,data):
    f=store(io.BytesIO(data),tmp_path,'id',name);assert f['digest']==hashlib.sha256(data).hexdigest() and f['size']==len(data)
@pytest.mark.parametrize('name,data',[('../x.txt',b'hello'),('x.exe',b'MZexe'),('x.pdf',b'plain text'),('x.png',b'%PDF-1.4'),('x.txt',b'\xff\x00'),('x.txt',b'')])
def test_upload_reject(tmp_path,name,data):
    with pytest.raises(Invalid):store(io.BytesIO(data),tmp_path,'id',name)
    assert not (tmp_path/'id').exists()
def test_upload_size(tmp_path):
    with pytest.raises(Invalid):store(io.BytesIO(b'a'*(MAX_BYTES+1)),tmp_path,'id','x.txt')
def test_docx(tmp_path):
    b=io.BytesIO()
    with zipfile.ZipFile(b,'w') as z:z.writestr('[Content_Types].xml','<Types/>');z.writestr('word/document.xml','<document/>')
    assert store(io.BytesIO(b.getvalue()),tmp_path,'id','x.docx')['size']>0
@pytest.mark.parametrize('weeks,expected',[([1,1],'IMPROVING'),([1,2],'RESOLVED'),([1,3],'IMPROVING')])
def test_two_distinct_consecutive_weeks(svc,account,weeks,expected):
    s,_=account
    for week in weeks:
        with svc.db.tx() as c:svc._weakness_updates(c,s['student'],week,[weakness(clean=True)])
    assert svc.weaknesses(s['student'])[0]['status']==expected

def test_recurrence_reopens(svc,account):
    sid=account[0]['student']
    with svc.db.tx() as c:
        for week,clean in [(1,True),(2,True),(3,False)]:svc._weakness_updates(c,sid,week,[weakness(clean=clean)])
    assert svc.weaknesses(sid)[0]['status']=='OPEN'

def test_account_login_reset(svc,account):
    s,token=account;assert PASSWORDS.verify(s['password_hash'],'correct horse battery staple')
    assert svc.auth(svc.login({'email':'STUDENT@example.test','password':'correct horse battery staple'}))['student']==s['student']
    link=svc.reset_link('student@example.test');p={'token':link.rsplit('/',1)[1],'password':'a different long password'};svc.reset_password(p)
    with pytest.raises(Invalid):svc.auth(token)
    with pytest.raises(Invalid):svc.reset_password(p)

def test_telegram_single_use_expiry(svc,account):
    s,_=account;svc.config.bot_token='test';svc.config.bot_username='test_bot';url=svc.connect(s);token=url.split('=')[1];svc.link(token,123)
    with pytest.raises(Invalid):svc.link(token,124)
    assert svc.me(s)['telegramLinked']
def test_telegram_expired(svc,account):
    s,_=account;svc.config.bot_token='test';svc.config.bot_username='test_bot';token=svc.connect(s).split('=')[1]
    with svc.db.tx() as c:c.execute('UPDATE links SET expires=0')
    with pytest.raises(Invalid):svc.link(token,123)
def test_telegram_disabled(svc,account):
    assert svc.me(account[0])['telegramEnabled'] is False
    with pytest.raises(Invalid):svc.connect(account[0])

def input_quiz():
    p=payload();return {k:p[k] for k in ('attemptId','quizId','buildCommit')}|{'items':[{k:i[k] for k in ('itemId','itemHash','kind','studentAnswer','touched','reflection')} for i in p['items']]}
def grade_quiz(svc,s):
    p=input_quiz();svc.quiz_submit(p,s);packet=json.loads(svc.db.rows('SELECT body FROM quizzes WHERE attempt=?',(p['attemptId'],))[0]['body']);d=qdecision(svc,packet);rid='quiz:'+p['attemptId'];lease=svc.claim(rid)['leaseToken'];return p,d,rid,lease

def test_quiz_auto_delivers_no_unlock(svc,account,bank):
    s,_=account;p,d,rid,lease=grade_quiz(svc,s);r=svc.decision(d,rid,lease)
    assert r['state']=='DELIVERED' and svc.entitlements(s['student'])['unlockedStage']==1
    assert svc.entitlements(s['student'])['status']=='ASSIGNMENT_ISSUED'
    assert svc.decision(d,rid,lease)['idempotent']
    assert svc.db.rows('SELECT 1 FROM notifications')
    assert svc.quiz_feedback(s,p['attemptId'])['decision']['verdict']=='APPROVED'

def practical(svc,s):
    sid=svc.draft(s)
    from werkzeug.datastructures import FileStorage
    svc.upload(s,sid,FileStorage(stream=io.BytesIO(b'Structural stop and risk evidence.'),filename='work.txt'))
    svc.submit_practical(s,sid);return sid
@pytest.mark.parametrize('score,blocked,expected_stage,expected_state',[(90,False,2,'LESSON_OPEN'),(65,False,2,'LESSON_OPEN'),(64,False,1,'REMEDIAL_ISSUED'),(100,True,1,'REMEDIAL_ISSUED')])
def test_practical_gate(svc,account,bank,score,blocked,expected_stage,expected_state):
    s,_=account;_,d,rid,lease=grade_quiz(svc,s);svc.decision(d,rid,lease);sid=practical(svc,s)
    d=pdecision(svc,sid,score,blocked);rid='practical:'+sid;svc.decision(d,rid,svc.claim(rid)['leaseToken'],risk_evidence(d))
    ent=svc.entitlements(s['student']);assert (ent['unlockedStage'],ent['status'])==(expected_stage,expected_state)

def test_stage8_no_stage9(svc,account,bank):
    s,_=account
    with svc.db.tx() as c:
        c.execute('UPDATE students SET stage=8 WHERE student=?',(s['student'],));c.execute("UPDATE weeks SET stage=8,state='ASSIGNMENT_ISSUED' WHERE student=?",(s['student'],))
    sid=practical(svc,s);d=pdecision(svc,sid);rid='practical:'+sid;svc.decision(d,rid,svc.claim(rid)['leaseToken'],risk_evidence(d));ent=svc.entitlements(s['student']);assert ent['status']=='AWAITING_SENIOR_MENTOR' and ent['unlockedStage']==8

def test_missing_key_pending(svc,account):
    s,_=account;p=input_quiz();assert svc.quiz_submit(p,s)['assessment']['status']=='UNVERIFIED'
    assert svc.entitlements(s['student'])['status']=='QUIZ_SUBMITTED'

def test_claim_and_decision_conflicts(svc,account,bank):
    s,_=account;p,d,rid,lease=grade_quiz(svc,s)
    with pytest.raises(Invalid):svc.claim(rid)
    with pytest.raises(Invalid):svc.decision(d,rid,'bad')
    svc.decision(d,rid,lease);bad=copy.deepcopy(d);bad['feedback']['en']='different'
    with pytest.raises(Invalid):svc.decision(bad,rid,lease)

def test_future_content_locked(svc,account):
    with pytest.raises(Invalid):svc.authorize(account[0],2)

def test_legacy_never_unlocks(svc,account):
    s,_=account;svc.legacy(s,{'records':{'stage':8}});svc.legacy(s,{'records':{'stage':7}})
    assert svc.entitlements(s['student'])['unlockedStage']==1
    assert len(svc.db.rows("SELECT * FROM events WHERE kind='LEGACY_UNVERIFIED'"))==1

def test_override_relocks_and_requeues(svc,account,bank):
    s,_=account;_,d,rid,lease=grade_quiz(svc,s);svc.decision(d,rid,lease);sid=practical(svc,s);d=pdecision(svc,sid);rid='practical:'+sid;svc.decision(d,rid,svc.claim(rid)['leaseToken'],risk_evidence(d))
    svc.override(d['decisionId'],'Human mentor found missing evidence')
    assert svc.entitlements(s['student'])['unlockedStage']==1
    assert any(q['requestId'].startswith('practical:') for q in svc.queue())

def test_override_next_work_blocked(svc,account,bank):
    s,_=account;_,d,rid,lease=grade_quiz(svc,s);svc.decision(d,rid,lease);sid=practical(svc,s);d=pdecision(svc,sid);rid='practical:'+sid;svc.decision(d,rid,svc.claim(rid)['leaseToken'],risk_evidence(d))
    p=input_quiz();p['attemptId']='later';p['quizId']='M2'
    # Actual valid next-stage packet built from vectors.
    v=payload(stage=2);p={k:v[k] for k in ('attemptId','quizId','buildCommit')}|{'items':[{k:i[k] for k in ('itemId','itemHash','kind','studentAnswer','touched','reflection')} for i in v['items']]};svc.quiz_submit(p,s)
    with pytest.raises(Invalid):svc.override(d['decisionId'],'Mentor correction requested')


def risk_evidence(d): return {'currentEquity':'10000','riskAmount':'100','netReward':'220','stopType':'MENTAL' if d.get('finalHardBlock') else 'STRUCTURAL_HARD','evidenceRefs':['document:final-plan']}

@pytest.mark.parametrize('equity,risk,reward,stop,blocked',[('10000','100','200','STRUCTURAL_HARD',False),('10000','100.01','300','STRUCTURAL_HARD',True),('10000','100','199.99','STRUCTURAL_HARD',True),('10000','100','220','MENTAL',True),('10000','100','220','NONE',True)])
def test_decimal_final_plan_gate(equity,risk,reward,stop,blocked):
    from sfa_api.risk import hard_block
    assert hard_block({'currentEquity':equity,'riskAmount':risk,'netReward':reward,'stopType':stop,'evidenceRefs':['p2']}) is blocked

@pytest.mark.parametrize('value',[None,{}, {'currentEquity':'NaN','riskAmount':'1','netReward':'3','stopType':'STRUCTURAL_HARD','evidenceRefs':['p2']}])
def test_missing_risk_evidence_pending(value):
    from sfa_api.risk import hard_block
    with pytest.raises(Invalid):hard_block(value)
