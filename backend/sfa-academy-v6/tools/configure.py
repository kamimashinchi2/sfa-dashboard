#!/usr/bin/env python3
"""Root-only install helpers. Never print configuration values or child errors."""
import argparse,hashlib,json,os,pwd,secrets,shutil,subprocess,time
from pathlib import Path
from dotenv import dotenv_values
P=Path('/etc/sfa'); STATE=P/'install-state.json'
def safe_write(path,data,uid=0,gid=0,mode=0o600):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_name(path.name+'.new'); temp.write_text(data); os.chmod(temp,mode); os.chown(temp,uid,gid); os.replace(temp,path)
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
def configure(domain):
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
    keypath=P/'echo-api-key'
    key=keypath.read_text().strip() if keypath.exists() else secrets.token_urlsafe(48)
    safe_write(keypath,key+'\n')
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
            state=json.loads(STATE.read_text()); cmd=['runuser','-u',state['user'],'--','env','PM2_HOME='+state['home']+'/.pm2','PATH='+state['path'],'HOSTNAME=127.0.0.1',state['pm2']]
            if a.value=='stop-legacy':
                for n in state['old_pm2']: subprocess.run(cmd+['delete',str(n)],check=True,stdout=subprocess.DEVNULL)
            elif a.value=='restart':
                # ecosystem exported env can override .env.local. Update only these server vars in PM2 explicitly.
                env=dotenv_values(P/'sfa.env'); cmd=cmd[:-1]+['SFA_BRIDGE_URL=http://127.0.0.1:8081','SFA_SITE_ORIGIN='+env['SFA_SITE_ORIGIN'],'SFA_BRIDGE_SECRET='+env['SFA_BRIDGE_SECRET'],'SFA_ALLOW_INSECURE_PILOT=0','SFA_ALLOW_CONTENT_BYPASS=0',state['pm2']]
                # Secret would be visible transiently in argv; instead inject via subprocess env + runuser preserve-environment.
                extras={x.split('=',1)[0]:x.split('=',1)[1] for x in cmd[4:-1] if '=' in x}
                extras.update(HOME=state['home'],USER=state['user'],LOGNAME=state['user'])
                command=['runuser','-u',state['user'],'--preserve-environment','--',state['pm2'],'restart','sfa-dashboard','--update-env']
                r=subprocess.run(command,env={**os.environ,**extras},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
                if r.returncode: raise ValueError('PM2 restart failed')
                subprocess.run(['runuser','-u',state['user'],'--','env','PM2_HOME='+state['home']+'/.pm2','PATH='+state['path'],state['pm2'],'save'],check=True,stdout=subprocess.DEVNULL)
    except Exception:
        print('Install helper failed ('+a.action+'); no secret details logged.',file=__import__('sys').stderr); raise SystemExit(1)
