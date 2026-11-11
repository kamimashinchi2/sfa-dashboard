"""Deterministic final-plan gate over Echo's evidence-backed, same-currency totals.
Missing inputs are pending, never guessed. Narrative interpretation still belongs to reviewers.
"""
from decimal import Decimal,InvalidOperation,localcontext
from .contracts import require

def hard_block(e):
    require(isinstance(e,dict) and set(e)=={'currentEquity','riskAmount','netReward','stopType','evidenceRefs'},'RISK_EVIDENCE_REQUIRED_PENDING')
    values=[]
    for k in ('currentEquity','riskAmount','netReward'):
        require(isinstance(e[k],str) and len(e[k])<=60,'RISK_DECIMAL_STRINGS_REQUIRED')
        try: n=Decimal(e[k])
        except InvalidOperation: n=Decimal('NaN')
        require(n.is_finite() and n>=0 and (n==0 or -18<=n.adjusted()<=24),'RISK_INPUT_UNVERIFIED_PENDING'); values.append(n)
    equity,risk,reward=values; require(equity>0 and risk>0,'RISK_INPUT_UNVERIFIED_PENDING')
    require(e['stopType'] in ('STRUCTURAL_HARD','MENTAL','NONE'),'STOP_EVIDENCE_REQUIRED_PENDING')
    require(isinstance(e['evidenceRefs'],list) and 1<=len(e['evidenceRefs'])<=20 and all(isinstance(r,str) and 1<=len(r)<=300 for r in e['evidenceRefs']),'RISK_EVIDENCE_REFS_REQUIRED')
    with localcontext() as ctx:
        ctx.prec=120
        return e['stopType']!='STRUCTURAL_HARD' or risk*100>equity or reward<risk*2
