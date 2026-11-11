"""Single contract registry: decorators below generate api-contract.md."""
import hashlib,hmac,json,re,secrets,tempfile,time
from pathlib import Path
from flask import Flask,request,jsonify,send_file,g
from werkzeug.exceptions import HTTPException
import psycopg
from .config import Config
from .service import Service,NOTICE
from .contracts import Invalid,require,canonical
from .security import verify,token_hash

CONTRACT=[]
def endpoint(app,method,path,request_shape,response_shape,*,auth='student'):
    def wrap(fn):
        CONTRACT.append((method,path,auth,request_shape,response_shape))
        app.add_url_rule(path,fn.__name__,fn,methods=[method]); return fn
    return wrap

def create_app(config=None):
    app=Flask(__name__); app.config['MAX_CONTENT_LENGTH']=250*1024*1024
    cfg=config or Config.env(); svc=Service(cfg); app.extensions['sfa']=svc
    def payload():
        require(request.is_json,'JSON_REQUIRED'); p=request.get_json(); require(isinstance(p,dict),'OBJECT_REQUIRED'); return p
    def token():
        value=request.headers.get('Authorization',''); return value[7:] if value.startswith('Bearer ') else ''
    def student(): return svc.auth(token())
    def admin():
        s=student(); require(s['role']=='ADMIN','ADMIN_REQUIRED'); return s
    @app.before_request
    def auth_boundary():
        if request.path=='/echo/v1/health': return None
        if request.path.startswith('/echo/v1/'):
            require((request.content_length or 0)<=1024*1024,'BODY_TOO_LARGE')
            if not svc.db.rate('echo:'+token_hash(request.remote_addr or ''),int(time.time()),120): return jsonify(error='RATE_LIMITED'),429
            if not token() or not hmac.compare_digest(token_hash(token()),cfg.echo_hash): return jsonify(error='UNAUTHORIZED'),401
            return None
        if not request.path.startswith('/api/v1/'): return jsonify(error='NOT_FOUND'),404
        # Network boundary: Caddy never proxies /api/v1, Flask binds loopback.
        if request.remote_addr not in ('127.0.0.1','::1',None): return jsonify(error='LOOPBACK_REQUIRED'),403
        if request.mimetype=='multipart/form-data':
            stamp=request.headers.get('X-SFA-Timestamp',''); nonce=request.headers.get('X-SFA-Nonce','')
            require(stamp.isdigit() and abs(int(time.time())-int(stamp))<=300 and re.fullmatch(r'[A-Za-z0-9_-]{16,100}',nonce),'INVALID_SIGNATURE')
            mac=hmac.new(cfg.secret.encode(),f'{stamp}\n{nonce}\n{request.method}\n{request.path}\n'.encode(),hashlib.sha256)
            spool=tempfile.SpooledTemporaryFile(max_size=1024*1024,mode='w+b'); g.spool=spool; total=0
            while chunk:=request.stream.read(64*1024):
                total+=len(chunk); require(total<=22*1024*1024,'ONE_FILE_PER_UPLOAD_MAX_20_MIB'); mac.update(chunk); spool.write(chunk)
            require(hmac.compare_digest('sha256='+mac.hexdigest(),request.headers.get('X-SFA-Signature','')),'INVALID_SIGNATURE')
            spool.seek(0); request.stream=spool
        else:
            require((request.content_length or 0)<=1024*1024,'BODY_TOO_LARGE')
            verify(cfg.secret,request.headers,request.method,request.path,request.get_data(cache=True))
        with svc.db.tx() as c:
            c.execute('DELETE FROM nonces WHERE expires<?',(int(time.time()),))
            n=c.execute('INSERT INTO nonces VALUES(?,?) ON CONFLICT DO NOTHING RETURNING nonce',(request.headers.get('X-SFA-Nonce'),int(time.time())+600)).fetchone()
            require(n is not None,'REPLAY_REJECTED')
        if request.path in ('/api/v1/login','/api/v1/signup','/api/v1/reset-password'):
            # Next signs both account identity and observed trusted client-IP rate key.
            p=request.get_json(silent=True) or {}; account=token_hash(str(p.get('email') or p.get('token') or p.get('inviteToken') or 'unknown').lower())
            ip=token_hash(request.headers.get('X-SFA-Client-IP','unknown'))
            if not svc.db.rate('account:'+account,int(time.time()),10,600) or not svc.db.rate('auth-ip:'+ip,int(time.time()),40,600): return jsonify(error='RATE_LIMITED'),429
    @app.teardown_request
    def cleanup(_):
        if hasattr(g,'spool'): g.spool.close()
    @app.after_request
    def no_cache(r):
        r.headers['Cache-Control']='no-store'; r.headers['X-Content-Type-Options']='nosniff'; return r
    @app.errorhandler(Invalid)
    def invalid(e):
        msg=str(e); code='UNAUTHORIZED' if 'session' in msg.lower() or msg=='LOGIN_FAILED' else 'STAGE_LOCKED' if msg=='STAGE_LOCKED' else 'VALIDATION_FAILED'
        return jsonify(error=code,message=msg),401 if code=='UNAUTHORIZED' else 403 if code=='STAGE_LOCKED' else 400
    @app.errorhandler(HTTPException)
    def http_error(e): return jsonify(error=e.name.upper().replace(' ','_')),e.code
    @app.errorhandler(Exception)
    def unexpected(e):
        # Never log raw exception/SQL/credentials or return student content in errors.
        app.logger.error('SFA_INTERNAL_ERROR'); return jsonify(error='INTERNAL_ERROR'),500
    def session_result(value): return {'sessionToken':value,'expiresIn':604800,'me':svc.me(svc.auth(value))}
    ep=lambda m,p,i,o,auth='student': endpoint(app,m,p,i,o,auth=auth)
    @ep('GET','/echo/v1/health','none','{ok:true, version:6}',auth='public')
    def health(): svc.db.rows('SELECT 1'); return {'ok':True,'version':6}
    @ep('GET','/api/v1/data-notice','none','{version:1,text:string}',auth='HMAC only')
    def notice(): return {'version':1,'text':NOTICE}
    @ep('POST','/api/v1/signup','{inviteToken,displayName,email,password,acceptDataNotice:true}','{sessionToken,expiresIn:604800,me:Me}',auth='HMAC only')
    def signup(): return session_result(svc.signup(payload())),201
    @ep('POST','/api/v1/login','{email,password}','{sessionToken,expiresIn:604800,me:Me}',auth='HMAC only')
    def login(): return session_result(svc.login(payload()))
    @ep('POST','/api/v1/reset-password','{token,password}','{ok:true}',auth='HMAC only')
    def reset(): svc.reset_password(payload()); return {'ok':True}
    @ep('POST','/api/v1/logout','{}','{ok:true}')
    def logout(): svc.logout(token()); return {'ok':True}
    @ep('GET','/api/v1/me','none','Me')
    def me(): return svc.me(student())
    @ep('GET','/api/v1/entitlements','none','{unlockedStage,currentWeek,status}')
    def entitlement(): return svc.entitlements(student()['student'])
    @ep('GET','/api/v1/authorize/<int:stage>','none','{allowed:true,stage}')
    def authorize(stage): return svc.authorize(student(),stage)
    @ep('GET','/api/v1/responses/<int:stage>','none','{responses:object|null}')
    def get_responses(stage):
        s=student(); svc.authorize(s,stage); r=svc.db.rows('SELECT body FROM responses WHERE student=? AND stage=?',(s['student'],stage)); return {'responses':json.loads(r[0]['body']) if r else None}
    @ep('POST','/api/v1/responses/<int:stage>','{responses:object}','{ok:true}')
    def responses(stage): svc.lesson_response(student(),stage,payload()['responses']); return {'ok':True}
    @ep('POST','/api/v1/legacy-import','{records:object; <=500000 UTF-8 JSON chars}','{imported:true,verified:false,unlocksChanged:false}')
    def legacy(): return svc.legacy(student(),payload())
    @ep('POST','/api/v1/quizzes','QuizInput','{attemptId,assessment:PublicAssessment,decision:Decision|null}')
    def quizzes(): return svc.quiz_submit(payload(),student())
    @ep('GET','/api/v1/quizzes','none','{attempts:[{attemptId,quizId,stage,week,created,assessmentStatus}]}')
    def quiz_history():
        s=student(); out=[]
        for r in svc.db.rows('SELECT * FROM quizzes WHERE student=? ORDER BY created DESC LIMIT 100',(s['student'],)):
            p=json.loads(r['body']); out.append({'attemptId':r['attempt'],'quizId':p['quizId'],'stage':p['stage'],'week':r['week'],'created':r['created'],'assessmentStatus':json.loads(r['assessment'])['status']})
        return {'attempts':out}
    @ep('GET','/api/v1/quizzes/<attempt>','none','{attemptId,assessment:PublicAssessment,decision:Decision|null}')
    def feedback(attempt): return svc.quiz_feedback(student(),attempt)
    @ep('GET','/api/v1/assignment','none','{week,stage,status,assignment:Assignment|null}')
    def assignment():
        s=student()
        with svc.db.tx() as c: w=svc._week(c,s['student'])
        return {'week':w['week'],'stage':w['stage'],'status':w['state'],'assignment':json.loads(w['assignment']) if w['assignment'] else None}
    @ep('GET','/api/v1/practicals','none','{submissions:[{id,stage,week,state,created,files:[File]}]}')
    def practical_history():
        s=student();return {'submissions':[{**r,'files':svc.file_list(r['id'])} for r in svc.db.rows('SELECT id,stage,week,state,created FROM submissions WHERE student=? ORDER BY created DESC LIMIT 100',(s['student'],))]}
    @ep('POST','/api/v1/practicals/draft','{}','{submissionId,files:[File]}')
    def draft():
        sid=svc.draft(student()); return {'submissionId':sid,'files':svc.file_list(sid)}
    @ep('POST','/api/v1/practicals/<sid>/files','multipart/form-data: exactly one field file','File')
    def upload(sid):
        s=student(); require(len(request.files.getlist('file'))==1 and set(request.files)=={'file'},'ONE_FILE_REQUIRED'); return svc.upload(s,sid,request.files['file']),201
    @ep('POST','/api/v1/practicals/<sid>/submit','{}','{submissionId,status:"QUEUED"}')
    def submit(sid): return {'submissionId':svc.submit_practical(student(),sid),'status':'QUEUED'}
    @ep('GET','/api/v1/notifications','none','{notifications:[{id,body:object,created,isRead}]}')
    def notifications():
        s=student(); return {'notifications':[{'id':r['id'],'body':json.loads(r['body']),'created':r['created'],'isRead':bool(r['is_read'])} for r in svc.db.rows('SELECT * FROM notifications WHERE student=? ORDER BY created DESC LIMIT 100',(s['student'],))]}
    @ep('POST','/api/v1/notifications/<nid>/read','{}','{ok:true}')
    def read_notification(nid):
        s=student()
        with svc.db.tx() as c: c.execute('UPDATE notifications SET is_read=1 WHERE id=? AND student=?',(nid,s['student']))
        return {'ok':True}
    @ep('GET','/api/v1/report','none','Report')
    def report(): return svc.report(student()['student'])
    @ep('POST','/api/v1/telegram/connect-link','{}','{url,expiresIn:900}')
    def telegram(): return {'url':svc.connect(student()),'expiresIn':900}
    @ep('GET','/api/v1/admin/students','none','{students:[{student,display_name,email,stage,current_week,role}]}',auth='ADMIN session + HMAC')
    def admin_students():
        admin(); return {'students':svc.db.rows('SELECT student,display_name,email,stage,current_week,role FROM students ORDER BY student')}
    @ep('GET','/api/v1/admin/decisions','none','{decisions:[{id,student,state,body:Decision,delivered_at}]}',auth='ADMIN session + HMAC')
    def admin_decisions():
        admin(); return {'decisions':[{**r,'body':json.loads(r['body'])} for r in svc.db.rows('SELECT id,student,state,body,delivered_at FROM mentor_decisions ORDER BY delivered_at DESC NULLS LAST LIMIT 100')]}
    @ep('POST','/api/v1/admin/decisions/<did>/override','{reason}','{ok:true}',auth='ADMIN session + HMAC')
    def override(did): admin(); svc.override(did,payload()['reason']); return {'ok':True}
    @ep('POST','/api/v1/admin/decisions/<did>/approve','{}','{ok:true}',auth='ADMIN session + HMAC')
    def approve(did):
        admin()
        with svc.db.tx() as c:
            row=c.execute("SELECT * FROM mentor_decisions WHERE id=? AND state='PENDING_APPROVAL'",(did,)).fetchone(); require(row is not None,'NOT_PENDING'); svc.deliver(c,row,json.loads(row['body']))
        return {'ok':True}
    @ep('GET','/echo/v1/queue','none','{requests:[QueueItem],policy:{quizApproved:80,quizPartial:60,practicalApproved:80,practicalPartial:65,cleanWeeks:2,approvalRequired}}',auth='Echo Bearer')
    def queue(): return {'requests':svc.queue(),'policy':{'quizApproved':cfg.quiz_approved,'quizPartial':cfg.quiz_partial,'practicalApproved':cfg.practical_approved,'practicalPartial':cfg.practical_partial,'cleanWeeks':cfg.clean_weeks,'approvalRequired':cfg.approval_required}}
    @ep('GET','/echo/v1/students/<sid>/report','none','Report',auth='Echo Bearer')
    def echo_report(sid): return svc.report(sid)
    @ep('GET','/echo/v1/files/<fid>','none','original attachment; verify digest/size from queue',auth='Echo Bearer')
    def file(fid):
        rows=svc.db.rows('SELECT * FROM files WHERE id=?',(fid,)); require(bool(rows),'FILE_NOT_FOUND'); f=rows[0]; p=Path(f['path']).resolve(); require(p.is_relative_to((cfg.root/'uploads').resolve()),'FILE_PATH_REJECTED')
        return send_file(p,as_attachment=True,download_name=f['name'],mimetype='application/octet-stream')
    @ep('POST','/echo/v1/claims/<path:rid>','{}','{requestId,leaseToken,expiresAt:unixSeconds}',auth='Echo Bearer')
    def claim(rid): return svc.claim(rid)
    @ep('POST','/echo/v1/decisions','{requestId,leaseToken,decision:Decision,riskEvidence?:RiskEvidence}','{decisionId,state:"DELIVERED"|"PENDING_APPROVAL",idempotent:boolean}',auth='Echo Bearer')
    def decision():
        p=payload(); require({'requestId','leaseToken','decision'}<=set(p)<= {'requestId','leaseToken','decision','riskEvidence'},'DECISION_ENVELOPE_REQUIRED'); return svc.decision(p['decision'],p['requestId'],p['leaseToken'],p.get('riskEvidence'))
    return app

if __name__=='__main__': create_app().run('127.0.0.1',8081)
