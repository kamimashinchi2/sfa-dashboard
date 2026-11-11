"""One-shot, read-only SQLite -> PostgreSQL migration; originals remain backed up."""
import hashlib,json,shutil,sqlite3
from pathlib import Path
from .contracts import require,identity,ident
from .service import now
TABLES=('students','weeks','sessions','quizzes','events','submissions','files','mentor_decisions','weaknesses')
def import_sqlite(svc,path):
    path=Path(path).resolve()
    if not path.is_file(): return {'imported':False,'reason':'no legacy SQLite'}
    source=str(path.resolve())+':'+hashlib.sha256(path.read_bytes()).hexdigest()
    # Sessions and link codes are deliberately not imported: new account login is required.
    conn=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True); conn.row_factory=sqlite3.Row
    copied=[]
    try:
        with svc.db.tx() as c:
            if c.execute('SELECT 1 FROM legacy_imports WHERE path=?',(str(path.resolve()),)).fetchone(): return {'imported':False,'reason':'already imported'}
            require(not c.execute('SELECT 1 FROM students LIMIT 1').fetchone(),'LEGACY_IMPORT_REQUIRES_EMPTY_DATABASE')
            tables={r['name'] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            for table in TABLES:
                if table in ('sessions',) or table not in tables: continue
                cols={r['column_name'] for r in c.execute('SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=?',(table,))}
                for raw in conn.execute('SELECT * FROM '+table):
                    row={k:raw[k] for k in raw.keys() if k in cols}
                    if table=='students': identity(row['student'],row['alias'])
                    if table=='files':
                        ident(row['id']); ident(row['submission'])
                        original=Path(row['path']).resolve()
                        require(original.is_relative_to(path.parent.resolve()) and original.is_file(),'LEGACY_FILE_OUTSIDE_DATA_ROOT_OR_MISSING')
                        sub=conn.execute('SELECT student FROM submissions WHERE id=?',(row['submission'],)).fetchone(); require(sub is not None,'LEGACY_ORPHAN_FILE')
                        dest=svc.config.root/'uploads'/sub['student']/row['submission']/row['id']; dest.parent.mkdir(parents=True,exist_ok=True,mode=0o700); shutil.copyfile(original,dest); dest.chmod(0o600); copied.append(dest)
                        row['path']=str(dest); row['text_path']=None
                    if table=='mentor_decisions' and row['state']=='SENT': row['state']='DELIVERED'; row['delivered_at']=0
                    c.execute('INSERT INTO '+table+'('+','.join(row)+') VALUES('+','.join('?' for _ in row)+') ON CONFLICT DO NOTHING',tuple(row.values()))
            c.execute("INSERT INTO weeks(student,week,stage,state) SELECT student,current_week,stage,'LESSON_OPEN' FROM students ON CONFLICT DO NOTHING")
            # Sequence avoids collisions with imported IDs.
            highest=max([int(r['student'][1:]) for r in c.execute('SELECT student FROM students')]+[9999])
            c.execute("SELECT setval('student_number',?)",(highest+1,))
            c.execute('INSERT INTO legacy_imports VALUES(?,?)',(str(path.resolve()),now()))
        return {'imported':True,'sourceDigest':hashlib.sha256(source.encode()).hexdigest()}
    except BaseException:
        for p in copied: p.unlink(missing_ok=True)
        raise
    finally: conn.close()
