import asyncio, hashlib, json, secrets, time, uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
from .contracts import Invalid, canonical, identity, require, validate_quiz, validate_decision
from .security import token_hash
from .db import DB

def now(): return int(time.time())

class CoreService:
    def __init__(self, config):
        self.config=config; self.db=DB(config.database_url)
    def auth(self, token):
        r=self.db.rows('SELECT students.* FROM sessions JOIN students ON students.student=sessions.student WHERE hash=? AND expires>?',(token_hash(token),now()))
        require(bool(r),'Invalid/expired student session'); return r[0]
    def _week(self,c,student):
        row=c.execute('SELECT w.* FROM weeks w JOIN students s ON s.student=w.student AND s.current_week=w.week WHERE w.student=?',(student,)).fetchone()
        require(row is not None,'Missing current week'); return dict(row)
    def _transition(self,c,student,week,state,extra=None):
        r=c.execute('SELECT * FROM weeks WHERE student=? AND week=?',(student,week)).fetchone()
        allowed={'LESSON_OPEN':{'QUIZ_SUBMITTED'},'QUIZ_SUBMITTED':{'QUIZ_ASSESSED'},'QUIZ_ASSESSED':{'QUIZ_SUBMITTED','ASSIGNMENT_ISSUED'},'ASSIGNMENT_ISSUED':{'PRACTICAL_SUBMITTED'},'REMEDIAL_ISSUED':{'PRACTICAL_SUBMITTED'},'PRACTICAL_SUBMITTED':{'PRACTICAL_ASSESSED'},'PRACTICAL_ASSESSED':{'NEXT_UNLOCKED','REMEDIAL_ISSUED','DOSSIER_READY'},'DOSSIER_READY':{'AWAITING_SENIOR_MENTOR'}}
        require(r and state in allowed.get(r['state'],set()),f'Illegal state transition to {state}')
        c.execute('UPDATE weeks SET state=? WHERE student=? AND week=?',(state,student,week))
        self._event(c,'transition:'+uuid.uuid4().hex,student,state,{'week':week,'stage':r['stage'],**(extra or {})})
    def entitlements(self,student):
        with self.db.tx() as c:
            w=self._week(c,student)
            stage=c.execute('SELECT stage FROM students WHERE student=?',(student,)).fetchone()['stage']
        return {'unlockedStage':stage,'currentWeek':w['week'],'status':w['state']}
    def quiz(self,p,student,key):
        from .grading import assess
        validate_quiz(p); require(p['studentId']==student['student'] and p['alias']==student['alias'],'Student identity mismatch')
        require(key==p['attemptId'],'Idempotency-Key must equal attemptId')
        body=canonical(p); digest=token_hash(body)
        with self.db.tx() as c:
            old=c.execute('SELECT digest FROM quizzes WHERE attempt=?',(key,)).fetchone()
            if old:
                require(old['digest']==digest,'Idempotency conflict'); return False
            w=self._week(c,student['student'])
            require(p['stage']==w['stage'],'Lesson/quiz locked or historical; current stage only')
            require(w['state']=='LESSON_OPEN' or w['state']=='QUIZ_ASSESSED' and w['quiz_verdict']=='NOT_APPROVED','Await current assessment/assignment')
            assessment=assess(p,self.config)
            c.execute('INSERT INTO quizzes(attempt,student,digest,body,created,assessment,week) VALUES(?,?,?,?,?,?,?)',(key,p['studentId'],digest,body,now(),canonical(assessment),w['week']))
            c.execute('UPDATE weeks SET attempt=? WHERE student=? AND week=?',(key,p['studentId'],w['week']))
            self._transition(c,p['studentId'],w['week'],'QUIZ_SUBMITTED',{'attemptId':key})
            self._event(c,'quiz:'+key,p['studentId'],'QUIZ_ASSESSMENT_REQUEST',{'attemptId':key,'week':w['week'],'buildCommit':p['buildCommit'],'clientClaims':'UNVERIFIED','assessmentStatus':assessment['status']})
        return True
    def refresh_assessments(self):
        from .grading import assess
        for r in self.db.rows('SELECT * FROM quizzes'):
            if not r['assessment'] or json.loads(r['body']).get('schemaVersion')!=2: continue
            if json.loads(r['assessment'])['status']=='UNVERIFIED':
                a=assess(json.loads(r['body']),self.config)
                if a['status']=='RECOMPUTED':
                    with self.db.tx() as c: c.execute('UPDATE quizzes SET assessment=? WHERE attempt=?',(canonical(a),r['attempt']))
    def _event(self,c,eid,student,kind,body):
        c.execute('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?)',(eid,student,kind,canonical(body),now()))
    def new_submission(self,student):
        with self.db.tx() as c:
            w=self._week(c,student['student'])
            require(w['state'] in ('ASSIGNMENT_ISSUED','REMEDIAL_ISSUED'),'A quiz-approved personalized assignment is required before practical intake')
            r=c.execute("SELECT id FROM submissions WHERE student=? AND state='DRAFT' AND week=?",(student['student'],w['week'])).fetchone()
            if r: return r['id']
            sid=uuid.uuid4().hex
            c.execute('INSERT INTO submissions(id,student,stage,state,created,week) VALUES(?,?,?,?,?,?)',(sid,student['student'],w['stage'],'DRAFT',now(),w['week']))
            return sid
    def submit(self,student):
        with self.db.tx() as c:
            w=self._week(c,student['student']); require(w['state'] in ('ASSIGNMENT_ISSUED','REMEDIAL_ISSUED'),'Practical not open')
            r=c.execute("SELECT * FROM submissions WHERE student=? AND state='DRAFT' AND week=?",(student['student'],w['week'])).fetchone()
            require(r is not None,'Start /new and upload evidence first')
            files=c.execute('SELECT * FROM files WHERE submission=?',(r['id'],)).fetchall()
            require(any(Path(f['name']).suffix.lower() in ('.pdf','.docx','.txt','.md') for f in files),'A practical document is required, not screenshots alone')
            c.execute("UPDATE submissions SET state='QUEUED' WHERE id=?",(r['id'],))
            self._transition(c,student['student'],w['week'],'PRACTICAL_SUBMITTED',{'submissionId':r['id']})
        return r['id']
    def weaknesses(self,student):
        return self.db.rows('SELECT * FROM weaknesses WHERE student=? ORDER BY first_week,id',(student,))
    def _weakness_updates(self,c,student,week,updates):
        for u in updates:
            old=c.execute('SELECT * FROM weaknesses WHERE student=? AND id=?',(student,u['id'])).fetchone()
            old=dict(old) if old else {'first_week':week,'evidence':'[]','clean_weeks':0,'last_clean_week':None,'last_drilled':None,'status':'OPEN'}
            clean=old['clean_weeks']; lastclean=old['last_clean_week']
            if not u['demonstratedClean']: clean=0; lastclean=None
            elif u['drilled'] and lastclean!=week:
                clean=clean+1 if lastclean==week-1 else 1; lastclean=week
            status='RESOLVED' if clean>=self.config.clean_weeks else 'IMPROVING' if clean else 'OPEN'
            refs=sorted(set(json.loads(old['evidence']))|set(u['evidenceRefs']))
            c.execute('INSERT OR REPLACE INTO weaknesses VALUES(?,?,?,?,?,?,?,?,?)',(student,u['id'],u['skill'],old['first_week'],canonical(refs),status,week if u['drilled'] else old['last_drilled'],clean,lastclean))
    def apply_delivered(self,c,row,p,messageid):
        student=row['student']; week=p['week']; w=self._week(c,student)
        require(w['week']==week,'Stale delivery cannot unlock another week')
        self._weakness_updates(c,student,week,p['weaknessUpdates'])
        good=p['verdict']!='NOT_APPROVED'
        if row['kind']=='quiz':
            self._transition(c,student,week,'QUIZ_ASSESSED',{'verdict':p['verdict']})
            c.execute('UPDATE weeks SET quiz_verdict=? WHERE student=? AND week=?',(p['verdict'],student,week))
            if good:
                c.execute('UPDATE weeks SET assignment=? WHERE student=? AND week=?',(canonical(p['assignment']),student,week))
                self._transition(c,student,week,'ASSIGNMENT_ISSUED')
        else:
            self._transition(c,student,week,'PRACTICAL_ASSESSED',{'verdict':p['verdict']})
            c.execute('UPDATE weeks SET practical_verdict=? WHERE student=? AND week=?',(p['verdict'],student,week))
            c.execute("UPDATE submissions SET state='DELIVERED' WHERE id=?",(p['submissionId'],))
            if good and p['stage']==8:
                self._transition(c,student,week,'DOSSIER_READY'); self._transition(c,student,week,'AWAITING_SENIOR_MENTOR')
            elif good:
                self._transition(c,student,week,'NEXT_UNLOCKED')
                c.execute('UPDATE students SET stage=?,current_week=? WHERE student=?',(p['stage']+1,week+1,student))
                c.execute("INSERT INTO weeks(student,week,stage,state) VALUES(?,?,?,'LESSON_OPEN')",(student,week+1,p['stage']+1))
            else:
                self._transition(c,student,week,'REMEDIAL_ISSUED')
                c.execute('UPDATE students SET current_week=? WHERE student=?',(week+1,student))
                c.execute("INSERT INTO weeks(student,week,stage,state,assignment) VALUES(?,?,?,'REMEDIAL_ISSUED',?)",(student,week+1,p['stage'],canonical(p['remedialAssignment'])))
        c.execute("UPDATE mentor_decisions SET state='SENT',message_id=? WHERE id=?",(messageid,row['id']))
        self._event(c,'decision:'+row['id'],student,'ECHO_DECISION',p)
