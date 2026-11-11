import io, json, secrets, time, uuid
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from .core import CoreService, now
from .contracts import require, canonical, validate_decision, validate_quiz, Invalid
from .security import token_hash
from .uploads import store

PASSWORDS=PasswordHasher(time_cost=3,memory_cost=65536,parallelism=2)
DUMMY=PASSWORDS.hash(secrets.token_urlsafe(32))
NOTICE='Your learning work and grades are stored on the academy server; Echo and the academy mentor review them. No live trading or sensitive account documents required. / تمرین‌ها و نمرات در سرور آکادمی ذخیره و توسط Echo و منتور بررسی می‌شوند. اطلاعات حساس حساب نفرستید.'

def email_value(v):
    import re
    require(isinstance(v,str) and len(v)<=254 and re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',v),'EMAIL_INVALID')
    return v.strip().lower()

def password_value(v):
    require(isinstance(v,str) and 12<=len(v)<=256,'PASSWORD_12_TO_256_REQUIRED'); return v

class Service(CoreService):
    def invite(self,days=30,max_uses=100):
        require(1<=days<=365 and 1<=max_uses<=10000,'INVITE_LIMIT_INVALID')
        token=secrets.token_urlsafe(32)
        with self.db.tx() as c: c.execute('INSERT INTO invites(hash,expires,max_uses) VALUES(?,?,?)',(token_hash(token),now()+days*86400,max_uses))
        return self.config.origin+'/join/'+token
    def signup(self,p):
        email=email_value(p.get('email')); password=password_value(p.get('password')); name=p.get('displayName')
        require(isinstance(name,str) and 1<=len(name.strip())<=100,'NAME_REQUIRED')
        require(p.get('acceptDataNotice') is True,'DATA_NOTICE_REQUIRED')
        ph=PASSWORDS.hash(password); token=secrets.token_urlsafe(32)
        with self.db.tx() as c:
            inv=c.execute('SELECT * FROM invites WHERE hash=?',(token_hash(str(p.get('inviteToken',''))),)).fetchone()
            require(inv and inv['expires']>now() and inv['uses']<inv['max_uses'],'INVITE_EXPIRED_OR_INVALID')
            require(not c.execute('SELECT 1 FROM students WHERE email=?',(email,)).fetchone(),'SIGNUP_UNAVAILABLE')
            sid='S'+str(c.execute("SELECT nextval('student_number') AS n").fetchone()['n'])
            c.execute('INSERT INTO students(student,alias,enrollment_hash,email,display_name,password_hash,notice_accepted) VALUES(?,?,?,?,?,?,?)',(sid,'Learner-'+sid,token_hash(secrets.token_urlsafe(32)),email,name.strip(),ph,now()))
            c.execute("INSERT INTO weeks(student,week,stage,state) VALUES(?,1,1,'LESSON_OPEN')",(sid,))
            c.execute('UPDATE invites SET uses=uses+1 WHERE hash=?',(inv['hash'],))
            self._session(c,sid,token)
            self._event(c,'join:'+sid,sid,'ACCOUNT_CREATED',{'dataNoticeVersion':1})
        return token
    def _session(self,c,sid,token):
        c.execute('DELETE FROM sessions WHERE expires<?',(now(),))
        c.execute('INSERT INTO sessions VALUES(?,?,?)',(token_hash(token),sid,now()+7*86400))
    def login(self,p):
        email=email_value(p.get('email')); pw=p.get('password'); require(isinstance(pw,str) and len(pw)<=256,'LOGIN_FAILED')
        rows=self.db.rows('SELECT * FROM students WHERE email=?',(email,)); row=rows[0] if rows else None
        try: ok=PASSWORDS.verify((row or {}).get('password_hash') or DUMMY,pw)
        except (VerificationError,InvalidHashError): ok=False
        require(ok and row is not None,'LOGIN_FAILED')
        token=secrets.token_urlsafe(32)
        with self.db.tx() as c:
            if PASSWORDS.check_needs_rehash(row['password_hash']): c.execute('UPDATE students SET password_hash=? WHERE student=?',(PASSWORDS.hash(pw),row['student']))
            self._session(c,row['student'],token)
        return token
    def logout(self,token):
        with self.db.tx() as c: c.execute('DELETE FROM sessions WHERE hash=?',(token_hash(token),))
    def reset_link(self,email):
        rows=self.db.rows('SELECT student FROM students WHERE email=?',(email_value(email),)); require(bool(rows),'ACCOUNT_NOT_FOUND')
        token=secrets.token_urlsafe(32)
        with self.db.tx() as c:
            c.execute('DELETE FROM resets WHERE student=?',(rows[0]['student'],))
            c.execute('INSERT INTO resets VALUES(?,?,?)',(token_hash(token),rows[0]['student'],now()+1800))
        return self.config.origin+'/reset/'+token
    def reset_password(self,p):
        ph=PASSWORDS.hash(password_value(p.get('password')))
        with self.db.tx() as c:
            r=c.execute('DELETE FROM resets WHERE hash=? AND expires>? RETURNING student',(token_hash(str(p.get('token',''))),now())).fetchone()
            require(r is not None,'RESET_EXPIRED_OR_INVALID')
            c.execute('UPDATE students SET password_hash=? WHERE student=?',(ph,r['student']))
            c.execute('DELETE FROM sessions WHERE student=?',(r['student'],))
    def bot_username(self):
        if not self.config.bot_token: return ''
        rows=self.db.rows("SELECT value FROM settings WHERE key='bot_username'")
        return self.config.bot_username or (rows[0]['value'] if rows else '')
    def me(self,s):
        fresh=self.db.rows('SELECT * FROM students WHERE student=?',(s['student'],))[0]
        return {'studentId':fresh['student'],'displayName':fresh['display_name'] or fresh['alias'],'email':fresh['email'],'role':fresh['role'],**self.entitlements(s['student']),'telegramEnabled':bool(self.config.bot_token and self.bot_username()),'telegramLinked':fresh['telegram'] is not None}
    def authorize(self,s,stage):
        require(type(stage) is int and 1<=stage<=8,'STAGE_INVALID')
        require(stage<=self.entitlements(s['student'])['unlockedStage'],'STAGE_LOCKED')
        return {'allowed':True,'stage':stage}
    def connect(self,s):
        require(bool(self.config.bot_token and self.bot_username()),'TELEGRAM_DISABLED')
        token=secrets.token_urlsafe(32)
        with self.db.tx() as c:
            require(not c.execute('SELECT telegram FROM students WHERE student=?',(s['student'],)).fetchone()['telegram'],'ALREADY_LINKED')
            c.execute('DELETE FROM links WHERE student=?',(s['student'],))
            c.execute('INSERT INTO links VALUES(?,?,?,0)',(token_hash(token),s['student'],now()+900))
        return 'https://t.me/'+self.bot_username()+'?start='+token
    def link(self, code, telegram):
        require(type(telegram) is int and telegram>0,'Private Telegram account required')
        with self.db.tx() as c:
            row=c.execute('SELECT * FROM links WHERE hash=?',(token_hash(code),)).fetchone()
            require(row is not None and not row['used'] and row['expires']>now(),'Expired/used link code')
            require(c.execute('SELECT 1 FROM students WHERE telegram=?',(telegram,)).fetchone() is None,'Telegram already linked')
            require(c.execute('SELECT telegram FROM students WHERE student=?',(row['student'],)).fetchone()['telegram'] is None,'Student already linked')
            c.execute('UPDATE students SET telegram=? WHERE student=?',(telegram,row['student']))
            c.execute('UPDATE links SET used=1 WHERE hash=?',(token_hash(code),))
        return row['student']
    def quiz_submit(self,p,s):
        # Server supplies identity and all client-only claims; input is the full canonical answers.
        require(set(p)=={'attemptId','quizId','buildCommit','items'},'QUIZ_FIELDS_INVALID')
        from .contracts import MISSIONS
        stage=MISSIONS.get(p['quizId']); require(stage is not None,'QUIZ_UNKNOWN')
        require(isinstance(p['items'],list) and 1<=len(p['items'])<=100,'FULL_QUIZ_ITEMS_REQUIRED')
        items=[]
        for i in p['items']:
            require(isinstance(i,dict) and set(i)=={'itemId','itemHash','kind','studentAnswer','touched','reflection'},'ITEM_FIELDS_INVALID')
            items.append({**i,'topic':'Server-verified topic','clientCorrect':False})
        body={'format':'sfa-quiz-result','schemaVersion':2,'studentId':s['student'],'alias':s['alias'],'attemptId':p['attemptId'],'quizId':p['quizId'],'missionId':p['quizId'],'stage':stage,'submittedAtISO':datetime.now(ZoneInfo('Europe/Amsterdam')).isoformat(),'buildCommit':p['buildCommit'],'score':0,'correct':0,'total':len(items),'readiness':'REMEDIATION','weakTopics':[],'items':items,'telegramLinkStatus':'UNKNOWN'}
        # submittedAt generated once; repeated same answers must retain original server timestamp.
        old=self.db.rows('SELECT body FROM quizzes WHERE attempt=?',(p['attemptId'],))
        if old: body['submittedAtISO']=json.loads(old[0]['body'])['submittedAtISO']
        self.quiz(body,s,p['attemptId'])
        return self.quiz_feedback(s,p['attemptId'])
    def quiz_feedback(self,s,aid):
        rows=self.db.rows('SELECT * FROM quizzes WHERE student=? AND attempt=?',(s['student'],aid)); require(bool(rows),'ATTEMPT_NOT_FOUND')
        a=json.loads(rows[0]['assessment']); decisions=self.db.rows("SELECT body,state FROM mentor_decisions WHERE target=?",('quiz:'+aid,))
        # Full expected answers are Echo-only; student sees correctness after a complete submission.
        public={k:v for k,v in a.items() if k in ('status','reason','score','correct','total','verdict')}
        public['items']=[{'itemId':i['itemId'],'correct':i['correct']} for i in a['items']]
        return {'attemptId':aid,'assessment':public,'decision':json.loads(decisions[0]['body']) if decisions and decisions[0]['state']=='DELIVERED' else None}
    def draft(self,s): return self.new_submission(s)
    def upload(self,s,sid,uploaded):
        with self.db.tx() as c:
            r=c.execute('SELECT * FROM submissions WHERE id=? AND student=?',(sid,s['student'])).fetchone()
            require(r and r['state']=='DRAFT' and self._week(c,s['student'])['week']==r['week'],'DRAFT_NOT_OPEN')
            require(c.execute('SELECT count(*) AS n FROM files WHERE submission=?',(sid,)).fetchone()['n']<12,'MAX_12_FILES')
            fid=uuid.uuid4().hex; data=store(uploaded.stream,self.config.root/'uploads'/s['student']/sid,fid,uploaded.filename)
            try: c.execute('INSERT INTO files(id,submission,path,digest,name,size,mime) VALUES(?,?,?,?,?,?,?)',(fid,sid,data['path'],data['digest'],data['name'],data['size'],data['mime']))
            except BaseException: Path(data['path']).unlink(missing_ok=True); raise
        return {'fileId':fid,**{k:data[k] for k in ('name','size','digest','mime')}}
    def submit_practical(self,s,sid):
        old=self.db.rows('SELECT * FROM submissions WHERE id=? AND student=?',(sid,s['student'])); require(bool(old),'SUBMISSION_NOT_FOUND')
        if old[0]['state'] in ('QUEUED','DELIVERED'): return sid
        require(self.draft(s)==sid,'DRAFT_MISMATCH'); return self.submit(s)
    def lesson_response(self,s,stage,body):
        self.authorize(s,stage); require(isinstance(body,dict) and len(canonical(body))<=50000,'RESPONSE_TOO_LARGE')
        with self.db.tx() as c: c.execute('INSERT INTO responses VALUES(?,?,?) ON CONFLICT(student,stage) DO UPDATE SET body=EXCLUDED.body',(s['student'],stage,canonical(body)))
    def legacy(self,s,p):
        require(isinstance(p,dict) and len(canonical(p))<=500000,'LEGACY_TOO_LARGE')
        with self.db.tx() as c: self._event(c,'legacy:'+s['student'],s['student'],'LEGACY_UNVERIFIED',p)
        return {'imported':True,'verified':False,'unlocksChanged':False}
    def queue(self):
        self.refresh_assessments(); out=[]
        for kind,table,key in [('quiz','quizzes','attempt'),('practical','submissions','id')]:
            for r in self.db.rows('SELECT * FROM '+table+' ORDER BY created'):
                rid=kind+':'+r[key]
                if kind=='practical' and r['state']!='QUEUED': continue
                if self.db.rows('SELECT 1 FROM mentor_decisions WHERE target=?',(rid,)): continue
                claim=self.db.rows('SELECT expires FROM claims WHERE request=? AND expires>?',(rid,now()))
                item={'requestId':rid,'studentId':r['student'],'week':r['week'],'claimExpires':claim[0]['expires'] if claim else None}
                if kind=='quiz': item.update(kind='quiz_assessment',packet=json.loads(r['body']),assessment=json.loads(r['assessment']))
                else: item.update(kind='practical_submission',stage=r['stage'],files=self.file_list(r['id']))
                out.append(item)
        return out
    def file_list(self,sid):
        return self.db.rows('SELECT id AS "fileId",name,size,digest,mime FROM files WHERE submission=?',(sid,))
    def claim(self,rid):
        require(any(r['requestId']==rid for r in self.queue()),'REQUEST_NOT_PENDING')
        token=secrets.token_urlsafe(32)
        with self.db.tx() as c:
            r=c.execute('SELECT * FROM claims WHERE request=?',(rid,)).fetchone()
            require(not r or r['expires']<=now(),'CLAIM_BUSY')
            c.execute('INSERT INTO claims VALUES(?,?,?) ON CONFLICT(request) DO UPDATE SET lease=EXCLUDED.lease,expires=EXCLUDED.expires',(rid,token_hash(token),now()+1800))
        return {'requestId':rid,'leaseToken':token,'expiresAt':now()+1800}
    def decision(self,p,rid=None,lease=None,risk_evidence=None):
        require(isinstance(p,dict),'DECISION_REQUIRED')
        isquiz=p.get('format')=='sfa-quiz-decision'; tid=p.get('attemptId') if isquiz else p.get('submissionId'); targetkey=('quiz:' if isquiz else 'practical:')+str(tid)
        require(rid==targetkey,'REQUEST_MISMATCH'); digest=token_hash(canonical(p))
        with self.db.tx() as c:
            old=c.execute('SELECT * FROM mentor_decisions WHERE target=? OR id=?',(rid,p.get('decisionId'))).fetchone()
            if old:
                require(old['digest']==digest and old['target']==rid and old['id']==p.get('decisionId'),'DECISION_CONFLICT'); return {'decisionId':old['id'],'state':old['state'],'idempotent':True}
            claim=c.execute('SELECT * FROM claims WHERE request=?',(rid,)).fetchone()
            require(claim and claim['expires']>now() and secrets.compare_digest(claim['lease'],token_hash(lease or '')),'CLAIM_REQUIRED')
            r=c.execute('SELECT * FROM '+('quizzes WHERE attempt=?' if isquiz else 'submissions WHERE id=?'),(tid,)).fetchone(); require(r is not None,'TARGET_MISSING')
            target={'id':tid,'student':r['student'],'week':r['week'],'stage':json.loads(r['body'])['stage'] if isquiz else r['stage']}
            if isquiz: target['assessment']=json.loads(r['assessment'])
            required=[w['id'] for w in c.execute("SELECT id FROM weaknesses WHERE student=? AND status!='RESOLVED'",(r['student'],))]
            if not isquiz:
                from .risk import hard_block
                blocked=hard_block(risk_evidence)
                require(p.get('finalHardBlock') is blocked,'FINAL_HARD_BLOCK_MISMATCH')
            validate_decision(p,target,self.config,required)
            # Dates and explicit hard-block evidence cannot be weakened by grading totals.
            assignment=p.get('assignment') or p.get('remedialAssignment')
            if assignment:
                due=datetime.fromisoformat(assignment['dueAtISO'].replace('Z','+00:00')); delta=due-datetime.now(due.tzinfo)
                require(timedelta(days=5)<=delta<=timedelta(days=9),'DUE_DATE_MUST_BE_ABOUT_ONE_WEEK')
            w=self._week(c,r['student']); require(w['week']==r['week'] and w['state']==('QUIZ_SUBMITTED' if isquiz else 'PRACTICAL_SUBMITTED'),'STALE_ASSESSMENT')
            if isquiz: require(w['attempt']==tid,'ATTEMPT_SUPERSEDED')
            state='PENDING_APPROVAL' if self.config.approval_required else 'READY'
            c.execute('INSERT INTO mentor_decisions(id,target,student,week,kind,body,digest,state,approved) VALUES(?,?,?,?,?,?,?,?,?)',(p['decisionId'],rid,r['student'],r['week'],'quiz' if isquiz else 'practical',canonical(p),digest,state,int(not self.config.approval_required)))
            row=c.execute('SELECT * FROM mentor_decisions WHERE id=?',(p['decisionId'],)).fetchone()
            if not isquiz: self._event(c,'risk-evidence:'+p['decisionId'],r['student'],'FINAL_PLAN_RISK_EVIDENCE',risk_evidence)
            if state=='READY': self.deliver(c,row,p)
            else: self._notify(c,r['student'],'DECISION_PENDING_APPROVAL',{'decisionId':p['decisionId']},student_notice=False)
            c.execute('DELETE FROM claims WHERE request=?',(rid,))
        return {'decisionId':p['decisionId'],'state':'DELIVERED' if state=='READY' else state,'idempotent':False}
    def deliver(self,c,row,p):
        sid=row['student']
        snapshot={'student':dict(c.execute('SELECT stage,current_week FROM students WHERE student=?',(sid,)).fetchone()),'weeks':list(c.execute('SELECT * FROM weeks WHERE student=?',(sid,))),'weaknesses':list(c.execute('SELECT * FROM weaknesses WHERE student=?',(sid,)))}
        c.execute('UPDATE mentor_decisions SET snapshot=?,delivered_at=? WHERE id=?',(canonical(snapshot),now(),row['id']))
        self.apply_delivered(c,row,p,None)
        c.execute("UPDATE mentor_decisions SET state='DELIVERED' WHERE id=?",(row['id'],))
        kinds=['QUIZ_RESULT_READY','ASSIGNMENT_READY'] if row['kind']=='quiz' and p['verdict']!='NOT_APPROVED' else ['QUIZ_RESULT_READY'] if row['kind']=='quiz' else ['PRACTICAL_GRADED']+(['LESSON_UNLOCKED'] if p['unlockNext'] else [])
        for kind in kinds: self._notify(c,sid,kind,{'decisionId':row['id'],'verdict':p['verdict']})
        if self.config.admin_id:
            copy='Decision copy '+row['id']+' / '+sid+'\n'+canonical(p)
            chunks=[copy[i:i+3200] for i in range(0,len(copy),3200)]
            for i,chunk in enumerate(chunks): c.execute('INSERT INTO outbox(id,chat,body) VALUES(?,?,?)',(uuid.uuid4().hex,self.config.admin_id,f'[{i+1}/{len(chunks)}] '+chunk))
    def _notify(self,c,sid,kind,data,student_notice=True):
        body=canonical({'kind':kind,**data,'url':self.config.origin+'/progress'})
        if student_notice:
            c.execute('INSERT INTO notifications(id,student,body,created) VALUES(?,?,?,?)',(uuid.uuid4().hex,sid,body,now()))
            r=c.execute('SELECT telegram FROM students WHERE student=?',(sid,)).fetchone()
            if r and r['telegram']: c.execute('INSERT INTO outbox(id,chat,body) VALUES(?,?,?)',(uuid.uuid4().hex,r['telegram'],kind+' / نتیجه در داشبورد آماده است\n'+self.config.origin+'/progress'))
        if self.config.admin_id: c.execute('INSERT INTO outbox(id,chat,body) VALUES(?,?,?)',(uuid.uuid4().hex,self.config.admin_id,sid+' '+kind+' '+canonical(data)))
    def override(self,did,reason):
        require(isinstance(reason,str) and 5<=len(reason)<=1000,'OVERRIDE_REASON_REQUIRED')
        with self.db.tx() as c:
            row=c.execute('SELECT * FROM mentor_decisions WHERE id=?',(did,)).fetchone()
            require(row and row['state']=='DELIVERED' and row['delivered_at']>=now()-86400,'OVERRIDE_WINDOW_CLOSED')
            sid=row['student']; snapshot=json.loads(row['snapshot']); old=snapshot['student']
            # Do not erase subsequent assessed work or pretend an unsafe rollback succeeded.
            require(not c.execute('SELECT 1 FROM mentor_decisions WHERE student=? AND (delivered_at>? OR week>?) AND id!=? AND state=?',(sid,row['delivered_at'],row['week'],did,'DELIVERED')).fetchone(),'LATER_DECISION_REQUIRES_MANUAL_REVIEW')
            require(not c.execute('SELECT 1 FROM quizzes WHERE student=? AND week>?',(sid,row['week'])).fetchone() and not c.execute('SELECT 1 FROM submissions WHERE student=? AND week>?',(sid,row['week'])).fetchone(),'NEXT_STAGE_WORK_EXISTS_CONTACT_MENTOR')
            if row['kind']=='quiz':
                require(not c.execute('SELECT 1 FROM submissions WHERE student=? AND week=?',(sid,row['week'])).fetchone(),'PRACTICAL_STARTED_CONTACT_MENTOR')
            c.execute('UPDATE students SET stage=?,current_week=? WHERE student=?',(old['stage'],old['current_week'],sid))
            c.execute('DELETE FROM weeks WHERE student=?',(sid,))
            for w in snapshot['weeks']: c.execute('INSERT INTO weeks(student,week,stage,state,attempt,assignment,quiz_verdict,practical_verdict) VALUES(?,?,?,?,?,?,?,?)',tuple(w[k] for k in ('student','week','stage','state','attempt','assignment','quiz_verdict','practical_verdict')))
            c.execute('DELETE FROM weaknesses WHERE student=?',(sid,))
            for w in snapshot['weaknesses']: c.execute('INSERT INTO weaknesses VALUES(?,?,?,?,?,?,?,?,?)',tuple(w[k] for k in ('student','id','skill','first_week','evidence','status','last_drilled','clean_weeks','last_clean_week')))
            # Reopen assessment under a new target; immutable old decision remains in audit history.
            p=json.loads(row['body']); new=uuid.uuid4().hex
            if row['kind']=='quiz':
                q=c.execute('SELECT * FROM quizzes WHERE attempt=?',(p['attemptId'],)).fetchone(); packet=json.loads(q['body']); packet['attemptId']=new
                c.execute('INSERT INTO quizzes(attempt,student,digest,body,created,assessment,week) VALUES(?,?,?,?,?,?,?)',(new,sid,token_hash(canonical(packet)),canonical(packet),now(),q['assessment'],q['week']))
                c.execute('UPDATE weeks SET attempt=? WHERE student=? AND week=?',(new,sid,row['week']))
            else:
                c.execute("UPDATE submissions SET state='RETRACTED' WHERE id=?",(p['submissionId'],))
                c.execute("INSERT INTO submissions(id,student,stage,state,created,week) VALUES(?,?,?,'QUEUED',?,?)",(new,sid,p['stage'],now(),row['week']))
                c.execute('UPDATE files SET submission=? WHERE submission=?',(new,p['submissionId']))
            c.execute("UPDATE mentor_decisions SET state='RETRACTED',override_reason=? WHERE id=?",(reason,did))
            self._event(c,'override:'+did,sid,'DECISION_RETRACTED',{'decisionId':did,'reason':reason,'replacementRequestId':('quiz:' if row['kind']=='quiz' else 'practical:')+new})
            self._notify(c,sid,'DECISION_RETRACTED',{'decisionId':did,'reason':reason})
    def report(self,sid):
        rows=self.db.rows('SELECT student,alias,stage,current_week FROM students WHERE student=?',(sid,)); require(bool(rows),'STUDENT_NOT_FOUND')
        weaknesses=self.weaknesses(sid); events=self.db.rows('SELECT kind,body,created FROM events WHERE student=? ORDER BY created,id',(sid,))
        weeks=self.db.rows('SELECT * FROM weeks WHERE student=? ORDER BY week',(sid,)); decisions=self.db.rows('SELECT id,state,body,override_reason FROM mentor_decisions WHERE student=? ORDER BY delivered_at NULLS LAST,id',(sid,))
        md='# Cumulative Progress Report — '+sid+'\n\nEducational only; no signals or financial advice. / صرفاً آموزشی\n'
        for e in events:
            stamp=datetime.fromtimestamp(e['created'],ZoneInfo('Europe/Amsterdam')).isoformat()
            md+='\n## '+stamp+' Europe/Amsterdam — '+e['kind']+'\n```json\n'+e['body']+'\n```\n'
        md+='\n## Weaknesses\n```json\n'+canonical(weaknesses)+'\n```\n'
        return {'student':rows[0],'markdown':md,'weaknesses':weaknesses,'weeks':weeks,'decisions':[{**d,'body':json.loads(d['body'])} for d in decisions]}
