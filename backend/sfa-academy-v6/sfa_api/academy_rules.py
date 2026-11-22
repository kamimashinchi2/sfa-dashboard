"""Per-level risk bounds from content/v3/rules.json.

Numeric fields and the stop flags are enforced. Situations are copied into the
Echo packet and are not scored. The shipped file is Kamyar's approved gate.
shared/legacy-rules.json keeps the previous 1% / mental-stop behaviour for vectors.
"""
import json
import os
from pathlib import Path

LEVEL_BY_STAGE = {0: 'L00', 1: 'L01', 2: 'L02', 3: 'L03', 4: 'L04', 5: 'L05', 6: 'L06', 7: 'L07', 8: 'L08'}
_NUMERIC = (
    'maxRiskPctPerTrade', 'minRiskPctPerTrade', 'stopRequirement', 'mentalStopIsHardBlock', 'minNetRR',
    'stopBlockMode', 'unplannedStopMoveIsHardBlock', 'plannedStopMoveAllowed', 'dailyLossCapPct',
)
_PASSTHROUGH = ('dailyActiveRiskCap', 'weeklyCompliancePause')


def _pick(row, defaults, key, fallback=None):
    if key in row:
        return row[key]
    if key in defaults:
        return defaults[key]
    return fallback


def rules_path():
    env = os.environ.get('SFA_RULES_PATH')
    if env:
        return Path(env)
    candidates = [
        Path(__file__).resolve().parents[3] / 'content' / 'v3' / 'rules.json',
        Path('/etc/sfa/rules.json'),
    ]
    for path in candidates:
        if path.is_file():
            return path
    raise FileNotFoundError('content/v3/rules.json')


def load_rules(path=None):
    return json.loads(Path(path or rules_path()).read_text())


def level_for_stage(stage):
    try:
        stage = int(stage)
    except (TypeError, ValueError):
        return None
    return LEVEL_BY_STAGE.get(stage)


def effective_rules(level=None, document=None):
    doc = document or load_rules()
    defaults = doc['defaults']
    row = {}
    if level and isinstance(doc.get('levels'), dict):
        row = doc['levels'].get(level) or {}
    mode = _pick(row, defaults, 'stopBlockMode', 'MENTAL_OR_NONE') or 'MENTAL_OR_NONE'
    mental = _pick(row, defaults, 'mentalStopIsHardBlock', True)
    move = _pick(row, defaults, 'unplannedStopMoveIsHardBlock', False)
    planned = _pick(row, defaults, 'plannedStopMoveAllowed', True)
    return {
        'level': level,
        'maxRiskPctPerTrade': _pick(row, defaults, 'maxRiskPctPerTrade', '1.00'),
        'minRiskPctPerTrade': _pick(row, defaults, 'minRiskPctPerTrade', None),
        'stopRequirement': _pick(row, defaults, 'stopRequirement', 'REGISTERED_STOP'),
        'mentalStopIsHardBlock': bool(mental),
        'minNetRR': _pick(row, defaults, 'minNetRR', '2.00'),
        'stopBlockMode': mode,
        'unplannedStopMoveIsHardBlock': bool(move),
        'plannedStopMoveAllowed': bool(planned) if planned is not None else True,
        'dailyLossCapPct': _pick(row, defaults, 'dailyLossCapPct', None),
        'situations': row.get('situations') or [],
        'dailyActiveRiskCap': row.get('dailyActiveRiskCap'),
        'weeklyCompliancePause': row.get('weeklyCompliancePause'),
    }


def rules_for_stage(stage, document=None):
    level = level_for_stage(stage)
    rules = effective_rules(level, document)
    doc = document or load_rules()
    row = {}
    if level and isinstance(doc.get('levels'), dict):
        row = doc['levels'].get(level) or {}
    packet = {
        'level': level,
        'effective': {key: rules[key] for key in _NUMERIC},
        'situations': rules['situations'],
    }
    for key in _PASSTHROUGH:
        if key in row:
            packet[key] = row[key]
    return packet
