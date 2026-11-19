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

def _entry(task='C1'):
    return {'taskIds':[task],'dayCall':'NO_TRADE','dayCallReason':'Observed reaction unavailable','routine':{'freshness':'FRESH','oneLine':'I checked the list before acting.'},'observations':'EURUSD bid 1.08 at 10:15 on the broker screen.','currentApplication':'Applied this week lesson to that reading.','spiralApplication':'Marked the earlier level.','paperPlan':None,'selfCheck':'No signal. Simulated only.'}

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
    for banned in ('correctAnswer','echoNotes','answerKey','ECHO_ACADEMY_API_KEY','contentDigest'):
        assert banned not in blob
    svc.clock=lambda: at(2026,11,27,18)
    sid=svc.draft(s)
    svc.upload(s, sid, FileStorage(stream=io.BytesIO(b'Friday document.'), filename='work.txt'))
    svc.submit_practical(s, sid)
    item=next(i for i in svc.queue() if i['kind']=='practical_submission')
    assert item['dailyLog']['countedDays']>=0
    assert 'contentDigest' in item['dailyLog']['entries'][0]
    assert 'correctAnswer' not in json.dumps(item['dailyLog'])
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

def test_a8_missing_plan_cannot_approve(svc, account):
    s,_=account
    _open(svc, s, 8)
    sid=practical(svc, s)
    d=pdecision(svc, sid, 96, False)
    rid='practical:'+sid
    with pytest.raises(Invalid, match='PLAN_MISSING_REMEDIAL_ONLY'):
        svc.decision(d, rid, svc.claim(rid)['leaseToken'], None, False, None, True)

def test_trade_on_no_trade_day_is_flagged_and_blocks_no_plan(svc, account):
    s,_=account
    _arm(svc, s, at(2026,11,24,9), stage=1)
    traded=_entry(); traded['dayCall']='NO_TRADE'; traded['paperPlan']={'equity':'10000','riskPct':'1','entry':'1.08','stopLevel':'1.07','stopType':'hard','pointValue':'10','pointValueSource':'illustrative','lot':'0.1','spreadCosts':'1','target':'1.10','netRR':'2'}
    svc.create_daily_entry(s, traded)
    quiet=_entry(); quiet['dayCall']='NO_TRADE'
    svc.clock=lambda: at(2026,11,25,9)
    svc.create_daily_entry(s, quiet)
    svc.clock=lambda: at(2026,11,27,16)
    sid=svc.draft(s)
    svc.upload(s, sid, FileStorage(stream=io.BytesIO(b'Friday note.'), filename='work.txt'))
    svc.submit_practical(s, sid)
    packet=next(i for i in svc.queue() if i['requestId']=='practical:'+sid)['dailyLog']
    assert packet['tradeDays']==1 and packet['noTradeDays']==1 and packet['tradesOnNoTradeDays']==1
    assert packet['tradeOnNoTradeDay']==['2026-11-24']
    d=_v3(svc, sid, 90, {'requiredDays':3,'serverCountedDays':packet['countedDays'],'genuineDays':0,'genuineEntryIds':[],'rejectedEntries':[{'entryId':e['entryId'],'reason':'Day was not genuine enough.'} for e in packet['entries'] if e['localDate'] in packet['countedLocalDates']],'passed':False})
    # The gate object above may not match counted days. noPlan is rejected before the gate because a trade was recorded.
    rid='practical:'+sid
    with pytest.raises(Invalid, match='NO_PLAN_REQUIRES_ZERO_TRADES'):
        svc.decision(d, rid, svc.claim(rid)['leaseToken'], None, True, 'No plan. The log already records a paper trade on 24 Nov.')

def test_legacy_week_is_unchanged(svc, account):
    s,_=account
    view=svc.daily_log_view(s)
    assert view['active'] is False and view['practicalModel']=='LEGACY'
    assert svc.db.rows('SELECT practical_model FROM weeks WHERE student=?', (s['student'],))[0]['practical_model']=='LEGACY'

def test_missing_evidence_still_pending(svc, account):
    s, _ = account
    _open(svc, s, 2)
    sid = practical(svc, s)
    d = pdecision(svc, sid, 90, False)
    rid = 'practical:' + sid
    with pytest.raises(Invalid, match='RISK_EVIDENCE'):
        svc.decision(d, rid, svc.claim(rid)['leaseToken'], None, None)
