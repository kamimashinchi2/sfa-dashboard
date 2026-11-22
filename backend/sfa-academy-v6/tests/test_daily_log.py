"""DAILY_LOG_V1 gates, the Friday window, and the no-plan path."""
import io, json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import pytest
from werkzeug.datastructures import FileStorage
from sfa_api.contracts import Invalid
from sfa_api.daily import AMSTERDAM, next_local_midnight, server_due_friday
from sfa_api.plan_policy import PLAN_POLICY, plan_policy
from .test_units import practical, risk_evidence
from .vectors import assignment, pdecision

TZ = AMSTERDAM

def at(y, m, d, hh=12, mm=0, ss=0):
    return datetime(y, m, d, hh, mm, ss, tzinfo=TZ)

def test_plan_policy_table_is_the_only_switch():
    assert [plan_policy(s) for s in range(1, 8)] == ['optional'] * 7
    assert plan_policy(8) == 'required'
    assert PLAN_POLICY[5] == 'optional' and PLAN_POLICY[8] == 'required'

def test_due_friday_each_weekday_and_dst():
    # 2026-11-23 is Monday. Four weekdays after it end on Friday 27 Nov.
    assert server_due_friday(at(2026, 11, 23, 10)).date().isoformat() == '2026-11-27'
    for day in range(24, 30):
        assert server_due_friday(at(2026, 11, day, 10)).date().isoformat() == '2026-12-04'
    spring = server_due_friday(at(2026, 3, 27, 12))  # Friday before the March transition
    assert spring.date().isoformat() == '2026-04-03'
    assert spring.utcoffset() == timedelta(hours=2)
    autumn = server_due_friday(at(2026, 10, 24, 12))  # Saturday before the October transition
    assert autumn.date().isoformat() == '2026-10-30'
    assert autumn.utcoffset() == timedelta(hours=1)
    assert next_local_midnight(datetime(2026, 10, 25, tzinfo=TZ).date()).isoformat() == '2026-10-26T00:00:00+01:00'
    assert next_local_midnight(datetime(2026, 3, 28, tzinfo=TZ).date()).isoformat() == '2026-03-29T00:00:00+01:00'

def _open(svc, student, stage):
    with svc.db.tx() as c:
        c.execute('UPDATE students SET stage=? WHERE student=?', (stage, student['student']))
        c.execute("UPDATE weeks SET stage=?, state='ASSIGNMENT_ISSUED', practical_model='LEGACY', plan_required=? WHERE student=?", (stage, 1 if plan_policy(stage)=='required' else 0, student['student']))

def _grade(svc, student, stage, score=90, no_plan=None, evidence='omit'):
    _open(svc, student, stage)
    sid = practical(svc, student)
    d = pdecision(svc, sid, score, False)
    d['finalHardBlock'] = False
    rid = 'practical:' + sid
    lease = svc.claim(rid)['leaseToken']
    risk = None if evidence == 'omit' else evidence
    if isinstance(no_plan, dict):
        return svc.decision(d, rid, lease, risk, True, no_plan.get('noPlanReason')), d, sid
    return svc.decision(d, rid, lease, risk, False, None), d, sid

@pytest.mark.parametrize('stage', [1, 2, 3, 4, 5, 6, 7])
def test_no_plan_accepted_for_optional_weeks(svc, account, stage):
    s, _ = account
    reason = 'No trade. Timestamped readings at 14:35 show the chain unresolved.'
    result, d, sid = _grade(svc, s, stage, 90, {'noPlan': True, 'noPlanReason': reason})
    assert result['state'] == 'DELIVERED'
    stored=svc.db.rows('SELECT plan_required FROM weeks WHERE student=? AND week=1', (s['student'],))
    assert bool(stored[0]['plan_required']) is (stage==8)
    kinds = [e['kind'] for e in svc.db.rows('SELECT kind FROM events WHERE student=?', (s['student'],))]
    assert 'NO_PLAN' in kinds and 'FINAL_PLAN_RISK_EVIDENCE' not in kinds
    assert svc.entitlements(s['student'])['status'] == ('AWAITING_SENIOR_MENTOR' if stage == 8 else 'LESSON_OPEN')

def test_no_plan_rejected_for_a8(svc, account):
    s, _ = account
    with pytest.raises(Invalid, match='PLAN_REQUIRED_FOR_WEEK'):
        _grade(svc, s, 8, 90, {'noPlan': True, 'noPlanReason': 'No trade this week, grounded in the 0-5 window.'})

def test_no_plan_with_evidence_is_rejected(svc, account):
    s, _ = account
    _open(svc, s, 5)
    sid = practical(svc, s)
    d = pdecision(svc, sid, 90, False)
    rid = 'practical:' + sid
    with pytest.raises(Invalid, match='PLAN_AND_NO_PLAN_CONFLICT'):
        svc.decision(d, rid, svc.claim(rid)['leaseToken'], risk_evidence(d), True, 'Both a plan and a no-plan flag were sent.')

def test_no_plan_cannot_set_hard_block(svc, account):
    s, _ = account
    _open(svc, s, 3)
    sid = practical(svc, s)
    d = pdecision(svc, sid, 90, True)
    rid = 'practical:' + sid
    with pytest.raises(Invalid, match='FINAL_HARD_BLOCK_MISMATCH'):
        svc.decision(d, rid, svc.claim(rid)['leaseToken'], None, True, 'Grounded no-trade. Timestamped bid/ask at 10:15.')

def test_no_plan_still_uses_score_thresholds(svc, account):
    s, _ = account
    result, d, sid = _grade(svc, s, 4, 64, {'noPlan': True, 'noPlanReason': 'No trade. Observed reaction unavailable for the release window.'})
    assert svc.entitlements(s['student'])['status'] == 'REMEDIAL_ISSUED'
    assert d['verdict'] == 'NOT_APPROVED'

def _assign(stage=1):
    tasks=[{'taskId':'C1','kind':'CORE','stage':stage,'skill':'core','task':{'fa':'کار اصلی این هفته.','en':'Core task for this week.'},'minDays':1}]
    tasks+=[{'taskId':f'S{s}','kind':'SPIRAL','stage':s,'skill':'prior','task':{'fa':'مرور مرحله قبل.','en':'Spiral task from an earlier stage.'},'minDays':1} for s in range(1, stage)]
    return {'week':1,'stage':stage,'title':{'fa':'تکلیف','en':'Assignment'},'coreTasks':[{'fa':'کار','en':'Do the lesson.'}],'weaknessDrills':[],'spiralReview':[{'stage':s,'skill':'prior','task':{'fa':'مرور','en':'Review.'}} for s in range(1, stage)],'riskRules':{'maxRiskPct':'1','hardStructuralStop':True,'minNetRR':'2','noSignals':True},'deliverables':[{'fa':'سند','en':'A document.'}],'dueAtISO':'2026-11-27T23:59:59+01:00','dailyTasks':tasks,'dailyLogRequirement':{'minDays':3,'eligibleWeekdays':['MON','TUE','WED','THU','FRI'],'timezone':'Europe/Amsterdam','freshCount':True},'fridayDeliverable':{'fa':'جمعه','en':'Friday file.'}}

def _paper(**over):
    plan={'equity':'10000','riskPct':'1','entry':'1.08','stopLevel':'1.07','stopType':'hard','pointValue':'10','pointValueSource':'illustrative','lot':'0.1','spreadCosts':'1','target':'1.10','netRR':'2'}
    plan.update(over)
    return plan

def _conditional():
    return {'condition':'WAIT until the marked level is swept','entry':'1.0840','stop':'1.0820','target':'1.0900','sizeRisk':'1% of paper equity, rounded down'}

def _entry(task='C1'):
    return {'taskIds':[task],'dayCall':'NO_TRADE','dayCallReason':'Observed reaction unavailable','routine':{'freshness':'FRESH','oneLine':'I checked the list before acting.'},'observations':'EURUSD bid 1.08 at 10:15 on the broker screen.','currentApplication':'Applied this week lesson to that reading.','spiralApplication':'Marked the earlier level.','paperPlan':None,'selfCheck':'No signal. Simulated only.'}

def _trade(task='C1', **over):
    body=_entry(task)
    body['dayCall']='TRADE'
    body['dayCallReason']=''
    body['paperPlan']=_paper(**over)
    return body

def _arm(svc, student, when, stage=1):
    svc.clock=lambda: when
    issued=int(at(2026,11,23,10).timestamp())
    with svc.db.tx() as c:
        c.execute("UPDATE weeks SET stage=?, state='ASSIGNMENT_ISSUED', practical_model='DAILY_LOG_V1', issued_at=?, due_friday=?, window_start=?, assignment=? WHERE student=?",
                  (stage, issued, '2026-11-27', '2026-11-24', json.dumps(_assign(stage)), student['student']))

def test_entry_locks_at_amsterdam_midnight(svc, account):
    s,_=account; _arm(svc, s, at(2026,11,24,10))
    made=svc.create_daily_entry(s, _entry())
    svc.clock=lambda: at(2026,11,25,0,0,0)
    with pytest.raises(Invalid, match='DAY_LOCKED'):
        svc.update_daily_entry(s, made['entryId'], _entry())
    with pytest.raises(Invalid, match='DAY_LOCKED'):
        svc.delete_daily_entry(s, made['entryId'])

def test_weekend_is_ineligible_and_three_is_the_limit(svc, account):
    s,_=account; _arm(svc, s, at(2026,11,28,11))
    saved=svc.create_daily_entry(s, _entry())
    assert saved['eligible'] is False and saved['ineligibleReason']=='WEEKEND'
    svc.clock=lambda: at(2026,11,24,9)
    for _ in range(3):
        svc.create_daily_entry(s, _entry())
    with pytest.raises(Invalid, match='DAILY_ENTRY_LIMIT'):
        svc.create_daily_entry(s, _entry())

def test_revisions_are_appended(svc, account):
    s,_=account; _arm(svc, s, at(2026,11,24,9))
    made=svc.create_daily_entry(s, _entry())
    svc.clock=lambda: at(2026,11,24,15)
    edited=svc.update_daily_entry(s, made['entryId'], _entry())
    assert edited['revisionCount']==2
    rows=svc.db.rows('SELECT revision FROM daily_entry_revisions WHERE entry=? ORDER BY revision', (made['entryId'],))
    assert [r['revision'] for r in rows]==[1,2]

def test_window_closed_and_overdue_rollover_and_override(svc, account):
    s,_=account; _arm(svc, s, at(2026,11,24,9))
    with pytest.raises(Invalid, match='PRACTICAL_WINDOW_CLOSED') as exc:
        svc.draft(s)
    assert exc.value.extra['opensAtISO'].startswith('2026-11-27T00:00:00')
    assert exc.value.extra['closesAtISO'].startswith('2026-11-27T23:59:59')
    svc.clock=lambda: at(2026,11,28,10)
    view=svc.daily_log_view(s)
    assert view['state']=='PRACTICAL_OVERDUE' and view['dueFriday']=='2026-12-04'
    opened=svc.open_practical_window(s['student'], 'Student was travelling and asked before the new Friday.')
    assert opened['opensAtISO'].startswith('2026-11-28')
    sid=svc.draft(s)
    svc.upload(s, sid, FileStorage(stream=io.BytesIO(b'A grounded note with a hard stop.'), filename='work.txt'))
    assert svc.submit_practical(s, sid)==sid

def test_packet_is_server_built_and_hides_answer_keys(svc, account):
    s,_=account; _arm(svc, s, at(2026,11,24,9), stage=2)
    body=_entry(); body['taskIds']=['C1','S1']; body['spiralApplication']='Reviewed stage 1 spread.'
    svc.create_daily_entry(s, body)
    view=svc.daily_log_view(s)
    blob=json.dumps(view)
    for banned in ('correctAnswer','echoNotes','answerKey','ECHO_ACADEMY_API_KEY','contentDigest','academyRules','approval','Kamyar'):
        assert banned not in blob
    svc.clock=lambda: at(2026,11,27,18)
    sid=svc.draft(s)
    svc.upload(s, sid, FileStorage(stream=io.BytesIO(b'Friday document.'), filename='work.txt'))
    svc.submit_practical(s, sid)
    item=next(i for i in svc.queue() if i['kind']=='practical_submission')
    assert item['dailyLog']['countedDays']>=0
    assert 'contentDigest' in item['dailyLog']['entries'][0]
    assert 'correctAnswer' not in json.dumps(item['dailyLog'])
    assert item['academyRules']['effective']['stopBlockMode']=='NO_STOP_ONLY'
    assert 'approval' not in item['academyRules']
    assert item['dailyLog']['academyRules']['level']=='L02'
    assert item['weekPlanRequired'] is False and item['dailyLog']['weekPlanRequired'] is False
    assert item['planPolicy']=='optional'

def _v3(svc, sid, score, gate, blocked=False):
    d=pdecision(svc, sid, score, blocked)
    d['schemaVersion']=3
    d['routineGate']=gate
    d['finalHardBlock']=blocked
    from sfa_api.grading import verdict
    expected=verdict(sum(d['scores'].values()), svc.config.practical_approved, svc.config.practical_partial, blocked or not gate['passed'])
    d['verdict']=expected
    d['unlockNext']=expected!='NOT_APPROVED' and d['stage']<8
    if expected=='NOT_APPROVED':
        d['remedialAssignment']=assignment(d['week']+1, d['stage'])
        d['nextAssignment']=None
        d['unlockNext']=False
    else:
        d['remedialAssignment']=None
        d['nextAssignment']=None
    return d

def test_routine_gate_pass_fail_and_mismatch(svc, account):
    s,_=account
    _arm(svc, s, at(2026,11,24,9), stage=1)
    svc.create_daily_entry(s, _entry())
    svc.clock=lambda: at(2026,11,25,9)
    second=svc.create_daily_entry(s, _entry())
    svc.clock=lambda: at(2026,11,27,16)
    sid=svc.draft(s)
    svc.upload(s, sid, FileStorage(stream=io.BytesIO(b'Friday note.'), filename='work.txt'))
    svc.submit_practical(s, sid)
    rid='practical:'+sid
    ids=[e['entryId'] for e in svc.queue()[0]['dailyLog']['entries']]
    assert svc.queue()[0]['dailyLog']['countedDays']==2
    fail={'requiredDays':3,'serverCountedDays':2,'genuineDays':2,'genuineEntryIds':ids,'rejectedEntries':[],'passed':False}
    lease=svc.claim(rid)['leaseToken']
    with pytest.raises(Invalid, match='ROUTINE_COUNT_MISMATCH'):
        bad=dict(fail); bad['genuineDays']=3
        svc.decision(_v3(svc, sid, 90, bad), rid, lease, risk_evidence(pdecision(svc, sid)))
    low=_v3(svc, sid, 90, fail)
    # 90 points but the gate failed: not approved, no unlock.
    result=svc.decision(low, rid, lease, risk_evidence(low))
    assert result['state']=='DELIVERED'
    assert svc.entitlements(s['student'])['unlockedStage']==1
    assert svc.entitlements(s['student'])['status']=='REMEDIAL_ISSUED'

def test_hard_block_and_failed_gate_are_both_recorded(svc, account):
    s,_=account
    _arm(svc, s, at(2026,11,27,12), stage=1)
    made=svc.create_daily_entry(s, _entry())
    sid=svc.draft(s)
    svc.upload(s, sid, FileStorage(stream=io.BytesIO(b'Friday note.'), filename='work.txt'))
    svc.submit_practical(s, sid)
    rid='practical:'+sid
    gate={'requiredDays':3,'serverCountedDays':1,'genuineDays':0,'genuineEntryIds':[],'rejectedEntries':[{'entryId':made['entryId'],'reason':'Copied template, no same-day source.'}],'passed':False}
    d=_v3(svc, sid, 100, gate, blocked=True)
    svc.decision(d, rid, svc.claim(rid)['leaseToken'], risk_evidence(d))
    kinds=[e['kind'] for e in svc.db.rows('SELECT kind FROM events WHERE student=?', (s['student'],))]
    assert 'FINAL_PLAN_RISK_EVIDENCE' in kinds and 'ROUTINE_GATE' in kinds
    assert svc.entitlements(s['student'])['status']=='REMEDIAL_ISSUED'

def test_previous_week_entries_are_not_counted(svc, account):
    s,_=account
    _arm(svc, s, at(2026,11,24,9), stage=1)
    old=svc.create_daily_entry(s, _entry())
    with svc.db.tx() as c:
        c.execute("INSERT INTO weeks(student,week,stage,state,practical_model,issued_at,due_friday,window_start,assignment) VALUES(?,2,1,'REMEDIAL_ISSUED','DAILY_LOG_V1',?,?,?,?)",
                  (s['student'], int(at(2026,12,1,10).timestamp()), '2026-12-04', '2026-12-01', json.dumps(_assign(1))))
        c.execute('UPDATE students SET current_week=2 WHERE student=?', (s['student'],))
    svc.clock=lambda: at(2026,12,4,12)
    sid=svc.draft(s)
    svc.upload(s, sid, FileStorage(stream=io.BytesIO(b'Fresh week.'), filename='work.txt'))
    svc.submit_practical(s, sid)
    packet=next(i['dailyLog'] for i in svc.queue() if i['requestId']=='practical:'+sid)
    assert old['entryId'] not in [e['entryId'] for e in packet['entries']]
    assert packet['countedDays']==0

def test_a8_missing_plan_reissues_the_practical(svc, account):
    s,_=account
    svc.config.admin_id=4242
    _open(svc, s, 8)
    sid=practical(svc, s)
    d=pdecision(svc, sid, 96, False)
    d['verdict']='NOT_APPROVED'; d['unlockNext']=False; d['finalHardBlock']=False
    d['nextAssignment']=None; d['remedialAssignment']=assignment(d['week']+1, d['stage'])
    rid='practical:'+sid
    svc.decision(d, rid, svc.claim(rid)['leaseToken'], None, False, None, True)
    ent=svc.entitlements(s['student'])
    assert ent['status']=='REMEDIAL_ISSUED' and ent['unlockedStage']==8
    note=json.loads(svc.db.rows('SELECT body FROM notifications WHERE student=? ORDER BY created', (s['student'],))[-1]['body'])
    assert note['en']=='plan missing: redo and re-upload' and note['fa'].startswith('طرح نیست')
    assert 'NOT_APPROVED' not in note['en'] and 'NOT_APPROVED' not in note['fa']
    owner=[r['body'] for r in svc.db.rows('SELECT body FROM outbox WHERE chat=?', (4242,))]
    assert owner and 'plan missing: redo and re-upload' in owner[-1] and 'NOT_APPROVED' not in owner[-1]
    report=svc.report(s['student'])
    row=report['decisions'][-1]
    assert row['reasonCode']=='PLAN_MISSING_REMEDIAL' and row['body']['verdict']=='NOT_APPROVED' and row['body']['unlockNext'] is False

def _counted_gate(packet, passed):
    counted=[e for e in packet['entries'] if e['localDate'] in packet['countedLocalDates']]
    dates=sorted({e['localDate'] for e in counted})
    if passed:
        return {'requiredDays':3,'serverCountedDays':len(dates),'genuineDays':len(dates),'genuineEntryIds':[e['entryId'] for e in counted],'rejectedEntries':[],'passed':True}
    return {'requiredDays':3,'serverCountedDays':len(dates),'genuineDays':0,'genuineEntryIds':[],'rejectedEntries':[{'entryId':e['entryId'],'reason':'Day was not genuine enough.'} for e in counted],'passed':False}

def test_plan_missing_keeps_scores_and_hides_them_from_the_student(svc, account):
    from sfa_api.contracts import validate_decision
    from sfa_api.grading import verdict
    s,_=account
    svc.config.admin_id=4242
    _arm(svc, s, at(2026,11,24,9), stage=8)
    with svc.db.tx() as c:
        c.execute('UPDATE students SET stage=8 WHERE student=?', (s['student'],))
        c.execute('UPDATE weeks SET plan_required=1 WHERE student=?', (s['student'],))
    for day in (24, 25, 26):
        svc.clock=lambda day=day: at(2026,11,day,10)
        body=_entry(); body['taskIds']=['C1','S1']
        svc.create_daily_entry(s, body)
    sid=_submit_friday(svc, s)
    packet=next(i for i in svc.queue() if i['requestId']=='practical:'+sid)['dailyLog']
    assert packet['countedDays']==3 and packet['tradeDays']==0
    gate=_counted_gate(packet, True)
    d=pdecision(svc, sid, 96, False)
    d['schemaVersion']=3
    d['routineGate']=gate
    d['verdict']='NOT_APPROVED'
    d['unlockNext']=False
    d['finalHardBlock']=False
    d['nextAssignment']=None
    d['remedialAssignment']=assignment(d['week']+1, d['stage'])
    formula=verdict(sum(d['scores'].values()), svc.config.practical_approved, svc.config.practical_partial, False)
    assert formula=='APPROVED' and d['routineGate']['passed'] is True
    counted=[{'entryId':e['entryId'],'localDate':e['localDate']} for e in packet['entries'] if e['localDate'] in packet['countedLocalDates']]
    accepted=validate_decision(d, {'id':sid,'student':s['student'],'week':d['week'],'stage':d['stage']}, svc.config, [], 'DAILY_LOG_V1', 'LEGACY', counted, False, True)
    assert accepted['verdict']=='NOT_APPROVED' and accepted['scores']==d['scores'] and accepted['routineGate']['passed'] is True
    rid='practical:'+sid
    lease=svc.claim(rid)['leaseToken']
    with pytest.raises(Invalid, match='PLAN_AND_NO_PLAN_CONFLICT'):
        svc.decision(d, rid, lease, risk_evidence(d), False, None, True)
    with pytest.raises(Invalid, match='PLAN_AND_NO_PLAN_CONFLICT'):
        svc.decision(d, rid, lease, None, True, 'A8 has no plan, so this reason is the wrong envelope.', True)
    approved=dict(d); approved['verdict']='APPROVED'; approved['remedialAssignment']=None
    with pytest.raises(Invalid, match='PLAN_MISSING_REMEDIAL_ONLY'):
        svc.decision(approved, rid, lease, None, False, None, True)
    svc.decision(d, rid, lease, None, False, None, True)
    stored=json.loads(svc.db.rows('SELECT body FROM mentor_decisions WHERE id=?', (d['decisionId'],))[0]['body'])
    assert stored['verdict']=='NOT_APPROVED' and stored['unlockNext'] is False and stored['finalHardBlock'] is False
    assert stored['scores']==d['scores'] and stored['routineGate']==gate
    assert stored['remedialAssignment']['stage']==8 and stored['remedialAssignment']['week']==d['week']+1
    kinds=[e['kind'] for e in svc.db.rows('SELECT kind FROM events WHERE student=?', (s['student'],))]
    assert 'PLAN_MISSING_REMEDIAL' in kinds and 'ROUTINE_GATE' in kinds
    assert 'FINAL_PLAN_RISK_EVIDENCE' not in kinds and 'NO_PLAN' not in kinds
    ent=svc.entitlements(s['student'])
    assert ent['status']=='REMEDIAL_ISSUED' and ent['unlockedStage']==8
    full=svc.report(s['student'])
    assert full['decisions'][-1]['body']['scores']['risk']==40
    assert full['decisions'][-1]['body']['routineGate']['passed'] is True
    student=svc.report(s['student'], audience='student')
    visible=student['decisions'][-1]
    assert visible['reasonCode']=='PLAN_MISSING_REMEDIAL'
    assert set(visible['body'])=={'feedback'}
    blob=json.dumps(student)
    assert 'routineGate' not in blob and 'NOT_APPROVED' not in blob and '"risk"' not in blob
    assert 'plan missing: redo and re-upload' in student['markdown']
    assert visible['body']['feedback']['en']

def test_a8_missing_plan_cannot_approve(svc, account):
    s,_=account
    _open(svc, s, 8)
    sid=practical(svc, s)
    d=pdecision(svc, sid, 96, False)
    rid='practical:'+sid
    with pytest.raises(Invalid, match='PLAN_MISSING_REMEDIAL_ONLY'):
        svc.decision(d, rid, svc.claim(rid)['leaseToken'], None, False, None, True)

def _submit_friday(svc, student):
    svc.clock=lambda: at(2026,11,27,16)
    sid=svc.draft(student)
    svc.upload(student, sid, FileStorage(stream=io.BytesIO(b'Friday note.'), filename='work.txt'))
    svc.submit_practical(student, sid)
    return sid

def test_only_trade_days_count_and_a_conditional_plan_does_not(svc, account):
    s,_=account
    _arm(svc, s, at(2026,11,24,9), stage=1)
    quiet=_entry(); quiet['dayCallReason']=''; quiet['groundingRefs']=['EURUSD bid 1.0850 at 10:15 Amsterdam']
    quiet['conditionalPlan']=_conditional()
    made=svc.create_daily_entry(s, quiet)
    assert made['fields']['paperPlan'] is None and made['fields']['conditionalPlan']['condition'].startswith('WAIT')
    svc.clock=lambda: at(2026,11,25,9)
    svc.create_daily_entry(s, _trade())
    sid=_submit_friday(svc, s)
    packet=next(i for i in svc.queue() if i['requestId']=='practical:'+sid)['dailyLog']
    assert packet['tradeDays']==1 and packet['noTradeDays']==1 and packet['tradesOnNoTradeDays']==0
    assert packet['tradeOnNoTradeDay']==[]
    rid='practical:'+sid
    with pytest.raises(Invalid, match='NO_PLAN_REQUIRES_ZERO_TRADES'):
        gate={'requiredDays':3,'serverCountedDays':packet['countedDays'],'genuineDays':0,'genuineEntryIds':[],'rejectedEntries':[{'entryId':e['entryId'],'reason':'Day was not genuine enough.'} for e in packet['entries'] if e['localDate'] in packet['countedLocalDates']],'passed':False}
        svc.decision(_v3(svc, sid, 90, gate), rid, svc.claim(rid)['leaseToken'], None, True, 'No Friday plan, but Tuesday was a trade day.')

def test_conditional_plan_on_a_no_trade_week_does_not_block_no_plan(svc, account):
    s,_=account
    _arm(svc, s, at(2026,11,24,9), stage=1)
    body=_entry(); body['conditionalPlan']=_conditional()
    svc.create_daily_entry(s, body)
    sid=_submit_friday(svc, s)
    packet=next(i for i in svc.queue() if i['requestId']=='practical:'+sid)['dailyLog']
    assert packet['tradeDays']==0 and packet['tradeOnNoTradeDay']==[] and packet['noTradeDays']==1
    rid='practical:'+sid
    gate={'requiredDays':3,'serverCountedDays':packet['countedDays'],'genuineDays':0,'genuineEntryIds':[],'rejectedEntries':[{'entryId':e['entryId'],'reason':'Day was not genuine enough.'} for e in packet['entries'] if e['localDate'] in packet['countedLocalDates']],'passed':False}
    result=svc.decision(_v3(svc, sid, 90, gate), rid, svc.claim(rid)['leaseToken'], None, True, 'No Friday plan. The only plan is a conditional WAIT drill.')
    assert result['state']=='DELIVERED'
    kinds=[e['kind'] for e in svc.db.rows('SELECT kind FROM events WHERE student=?', (s['student'],))]
    assert 'NO_PLAN' in kinds and 'FINAL_PLAN_RISK_EVIDENCE' not in kinds

def test_same_date_trade_and_no_trade_is_the_only_flag(svc, account):
    s,_=account
    _arm(svc, s, at(2026,11,24,9), stage=1)
    svc.create_daily_entry(s, _trade())
    svc.create_daily_entry(s, _entry())
    sid=_submit_friday(svc, s)
    packet=next(i for i in svc.queue() if i['requestId']=='practical:'+sid)['dailyLog']
    assert packet['tradeDays']==1 and packet['noTradeDays']==0 and packet['tradesOnNoTradeDays']==1
    assert packet['tradeOnNoTradeDay']==['2026-11-24']

def test_daily_plan_rules_are_presence_only(svc, account):
    s,_=account
    _arm(svc, s, at(2026,11,24,9), stage=1)
    with pytest.raises(Invalid, match='PAPER_PLAN_TRADE_ONLY'):
        svc.create_daily_entry(s, {**_entry(), 'paperPlan': _paper()})
    with pytest.raises(Invalid, match='CONDITIONAL_PLAN_NO_TRADE_ONLY'):
        svc.create_daily_entry(s, {**_trade(), 'conditionalPlan': _conditional()})
    bare=_trade(); bare['paperPlan']=None
    with pytest.raises(Invalid, match='PAPER_PLAN_REQUIRED'):
        svc.create_daily_entry(s, bare)
    ungrounded=_entry(); ungrounded['dayCallReason']='no setup'
    with pytest.raises(Invalid, match='GROUNDING_REQUIRED'):
        svc.create_daily_entry(s, ungrounded)
    unsafe=_trade(stopType='mental', riskPct='5', netRR='0.4')
    stored=svc.create_daily_entry(s, unsafe)
    assert stored['fields']['paperPlan']['stopType']=='mental'
    assert stored['fields']['paperPlan']['riskPct']=='5' and stored['fields']['paperPlan']['netRR']=='0.4'
    assert stored['fields']['conditionalPlan'] is None

def test_money_rounds_half_up_away_from_zero():
    from decimal import Decimal
    from sfa_api.daily import round_half_up_money, week_trade_risk_summary
    assert round_half_up_money(Decimal('1.005'))=='1.01'
    assert round_half_up_money(Decimal('1.004'))=='1.00'
    left=_trade(equity='1.005', riskPct='1', netRR='2', stopType='hard')
    right=_trade(equity='1.005', riskPct='1', netRR='2', stopType='hard')
    summary=week_trade_risk_summary([
        {'id':'de_a','local_date':'2026-11-24','body':json.dumps({'dayCall':'TRADE','fields':{'paperPlan':left['paperPlan']}})},
        {'id':'de_b','local_date':'2026-11-25','body':json.dumps({'dayCall':'TRADE','fields':{'paperPlan':right['paperPlan']}})},
    ])
    assert summary['currentEquity']=='1.01'
    assert summary['riskAmount']=='0.01'
    assert summary['netReward']=='0.02'
    assert summary['stopType']=='STRUCTURAL_HARD'

def test_unsafe_daily_trade_does_not_block_a_clean_friday_plan(svc, account):
    from sfa_api.risk import hard_block
    s,_=account
    _arm(svc, s, at(2026,11,24,9), stage=1)
    svc.create_daily_entry(s, _trade(stopType='mental', riskPct='5', netRR='0.4'))
    svc.clock=lambda: at(2026,11,25,9)
    svc.create_daily_entry(s, _trade())
    svc.clock=lambda: at(2026,11,26,9)
    svc.create_daily_entry(s, _trade())
    sid=_submit_friday(svc, s)
    packet=next(i for i in svc.queue() if i['requestId']=='practical:'+sid)['dailyLog']
    assert packet['unsafeDailyTradeCount']==1
    assert packet['unsafeDailyTrades'][0]['date']=='2026-11-24'
    assert packet['unsafeDailyTrades'][0]['reasons']==['RISK_OVER_1PCT','NET_RR_UNDER_2']
    gate=_counted_gate(packet, True)
    d=_v3(svc, sid, 90, gate, blocked=False)
    evidence=risk_evidence(d)
    assert hard_block(evidence) is False and d['scores']['risk']==40
    result=svc.decision(d, 'practical:'+sid, svc.claim('practical:'+sid)['leaseToken'], evidence)
    assert result['state']=='DELIVERED'
    stored=json.loads(svc.db.rows('SELECT body FROM mentor_decisions WHERE id=?', (d['decisionId'],))[0]['body'])
    assert stored['finalHardBlock'] is False and stored['verdict']=='APPROVED' and stored['scores']==d['scores']
    assert svc.entitlements(s['student'])['unlockedStage']==2

def test_week_average_uses_changing_equity_and_accepts_structural_hard(svc, account):
    s,_=account
    _arm(svc, s, at(2026,11,24,9), stage=1)
    svc.create_daily_entry(s, _trade(equity='10000', riskPct='1', netRR='2', stopType='mental'))
    svc.clock=lambda: at(2026,11,25,9)
    svc.create_daily_entry(s, _trade(equity='20000', riskPct='1', netRR='4', stopType='hard'))
    svc.clock=lambda: at(2026,11,26,9)
    svc.create_daily_entry(s, _trade(equity='15000', riskPct='1', netRR='2', stopType='structural'))
    sid=_submit_friday(svc, s)
    packet=next(i for i in svc.queue() if i['requestId']=='practical:'+sid)['dailyLog']
    summary=packet['weekTradeRiskSummary']
    assert summary['source']=='WEEK_TRADES_AVERAGE'
    assert summary['tradeCount']==3 and summary['hardStopCount']==2 and summary['mentalOrNoStopCount']==1
    assert summary['stopType']=='STRUCTURAL_HARD'
    assert summary['currentEquity']=='15000.00' and summary['riskAmount']=='150.00' and summary['netReward']=='433.33'
    assert summary['avgRiskPct']=='1.0000'
    # Mean of the per-trade ratios is 2.6667. The ratio of the rounded means is not that.
    assert summary['avgNetRR']=='2.8889'
    assert len(summary['evidenceRefs'])==3 and all(ref.startswith('daily:') for ref in summary['evidenceRefs'])
    assert packet['unsafeDailyTradeCount']==0
    gate=_counted_gate(packet, True)
    d=_v3(svc, sid, 90, gate, blocked=False)
    rid='practical:'+sid
    lease=svc.claim(rid)['leaseToken']
    with pytest.raises(Invalid, match='NO_PLAN_REQUIRES_ZERO_TRADES'):
        svc.decision(d, rid, lease, None, True, 'The week has trades, so a no-plan envelope is rejected.')
    evidence={'currentEquity':summary['currentEquity'],'riskAmount':summary['riskAmount'],'netReward':summary['netReward'],'stopType':summary['stopType'],'evidenceRefs':summary['evidenceRefs']}
    result=svc.decision(d, rid, lease, evidence)
    assert result['state']=='DELIVERED'
    stored=json.loads(svc.db.rows('SELECT body FROM mentor_decisions WHERE id=?', (d['decisionId'],))[0]['body'])
    assert stored['finalHardBlock'] is False and stored['verdict']=='APPROVED'
    kinds=[e['kind'] for e in svc.db.rows('SELECT kind FROM events WHERE student=?', (s['student'],))]
    assert 'FINAL_PLAN_RISK_EVIDENCE' in kinds and 'NO_PLAN' not in kinds

def test_legacy_week_is_unchanged(svc, account):
    s,_=account
    view=svc.daily_log_view(s)
    assert view['active'] is False and view['practicalModel']=='LEGACY'
    assert svc.db.rows('SELECT practical_model FROM weeks WHERE student=?', (s['student'],))[0]['practical_model']=='LEGACY'

def _daily_assignment(base, due_iso):
    stage = base['stage']
    tasks = [{'taskId': 'C1', 'kind': 'CORE', 'stage': stage, 'skill': 'core', 'task': {'fa': 'کار اصلی این هفته.', 'en': 'Core task for this week.'}, 'minDays': 1}]
    for drill in base['weaknessDrills']:
        tasks.append({'taskId': 'W-' + drill['weaknessId'], 'kind': 'WEAKNESS', 'weaknessId': drill['weaknessId'], 'skill': 'Risk', 'task': drill['task'], 'minDays': 1})
    for prior in range(1, stage):
        tasks.append({'taskId': f'S{prior}', 'kind': 'SPIRAL', 'stage': prior, 'skill': 'prior', 'task': {'fa': 'مرور مرحله قبل.', 'en': 'Spiral task from an earlier stage.'}, 'minDays': 1})
    return {**base, 'dueAtISO': due_iso, 'dailyTasks': tasks, 'dailyLogRequirement': {'minDays': 3, 'eligibleWeekdays': ['MON', 'TUE', 'WED', 'THU', 'FRI'], 'timezone': 'Europe/Amsterdam', 'freshCount': True}, 'fridayDeliverable': {'fa': 'جمعه', 'en': 'Friday file.'}}

def _weekdays_in_window(issued, start, due, count=3):
    days = []
    cursor = issued + timedelta(days=1)
    while cursor <= due and len(days) < count:
        if cursor.weekday() < 5 and cursor >= start:
            days.append(cursor)
        cursor += timedelta(days=1)
    return days

def test_non_test_daily_log_has_no_test_mode_or_allowed_dates(svc, account):
    s, _ = account
    legacy = svc.daily_log_view(s)
    assert legacy['active'] is False
    assert 'testMode' not in legacy and 'allowedDates' not in legacy
    _arm(svc, s, at(2026, 11, 24, 9))
    view = svc.daily_log_view(s)
    assert view['active'] is True
    assert 'testMode' not in view and 'allowedDates' not in view
    blob = json.dumps(view)
    assert 'testMode' not in blob and 'allowedDates' not in blob
    svc.clock = lambda: at(2026, 11, 21, 12)
    svc.enable_test_account(s['student'], 1, 'bot E2E test')
    flagged = svc.daily_log_view(s)
    assert flagged['testMode'] is True
    from datetime import date as Date
    row = svc.db.rows('SELECT issued_at, due_friday FROM weeks WHERE student=? AND week=1', (s['student'],))[0]
    issued = datetime.fromtimestamp(int(row['issued_at']), TZ).date()
    due = Date.fromisoformat(row['due_friday'])
    expect = []
    cursor = issued + timedelta(days=1)
    while cursor <= due:
        if cursor.weekday() < 5:
            expect.append(cursor.isoformat())
        cursor += timedelta(days=1)
    assert flagged['allowedDates'] == expect
    assert expect and all(issued < Date.fromisoformat(day) <= due and Date.fromisoformat(day).weekday() < 5 for day in expect)
    token = svc.invite().rsplit('/', 1)[1]
    other = svc.auth(svc.signup({'inviteToken': token, 'email': 'plain@example.test', 'displayName': 'Plain Learner', 'password': 'correct horse battery staple', 'acceptDataNotice': True}))
    _arm(svc, other, at(2026, 11, 24, 9))
    plain = svc.daily_log_view(other)
    assert plain['active'] is True
    assert 'testMode' not in plain and 'allowedDates' not in plain
    assert 'testMode' not in json.dumps(plain) and 'allowedDates' not in json.dumps(plain)

def test_non_test_student_keeps_weekend_friday_window_and_rejects_test_date(svc, account):
    s, _ = account
    _arm(svc, s, at(2026, 11, 24, 9))
    with pytest.raises(Invalid, match='TEST_DATE_NOT_ALLOWED'):
        svc.create_daily_entry(s, {**_entry(), 'testLocalDate': '2026-11-25'})
    with pytest.raises(Invalid, match='PRACTICAL_WINDOW_CLOSED') as exc:
        svc.draft(s)
    assert exc.value.extra['opensAtISO'].startswith('2026-11-27T00:00:00')
    unix = int(at(2026, 11, 24, 9).timestamp())
    with svc.db.tx() as c:
        c.execute('DELETE FROM rate WHERE key=?', ('daily:' + s['student'],))
        c.execute('INSERT INTO rate VALUES(?,?,?)', ('daily:' + s['student'], unix, 30))
    with pytest.raises(Invalid, match='RATE_LIMITED'):
        svc.create_daily_entry(s, _entry())
    with svc.db.tx() as c:
        c.execute('DELETE FROM rate WHERE key=?', ('daily:' + s['student'],))
    svc.clock = lambda: at(2026, 11, 28, 11)
    saved = svc.create_daily_entry(s, _entry())
    assert saved['eligible'] is False and saved['ineligibleReason'] == 'WEEKEND'
    assert 'testBackdated' not in saved
    assert not svc.db.rows('SELECT is_test_account FROM students WHERE student=?', (s['student'],))[0]['is_test_account']

def test_test_account_command_refuses_other_students_and_off_restores_rules(svc, account):
    s, _ = account
    with pytest.raises(Invalid, match='STUDENT_NOT_FOUND'):
        svc.enable_test_account('S99999', 1, 'bot E2E test')
    with pytest.raises(Invalid, match='WEEK_NOT_FOUND'):
        svc.enable_test_account(s['student'], 9, 'bot E2E test')
    with pytest.raises(Invalid, match='OVERRIDE_REASON_REQUIRED'):
        svc.enable_test_account(s['student'], 1, 'no')
    with pytest.raises(Invalid, match='TEST_ACCOUNT_REQUIRED'):
        svc.disable_test_account(s['student'])
    token = svc.invite().rsplit('/', 1)[1]
    other = svc.auth(svc.signup({'inviteToken': token, 'email': 'other@example.test', 'displayName': 'Other Learner', 'password': 'correct horse battery staple', 'acceptDataNotice': True}))
    marked = svc.enable_test_account(s['student'], 1, 'bot E2E test')
    assert marked['student'] == s['student'] and marked['isTestAccount'] is True and marked['practicalModel'] == 'DAILY_LOG_V1'
    assert marked['planRequired'] is False and marked['dueFriday'] and marked['issuedAt']
    assert not svc.db.rows('SELECT is_test_account FROM students WHERE student=?', (other['student'],))[0]['is_test_account']
    assert 'TEST_ACCOUNT_ENABLED' in [e['kind'] for e in svc.db.rows('SELECT kind FROM events WHERE student=?', (s['student'],))]
    assert svc.disable_test_account(s['student'])['isTestAccount'] is False
    assert 'TEST_ACCOUNT_DISABLED' in [e['kind'] for e in svc.db.rows('SELECT kind FROM events WHERE student=?', (s['student'],))]
    _arm(svc, s, at(2026, 11, 28, 11))
    saved = svc.create_daily_entry(s, _entry())
    assert saved['ineligibleReason'] == 'WEEKEND'
    with pytest.raises(Invalid, match='TEST_DATE_NOT_ALLOWED'):
        svc.create_daily_entry(s, {**_entry(), 'testLocalDate': '2026-11-24'})
    _arm(svc, other, at(2026, 11, 24, 9))
    with pytest.raises(Invalid, match='PRACTICAL_WINDOW_CLOSED'):
        svc.draft(other)

def test_test_account_runs_daily_log_in_one_session(svc, account, bank):
    import threading
    from datetime import date as Date
    from werkzeug.serving import make_server
    import sfa_api.app as app_module
    from echo_client import Client
    from sfa_api.daily import server_due_friday
    from .test_units import input_quiz
    from .vectors import qdecision
    s, _ = account
    when = at(2026, 11, 21, 12)  # Saturday. The whole flow uses this clock.
    svc.clock = lambda: when
    switched = svc.enable_test_account(s['student'], 1, 'bot E2E test')
    assert switched['state'] == 'LESSON_OPEN' and switched['practicalModel'] == 'DAILY_LOG_V1'
    quiz = input_quiz()
    svc.quiz_submit(quiz, s)
    stored_quiz = json.loads(svc.db.rows('SELECT body FROM quizzes WHERE attempt=?', (quiz['attemptId'],))[0]['body'])
    mentor = qdecision(svc, stored_quiz)
    mentor['assignment'] = _daily_assignment(mentor['assignment'], server_due_friday(svc.local_now()).isoformat(timespec='seconds'))
    original = app_module.Service
    app_module.Service = lambda _config: svc
    server = None
    thread = None
    try:
        app = app_module.create_app(svc.config)
        server = make_server('127.0.0.1', 0, app, threaded=False)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        client = Client('http://127.0.0.1:' + str(server.server_port), 'e' * 48)
        rid = 'quiz:' + quiz['attemptId']
        lease = client.call('POST', 'claims/' + rid, {})['leaseToken']
        assert client.submit({'requestId': rid, 'leaseToken': lease, 'decision': mentor})['state'] == 'DELIVERED'
        issued_row = svc.db.rows('SELECT issued_at, due_friday, window_start, state, assignment FROM weeks WHERE student=? AND week=1', (s['student'],))[0]
        assert issued_row['state'] == 'ASSIGNMENT_ISSUED'
        assert 'dailyTasks' in json.loads(issued_row['assignment'])
        issued = datetime.fromtimestamp(int(issued_row['issued_at']), TZ).date()
        due = Date.fromisoformat(issued_row['due_friday'])
        start = Date.fromisoformat(issued_row['window_start'])
        weekend = issued + timedelta(days=1)
        while weekend.weekday() < 5:
            weekend += timedelta(days=1)
        later = due + timedelta(days=1)
        while later.weekday() >= 5:
            later += timedelta(days=1)
        with pytest.raises(Invalid, match='TEST_DATE_INVALID'):
            svc.create_daily_entry(s, {**_entry(), 'testLocalDate': '25-11-2026'})
        with pytest.raises(Invalid, match='TEST_DATE_NOT_WEEKDAY'):
            svc.create_daily_entry(s, {**_entry(), 'testLocalDate': weekend.isoformat()})
        before = issued - timedelta(days=1)
        while before.weekday() >= 5:
            before -= timedelta(days=1)
        with pytest.raises(Invalid, match='TEST_DATE_BEFORE_ISSUE'):
            svc.create_daily_entry(s, {**_entry(), 'testLocalDate': before.isoformat()})
        with pytest.raises(Invalid, match='TEST_DATE_AFTER_DUE'):
            svc.create_daily_entry(s, {**_entry(), 'testLocalDate': later.isoformat()})
        days = _weekdays_in_window(issued, start, due)
        assert len(days) == 3 and all(day.weekday() < 5 and issued < day <= due for day in days)
        unix = int(when.timestamp())
        with svc.db.tx() as c:
            c.execute('DELETE FROM rate WHERE key=?', ('daily:' + s['student'],))
            c.execute('INSERT INTO rate VALUES(?,?,?)', ('daily:' + s['student'], unix, 30))
        quiet = _entry()
        quiet['dayCallReason'] = ''
        quiet['groundingRefs'] = ['EURUSD bid 1.0850 at 10:15 Amsterdam']
        quiet['conditionalPlan'] = _conditional()
        trade = svc.create_daily_entry(s, {**_trade(), 'testLocalDate': days[0].isoformat()})
        no_trade = svc.create_daily_entry(s, {**quiet, 'testLocalDate': days[1].isoformat()})
        third = svc.create_daily_entry(s, {**_entry(), 'testLocalDate': days[2].isoformat()})
        assert trade['eligible'] and no_trade['eligible'] and third['eligible']
        assert no_trade['fields']['conditionalPlan']['condition'].startswith('WAIT')
        assert svc.daily_log_view(s)['countedDays'] == 3
        # The chosen day has passed local midnight, and the test account can still edit it.
        edit_at = datetime(days[0].year, days[0].month, days[0].day, 10, tzinfo=TZ) + timedelta(days=1)
        assert edit_at.date() <= due
        svc.clock = lambda edit_at=edit_at: edit_at
        edited = svc.update_daily_entry(s, trade['entryId'], _trade())
        assert edited['revisionCount'] == 2 and edited['localDate'] == days[0].isoformat()
        svc.clock = lambda: when
        assert svc.daily_log_view(s)['windowOpen'] is True
        sid = svc.draft(s)
        svc.upload(s, sid, FileStorage(stream=io.BytesIO(b'Friday document uploaded in the same session.'), filename='work.txt'))
        assert svc.submit_practical(s, sid) == sid
        item = next(i for i in client.call('GET', 'queue')['requests'] if i['requestId'] == 'practical:' + sid)
        packet = item['dailyLog']
        assert packet['tradeDays'] == 1 and packet['noTradeDays'] >= 1 and packet['countedDays'] == 3
        assert all(entry.get('testBackdated') is True for entry in packet['entries'])
        assert 'correctAnswer' not in json.dumps(packet) and 'answerKey' not in json.dumps(packet)
        gate = _counted_gate(packet, True)
        decision = _v3(svc, sid, 90, gate, blocked=False)
        prid = 'practical:' + sid
        please = client.call('POST', 'claims/' + prid, {})['leaseToken']
        assert client.submit({'requestId': prid, 'leaseToken': please, 'decision': decision, 'riskEvidence': risk_evidence(decision)})['state'] == 'DELIVERED'
    finally:
        if server is not None:
            server.shutdown()
            thread.join(5)
            server.server_close()
        app_module.Service = original
    feedback = svc.quiz_feedback(s, quiz['attemptId'])
    log = svc.daily_log_view(s, '1')
    student = svc.report(s['student'], audience='student')
    blob = json.dumps({'quiz': feedback, 'log': log, 'report': student})
    for banned in ('correctAnswer', 'answerKey', 'ECHO_ACADEMY_API_KEY', 'sfa-answer-key', 'testBackdated', 'contentDigest'):
        assert banned not in blob
    assert 'routineGate' not in json.dumps(log) and 'scores' not in json.dumps(log)
    assert 'routineGate' not in json.dumps(feedback) and 'scores' not in json.dumps(feedback)
    assert feedback['assessment']['items'] and all(set(item) == {'itemId', 'correct'} for item in feedback['assessment']['items'])
    assert svc.entitlements(s['student'])['unlockedStage'] == 2

def test_practical_list_is_the_current_week_and_model(svc, account):
    s, _ = account
    with svc.db.tx() as c:
        c.execute("INSERT INTO submissions(id,student,stage,state,created,week) VALUES(?,?,?,?,?,?)",
                  ('sub-w1', s['student'], 1, 'DELIVERED', 1, 1))
        c.execute("UPDATE weeks SET state='NEXT_UNLOCKED', practical_model='LEGACY' WHERE student=? AND week=1", (s['student'],))
        c.execute("UPDATE students SET current_week=2, stage=2 WHERE student=?", (s['student'],))
        c.execute("INSERT INTO weeks(student,week,stage,state,practical_model,plan_required) VALUES(?,?,?,?,?,?)",
                  (s['student'], 2, 2, 'ASSIGNMENT_ISSUED', 'DAILY_LOG_V1', 0))
    opened = svc.list_practicals(s)
    assert opened['currentWeek'] == 2 and opened['practicalModel'] == 'DAILY_LOG_V1'
    assert opened['submissions'] == []
    with svc.db.tx() as c:
        c.execute("INSERT INTO submissions(id,student,stage,state,created,week) VALUES(?,?,?,?,?,?)",
                  ('sub-w2', s['student'], 2, 'QUEUED', 2, 2))
    locked = svc.list_practicals(s)
    assert [row['id'] for row in locked['submissions']] == ['sub-w2']
    assert locked['submissions'][0]['state'] == 'QUEUED'
    assert locked['submissions'][0]['practicalModel'] == 'DAILY_LOG_V1'
    assert locked['submissions'][0]['week'] == 2

def test_student_report_and_quiz_feedback_omit_mentor_notes(svc, account, bank):
    from .test_units import grade_quiz
    s, _ = account
    attempt, decision, rid, lease = grade_quiz(svc, s)
    assert decision['echoNotes']
    svc.decision(decision, rid, lease)
    feedback = svc.quiz_feedback(s, attempt['attemptId'])
    student = svc.report(s['student'], audience='student')
    full = svc.report(s['student'])
    blob = json.dumps({'feedback': feedback, 'student': student})
    assert 'echoNotes' not in blob
    assert decision['echoNotes'] not in blob
    assert 'correctAnswer' not in blob
    assert 'noPlanReason' not in blob
    assert feedback['decision']['verdict'] == 'APPROVED'
    assert feedback['decision']['feedback']['en']
    assert feedback['assessment']['items'] and all(set(item) == {'itemId', 'correct'} for item in feedback['assessment']['items'])
    assert full['decisions'][-1]['body']['echoNotes'] == decision['echoNotes']
    assert decision['echoNotes'] in full['markdown']
    reason = 'No trade. Timestamped readings at 14:35 show the chain unresolved.'
    _grade(svc, s, 2, 90, {'noPlan': True, 'noPlanReason': reason})
    hidden = svc.report(s['student'], audience='student')
    mentor = svc.report(s['student'])
    assert reason not in hidden['markdown'] and 'noPlanReason' not in hidden['markdown']
    assert reason in mentor['markdown'] and 'noPlanReason' in mentor['markdown']

def test_each_uncounted_day_has_a_student_safe_reason(svc, account):
    s, _ = account
    _arm(svc, s, at(2026, 11, 23, 15), stage=2)
    early = svc.create_daily_entry(s, _entry())
    assert early['countReason'] == 'BEFORE_ISSUE'
    svc.clock = lambda: at(2026, 11, 24, 10)
    gap = svc.create_daily_entry(s, _entry())
    assert gap['countReason'] == 'NOT_LOCKED'
    svc.clock = lambda: at(2026, 11, 25, 10)
    reasons = {e['entryId']: e['countReason'] for e in svc.daily_log_view(s)['entries']}
    assert reasons[early['entryId']] == 'BEFORE_ISSUE'
    assert reasons[gap['entryId']] == 'NO_SPIRAL_TASK'
    assert svc.daily_log_view(s)['countedDays'] == 0
    svc.clock = lambda: at(2026, 11, 28, 11)
    weekend = svc.create_daily_entry(s, _entry())
    assert weekend['countReason'] == 'WEEKEND' and weekend['ineligibleReason'] == 'WEEKEND'
    blob = json.dumps(svc.daily_log_view(s))
    for banned in ('echoNotes', 'correctAnswer', 'score', 'contentDigest', 'answerKey'):
        assert banned not in blob

def test_after_due_and_after_submission_are_named(svc, account):
    s, _ = account
    _arm(svc, s, at(2026, 11, 27, 12))
    counted = svc.create_daily_entry(s, _entry())
    assert counted['countReason'] is None
    with svc.db.tx() as c:
        c.execute('''INSERT INTO daily_entries(id,student,week,stage,local_date,created,updated,body,digest,revision,eligible,ineligible_reason)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)''',
                  ('de_late', s['student'], 1, 1, '2026-11-30', 1, 1, '{}', 'd', 1, 1, None))
    late = next(e for e in svc.daily_log_view(s)['entries'] if e['entryId'] == 'de_late')
    assert late['countReason'] == 'AFTER_DUE'
    sid = _submit_friday(svc, s)
    submitted = svc.db.rows('SELECT submitted_at FROM submissions WHERE id=?', (sid,))[0]['submitted_at']
    with svc.db.tx() as c:
        c.execute('''INSERT INTO daily_entries(id,student,week,stage,local_date,created,updated,body,digest,revision,eligible,ineligible_reason)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)''',
                  ('de_after', s['student'], 1, 1, '2026-11-27', int(submitted) + 30, int(submitted) + 30, '{}', 'd', 1, 1, None))
    after = next(e for e in svc.daily_log_view(s, '1')['entries'] if e['entryId'] == 'de_after')
    assert after['countReason'] == 'AFTER_SUBMISSION'

def test_normal_days_can_hold_two_entries_and_still_count_once(svc, account):
    s, _ = account
    _arm(svc, s, at(2026, 11, 24, 9))
    for _ in range(3):
        svc.create_daily_entry(s, _entry())
    with pytest.raises(Invalid, match='DAILY_ENTRY_LIMIT'):
        svc.create_daily_entry(s, _entry())
    assert len(svc.db.rows('SELECT id FROM daily_entries WHERE student=?', (s['student'],))) == 3
    sid = _submit_friday(svc, s)
    packet = next(i['dailyLog'] for i in svc.queue() if i['requestId'] == 'practical:' + sid)
    assert len(packet['entries']) == 3
    assert packet['countedDays'] == 1

def test_test_date_resave_revises_and_the_packet_has_one_row(svc, account):
    s, _ = account
    svc.clock = lambda: at(2026, 11, 21, 12)
    svc.enable_test_account(s['student'], 1, 'bot E2E test')
    with svc.db.tx() as c:
        c.execute("UPDATE weeks SET state='ASSIGNMENT_ISSUED', assignment=? WHERE student=? AND week=1",
                  (json.dumps(_assign(1)), s['student']))
    day = svc.daily_log_view(s)['allowedDates'][0]
    first = svc.create_daily_entry(s, {**_entry(), 'testLocalDate': day})
    assert first['revisionCount'] == 1 and first['localDate'] == day
    svc.clock = lambda: at(2026, 11, 26, 15)
    second = svc.create_daily_entry(s, {**_entry(), 'testLocalDate': day, 'observations': 'Updated reading at 11:00 on the broker screen.'})
    assert second['entryId'] == first['entryId'] and second['revisionCount'] == 2
    assert second['fields']['observations'].startswith('Updated')
    assert len(svc.db.rows('SELECT id FROM daily_entries WHERE student=? AND local_date=?', (s['student'], day))) == 1
    stored = svc.db.rows('SELECT * FROM daily_entries WHERE id=?', (first['entryId'],))[0]
    with svc.db.tx() as c:
        c.execute('''INSERT INTO daily_entries(id,student,week,stage,local_date,created,updated,body,digest,revision,eligible,ineligible_reason,test_backdated)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                  ('de_old', stored['student'], stored['week'], stored['stage'], stored['local_date'],
                   stored['created'], int(stored['updated']) - 5, stored['body'], stored['digest'], 1, 1, None, 1))
    shown = [e for e in svc.daily_log_view(s)['entries'] if e['localDate'] == day]
    assert [e['entryId'] for e in shown] == [first['entryId']]
    sid = svc.draft(s)
    svc.upload(s, sid, FileStorage(stream=io.BytesIO(b'Friday document uploaded after the revision.'), filename='work.txt'))
    svc.submit_practical(s, sid)
    packet = next(i['dailyLog'] for i in svc.queue() if i['requestId'] == 'practical:' + sid)
    assert [e['entryId'] for e in packet['entries'] if e['localDate'] == day] == [first['entryId']]
    assert 'countReason' not in json.dumps(packet)
    assert packet['entries'][0].get('testBackdated') is True

def test_missing_evidence_still_pending(svc, account):
    s, _ = account
    _open(svc, s, 2)
    sid = practical(svc, s)
    d = pdecision(svc, sid, 90, False)
    rid = 'practical:' + sid
    with pytest.raises(Invalid, match='RISK_EVIDENCE'):
        svc.decision(d, rid, svc.claim(rid)['leaseToken'], None, None)
