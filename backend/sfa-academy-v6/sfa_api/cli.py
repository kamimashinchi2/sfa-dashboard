import argparse,hashlib,json,os,secrets,subprocess
from pathlib import Path
from .config import Config
from .service import Service,email_value,now
from .contracts import require
from .legacy import import_sqlite

ETC=Path('/etc/sfa')

def echo_key_hash(key_text):
    return hashlib.sha256(key_text.strip().encode()).hexdigest()
def stored_echo_hash(env_text):
    for raw in env_text.splitlines():
        line=raw.strip()
        if line.startswith('export '): line=line[len('export '):].strip()
        if line.startswith('ECHO_API_KEY_HASH='):
            return line.split('=',1)[1].strip().strip('"').strip("'")
    return ''
def echo_key_state(etc=ETC):
    key_path=etc/'echo-api-key'; env_path=etc/'sfa.env'
    if not key_path.is_file(): return 'missing', '/etc/sfa/echo-api-key'
    if not env_path.is_file(): return 'missing', '/etc/sfa/sfa.env'
    try: key=key_path.read_text(); env=env_path.read_text()
    except OSError: return 'missing', '/etc/sfa/sfa.env'
    return ('ok' if stored_echo_hash(env)==echo_key_hash(key) else 'mismatch'), ''
def write_echo_hash(etc, key_text):
    env_path=etc/'sfa.env'
    digest=echo_key_hash(key_text)
    lines=[]; found=False
    for raw in env_path.read_text().splitlines():
        if raw.strip().startswith('ECHO_API_KEY_HASH=') or raw.strip().startswith('export ECHO_API_KEY_HASH='):
            lines.append('ECHO_API_KEY_HASH='+json.dumps(digest)); found=True
        else: lines.append(raw)
    if not found: lines.append('ECHO_API_KEY_HASH='+json.dumps(digest))
    tmp=env_path.with_name(env_path.name+'.new')
    tmp.write_text('\n'.join(lines)+'\n'); os.chmod(tmp, 0o600); os.replace(tmp, env_path); os.chmod(env_path, 0o600)
def setup_required(missing):
    print('run install.sh to finish setup (missing %s)'%missing, file=__import__('sys').stderr)
    raise SystemExit(1)
def load_config():
    env=Path('/etc/sfa/sfa.env')
    if not env.is_file(): setup_required('/etc/sfa/sfa.env')
    try: return Config.env()
    except KeyError as exc: setup_required(exc.args[0] if exc.args else '/etc/sfa/sfa.env')
    except OSError: setup_required('/etc/sfa/sfa.env')
def main():
    p=argparse.ArgumentParser(prog='sfa'); sp=p.add_subparsers(dest='command',required=True)
    sp.add_parser('migrate'); sp.add_parser('status'); sp.add_parser('backup-now'); sp.add_parser('show-echo-key'); sp.add_parser('check-echo-key'); sp.add_parser('rotate-echo-key')
    x=sp.add_parser('invite'); x.add_argument('--days',type=int,default=30); x.add_argument('--max-uses',type=int,default=100)
    for name in ('make-admin','reset-password'):
        sp.add_parser(name).add_argument('email')
    x=sp.add_parser('override'); x.add_argument('decisionId'); x.add_argument('--reason',required=True)
    sp.add_parser('import-legacy').add_argument('path')
    x=sp.add_parser('adopt-legacy'); x.add_argument('studentId'); x.add_argument('email')
    a=p.parse_args()
    if a.command in ('show-echo-key','check-echo-key','rotate-echo-key'):
        require(os.geteuid()==0,'Run sudo sfa '+a.command+' only in a private terminal; never paste into chat/logs.')
        state, missing=echo_key_state()
        if a.command=='check-echo-key':
            if state=='missing': setup_required(missing)
            print(state); raise SystemExit(0 if state=='ok' else 1)
        if a.command=='rotate-echo-key':
            if not (ETC/'sfa.env').is_file(): setup_required('/etc/sfa/sfa.env')
            fresh=secrets.token_urlsafe(48)
            key_path=ETC/'echo-api-key'; tmp=key_path.with_name('echo-api-key.new')
            tmp.write_text(fresh+'\n'); os.chmod(tmp, 0o600); os.replace(tmp, key_path); os.chmod(key_path, 0o600)
            write_echo_hash(ETC, fresh)
            restarted=subprocess.run(['systemctl','restart','sfa-api'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            if restarted.returncode: setup_required('sfa-api restart after rotate-echo-key')
            print('rotated'); return
        if state=='missing': setup_required(missing)
        print(state, file=__import__('sys').stderr)
        print((ETC/'echo-api-key').read_text().strip()); return
    if a.command=='backup-now': subprocess.run(['/opt/sfa/backup.sh'],check=True); return
    s=Service(load_config())
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
