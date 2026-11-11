"""Unit-state harness uses SQLite only in tests; production is PostgreSQL-only.
PostgreSQL integration fixture starts a real temporary cluster when pg_ctl exists.
"""
import contextlib,json,os,shutil,socket,sqlite3,subprocess,tempfile
from pathlib import Path
import pytest
from sfa_api.config import Config
from sfa_api.service import Service
from sfa_api.db import DB

class Cursor:
    def __init__(self,c): self.c=c; self.rowcount=c.rowcount
    def fetchone(self):
        r=self.c.fetchone(); return dict(r) if r else None
    def fetchall(self): return list(self)
    def __iter__(self): return (dict(r) for r in self.c)
class TestConnection:
    __test__=False
    def __init__(self,c): self.c=c
    def execute(self,sql,args=()):
        if "nextval('student_number')" in sql: sql="SELECT COALESCE(MAX(CAST(SUBSTR(student,2) AS INTEGER)),9999)+1 AS n FROM students"
        return Cursor(self.c.execute(sql,args))
class StateHarness:
    """SQL transport mock for portable unit tests, NOT a PostgreSQL integration test."""
    def __init__(self,path):
        self.path=path
        schema=Path(__file__).parents[1].joinpath('sfa_api/migration_001.sql').read_text().replace('ADD COLUMN IF NOT EXISTS','ADD COLUMN').replace('ADD COLUMN email TEXT UNIQUE','ADD COLUMN email TEXT')
        schema='\n'.join(l for l in schema.splitlines() if 'CREATE SEQUENCE' not in l)
        with sqlite3.connect(path) as c: c.executescript(schema)
    @contextlib.contextmanager
    def tx(self):
        with sqlite3.connect(self.path) as c:
            c.row_factory=sqlite3.Row; yield TestConnection(c)
    def rows(self,sql,args=()):
        with self.tx() as c: return list(c.execute(sql,args))
    rate=DB.rate
@pytest.fixture
def cfg(tmp_path):
    return Config('unit-transport','a'*64,__import__('hashlib').sha256(b'e'*48).hexdigest(),root=tmp_path,answer_key_path=str(tmp_path/'keys'))
@pytest.fixture
def svc(cfg,tmp_path):
    s=Service.__new__(Service); s.config=cfg; s.db=StateHarness(tmp_path/'state-unit.sqlite'); return s
@pytest.fixture
def account(svc):
    token=svc.invite().rsplit('/',1)[1]
    session=svc.signup({'inviteToken':token,'email':'student@example.test','displayName':'Learner','password':'correct horse battery staple','acceptDataNotice':True})
    return svc.auth(session),session

@pytest.fixture(scope='session')
def pg_url(tmp_path_factory):
    # Explicit external test DB allowed; never use production configuration.
    if os.getenv('SFA_TEST_DATABASE_URL'): yield os.environ['SFA_TEST_DATABASE_URL']; return
    paths=[Path('/usr/lib/postgresql')/v/'bin' for v in ('18','17','16','15','14')]
    pg=next((p for p in paths if (p/'pg_ctl').is_file()),None)
    if not pg and shutil.which('pg_ctl'): pg=Path(shutil.which('pg_ctl')).parent
    if not pg: pytest.skip('DB integration skipped: pg_ctl/initdb absent. Install PostgreSQL server or set SFA_TEST_DATABASE_URL to a disposable DB.')
    if os.geteuid()==0: pytest.skip('DB integration skipped: initdb cannot run as root; run pytest as an unprivileged user.')
    root=tmp_path_factory.mktemp('postgres'); data=root/'data'
    with socket.socket() as sock: sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
    # UTF-8: --no-locale alone creates SQL_ASCII, and psycopg then returns text as bytes.
    subprocess.run([str(pg/'initdb'),'-D',str(data),'-A','trust','-U','postgres','--locale=C','--encoding=UTF8'],check=True,stdout=subprocess.DEVNULL)
    subprocess.run([str(pg/'pg_ctl'),'-D',str(data),'-l',str(root/'log'),'-o',f'-h 127.0.0.1 -p {port}','-w','start'],check=True,stdout=subprocess.DEVNULL)
    try: yield f'postgresql://postgres@127.0.0.1:{port}/postgres'
    finally: subprocess.run([str(pg/'pg_ctl'),'-D',str(data),'-m','immediate','-w','stop'],check=True,stdout=subprocess.DEVNULL)

@pytest.fixture
def bank(cfg):
    from .vectors import key
    p=Path(cfg.answer_key_path);p.mkdir();(p/'synthetic.json').write_text(json.dumps(key()));return p
