"""Bounded streaming originals. File names are metadata, never filesystem paths."""
import hashlib, os, zipfile
from pathlib import Path
try:
    import magic
except ImportError:  # tests/minimal environments; production installer includes libmagic
    magic=None
from .contracts import require, Invalid
MAX_BYTES=20*1024*1024
ALLOWED={'.pdf':{'application/pdf'},'.png':{'image/png'},'.jpg':{'image/jpeg'},'.jpeg':{'image/jpeg'},'.txt':{'text/plain'},'.md':{'text/plain'},'.docx':{'application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document'}}

def check_file(path,name):
    ext=Path(name).suffix.lower(); require(ext in ALLOWED,'FILE_TYPE_REJECTED')
    with path.open('rb') as f: head=f.read(16)
    if magic is not None: mime=magic.from_file(str(path),mime=True)
    elif head.startswith(b'%PDF-'): mime='application/pdf'
    elif head.startswith(b'\x89PNG\r\n\x1a\n'): mime='image/png'
    elif head.startswith(b'\xff\xd8\xff'): mime='image/jpeg'
    elif head.startswith(b'PK\x03\x04'): mime='application/zip'
    else:
        try:
            sample=path.read_text('utf-8'); mime='text/plain' if sample and all(c.isprintable() or c in '\n\r\t' for c in sample) else 'application/octet-stream'
        except UnicodeError: mime='application/octet-stream'
    require(mime in ALLOWED[ext],'FILE_MAGIC_REJECTED')
    if ext=='.pdf': require(head.startswith(b'%PDF-'),'FILE_MAGIC_REJECTED')
    if ext=='.png': require(head.startswith(b'\x89PNG\r\n\x1a\n'),'FILE_MAGIC_REJECTED')
    if ext in ('.jpg','.jpeg'): require(head.startswith(b'\xff\xd8\xff'),'FILE_MAGIC_REJECTED')
    if ext in ('.txt','.md'):
        try: text=path.read_text('utf-8')
        except UnicodeError: raise Invalid('TEXT_MUST_BE_UTF8')
        require('\x00' not in text,'TEXT_MUST_BE_UTF8')
    if ext=='.docx':
        try:
            with zipfile.ZipFile(path) as z:
                require({'[Content_Types].xml','word/document.xml'}<=set(z.namelist()),'DOCX_REQUIRED')
                require(len(z.infolist())<=3000 and sum(i.file_size for i in z.infolist())<=100*1024*1024,'ZIP_EXPANSION_REJECTED')
                require(not any('vbaProject' in i.filename or i.flag_bits&1 for i in z.infolist()),'DOCX_MACROS_ENCRYPTION_REJECTED')
        except zipfile.BadZipFile: raise Invalid('DOCX_REQUIRED')
    return mime

def store(stream,folder,file_id,name):
    require(isinstance(name,str) and 0<len(name)<=240 and '/' not in name and '\\' not in name,'INVALID_FILENAME')
    folder.mkdir(parents=True,exist_ok=True,mode=0o700); path=folder/file_id
    h=hashlib.sha256(); size=0
    try:
        with path.open('xb') as f:
            os.chmod(path,0o600)
            while chunk:=stream.read(64*1024):
                size+=len(chunk); require(size<=MAX_BYTES,'FILE_TOO_LARGE'); h.update(chunk); f.write(chunk)
        require(size>0,'EMPTY_FILE'); mime=check_file(path,name)
        return {'path':str(path),'digest':h.hexdigest(),'name':name,'size':size,'mime':mime}
    except BaseException:
        path.unlink(missing_ok=True); raise
