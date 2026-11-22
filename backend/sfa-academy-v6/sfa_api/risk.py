"""Deterministic final-plan gate over Echo's evidence-backed, same-currency totals.
Missing inputs are pending, never guessed. Narrative interpretation still belongs to reviewers.
Limits come from content/v3/rules.json. The shipped defaults match the old 1% / hard stop / 1:2 gate.
"""
from decimal import Decimal,InvalidOperation,localcontext
from .academy_rules import effective_rules
from .contracts import require
from .paper_fields import classify_stop

_REQUIRED={'currentEquity','riskAmount','netReward','stopType','evidenceRefs'}
_OPTIONAL={'stopMoved'}

def _stop_blocks(stop_type, rules):
    kind=classify_stop(stop_type)
    if kind=='HARD_STRUCTURAL': return False
    if kind=='MENTAL':
        return rules['stopBlockMode']=='MENTAL_OR_NONE' and rules['mentalStopIsHardBlock']
    return rules['stopRequirement'] in ('HARD_STRUCTURAL','REGISTERED_STOP')

def hard_block(e, level=None, rules=None):
    require(isinstance(e,dict) and _REQUIRED<=set(e)<=_REQUIRED|_OPTIONAL,'RISK_EVIDENCE_REQUIRED_PENDING')
    rules=rules or effective_rules(level)
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
        max_pct=Decimal(rules['maxRiskPctPerTrade'])
        min_rr=Decimal(rules['minNetRR'])
        blocked=_stop_blocks(e['stopType'], rules) or risk*100>equity*max_pct or reward<risk*min_rr
        minimum=rules.get('minRiskPctPerTrade')
        if minimum: blocked=blocked or risk*100<equity*Decimal(minimum)
        if e.get('stopMoved')=='unplanned' and rules['unplannedStopMoveIsHardBlock']: blocked=True
        if e.get('stopMoved')=='planned' and not rules.get('plannedStopMoveAllowed', True): blocked=True
        return blocked
