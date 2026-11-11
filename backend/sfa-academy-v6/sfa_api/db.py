"""PostgreSQL only. SQL adapter preserves the independently tested v5 state machine.
Pilot operations serialize with an advisory transaction lock: safe across gunicorn/bot/CLI.
"""
from contextlib import contextmanager
from pathlib import Path
import psycopg
from psycopg.rows import dict_row

class Connection:
    def __init__(self,c): self.c=c
    def execute(self,sql,args=()):
        if sql.startswith('INSERT OR REPLACE INTO weaknesses'):
            sql=sql.replace('INSERT OR REPLACE','INSERT')+' ON CONFLICT(student,id) DO UPDATE SET skill=EXCLUDED.skill,first_week=EXCLUDED.first_week,evidence=EXCLUDED.evidence,status=EXCLUDED.status,last_drilled=EXCLUDED.last_drilled,clean_weeks=EXCLUDED.clean_weeks,last_clean_week=EXCLUDED.last_clean_week'
        elif sql.startswith('INSERT OR IGNORE'):
            sql=sql.replace('INSERT OR IGNORE','INSERT')+' ON CONFLICT DO NOTHING'
        return self.c.execute(sql.replace('?','%s'),args)

class DB:
    def __init__(self,url):
        self.url=url
        with self.tx() as c:
            c.execute('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY)')
            if not c.execute('SELECT 1 FROM schema_migrations WHERE version=1').fetchone():
                c.c.execute(Path(__file__).with_name('migration_001.sql').read_text())
                c.execute('INSERT INTO schema_migrations VALUES(1)')
    @contextmanager
    def tx(self):
        with psycopg.connect(self.url,row_factory=dict_row) as c:
            c.execute('SELECT pg_advisory_xact_lock(82648106)')
            yield Connection(c)
    def rows(self,sql,args=()):
        with self.tx() as c: return list(c.execute(sql,args))
    def rate(self,key,now,limit=30,window=60):
        with self.tx() as c:
            c.execute('DELETE FROM rate WHERE start<?',(now-86400,))
            r=c.execute('SELECT * FROM rate WHERE key=?',(key,)).fetchone()
            start,n=(now,1) if not r or now-r['start']>=window else (r['start'],r['count']+1)
            c.execute('INSERT INTO rate VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET start=EXCLUDED.start,count=EXCLUDED.count',(key,start,n))
            return n<=limit
