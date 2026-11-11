import argparse,json,os,subprocess
from pathlib import Path
from .config import Config
from .service import Service,email_value,now
from .contracts import require
from .legacy import import_sqlite

def main():
    p=argparse.ArgumentParser(prog='sfa'); sp=p.add_subparsers(dest='command',required=True)
    sp.add_parser('migrate'); sp.add_parser('status'); sp.add_parser('backup-now'); sp.add_parser('show-echo-key')
    x=sp.add_parser('invite'); x.add_argument('--days',type=int,default=30); x.add_argument('--max-uses',type=int,default=100)
    for name in ('make-admin','reset-password'):
        sp.add_parser(name).add_argument('email')
    x=sp.add_parser('override'); x.add_argument('decisionId'); x.add_argument('--reason',required=True)
    sp.add_parser('import-legacy').add_argument('path')
    x=sp.add_parser('adopt-legacy'); x.add_argument('studentId'); x.add_argument('email')
    a=p.parse_args()
    if a.command=='show-echo-key':
        require(os.geteuid()==0,'Run sudo sfa show-echo-key only in a private terminal; never paste into chat/logs.')
        print(Path('/etc/sfa/echo-api-key').read_text().strip()); return
    if a.command=='backup-now': subprocess.run(['/opt/sfa/backup.sh'],check=True); return
    s=Service(Config.env())
    if a.command=='migrate': print('Schema ready')
    elif a.command=='invite': print(s.invite(a.days,a.max_uses))
    elif a.command=='make-admin':
        with s.db.tx() as c:
            r=c.execute("UPDATE students SET role='ADMIN' WHERE email=? RETURNING student",(email_value(a.email),)).fetchone(); require(r is not None,'Account must sign up first')
        print('Admin role enabled; log in again')
    elif a.command=='reset-password': print(s.reset_link(a.email))
    elif a.command=='adopt-legacy':
        with s.db.tx() as c:
            r=c.execute('UPDATE students SET email=? WHERE student=? AND email IS NULL RETURNING student',(email_value(a.email),a.studentId)).fetchone(); require(r is not None,'Unknown/already adopted legacy account')
        print(s.reset_link(a.email))
    elif a.command=='override': s.override(a.decisionId,a.reason); print('Retracted; audit history retained; pending regrading')
    elif a.command=='import-legacy': print(json.dumps(import_sqlite(s,a.path)))
    else: print(json.dumps({'database':'ok','students':s.db.rows('SELECT count(*) AS n FROM students')[0]['n'],'pendingRequests':len(s.queue()),'approvalRequired':s.config.approval_required}))
if __name__=='__main__': main()
