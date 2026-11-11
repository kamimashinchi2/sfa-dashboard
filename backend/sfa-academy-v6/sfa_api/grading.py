"""Private deterministic recomputation. No LLM call, browser key or prefix matching."""
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path
from .contracts import require

DIGITS=str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩٫٬','01234567890123456789.,')

def verdict(score, approved, partial, hard_block=False):
    if hard_block: return 'NOT_APPROVED'
    return 'APPROVED' if score>=approved else 'PARTIALLY_APPROVED' if score>=partial else 'NOT_APPROVED'

def numeric(value):
    try:
        d=Decimal(str(value).translate(DIGITS).strip().replace(',','').replace(' ',''))
        return d if d.is_finite() else None
    except (InvalidOperation,ValueError): return None

def load_key(path,commit):
    if not path or not commit: return None
    root=Path(path); files=sorted(root.glob('*.json')) if root.is_dir() else [root]
    matches=[]
    for file in files:
        if not file.is_file(): continue
        key=json.loads(file.read_text())
        if key.get('format')=='sfa-answer-key' and key.get('commit')==commit: matches.append(key)
    require(len(matches)<=1,'Ambiguous answer keys for build commit')
    return matches[0] if matches else None

def assess(p,cfg):
    pending=lambda reason: {'status':'UNVERIFIED','reason':reason,'score':None,'verdict':None,'items':[]}
    try: key=load_key(cfg.answer_key_path,p['buildCommit'])
    except (ValueError,OSError,TypeError,AttributeError): return pending('ANSWER_KEY_UNAVAILABLE_OR_INVALID')
    if key is None: return pending('ANSWER_KEY_MISSING')
    bank=key.get('quizzes',{}).get(p['quizId'])
    if not bank: return pending('QUIZ_KEY_MISSING')
    if not isinstance(bank,list) or any(not isinstance(i,dict) or not all(k in i for k in ('itemId','itemHash','kind','answer')) for i in bank): return pending('ANSWER_KEY_INVALID')
    lookup={i['itemId']:i for i in bank}
    if len(lookup)!=len(bank) or set(lookup)!={i['itemId'] for i in p['items']}: return pending('ITEM_SET_MISMATCH')
    rows=[]
    for item in p['items']:
        k=lookup[item['itemId']]
        if k['itemHash']!=item['itemHash'] or k['kind']!=item['kind']: return pending('ITEM_HASH_OR_KIND_DRIFT')
        value=item['studentAnswer']; expected=k['answer']; kind=k['kind']
        if (kind=='mc' and type(expected) is not int) or (kind=='numeric' and numeric(expected) is None) or (kind=='order' and (not isinstance(expected,list) or any(type(v) is not int for v in expected))): return pending('ANSWER_KEY_INVALID')
        if kind=='numeric': correct=numeric(value) is not None and numeric(value)==numeric(expected)
        elif kind=='mc': correct=type(value) is int and value==expected
        else: correct=isinstance(value,list) and value==expected and item['touched']
        rows.append({'itemId':item['itemId'],'itemHash':item['itemHash'],'correct':bool(correct),'studentAnswer':value,'correctAnswer':expected,'topic':k.get('remediationTopic') or item['topic'],'clientMismatch':correct!=item['clientCorrect']})
    correct=sum(i['correct'] for i in rows); total=len(rows); score=int(100*correct/total+0.5)
    return {'status':'RECOMPUTED','correct':correct,'total':total,'score':score,'verdict':verdict(score,cfg.quiz_approved,cfg.quiz_partial),'items':rows,'clientClaims':'UNVERIFIED'}
