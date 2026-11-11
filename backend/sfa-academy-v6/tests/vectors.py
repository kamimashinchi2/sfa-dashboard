import hashlib,json,secrets
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from sfa_api.grading import verdict
def due_date(): return (datetime.now(ZoneInfo('Europe/Amsterdam'))+timedelta(days=7)).isoformat()
def student_id(svc): return svc.db.rows('SELECT student FROM students')[0]['student']
COMMIT='2302f9e'
def key():
    quizzes={}
    for mission in ['M1','M2','M3','M4','M5','A6','A7','A8']:
        quizzes[mission]=[{'itemId':f'{mission}-q{i}','kind':['mc','numeric','order'][i%3],'answer':[2,'0.50',[2,0,1]][i%3],'remediationTopic':['Risk','Structure','Macro'][i%3],'optionCount':3,'itemHash':hashlib.sha256(f'SYNTHETIC-{mission}-{i}'.encode()).hexdigest()} for i in range(10)]
    return {'format':'sfa-answer-key','commit':COMMIT,'assessmentCriteriaVersion':3,'quizzes':quizzes}
def payload(correct=10,stage=1,attempt=None):
    mission=f'M{stage}' if stage<=5 else f'A{stage}'; items=[]
    for n,k in enumerate(key()['quizzes'][mission]):
        value=k['answer'] if n<correct else [1,'2',[0,1,2]][n%3]
        items.append({'itemId':k['itemId'],'itemHash':k['itemHash'],'kind':k['kind'],'studentAnswer':value,'touched':True,'clientCorrect':True,'topic':k['remediationTopic'],'reflection':None})
    return {'format':'sfa-quiz-result','schemaVersion':2,'studentId':'S01','alias':'Demo-01','attemptId':attempt or mission+'-'+secrets.token_hex(6),'quizId':mission,'missionId':mission,'stage':stage,'submittedAtISO':'2026-11-09T20:00:00.000Z','buildCommit':COMMIT,'score':100,'correct':10,'total':10,'readiness':'READY','weakTopics':[],'items':items,'telegramLinkStatus':'LINKED'}
def bi(en='Explain evidence and practice safely.',fa='شواهد را توضیح دهید و تمرین کنید.'): return {'en':en,'fa':fa}
def assignment(week=1,stage=1,weaknesses=()):
    return {'week':week,'stage':stage,'title':bi('Personalized weekly practical assignment'),'coreTasks':[bi('Analyze this week lesson; cite dated evidence. Subscribe to no signals from Echo.')],'weaknessDrills':[{'weaknessId':w,'task':bi('Target this previously evidenced weakness with a measurable drill.')} for w in weaknesses],'spiralReview':[{'stage':s,'skill':'Prior-stage skill','task':bi('Rotate an earlier skill and demonstrate it with evidence.')} for s in range(1,stage)],'riskRules':{'maxRiskPct':'1','hardStructuralStop':True,'minNetRR':'2','noSignals':True},'deliverables':[bi('DOCX/PDF/text analysis plus screenshots and journal.')],'dueAtISO':due_date()}
def weakness(wid='risk',clean=False): return {'id':wid,'skill':'Risk','evidenceRefs':['submission:document:p2'],'demonstratedClean':clean,'drilled':True}
def qdecision(svc,p):
    row=svc.db.rows('SELECT * FROM quizzes WHERE attempt=?',(p['attemptId'],))[0]; a=json.loads(row['assessment']); wrong=[i for i in a['items'] if not i['correct']]
    topics=sorted({i['topic'] for i in wrong}); updates=[{'id':'weak-'+t.lower(),'skill':t,'evidenceRefs':[p['attemptId']],'demonstratedClean':False,'drilled':True} for t in topics]
    unresolved=[w['id'] for w in svc.weaknesses(student_id(svc)) if w['status']!='RESOLVED']; req=sorted(set(unresolved)|{u['id'] for u in updates})
    return {'format':'sfa-quiz-decision','schemaVersion':2,'decisionId':'qd-'+p['attemptId'],'studentId':student_id(svc),'week':row['week'],'stage':p['stage'],'verdict':a['verdict'],'feedback':bi(),'weaknessUpdates':updates,'habitChecklist':[{'skill':'Risk','adhered':not wrong,'evidenceRef':p['attemptId']}],'echoNotes':'Read the full history; carry recurring errors forward.','attemptId':p['attemptId'],'corrections':[{'itemId':i['itemId'],'correction':bi('Correct: '+str(i['correctAnswer'])),'explanation':bi('Reason this answer follows the current lesson.')} for i in wrong],'assignment':assignment(row['week'],p['stage'],req) if a['verdict']!='NOT_APPROVED' else None}
def pdecision(svc,sid,score=90,blocked=False,updates=()):
    r=svc.db.rows('SELECT * FROM submissions WHERE id=?',(sid,))[0]
    v=verdict(score,svc.config.practical_approved,svc.config.practical_partial,blocked); good=v!='NOT_APPROVED'; req={w['id'] for w in svc.weaknesses(student_id(svc)) if w['status']!='RESOLVED'}|{u['id'] for u in updates}
    return {'format':'sfa-practical-decision','schemaVersion':2,'decisionId':'pd-'+sid,'studentId':student_id(svc),'week':r['week'],'stage':r['stage'],'verdict':v,'feedback':bi(),'weaknessUpdates':list(updates),'habitChecklist':[{'skill':'Risk','adhered':not blocked,'evidenceRef':sid}],'echoNotes':'Independent reviews completed; cumulative history considered.','submissionId':sid,'scores':{'risk':min(score,40),'technicalMacro':min(max(score-40,0),40),'journalPsychology':max(score-80,0)},'finalHardBlock':blocked,'flaws':[] if good else ['Unsafe or unsupported analysis'],'unlockNext':good and r['stage']<8,'nextAssignment':None,'remedialAssignment':assignment(r['week']+1,r['stage'],req) if not good else None}
