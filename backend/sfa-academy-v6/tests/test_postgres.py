import json
import pytest
from sfa_api.db import DB
from sfa_api.service import Service
from sfa_api.app import create_app
from .vectors import key,pdecision
from .test_units import grade_quiz,practical,risk_evidence

@pytest.fixture
def pg_service(pg_url,cfg):
    cfg.database_url=pg_url
    s=Service(cfg)
    with s.db.tx() as c:
        for table in ('students','weeks','quizzes','events','submissions','files','mentor_decisions','weaknesses','invites','sessions','claims','notifications','outbox','nonces','rate','settings','resets','responses','legacy_imports'):c.execute('DELETE FROM '+table)
    return s
@pytest.fixture
def pg_account(pg_service):
    s=pg_service;token=s.invite().rsplit('/',1)[1];t=s.signup({'inviteToken':token,'email':'student@example.test','displayName':'Learner','password':'correct horse battery staple','acceptDataNotice':True});return s.auth(t),t

def test_real_pg_versioned_migration(pg_service):
    assert pg_service.db.rows('SELECT version FROM schema_migrations')==[{'version':1}]
    assert DB(pg_service.config.database_url).rows('SELECT version FROM schema_migrations')==[{'version':1}]
def test_real_pg_account(pg_service,pg_account):assert pg_service.me(pg_account[0])['unlockedStage']==1
@pytest.mark.parametrize('score,blocked,stage',[(90,False,2),(65,False,2),(100,True,1),(64,False,1)])
def test_real_pg_grading(pg_service,pg_account,tmp_path,score,blocked,stage):
    s=pg_service;bank=tmp_path/'key.json';bank.write_text(json.dumps(key()));s.config.answer_key_path=str(bank);student=pg_account[0]
    _,d,rid,lease=grade_quiz(s,student);s.decision(d,rid,lease);assert s.entitlements(student['student'])['unlockedStage']==1
    sid=practical(s,student);d=pdecision(s,sid,score,blocked);rid='practical:'+sid;s.decision(d,rid,s.claim(rid)['leaseToken'],risk_evidence(d));assert s.entitlements(student['student'])['unlockedStage']==stage
