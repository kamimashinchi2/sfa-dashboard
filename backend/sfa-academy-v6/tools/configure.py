#!/usr/bin/env python3
"""Root-only install helpers. Never print configuration values or child errors."""
import argparse,hashlib,json,os,pwd,re,secrets,shlex,shutil,subprocess,time
from pathlib import Path
from dotenv import dotenv_values
P=Path('/etc/sfa'); STATE=P/'install-state.json'
SFA_ENV_KEYS=('SFA_BRIDGE_URL','SFA_SITE_ORIGIN','SFA_BRIDGE_SECRET','SFA_ALLOW_INSECURE_PILOT','SFA_ALLOW_CONTENT_BYPASS')
def safe_write(path,data,uid=0,gid=0,mode=0o600):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_name(path.name+'.new'); temp.write_text(data); os.chmod(temp,mode)
    try: os.chown(temp,uid,gid)
    except PermissionError: pass
    # Replace even if chown failed, or the final name is missing and only *.new remains.
    os.replace(temp,path)
    os.chmod(path,mode)
def discover(app_dir):
    previous=json.loads(STATE.read_text()) if STATE.exists() else {}
    for u in pwd.getpwall():
        home=Path(u.pw_dir)
        if not (home/'.pm2/pm2.pid').is_file(): continue
        candidates=[Path('/usr/bin/pm2'),Path('/usr/local/bin/pm2')]+list((home/'.nvm/versions/node').glob('*/bin/pm2'))
        for binary in candidates:
            if not binary.exists(): continue
            envpath=str(binary.parent)+':/usr/local/bin:/usr/bin:/bin'
            cmd=['runuser','-u',u.pw_name,'--','env','PM2_HOME='+str(home/'.pm2'),'PATH='+envpath,str(binary)]
            try: procs=json.loads(subprocess.run(cmd+['jlist'],capture_output=True,text=True,check=True,timeout=20).stdout)
            except Exception: continue
            app=next((p for p in procs if p['name']=='sfa-dashboard'),None)
            if not app: continue
            cwd=Path(app_dir or app['pm2_env']['pm_cwd']).resolve()
            if not (cwd/'package.json').is_file(): raise ValueError('No Next checkout')
            legacy=[]; old=[]
            for process in procs:
                e=process.get('pm2_env',{}); pcwd=e.get('pm_cwd',''); script=e.get('pm_exec_path',''); name=process.get('name','')
                if name=='sfa-dashboard': continue
                # Only identified academy bridge scripts, not unrelated PM2 apps.
                if ('sfa' in name.lower() or 'sfa_bridge' in pcwd or 'sfa-bridge' in pcwd) and Path(script).name in ('app.py','bot_worker.py','gunicorn','python','python3'):
                    old.append(process['pm_id']); legacy.append(pcwd)
            state={'user':u.pw_name,'uid':u.pw_uid,'gid':u.pw_gid,'home':str(home),'pm2':str(binary),'path':envpath,'app':str(cwd),'legacy':list(dict.fromkeys(legacy+previous.get('legacy',[]))),'old_pm2':old}
            safe_write(STATE,json.dumps(state)); return
    raise ValueError('Cannot discover PM2 sfa-dashboard; run PM2 as the normal application user first')
def ensure_echo_key(directory=None, chown_root=True):
    """Create /etc/sfa/echo-api-key mode 0600 root:root. A rerun keeps the existing key.
    Written and fsynced before later steps so a failure after this point cannot
    leave only a temporary name. The EXIT trap in install.sh removes the answer-key
    temp file only, never this key. umask 077 is already compatible with mode 0600;
    chmod is repeated after replace because some filesystems do not keep the temp mode.
    """
    directory=Path(directory or P)
    directory.mkdir(parents=True, exist_ok=True)
    try: os.chmod(directory, 0o750)
    except PermissionError: pass
    path=directory/'echo-api-key'
    existing=''
    if path.is_file():
        try: existing=path.read_text().strip()
        except OSError: existing=''
    key=existing or secrets.token_urlsafe(48)
    safe_write(path, key+'\n', 0, 0, 0o600)
    fd=os.open(path, os.O_RDWR)
    try: os.fsync(fd)
    finally: os.close(fd)
    try:
        dirfd=os.open(directory, os.O_RDONLY)
        try: os.fsync(dirfd)
        finally: os.close(dirfd)
    except OSError: pass
    if chown_root:
        try: os.chown(path, 0, 0)
        except PermissionError: pass
    os.chmod(path, 0o600)
    written=path.read_text().strip()
    if not written: raise RuntimeError('echo-api-key was not created')
    return written
def configure(domain):
    # Key first: a PostgreSQL or later failure must not skip creating it, and a rerun must not rotate it.
    key=ensure_echo_key(P)
    state=json.loads(STATE.read_text()); user=pwd.getpwnam('sfa'); app=Path(state['app']); envfile=P/'sfa.env'; env=dict(dotenv_values(envfile)) if envfile.exists() else {}
    # Preserve only explicitly named bridge settings; never copy personal Google credentials.
    candidates=[Path(p)/'.env' for p in state['legacy']]+[app/'.env',app/'.env.local',Path('/opt/sfa-bridge/.env'),Path('/opt/sfa_bridge/.env'),Path(state['home'])/'sfa_bridge/.env',Path(state['home'])/'sfa-bridge/.env']
    oldenv={}
    for p in candidates:
        if p.is_file():
            v=dotenv_values(p)
            for key in ('TELEGRAM_BOT_TOKEN','ADMIN_CHAT_ID','ANSWER_KEY_PATH','QUIZ_ANSWER_KEY_PATH','DATA_DIR','BRIDGE_DATA_DIR'):
                if v.get(key):
                    value=v[key]
                    if key in ('ANSWER_KEY_PATH','QUIZ_ANSWER_KEY_PATH','DATA_DIR','BRIDGE_DATA_DIR') and not Path(value).is_absolute(): value=str((p.parent/value).resolve())
                    oldenv.setdefault(key,value)
    pending=P/'database-password.pending'
    dbpass=env.get('SFA_DB_PASSWORD') or (pending.read_text().strip() if pending.exists() else secrets.token_hex(32))
    # No SQL/secret on command line; child output remains captured, not installer log.
    sql=f"SELECT 1 FROM pg_roles WHERE rolname='sfa';"
    def psql(sql):
        r=subprocess.run(['runuser','-u','postgres','--','psql','-v','ON_ERROR_STOP=1','-tAc',sql] if 'PASSWORD' not in sql else ['runuser','-u','postgres','--','psql','-v','ON_ERROR_STOP=1'],input=sql if 'PASSWORD' in sql else None,capture_output=True,text=True)
        if r.returncode: raise ValueError('PostgreSQL provisioning failed; inspect service, not secret SQL')
        return r.stdout.strip()
    exists=psql(sql)=='1'
    if exists and not env.get('SFA_DB_PASSWORD') and not pending.exists(): raise ValueError('Reserved sfa role already exists without managed credentials; refusing password overwrite')
    if not exists:
        safe_write(pending,dbpass+'\n'); psql('CREATE ROLE sfa LOGIN;')
    psql("ALTER ROLE sfa WITH LOGIN PASSWORD '"+dbpass+"';")
    if psql("SELECT 1 FROM pg_database WHERE datname='sfa';")!='1': psql('CREATE DATABASE sfa OWNER sfa;')
    elif psql("SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='sfa';")!='sfa': raise ValueError('Existing database is not academy-owned')
    env.update({'SFA_DB_PASSWORD':dbpass,'DATABASE_URL':'postgresql://sfa:'+dbpass+'@127.0.0.1/sfa','SFA_BRIDGE_SECRET':env.get('SFA_BRIDGE_SECRET') or secrets.token_hex(32),'SESSION_SECRET':env.get('SESSION_SECRET') or secrets.token_hex(32),'ECHO_API_KEY_HASH':hashlib.sha256(key.encode()).hexdigest(),'SFA_SITE_ORIGIN':'https://'+domain,'SFA_DATA_DIR':'/var/lib/sfa','ANSWER_KEY_PATH':'/etc/sfa/answer-keys','APPROVAL_REQUIRED':env.get('APPROVAL_REQUIRED','false'),'TELEGRAM_BOT_TOKEN':env.get('TELEGRAM_BOT_TOKEN') or oldenv.get('TELEGRAM_BOT_TOKEN',''),'ADMIN_CHAT_ID':env.get('ADMIN_CHAT_ID') or oldenv.get('ADMIN_CHAT_ID','0'),'TELEGRAM_BOT_USERNAME':env.get('TELEGRAM_BOT_USERNAME','')})
    safe_write(envfile,'\n'.join(k+'='+json.dumps(str(v or '')) for k,v in env.items())+'\n',user.pw_uid,user.pw_gid)
    pending.unlink(missing_ok=True)
    # Merge Next env without parsing arbitrary shell syntax; strip obsolete security escape hatches.
    f=app/'.env.local'; original=f.read_text() if f.exists() else ''
    if f.exists(): safe_write(app/('.env.local.pre-sfa6-'+str(time.time_ns())),original,state['uid'],state['gid'])
    replacements={'SFA_BRIDGE_URL':'http://127.0.0.1:8081','SFA_BRIDGE_SECRET':env['SFA_BRIDGE_SECRET'],'SFA_SITE_ORIGIN':'https://'+domain,'HOSTNAME':'127.0.0.1'}
    retired={'SFA_ALLOW_INSECURE_PILOT','SFA_ALLOW_INSECURE_COOKIE','SFA_ALLOW_CONTENT_BYPASS'}
    lines=[line for line in original.splitlines() if line.split('=',1)[0].strip().removeprefix('export ') not in set(replacements)|retired]
    lines += [k+'='+json.dumps(v) for k,v in replacements.items()]
    safe_write(f,'\n'.join(lines)+'\n',state['uid'],state['gid'])
    # Copy pre-existing keys by file, not symlinking outside protected directory.
    keys=P/'answer-keys'; keys.mkdir(exist_ok=True); os.chmod(keys,0o750); os.chown(keys,0,user.pw_gid)
    for k in ('ANSWER_KEY_PATH','QUIZ_ANSWER_KEY_PATH'):
        old=Path(oldenv[k]) if oldenv.get(k) else None
        if old and old.exists():
            for source in old.glob('*.json') if old.is_dir() else [old]:
                try: data=json.loads(source.read_text())
                except Exception: continue
                if data.get('format')=='sfa-answer-key' and data.get('commit'):
                    import re
                    if re.fullmatch('[0-9a-f]{7,40}',data['commit']): safe_write(keys/(data['commit']+'.json'),json.dumps(data),0,user.pw_gid,0o640)
    state['legacy_data']=[]
    for root in state['legacy']+[oldenv.get('DATA_DIR',''),oldenv.get('BRIDGE_DATA_DIR','')]:
        if not root: continue
        root=Path(root)
        for p in (root,root/'data',root/'state'):
            if (p/'bridge.sqlite3').is_file() and str(p) not in state['legacy_data']: state['legacy_data'].append(str(p))
    safe_write(STATE,json.dumps(state))
def redact(text):
    text=re.sub(r'(?i)\b([A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|KEY|AUTHORIZATION)[A-Z0-9_]*)=[^\s]+', r'\1=***', text or '')
    text=re.sub(r'(?i)(Bearer\s+)[A-Za-z0-9._\-]{8,}', r'\1***', text)
    text=re.sub(r'[A-Za-z0-9+/_\-]{32,}', '***', text)
    return text
def pm2_candidates(home, which='', npm_prefix=''):
    """Ordered search: login `command -v pm2`, distro paths, npm prefix, then nvm."""
    found=[]
    def add(raw):
        if not raw: return
        path=Path(str(raw).strip())
        if path.is_file() and path not in found: found.append(path)
    add(which)
    add('/usr/local/bin/pm2')
    add('/usr/bin/pm2')
    if npm_prefix:
        add(Path(npm_prefix)/'bin'/'pm2')
        add(Path(npm_prefix)/'pm2')
    root=Path(home)/'.nvm'/'versions'/'node'
    if root.is_dir():
        for path in sorted(root.glob('*/bin/pm2')): add(path)
    return found
def node_tuple(text):
    text=(text or '').strip().lstrip('v').split()[0] if (text or '').strip() else ''
    parts=[]
    for piece in text.split('.'):
        if not piece.isdigit(): break
        parts.append(int(piece))
    while len(parts)<3: parts.append(0)
    return tuple(parts[:3])
def choose_pm2(candidates, versions):
    """Prefer a pm2 whose adjacent node is 22.6 or newer. versions maps path->'22.14.0'."""
    best=None; best_ver=(-1,-1,-1)
    for path in candidates:
        ver=node_tuple(versions.get(str(path), ''))
        if ver>=(22,6,0) and ver>=best_ver:
            best, best_ver=path, ver
    return best or (candidates[0] if candidates else None)
def pm2_process_env(state, sfa_env):
    """Minimal environment for the PM2 user. Never copy the caller's environment.
    SFA_BRIDGE_SECRET is included here so PM2 --update-env can see it, but the
    argv uses a mode-0600 env file instead of putting that value on the command line.
    """
    env={
        'HOME':state['home'],
        'USER':state['user'],
        'LOGNAME':state['user'],
        'PATH':state['path'],
        'PM2_HOME':state['home']+'/.pm2',
        'SFA_BRIDGE_URL':str(sfa_env.get('SFA_BRIDGE_URL') or 'http://127.0.0.1:8081'),
        'SFA_SITE_ORIGIN':str(sfa_env.get('SFA_SITE_ORIGIN') or ''),
        'SFA_BRIDGE_SECRET':str(sfa_env.get('SFA_BRIDGE_SECRET') or ''),
        'SFA_ALLOW_INSECURE_PILOT':'0',
        'SFA_ALLOW_CONTENT_BYPASS':'0',
    }
    return env
def write_pm2_env_file(state, proc_env):
    # Readable only by the app owner. Keeps the bridge secret out of argv and out of root's environ.
    path=Path(state['home'])/'.sfa'/'pm2.env'
    lines=[key+'='+shlex.quote(proc_env[key]) for key in ('SFA_BRIDGE_URL','SFA_SITE_ORIGIN','SFA_BRIDGE_SECRET','SFA_ALLOW_INSECURE_PILOT','SFA_ALLOW_CONTENT_BYPASS')]
    safe_write(path, '\n'.join(lines)+'\n', int(state['uid']), int(state['gid']), 0o600)
    return path
def runuser_argv(state, envfile, pm2_args):
    """runuser without --preserve-environment. Identity vars go through env(1); secrets stay in envfile."""
    ident=['HOME='+state['home'],'USER='+state['user'],'LOGNAME='+state['user'],'PATH='+state['path'],'PM2_HOME='+state['home']+'/.pm2']
    # $1 env file, $2 app dir, $3 pm2 binary, ${@:4} pm2 arguments. Secrets stay in the file.
    script='set -a; . "$1"; set +a; cd "$2" && exec "$3" "${@:4}"'
    return ['runuser','-u',state['user'],'--','env',*ident,'bash','-c',script,'_',str(envfile),state['app'],state['pm2'],*pm2_args]
def pm2_failure(action, result):
    err=redact((result.stderr or '')+'\n'+(result.stdout or ''))
    lines=[line.strip() for line in err.splitlines() if line.strip()][-4:]
    detail=' | '.join(lines) if lines else 'no stderr'
    return 'pm2 %s failed (exit %s): %s'%(action, result.returncode, detail)
def refresh_pm2(state, which='', npm_prefix='', versions=None):
    versions=versions or {}
    bins=pm2_candidates(state['home'], which, npm_prefix)
    chosen=choose_pm2(bins, versions)
    if chosen is None: raise RuntimeError('pm2 was not found for user %s'%state['user'])
    state['pm2']=str(chosen)
    state['path']=str(chosen.parent)+':/usr/local/bin:/usr/bin:/bin'
    safe_write(STATE, json.dumps(state))
    return state
class HelperFail(Exception):
    pass
def _run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, env={'PATH':'/usr/sbin:/usr/bin:/bin','LANG':'C'})
def discover_pm2_runtime(state):
    user=state['user']; home=state['home']
    which=_run(['runuser','-u',user,'--','bash','-lc','command -v pm2'])
    which_path=''
    if which.returncode==0 and which.stdout.strip():
        which_path=which.stdout.strip().splitlines()[-1]
    npm=_run(['runuser','-u',user,'--','bash','-lc','npm prefix -g'])
    prefix=npm.stdout.strip().splitlines()[-1] if npm.returncode==0 and npm.stdout.strip() else ''
    bins=pm2_candidates(home, which_path, prefix)
    versions={}
    for binary in bins:
        path=str(binary.parent)+':/usr/local/bin:/usr/bin:/bin'
        probe=_run(['runuser','-u',user,'--','env','PATH='+path, str(binary.parent/'node'), '-p','process.versions.node'])
        if probe.returncode!=0:
            probe=_run(['runuser','-u',user,'--','env','PATH='+path,'node','-p','process.versions.node'])
        versions[str(binary)]=probe.stdout.strip() if probe.returncode==0 else ''
    return refresh_pm2(state, which_path, prefix, versions)
def exec_pm2(state, pm2_args):
    sfa=dict(dotenv_values(P/'sfa.env')) if (P/'sfa.env').is_file() else {}
    proc=pm2_process_env(state, sfa)
    envfile=write_pm2_env_file(state, proc)
    argv=runuser_argv(state, envfile, pm2_args)
    # cwd is the Next app. The child environment is only PATH so root's secrets are not inherited.
    return subprocess.run(argv, cwd=state['app'], env={'PATH':'/usr/sbin:/usr/bin:/bin','LANG':'C'}, capture_output=True, text=True)
def dashboard_listed(state):
    result=exec_pm2(state, ['jlist'])
    if result.returncode!=0: return False
    try: rows=json.loads(result.stdout or '[]')
    except json.JSONDecodeError: return False
    return any(isinstance(row, dict) and row.get('name')=='sfa-dashboard' for row in rows)
def run_pm2(action):
    state=json.loads(STATE.read_text())
    try: state=discover_pm2_runtime(state)
    except RuntimeError as exc:
        raise HelperFail('pm2 %s failed (exit 1): %s'%(action, redact(str(exc)))) from None
    if action=='refresh': return
    if action=='stop-legacy':
        for n in state.get('old_pm2') or []:
            result=exec_pm2(state, ['delete', str(n)])
            if result.returncode: raise HelperFail(pm2_failure('delete '+str(n), result))
        return
    updated=exec_pm2(state, ['update'])
    if dashboard_listed(state):
        result=exec_pm2(state, ['restart','sfa-dashboard','--update-env'])
    else:
        result=exec_pm2(state, ['start','npm','--name','sfa-dashboard','--cwd',state['app'],'--','start','--','--hostname','127.0.0.1','--port','3000'])
    if result.returncode:
        extra=' pm2 update exit %s.'%updated.returncode if updated.returncode else ''
        raise HelperFail(pm2_failure('restart', result)+extra)
    saved=exec_pm2(state, ['save'])
    if saved.returncode: raise HelperFail(pm2_failure('save', saved))
def build_parser():
    p=argparse.ArgumentParser()
    p.add_argument('action',choices=['discover','configure','get','pm2'])
    # Optional: install.sh calls `discover "$APP_DIR"` and APP_DIR may be empty.
    p.add_argument('value',nargs='?',default=None)
    return p
if __name__=='__main__':
    a=build_parser().parse_args()
    try:
        if a.action=='discover': discover(a.value or None)
        elif a.action=='configure': configure(a.value)
        elif a.action=='get':
            state=json.loads(STATE.read_text()); value=state[a.value]; print(json.dumps(value) if isinstance(value,list) else value)
        elif a.action=='pm2':
            if a.value not in ('stop-legacy','restart','refresh'): raise ValueError('pm2 action must be stop-legacy, restart, or refresh')
            run_pm2(a.value)
    except HelperFail as exc:
        print(str(exc), file=__import__('sys').stderr); raise SystemExit(1)
    except SystemExit:
        raise
    except Exception:
        print('Install helper failed ('+a.action+'); no secret details logged.',file=__import__('sys').stderr); raise SystemExit(1)
