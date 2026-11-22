"""Read old free-text paper plans and the new selects the same way."""
import re
from decimal import Decimal, InvalidOperation

def classify_stop(value):
    raw = '' if value is None else str(value).strip()
    if not raw:
        return 'NONE'
    compact = re.sub(r'[\s-]+', '_', raw.upper())
    if compact in ('HARD_STRUCTURAL', 'STRUCTURAL_HARD'):
        return 'HARD_STRUCTURAL'
    if compact == 'MENTAL':
        return 'MENTAL'
    if compact == 'NONE':
        return 'NONE'
    token = re.sub(r'[^a-z]', '', raw.lower())
    if 'mental' in token:
        return 'MENTAL'
    if 'hard' in token or 'structural' in token:
        return 'HARD_STRUCTURAL'
    if token in ('none', 'nostop', 'missing'):
        return 'NONE'
    return 'NONE'


def parse_lenient_decimal(value):
    """'1% (100)' is 1. 'about 2.2' is 2.2. A bare Decimal string still parses."""
    if isinstance(value, Decimal):
        return value if value.is_finite() else None
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            number = Decimal(str(value))
        except InvalidOperation:
            return None
        return number if number.is_finite() else None
    if not isinstance(value, str):
        return None
    text = value.strip().replace(',', '')
    if not text:
        return None
    percent = re.search(r'(\d+(?:\.\d+)?)\s*%', text)
    match = percent or re.search(r'(\d+(?:\.\d+)?)', text)
    if not match:
        return None
    try:
        number = Decimal(match.group(1))
    except InvalidOperation:
        return None
    return number if number.is_finite() else None
