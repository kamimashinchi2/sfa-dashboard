"""Optional notifications-only Telegram long poller. No uploads, /submit or /approve.
Ambiguous sends become UNKNOWN, not automatically resent; dashboard delivery is canonical.
"""
import json,time
from datetime import datetime
from zoneinfo import ZoneInfo
import requests
from .config import Config
from .service import Service,now
from .contracts import Invalid

class Bot:
    def __init__(self,cfg): self.cfg=cfg; self.svc=Service(cfg)
    def call(self,method,**data):
        r=requests.post('https://api.telegram.org/bot'+self.cfg.bot_token+'/'+method,json=data,timeout=(5,40)); r.raise_for_status(); p=r.json()
        if not p.get('ok'): raise ValueError('TELEGRAM_REJECTED')
        return p['result']
    def handle(self,update):
        m=update.get('message',{}); chat=m.get('chat',{})
        if chat.get('type')!='private': return
        text=m.get('text',''); tid=chat['id']
        if text.startswith('/start '):
            try:
                self.svc.link(text.split(' ',1)[1].strip(),tid)
                self.call('sendMessage',chat_id=tid,text='Connected. Notifications only; submit work on the dashboard. / متصل شد. تکلیف را در داشبورد ارسال کنید.\n'+self.cfg.origin+'/progress')
            except Invalid:
                self.call('sendMessage',chat_id=tid,text='Link expired or already used. Open the dashboard and tap Telegram again. / پیوند منقضی است؛ از داشبورد دوباره اقدام کنید.')
        elif text.startswith('/start'):
            self.call('sendMessage',chat_id=tid,text='Connect from your academy dashboard. All submissions and grades are on the dashboard. / اتصال و ارسال تکلیف از داشبورد.\n'+self.cfg.origin+'/progress')
    def send_pending(self):
        for row in self.svc.db.rows("SELECT * FROM outbox WHERE state='PENDING' ORDER BY id LIMIT 50"):
            with self.svc.db.tx() as c:
                r=c.execute("UPDATE outbox SET state='SENDING',tries=tries+1 WHERE id=? AND state='PENDING' RETURNING id",(row['id'],)).fetchone()
            if not r: continue
            try:
                self.call('sendMessage',chat_id=row['chat'],text=row['body'][:3900]); state='SENT'
            except Exception: state='UNKNOWN'
            with self.svc.db.tx() as c: c.execute('UPDATE outbox SET state=? WHERE id=?',(state,row['id']))
            time.sleep(.12)
    def summary(self):
        local=datetime.now(ZoneInfo('Europe/Amsterdam')); day=local.date().isoformat()
        if not self.cfg.admin_id or local.hour<21: return
        key='daily-summary:'+day
        with self.svc.db.tx() as c:
            if c.execute('SELECT 1 FROM settings WHERE key=?',(key,)).fetchone(): return
            r=c.execute("SELECT count(*) AS n FROM mentor_decisions WHERE state='DELIVERED' AND delivered_at>?",(now()-86400,)).fetchone()
            c.execute('INSERT INTO settings VALUES(?,?)',(key,'queued'))
            c.execute('INSERT INTO outbox(id,chat,body) VALUES(?,?,?)',(key,self.cfg.admin_id,'SFA daily summary / خلاصه روزانه '+day+' Europe/Amsterdam\nDelivered decisions: '+str(r['n'])+'\n'+self.cfg.origin+'/admin'))
    def run(self):
        if not self.cfg.bot_token: return
        me=self.call('getMe'); username=me['username']
        with self.svc.db.tx() as c:
            c.execute("UPDATE outbox SET state='UNKNOWN' WHERE state='SENDING'")
            c.execute("INSERT INTO settings VALUES('bot_username',?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",(username,))
        offset=int((self.svc.db.rows("SELECT value FROM settings WHERE key='telegram_offset'") or [{'value':'0'}])[0]['value'])
        while True:
            try:
                for update in self.call('getUpdates',offset=offset,timeout=25,allowed_updates=['message']):
                    self.handle(update); offset=update['update_id']+1
                    with self.svc.db.tx() as c: c.execute("INSERT INTO settings VALUES('telegram_offset',?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",(str(offset),))
                self.summary(); self.send_pending()
            except Exception: time.sleep(5) # no raw HTTP exceptions: URLs contain the token
if __name__=='__main__':
    try: Bot(Config.env()).run()
    except Exception:
        print('SFA_BOT_STARTUP_FAILED',file=__import__('sys').stderr); raise SystemExit(1)
