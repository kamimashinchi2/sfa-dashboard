import json,re
from datetime import datetime
class Invalid(ValueError): pass
SID=re.compile(r'S\d{2,4}\Z'); ALIAS=re.compile(r'[A-Za-z][A-Za-z0-9-]{2,23}\Z'); ID=re.compile(r'[A-Za-z0-9_.:-]{1,160}\Z')
MISSIONS={f'M{i}':i for i in range(1,6)}|{f'A{i}':i for i in range(6,9)}
VERDICTS=('APPROVED','PARTIALLY_APPROVED','NOT_APPROVED')
def require(ok,msg):
    if not ok: raise Invalid(msg)
def exact(o,fields): require(isinstance(o,dict) and set(o)==set(fields.split()),'Unexpected/missing fields')
def integer(v,lo,hi): require(type(v) is int and lo<=v<=hi,'Invalid integer')
def text(v,maxlen=4000):
    require(isinstance(v,str) and 0<len(v)<=maxlen,'Invalid text')
    require(not re.search(r'\b[^\s@]+@[^\s@]+\.[^\s@]+\b|(?:\+\d[\d ()-]{8,}\d)',v),'Contact details prohibited')
def ident(v): require(isinstance(v,str) and ID.fullmatch(v) is not None,'Invalid ID')
def identity(s,a):
    require(isinstance(s,str) and SID.fullmatch(s) is not None,'Invalid studentId')
    require(isinstance(a,str) and ALIAS.fullmatch(a) is not None,'Invalid alias')
def bilingual(o,limit=2400):
    exact(o,'fa en')
    for v in o.values(): text(v,limit)
def timestamp(v):
    try: require(isinstance(v,str) and datetime.fromisoformat(v.replace('Z','+00:00')).tzinfo is not None,'Timestamp needs zone')
    except (ValueError,TypeError,AttributeError): raise Invalid('Invalid timestamp')
def answer(v):
    require(v is None or type(v) is int or isinstance(v,str) or (isinstance(v,list) and len(v)<=100 and all(type(i) is int and 0<=i<=1000 for i in v)),'Invalid answer')
    if type(v) is int: integer(v,0,1000)
    if isinstance(v,str): text(v,1000)
def validate_quiz(o):
    exact(o,'format schemaVersion studentId alias attemptId quizId missionId stage submittedAtISO buildCommit score correct total readiness weakTopics items telegramLinkStatus')
    require(o['format']=='sfa-quiz-result' and type(o['schemaVersion']) is int and o['schemaVersion']==2,'Unsupported quiz format')
    identity(o['studentId'],o['alias']); ident(o['attemptId'])
    require(isinstance(o['missionId'],str) and o['missionId'] in MISSIONS and o['quizId']==o['missionId'],'Invalid quiz/mission')
    integer(o['stage'],1,8); require(o['stage']==MISSIONS[o['missionId']],'Stage mismatch'); timestamp(o['submittedAtISO'])
    require(o['buildCommit'] is None or isinstance(o['buildCommit'],str) and re.fullmatch(r'[0-9a-f]{7,40}',o['buildCommit']),'Invalid commit')
    integer(o['score'],0,100); integer(o['total'],1,100); integer(o['correct'],0,o['total'])
    # Client claims need valid types, NOT agreement with actual correctness or each other.
    require(o['readiness'] in ('READY','REMEDIATION'),'Invalid readiness')
    require(o['telegramLinkStatus'] in ('UNKNOWN','UNLINKED','LINKED'),'Invalid link status')
    require(isinstance(o['weakTopics'],list) and len(o['weakTopics'])<=100,'Invalid topics')
    for t in o['weakTopics']: text(t,100)
    require(isinstance(o['items'],list) and len(o['items'])==o['total'],'Full item record required')
    seen=set()
    for i in o['items']:
        exact(i,'itemId itemHash kind studentAnswer touched clientCorrect topic reflection')
        ident(i['itemId']); require(i['itemId'] not in seen,'Duplicate itemId'); seen.add(i['itemId'])
        require(isinstance(i['itemHash'],str) and re.fullmatch(r'[0-9a-f]{64}',i['itemHash']),'Invalid item hash')
        require(i['kind'] in ('mc','numeric','order') and type(i['touched']) is bool and type(i['clientCorrect']) is bool,'Invalid item fields')
        answer(i['studentAnswer']); text(i['topic'],100)
        if i['reflection'] is not None: text(i['reflection'],4000)
    return o

def validate_assignment(o,week,stage,required_weaknesses=()):
    exact(o,'week stage title coreTasks weaknessDrills spiralReview riskRules deliverables dueAtISO')
    integer(o['week'],1,10000); integer(o['stage'],1,8); require(o['week']==week and o['stage']==stage,'Assignment week/stage mismatch')
    bilingual(o['title'],300)
    for field in ('coreTasks','deliverables'):
        require(isinstance(o[field],list) and 1<=len(o[field])<=20,'Assignment tasks/deliverables required')
        for t in o[field]: bilingual(t,1200)
    exact(o['riskRules'],'maxRiskPct hardStructuralStop minNetRR noSignals')
    require(o['riskRules']=={'maxRiskPct':'1','hardStructuralStop':True,'minNetRR':'2','noSignals':True},'Risk rules immutable')
    require(type(o['riskRules']['hardStructuralStop']) is bool and type(o['riskRules']['noSignals']) is bool,'Risk flags must be booleans')
    require(isinstance(o['weaknessDrills'],list) and len(o['weaknessDrills'])<=50,'Invalid drills'); drilled=set()
    for d in o['weaknessDrills']:
        exact(d,'weaknessId task'); ident(d['weaknessId']); require(d['weaknessId'] not in drilled,'Duplicate drill'); drilled.add(d['weaknessId']); bilingual(d['task'],1200)
    require(set(required_weaknesses)<=drilled,'All unresolved weaknesses need mandatory drills')
    require(isinstance(o['spiralReview'],list) and len(o['spiralReview'])<=40,'Invalid spiral review'); stages=set()
    for r in o['spiralReview']:
        exact(r,'stage skill task'); integer(r['stage'],1,max(1,stage-1)); require(r['stage']<stage,'Review must reference an earlier stage'); text(r['skill'],100); bilingual(r['task'],1200); stages.add(r['stage'])
    require(stages==set(range(1,stage)),'Review must cover ALL earlier stages (rotate skill/task within each stage)')
    timestamp(o['dueAtISO']); return o

def validate_weakness_updates(updates):
    require(isinstance(updates,list) and len(updates)<=50,'Invalid weakness updates'); seen=set()
    for w in updates:
        exact(w,'id skill evidenceRefs demonstratedClean drilled')
        ident(w['id']); require(w['id'] not in seen,'Duplicate weakness update'); seen.add(w['id']); text(w['skill'],100)
        require(isinstance(w['evidenceRefs'],list) and 1<=len(w['evidenceRefs'])<=20,'Evidence references required')
        for ref in w['evidenceRefs']: text(ref,300)
        require(type(w['demonstratedClean']) is bool and type(w['drilled']) is bool,'Invalid weakness flags')
        require(not w['demonstratedClean'] or w['drilled'],'Clean demonstration must be evidenced as drilled')

def validate_decision(o,target,cfg,required_weaknesses=()):
    from grading import verdict
    base='format schemaVersion decisionId studentId week stage verdict feedback weaknessUpdates habitChecklist echoNotes'
    isquiz=o.get('format')=='sfa-quiz-decision'
    exact(o,base+(' attemptId corrections assignment' if isquiz else ' submissionId scores finalHardBlock flaws unlockNext nextAssignment remedialAssignment'))
    require(o['format'] in ('sfa-quiz-decision','sfa-practical-decision') and type(o['schemaVersion']) is int and o['schemaVersion']==2,'Invalid decision format')
    ident(o['decisionId']); integer(o['week'],1,10000); integer(o['stage'],1,8)
    require(o['studentId']==target['student'] and o['week']==target['week'] and o['stage']==target['stage'],'Decision target mismatch')
    require(o['verdict'] in VERDICTS,'Invalid verdict'); bilingual(o['feedback']); text(o['echoNotes'],4000)
    validate_weakness_updates(o['weaknessUpdates'])
    require(isinstance(o['habitChecklist'],list) and len(o['habitChecklist'])<=30,'Invalid habits')
    for h in o['habitChecklist']:
        exact(h,'skill adhered evidenceRef'); text(h['skill'],100); require(type(h['adhered']) is bool,'Invalid habit adherence'); text(h['evidenceRef'],300)
    required=set(required_weaknesses)|{w['id'] for w in o['weaknessUpdates']}
    if isquiz:
        require(o['attemptId']==target['id'],'Attempt mismatch'); a=target['assessment']
        require(a['status']=='RECOMPUTED' and o['verdict']==a['verdict'],'Quiz key unavailable / verdict mismatch')
        require(isinstance(o['corrections'],list) and len(o['corrections'])<=100,'Invalid corrections'); corrected=set(); bank={i['itemId']:i for i in a['items']}
        for c in o['corrections']:
            exact(c,'itemId correction explanation'); ident(c['itemId']); require(c['itemId'] in bank and c['itemId'] not in corrected,'Invalid/duplicate correction'); corrected.add(c['itemId']); bilingual(c['correction']); bilingual(c['explanation'])
        require({i['itemId'] for i in a['items'] if not i['correct']}<=corrected,'Every incorrect item needs correction and explanation')
        require({i['topic'] for i in a['items'] if not i['correct']}<={w['skill'] for w in o['weaknessUpdates']},'Wrong quiz topics must update cumulative weaknesses')
        if o['verdict']=='NOT_APPROVED': require(o['assignment'] is None,'No practical assignment before quiz approval')
        else: validate_assignment(o['assignment'],o['week'],o['stage'],required)
    else:
        require(o['submissionId']==target['id'],'Submission mismatch'); exact(o['scores'],'risk technicalMacro journalPsychology')
        for k,cap in [('risk',40),('technicalMacro',40),('journalPsychology',20)]: integer(o['scores'][k],0,cap)
        require(type(o['finalHardBlock']) is bool and type(o['unlockNext']) is bool,'Invalid gate flags')
        expected=verdict(sum(o['scores'].values()),cfg.practical_approved,cfg.practical_partial,o['finalHardBlock'])
        require(o['verdict']==expected,'Practical verdict mismatch')
        allow=expected!='NOT_APPROVED' and o['stage']<8; require(o['unlockNext']==allow,'Invalid unlockNext')
        require(isinstance(o['flaws'],list) and len(o['flaws'])<=30,'Invalid flaws')
        for f in o['flaws']: text(f,1000)
        if expected=='NOT_APPROVED':
            require(o['nextAssignment'] is None,'No next-stage assignment after rejection')
            validate_assignment(o['remedialAssignment'],o['week']+1,o['stage'],required)
        else:
            require(o['remedialAssignment'] is None,'Approved practical has no remedial assignment')
            # Next week's actual practical assignment is issued only AFTER its quiz is assessed.
            require(o['nextAssignment'] is None,'Next practical assignment must wait for next week quiz')
    return o

def canonical(o): return json.dumps(o,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False)
