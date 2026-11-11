import hashlib, hmac, time, re
from .contracts import Invalid

def token_hash(s):
    return hashlib.sha256(s.encode()).hexdigest()

def sign(secret, timestamp, method, path, body, nonce):
    # UTF-8 timestamp + nonce + METHOD + path (newline separated), then exact body bytes.
    prefix=f'{timestamp}\n{nonce}\n{method.upper()}\n{path}\n'.encode()
    return 'sha256='+hmac.new(secret.encode(),prefix+body,hashlib.sha256).hexdigest()

def verify(secret, headers, method, path, body, window=300, now=None):
    t=headers.get('X-SFA-Timestamp','')
    try: stamp=int(t)
    except (ValueError,TypeError): raise Invalid('Invalid timestamp header')
    if abs((time.time() if now is None else now)-stamp)>window: raise Invalid('Expired signature')
    nonce=headers.get('X-SFA-Nonce','')
    if not re.fullmatch(r'[A-Za-z0-9_-]{16,100}',nonce): raise Invalid('Invalid nonce')
    if not hmac.compare_digest(sign(secret,t,method,path,body,nonce), headers.get('X-SFA-Signature','')):
        raise Invalid('Invalid signature')
