import copy,io,json,sqlite3,time
from pathlib import Path
from unittest.mock import Mock
import pytest
from sfa_api.bot import Bot
from sfa_api.contracts import Invalid, canonical
from sfa_api.service import _owner_decision_line
from .test_units import grade_quiz,practical,risk_evidence,input_quiz
from .vectors import pdecision,qdecision

def test_max12_files_and_document_required(svc,account,bank):
    s,_=account;_,d,rid,lease=grade_quiz(svc,s);svc.decision(d,rid,lease);sid=svc.draft(s)
    # File count enforcement runs before reading a 13th file.
    with svc.db.tx() as c:
        for i in range(12):c.execute('INSERT INTO files(id,submission,path,digest,name,size) VALUES(?,?,?,?,?,?)',(str(i),sid,'/not-read','a'*64,'screenshot.png',100))
    from werkzeug.datastructures import FileStorage
    with pytest.raises(Invalid):svc.upload(s,sid,FileStorage(io.BytesIO(b'text'),filename='work.txt'))
    with pytest.raises(Invalid):svc.submit_practical(s,sid)

def test_quiz_no_corrections_rejected(svc,account,bank):
    s,_=account;p=input_quiz();p['items'][0]['studentAnswer']=0;svc.quiz_submit(p,s)
    packet=json.loads(svc.db.rows('SELECT body FROM quizzes')[0]['body'])
    from .vectors import qdecision
    d=qdecision(svc,packet);d['corrections']=[];rid='quiz:'+p['attemptId']
    with pytest.raises(Invalid):svc.decision(d,rid,svc.claim(rid)['leaseToken'])

def test_practical_cannot_lie_about_risk(svc,account,bank):
    s,_=account;_,d,rid,lease=grade_quiz(svc,s);svc.decision(d,rid,lease);sid=practical(svc,s);d=pdecision(svc,sid);rid='practical:'+sid;lease=svc.claim(rid)['leaseToken']
    e=risk_evidence(d);e['riskAmount']='100.01'
    with pytest.raises(Invalid):svc.decision(d,rid,lease,e)
    with pytest.raises(Invalid):svc.decision(d,rid,lease,None)
    assert svc.entitlements(s['student'])['unlockedStage']==1

def test_approval_mode_no_unlock_before_admin(svc,account,bank):
    svc.config.approval_required=True;s,_=account;_,d,rid,lease=grade_quiz(svc,s);assert svc.decision(d,rid,lease)['state']=='PENDING_APPROVAL'
    assert svc.entitlements(s['student'])['status']=='QUIZ_SUBMITTED'
    with svc.db.tx() as c:svc.deliver(c,c.execute('SELECT * FROM mentor_decisions').fetchone(),d)
    assert svc.entitlements(s['student'])['status']=='ASSIGNMENT_ISSUED'

def test_expired_claim(svc,account,bank):
    s,_=account;_,d,rid,lease=grade_quiz(svc,s)
    with svc.db.tx() as c:c.execute('UPDATE claims SET expires=0')
    with pytest.raises(Invalid):svc.decision(d,rid,lease)
    assert svc.claim(rid)['leaseToken']!=lease

def test_24hour_override_closed(svc,account,bank):
    s,_=account;_,d,rid,lease=grade_quiz(svc,s);svc.decision(d,rid,lease)
    with svc.db.tx() as c:c.execute('UPDATE mentor_decisions SET delivered_at=0')
    with pytest.raises(Invalid):svc.override(d['decisionId'],'A mentor requested a correction')

def _owners(svc,chat=999):
    return [r['body'] for r in svc.db.rows('SELECT body FROM outbox WHERE chat=? ORDER BY rowid',(chat,))]

def svc_line(svc,row,p):
    return _owner_decision_line(None,row,p,svc.config.origin)

def _line(svc,text):
    return text+'\n'+svc.config.origin+'/admin'

def test_owner_copy_and_dashboard_delivery_independent_of_telegram(svc,account,bank):
    svc.config.admin_id=999;s,_=account;_,d,rid,lease=grade_quiz(svc,s);svc.decision(d,rid,lease)
    sid=s['student']; owners=_owners(svc)
    assert owners==[_line(svc,f'{sid} · Week 1 quiz · APPROVED 10/10 · practical assigned')]
    body=owners[0]
    assert '{' not in body and '}' not in body and 'echoNotes' not in body and 'Decision copy' not in body
    assert 'Explain evidence and practice safely.' not in body and 'Read the full history' not in body
    assert 'Personalized weekly practical assignment' not in body and 'correctAnswer' not in body
    notes=svc.db.rows('SELECT body FROM notifications')
    assert {n['body'] for n in notes}=={
        canonical({'kind':'QUIZ_RESULT_READY','decisionId':d['decisionId'],'verdict':'APPROVED','url':svc.config.origin+'/progress'}),
        canonical({'kind':'ASSIGNMENT_READY','decisionId':d['decisionId'],'verdict':'APPROVED','url':svc.config.origin+'/progress'})}
    svc.decision(d,rid,lease)
    assert _owners(svc)==owners

def test_owner_practical_lines(svc,account,bank):
    svc.config.admin_id=999;s,_=account;sid=s['student']
    _,d,rid,lease=grade_quiz(svc,s);svc.decision(d,rid,lease)
    sub=practical(svc,s);d=pdecision(svc,sub,86);svc.decision(d,'practical:'+sub,svc.claim('practical:'+sub)['leaseToken'],risk_evidence(d))
    assert _owners(svc)==[
        _line(svc,f'{sid} · Week 1 quiz · APPROVED 10/10 · practical assigned'),
        _line(svc,f'{sid} · Week 1 practical · APPROVED 86/100 · Week 2 unlocked')]

def test_owner_remedial_practical_line(svc,account,bank):
    svc.config.admin_id=999;s,_=account;sid=s['student']
    _,d,rid,lease=grade_quiz(svc,s);svc.decision(d,rid,lease)
    sub=practical(svc,s);d=pdecision(svc,sub,58);svc.decision(d,'practical:'+sub,svc.claim('practical:'+sub)['leaseToken'],risk_evidence(d))
    assert _line(svc,f'{sid} · Week 1 practical · NOT_APPROVED 58/100 · remedial issued') in _owners(svc)
    assert len(_owners(svc))==2
    assert all('{' not in b and 'remedialAssignment' not in b and 'Unsafe or unsupported' not in b for b in _owners(svc))

def test_echo_notes_never_reach_any_outbox(svc,account,bank):
    svc.config.admin_id=999;svc.config.bot_token='test';svc.config.bot_username='test_bot'
    s,_=account;svc.link(svc.connect(s).split('=')[1],4242)
    p=input_quiz();p['items'][0]['studentAnswer']=1;svc.quiz_submit(p,s)
    packet=json.loads(svc.db.rows('SELECT body FROM quizzes WHERE attempt=?',(p['attemptId'],))[0]['body'])
    d=qdecision(svc,packet);secret='every MC answer is index 1';d['echoNotes']=secret
    correction=d['corrections'][0]['correction']['en']
    svc.decision(d,'quiz:'+p['attemptId'],svc.claim('quiz:'+p['attemptId'])['leaseToken'])
    rows=svc.db.rows('SELECT chat,body FROM outbox')
    assert rows and all(secret not in r['body'] and 'echoNotes' not in r['body'] and correction not in r['body'] and '{' not in r['body'] for r in rows)
    owners=[r['body'] for r in rows if r['chat']==999]
    assert owners==[_line(svc,f"{s['student']} · Week 1 quiz · APPROVED 9/10 · practical assigned")]
    students=[r['body'] for r in rows if r['chat']==4242]
    origin=svc.config.origin
    assert sorted(students)==sorted([
        'QUIZ_RESULT_READY / نتیجه در داشبورد آماده است\n'+origin+'/progress',
        'ASSIGNMENT_READY / نتیجه در داشبورد آماده است\n'+origin+'/progress'])
    stored=json.loads(svc.db.rows('SELECT body FROM mentor_decisions')[0]['body'])
    assert stored['echoNotes']==secret
    assert all(secret not in n['body'] for n in svc.db.rows('SELECT body FROM notifications'))

def test_owner_pending_and_retract_are_readable(svc,account,bank):
    svc.config.admin_id=999;svc.config.approval_required=True
    s,_=account;sid=s['student'];_,d,rid,lease=grade_quiz(svc,s)
    assert svc.decision(d,rid,lease)['state']=='PENDING_APPROVAL'
    assert _owners(svc)==[_line(svc,f'{sid} · decision pending approval')]
    assert svc.db.rows('SELECT 1 FROM notifications')==[]
    with svc.db.tx() as c:svc.deliver(c,c.execute('SELECT * FROM mentor_decisions').fetchone(),d)
    svc.override(d['decisionId'],'Mentor found a grading mistake')
    assert set(_owners(svc))=={
        _line(svc,f'{sid} · decision pending approval'),
        _line(svc,f'{sid} · Week 1 quiz · APPROVED 10/10 · practical assigned'),
        _line(svc,f'{sid} · decision retracted')}
    assert all('grading mistake' not in b and '{' not in b and 'echoNotes' not in b for b in _owners(svc))
    assert any('grading mistake' in n['body'] for n in svc.db.rows('SELECT body FROM notifications'))

def test_owner_line_omits_missing_score(svc):
    origin=svc.config.origin
    quiz=svc_line(svc,{'student':'S10001','week':1,'kind':'quiz'},{'format':'sfa-quiz-decision','verdict':'APPROVED','assignment':{'title':'do not leak this assignment'},'echoNotes':'every MC answer is index 1','feedback':{'en':'hidden feedback','fa':'x'}})
    assert quiz==f'S10001 · Week 1 quiz · APPROVED · practical assigned\n{origin}/admin'
    missing=svc_line(svc,{'student':'S10001','week':1,'kind':'practical'},{'format':'sfa-practical-decision','verdict':'NOT_APPROVED','remedialAssignment':{'title':'do not leak'},'echoNotes':'every MC answer is index 1','feedback':{'en':'hidden feedback'}})
    assert missing==f'S10001 · Week 1 practical · NOT_APPROVED · remedial issued\n{origin}/admin'
    stage8=svc_line(svc,{'student':'S10001','week':8,'kind':'practical'},{'verdict':'APPROVED','unlockNext':False,'scores':{'risk':40,'technicalMacro':40,'journalPsychology':20},'echoNotes':'every MC answer is index 1'})
    assert stage8==f'S10001 · Week 8 practical · APPROVED 100/100 · awaiting senior mentor\n{origin}/admin'
    for body in (quiz,missing,stage8):
        assert '{' not in body and 'echoNotes' not in body and 'hidden feedback' not in body and 'do not leak' not in body and 'index 1' not in body

def test_daily_summary_stays_one_readable_line(svc,monkeypatch):
    from datetime import datetime as real_datetime
    clock={'hour':20}
    class Frozen(real_datetime):
        @classmethod
        def now(cls,tz=None):
            return real_datetime(2026,11,19,clock['hour'],30,tzinfo=tz)
    monkeypatch.setattr('sfa_api.bot.datetime',Frozen)
    svc.config.admin_id=999
    b=Bot.__new__(Bot);b.svc=svc;b.cfg=svc.config
    b.summary();assert svc.db.rows('SELECT 1 FROM outbox')==[]
    clock['hour']=21;b.summary();b.summary()
    rows=svc.db.rows('SELECT chat,body FROM outbox')
    assert rows==[{'chat':999,'body':'SFA daily summary / خلاصه روزانه 2026-11-19 Europe/Amsterdam\nDelivered decisions: 0\n'+svc.config.origin+'/admin'}]
    assert '{' not in rows[0]['body']

def test_bot_rejects_submission_commands(svc):
    b=Bot.__new__(Bot);b.svc=svc;b.cfg=svc.config;b.call=Mock()
    b.handle({'message':{'chat':{'id':123,'type':'private'},'text':'/submit'}});b.call.assert_not_called()
    b.handle({'message':{'chat':{'id':123,'type':'private'},'document':{'file_id':'x'}}});b.call.assert_not_called()

def test_bot_ambiguous_send_never_retries(svc):
    b=Bot.__new__(Bot);b.svc=svc;b.cfg=svc.config;b.call=Mock(side_effect=TimeoutError())
    with svc.db.tx() as c:c.execute('INSERT INTO outbox(id,chat,body) VALUES(?,?,?)',('test',123,'Ready'))
    b.send_pending();b.send_pending();assert b.call.call_count==1 and svc.db.rows('SELECT state FROM outbox')[0]['state']=='UNKNOWN'

def test_cross_user_quiz_feedback_denied(svc,account,bank):
    s,_=account;_,d,rid,lease=grade_quiz(svc,s)
    with pytest.raises(Invalid):svc.quiz_feedback({'student':'S99999999'},d['attemptId'])

def test_db_sql_adapter_preserves_postgres_upsert():
    from sfa_api.db import Connection
    c=Mock();Connection(c).execute('INSERT OR REPLACE INTO weaknesses VALUES(?,?,?,?,?,?,?,?,?)',tuple(range(9)))
    sql,args=c.execute.call_args.args
    assert 'ON CONFLICT(student,id) DO UPDATE' in sql and '?' not in sql and len(args)==9
    c.reset_mock();Connection(c).execute('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?)',tuple(range(5)))
    assert c.execute.call_args.args[0].endswith('ON CONFLICT DO NOTHING')

def test_installer_static_safety():
    root=Path(__file__).parents[1];s=(root/'install.sh').read_text()
    assert 'set -euo pipefail' in s and '.sfa-v6-ready' in s
    assert 'git pull' not in '\n'.join(x for x in s.splitlines() if not x.strip().startswith('#') and not x.startswith('echo'))
    assert 'iptables -F' not in s
    assert s.index('extract_answer_key.mjs')<s.index('pm2 stop-legacy')
    assert 'sfa invite > /etc/sfa/cohort-invite' in s and '>&3' in s
    assert '0.0.0.0:8081' not in s
    assert 'next.config.ts' in s and '$ROOT/../..' in s
    assert 'header_up X-SFA-Client-IP {http.request.remote.host}' in s
    assert 'proxy_set_header X-SFA-Client-IP' in s
    # nginx overwrites the client address; it must not append a client-supplied chain.
    assert 'proxy_add_x_forwarded_for' not in s
    assert 'set -eEuo pipefail' in s and "trap 'on_err $? $LINENO' ERR" in s
    assert 'stdbuf -oL' in s and 'BASH_XTRACEFD=4' in s and '--verbose' in s
    assert s.index("exec /opt/sfa/.venv/bin/python -m sfa_api.cli") < s.index('discover "$APP_DIR"')
    assert 'Node 22.6 or newer is required' in s and 'nvm install 22' in s
    assert 'quiz-item-hmac-key' in s and 'SFA_QUIZ_ITEM_HMAC_FILE' in s
    assert 'echo "$SFA_QUIZ' not in s and "printf '%s\\n' \"$SFA_QUIZ" not in s
    assert 'tar_rc' in s and 'cohort-invite is created only if missing' in s
    assert 'umask 022' in s and 'publish_opt_sfa /opt/sfa' in s
    assert 'wait_unit_http sfa-api' in s and 'last HTTP' in s
    assert '--location' in s and '--max-redirs 5' in s
    health_curl = next(line for line in s.splitlines() if 'health_url' in line and 'curl ' in line)
    assert '--location' not in health_curl and 'health_code == 200' in s


def test_risk_arithmetic_near_threshold_is_exact():
    from sfa_api.risk import hard_block
    e={'currentEquity':'10000','riskAmount':'100.00000000000000000000000000001','netReward':'300','stopType':'STRUCTURAL_HARD','evidenceRefs':['p2']}
    assert hard_block(e) is True
