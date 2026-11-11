import copy,io,json,sqlite3,time
from pathlib import Path
from unittest.mock import Mock
import pytest
from sfa_api.contracts import Invalid
from sfa_api.bot import Bot
from .test_units import grade_quiz,practical,risk_evidence,input_quiz
from .vectors import pdecision,assignment

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

def test_owner_copy_and_dashboard_delivery_independent_of_telegram(svc,account,bank):
    svc.config.admin_id=999;s,_=account;_,d,rid,lease=grade_quiz(svc,s);svc.decision(d,rid,lease)
    assert svc.db.rows('SELECT 1 FROM notifications')
    assert any('Decision copy' in r['body'] for r in svc.db.rows('SELECT body FROM outbox WHERE chat=999'))

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
