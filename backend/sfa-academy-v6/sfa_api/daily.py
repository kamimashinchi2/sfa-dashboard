"""Europe/Amsterdam daily log and the Friday-only practical window.

Day boundaries use zoneinfo. The client clock is ignored.
LEGACY weeks never enter this module's gates.
"""
import hashlib, json, re, uuid
from datetime import datetime, timedelta, date
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation, localcontext
from zoneinfo import ZoneInfo
from .contracts import Invalid, SID, canonical, ident, require, text
from .plan_policy import plan_policy

AMSTERDAM = ZoneInfo('Europe/Amsterdam')
# Preferred-session label from the Amsterdam clock. London cash is the morning
# until 14:00; New York cash is from 14:00. The header only allows these two.
SESSION_AT = ((9, 14, 'LONDON'),)
FRESHNESS = ('FRESH', 'RECENT', 'STALE', 'UNKNOWN')
PAPER_KEYS = ('equity', 'riskPct', 'entry', 'stopLevel', 'stopType', 'pointValue', 'pointValueSource', 'lot', 'spreadCosts', 'target', 'netRR')
# A WAIT / fallback plan on a no-trade day. It is not a paper trade.
CONDITIONAL_KEYS = ('condition', 'entry', 'stop', 'target', 'sizeRisk')
OBSERVED_UNAVAILABLE = 'Observed reaction unavailable'
GROUNDING_MAX = 8
# A hard structural stop on a daily paper plan. Anything else is mental or no stop.
HARD_STOPS = {'hard', 'structural', 'structuralhard', 'hardstructural', 'hardstop', 'structuralhardstop'}
UNSAFE_REASON_ORDER = ('MENTAL_STOP', 'RISK_OVER_1PCT', 'NET_RR_UNDER_2')
TASK_RE = re.compile(r'[A-Za-z0-9_.:-]{1,40}\Z')
WEEKDAY = ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN')
OPEN_STATES = ('ASSIGNMENT_ISSUED', 'REMEDIAL_ISSUED', 'PRACTICAL_OVERDUE')
# K10 for stage 8 only. M5 does not gain a conditional-plan requirement.
A8_FINAL_PLAN_REQUIRED = True


def iso(dt):
    return dt.isoformat(timespec='seconds')


def parse_iso(value):
    try:
        dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except (ValueError, TypeError, AttributeError):
        raise Invalid('Invalid timestamp')
    require(dt.tzinfo is not None, 'Timestamp needs zone')
    return dt.astimezone(AMSTERDAM)


def weekday_code(d):
    return WEEKDAY[d.weekday()]


def next_local_midnight(d):
    nxt = d + timedelta(days=1)
    return datetime(nxt.year, nxt.month, nxt.day, 0, 0, 0, tzinfo=AMSTERDAM)


def friday_open(d):
    return datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=AMSTERDAM)


def friday_close(d):
    return datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=AMSTERDAM)


def session_name(dt):
    hour = dt.astimezone(AMSTERDAM).hour
    return 'LONDON' if 9 <= hour < 14 else 'NEW_YORK'


def server_due_friday(issued):
    """First Friday with at least four Mon–Fri dates strictly after the issue date, 23:59:59 Amsterdam."""
    issued = issued.astimezone(AMSTERDAM) if isinstance(issued, datetime) else datetime.fromtimestamp(issued, AMSTERDAM)
    issue_date = issued.date()
    friday = issue_date + timedelta(days=(4 - issue_date.weekday()) % 7)
    for _ in range(8):
        count = 0
        cursor = issue_date + timedelta(days=1)
        while cursor <= friday:
            if cursor.weekday() < 5:
                count += 1
            cursor += timedelta(days=1)
        if friday.weekday() == 4 and count >= 4:
            return friday_close(friday)
        friday += timedelta(days=7)
    raise Invalid('DUE_FRIDAY_UNRESOLVED')


def window_start_after_issue(issued):
    issued = issued.astimezone(AMSTERDAM) if isinstance(issued, datetime) else datetime.fromtimestamp(issued, AMSTERDAM)
    return issued.date() + timedelta(days=1)


def rollover_window_start(due_friday):
    """Monday of the five-weekday block that ends on the new due Friday."""
    return due_friday - timedelta(days=4)


def parse_date(value):
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    return date.fromisoformat(str(value)[:10])


def model_of(row):
    return (row or {}).get('practical_model') or 'LEGACY'


def stamp_issue(now_dt, assignment):
    due = parse_iso(assignment['dueAtISO']).date()
    return int(now_dt.timestamp()), due.isoformat(), (now_dt.date() + timedelta(days=1)).isoformat()


def _entry_body(row):
    body = json.loads(row['body'])
    return body


def content_digest(body, file_digests):
    payload = {'fields': body['fields'], 'taskIds': list(body['taskIds']), 'files': sorted(file_digests)}
    return hashlib.sha256(canonical(payload).encode()).hexdigest()


def _tasks(assignment):
    if not isinstance(assignment, dict):
        return []
    tasks = assignment.get('dailyTasks') or []
    return tasks if isinstance(tasks, list) else []


def structural_reason(body, assignment, stage):
    """Student-safe code when the entry text cannot count. None when it can."""
    ids = set(body.get('taskIds') or [])
    tasks = _tasks(assignment)
    cores = {t['taskId'] for t in tasks if isinstance(t, dict) and t.get('kind') == 'CORE'}
    spirals = {t['taskId'] for t in tasks if isinstance(t, dict) and t.get('kind') == 'SPIRAL'}
    if not ids & cores:
        return 'NO_CORE_TASK'
    if stage >= 2 and not ids & spirals:
        return 'NO_SPIRAL_TASK'
    fields = body.get('fields') or {}
    if not str(fields.get('observations') or '').strip() or not str(fields.get('currentApplication') or '').strip():
        return 'INCOMPLETE'
    return None


def structural_ok(body, assignment, stage):
    return structural_reason(body, assignment, stage) is None


def allowed_test_dates(issued_date, due):
    """Weekdays strictly after the issue date, through the due Friday."""
    if issued_date is None or due is None or due <= issued_date:
        return []
    dates = []
    cursor = issued_date + timedelta(days=1)
    for _ in range(62):
        if cursor > due:
            break
        if cursor.weekday() < 5:
            dates.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return dates


def _student_is_test(c, student_id):
    row = c.execute('SELECT is_test_account FROM students WHERE student=?', (student_id,)).fetchone()
    return bool(row and row['is_test_account'])


def _split_test_date(payload, test_account, issued_date, due, now_dt):
    """testLocalDate is ignored when absent. A non-test account cannot send it."""
    if not isinstance(payload, dict) or 'testLocalDate' not in payload:
        return payload, now_dt.date(), False
    supplied = payload['testLocalDate']
    rest = {k: v for k, v in payload.items() if k != 'testLocalDate'}
    if not test_account:
        raise Invalid('TEST_DATE_NOT_ALLOWED', error='TEST_DATE_NOT_ALLOWED')
    if not isinstance(supplied, str) or re.fullmatch(r'\d{4}-\d{2}-\d{2}', supplied) is None:
        raise Invalid('TEST_DATE_INVALID', error='TEST_DATE_INVALID')
    try:
        local = date.fromisoformat(supplied)
    except ValueError:
        raise Invalid('TEST_DATE_INVALID', error='TEST_DATE_INVALID')
    if local.weekday() >= 5:
        raise Invalid('TEST_DATE_NOT_WEEKDAY', error='TEST_DATE_NOT_WEEKDAY')
    if issued_date is None or not local > issued_date:
        raise Invalid('TEST_DATE_BEFORE_ISSUE', error='TEST_DATE_BEFORE_ISSUE')
    if due is None or local > due:
        raise Invalid('TEST_DATE_AFTER_DUE', error='TEST_DATE_AFTER_DUE')
    return rest, local, True


def entry_count_reason(row, *, assignment, stage, issued_date, due, window_start, submitted_unix, now_dt, test_account=False):
    """None when the entry counts. Otherwise a short student-safe code.

    The checks stay in the same order as the count itself. Test accounts skip the
    weekend and midnight-lock gates. Everyone else keeps both.
    """
    local = parse_date(row['local_date'])
    if not row.get('eligible') or (local.weekday() >= 5 and not test_account):
        return 'WEEKEND'
    if issued_date is not None and not local > issued_date:
        return 'BEFORE_ISSUE'
    if window_start is not None and local < window_start:
        return 'BEFORE_WINDOW'
    if due is not None and local > due:
        return 'AFTER_DUE'
    if submitted_unix is not None and int(row['created']) > int(submitted_unix):
        return 'AFTER_SUBMISSION'
    if not test_account:
        locked = now_dt >= next_local_midnight(local)
        if not locked and (due is None or local != due):
            return 'NOT_LOCKED'
    return structural_reason(_entry_body(row), assignment, stage)


def entry_counts(row, *, assignment, stage, issued_date, due, window_start, submitted_unix, now_dt, test_account=False):
    return entry_count_reason(
        row, assignment=assignment, stage=stage, issued_date=issued_date, due=due,
        window_start=window_start, submitted_unix=submitted_unix, now_dt=now_dt, test_account=test_account,
    ) is None


def counted_entries(rows, **kw):
    out = []
    for row in rows:
        if entry_counts(row, **kw):
            out.append(row)
    return out


def counted_days(rows, **kw):
    return sorted({parse_date(r['local_date']).isoformat() for r in counted_entries(rows, **kw)})


def _row_rank(row):
    return (int(row.get('revision') or 0), int(row.get('updated') or 0), str(row.get('id') or ''))


def collapse_test_duplicates(rows):
    """Keep one test-backdated row per local date (the latest revision).

    A normal student may still have up to three entries on the same day.
    Those rows are not test-backdated and stay in the list. Day counting is
    already one count per distinct date.
    """
    newest = {}
    for row in rows:
        if not row.get('test_backdated'):
            continue
        key = parse_date(row['local_date']).isoformat()
        prev = newest.get(key)
        if prev is None or _row_rank(row) > _row_rank(prev):
            newest[key] = row
    out = []
    seen = set()
    for row in rows:
        if not row.get('test_backdated'):
            out.append(row)
            continue
        key = parse_date(row['local_date']).isoformat()
        if key in seen:
            continue
        seen.add(key)
        out.append(newest[key])
    return out


def _filled(value, limit, code):
    require(isinstance(value, str), code)
    cleaned = value.strip()
    text(cleaned, limit)
    return cleaned


def _plan(value, keys, code, limit):
    require(isinstance(value, dict) and set(value) == set(keys), code)
    return {k: _filled(value[k], limit, code) for k in keys}


def _grounding_refs(payload):
    raw = payload.get('groundingRefs', [])
    if raw is None:
        raw = []
    require(isinstance(raw, list) and len(raw) <= GROUNDING_MAX, 'GROUNDING_INVALID')
    refs = []
    for item in raw:
        refs.append(_filled(item, 300, 'GROUNDING_INVALID'))
    return refs


def validate_daily_payload(payload, assignment, now_dt):
    require(isinstance(payload, dict), 'DAILY_LOG_INVALID')
    allowed = {'taskIds', 'routine', 'observations', 'currentApplication', 'spiralApplication', 'paperPlan', 'conditionalPlan', 'groundingRefs', 'selfCheck', 'dayCall', 'dayCallReason'}
    require(set(payload) <= allowed, 'DAILY_LOG_INVALID')
    day_call = payload.get('dayCall')
    require(day_call in ('TRADE', 'NO_TRADE'), 'DAY_CALL_REQUIRED')
    day_reason = payload.get('dayCallReason')
    if day_reason in (None, ''):
        day_reason = None
    else:
        require(isinstance(day_reason, str) and len(day_reason) <= 500, 'DAY_CALL_REASON_INVALID')
        text(day_reason, 500)
        day_reason = day_reason.strip()
    refs = _grounding_refs(payload)
    raw_ids = payload.get('taskIds') or []
    require(isinstance(raw_ids, list) and len(raw_ids) <= 40, 'DAILY_LOG_INVALID')
    known = {t['taskId'] for t in _tasks(assignment) if isinstance(t, dict)}
    task_ids = []
    for tid in raw_ids:
        require(isinstance(tid, str) and TASK_RE.fullmatch(tid), 'DAILY_TASK_INVALID')
        require(not known or tid in known, 'DAILY_TASK_UNKNOWN')
        require(tid not in task_ids, 'DAILY_TASK_DUPLICATE')
        task_ids.append(tid)
    routine_in = payload.get('routine') if isinstance(payload.get('routine'), dict) else {}
    calendar = routine_in.get('calendar')
    if not isinstance(calendar, str) or not calendar.strip():
        calendar = 'NEWS RISK: NOT ASSESSED'
    else:
        text(calendar.strip(), 200)
        calendar = calendar.strip()
    freshness = routine_in.get('freshness')
    require(freshness in FRESHNESS, 'FRESHNESS_INVALID')
    one = routine_in.get('oneLine')
    text(one, 200)
    routine = {
        'time': now_dt.strftime('%H:%M'),
        'session': session_name(now_dt),
        'calendar': calendar,
        'freshness': freshness,
        'oneLine': one.strip(),
    }
    observations = payload.get('observations')
    current = payload.get('currentApplication')
    text(observations, 4000)
    text(current, 4000)
    spiral = payload.get('spiralApplication') if payload.get('spiralApplication') is not None else ''
    require(isinstance(spiral, str) and len(spiral) <= 4000, 'DAILY_LOG_INVALID')
    if spiral:
        text(spiral, 4000)
    self_check = payload.get('selfCheck')
    text(self_check, 4000)
    # Presence only. Daily risk size, stop type, and R:R are not a HARD_BLOCK.
    paper_raw = payload.get('paperPlan', None)
    conditional_raw = payload.get('conditionalPlan', None)
    if day_call == 'TRADE':
        require(conditional_raw is None, 'CONDITIONAL_PLAN_NO_TRADE_ONLY')
        require(paper_raw is not None, 'PAPER_PLAN_REQUIRED')
        paper = _plan(paper_raw, PAPER_KEYS, 'PAPER_PLAN_INVALID', 200)
        conditional = None
    else:
        require(paper_raw is None, 'PAPER_PLAN_TRADE_ONLY')
        paper = None
        if conditional_raw is None:
            conditional = None
        else:
            conditional = _plan(conditional_raw, CONDITIONAL_KEYS, 'CONDITIONAL_PLAN_INVALID', 500)
        require(bool(refs) or day_reason == OBSERVED_UNAVAILABLE, 'GROUNDING_REQUIRED')
    fields = {
        'routine': routine,
        'observations': observations.strip(),
        'currentApplication': current.strip(),
        'spiralApplication': spiral.strip(),
        'paperPlan': paper,
        'conditionalPlan': conditional,
        'groundingRefs': refs,
        'selfCheck': self_check.strip(),
    }
    return {'taskIds': task_ids, 'dayCall': day_call, 'dayCallReason': day_reason, 'fields': fields}


def student_entry(row, files, now_dt):
    body = _entry_body(row)
    local = parse_date(row['local_date'])
    locked_at = next_local_midnight(local)
    return {
        'entryId': row['id'],
        'localDate': local.isoformat(),
        'weekday': weekday_code(local),
        'eligible': bool(row['eligible']),
        'ineligibleReason': row['ineligible_reason'],
        'createdAtISO': iso(datetime.fromtimestamp(int(row['created']), AMSTERDAM)),
        'lastEditedAtISO': iso(datetime.fromtimestamp(int(row['updated']), AMSTERDAM)),
        'lockedAtISO': iso(locked_at),
        'locked': now_dt >= locked_at,
        'revisionCount': int(row['revision']),
        'taskIds': body.get('taskIds') or [],
        'dayCall': body.get('dayCall'),
        'dayCallReason': body.get('dayCallReason'),
        'fields': body.get('fields') or {},
        'files': [{'fileId': f['id'], 'name': f['name'], 'size': f['size'], 'mime': f['mime']} for f in files],
    }


def echo_entry(row, files, now_dt):
    body = _entry_body(row)
    local = parse_date(row['local_date'])
    digests = [f['digest'] for f in files]
    view = student_entry(row, files, now_dt)
    view['files'] = [{'fileId': f['id'], 'name': f['name'], 'size': f['size'], 'digest': f['digest'], 'mime': f['mime']} for f in files]
    view['contentDigest'] = content_digest(body, digests)
    # Grading can see that the calendar day was chosen for a test account, not taken from the clock.
    if row.get('test_backdated'):
        view['testBackdated'] = True
    return view


def _load_assignment(row):
    if not row or not row.get('assignment'):
        return None
    return json.loads(row['assignment']) if isinstance(row['assignment'], str) else row['assignment']


def _bounds(row):
    issued = datetime.fromtimestamp(int(row['issued_at']), AMSTERDAM).date() if row.get('issued_at') else None
    due = parse_date(row['due_friday']) if row.get('due_friday') else None
    start = parse_date(row['window_start']) if row.get('window_start') else None
    return issued, due, start


def roll_if_overdue(svc, c, row):
    if model_of(row) != 'DAILY_LOG_V1' or row.get('state') not in OPEN_STATES or not row.get('due_friday'):
        return row
    now_dt = svc.local_now()
    student, week = row['student'], row['week']
    for _ in range(8):
        due = parse_date(row['due_friday'])
        if now_dt <= friday_close(due):
            return row
        previous = row['state']
        if previous in ('ASSIGNMENT_ISSUED', 'REMEDIAL_ISSUED'):
            svc._transition(c, student, week, 'PRACTICAL_OVERDUE', {'reason': 'MISSED_FRIDAY', 'dueFriday': due.isoformat()})
            resume = previous
        else:
            resume = row.get('resume_state') or 'ASSIGNMENT_ISSUED'
            svc._event(c, 'overdue:' + uuid.uuid4().hex, student, 'PRACTICAL_OVERDUE', {'week': week, 'dueFriday': due.isoformat()})
        nxt = due + timedelta(days=7)
        start = rollover_window_start(nxt).isoformat()
        c.execute('UPDATE weeks SET due_friday=?, window_start=?, resume_state=? WHERE student=? AND week=?', (nxt.isoformat(), start, resume, student, week))
        row = dict(c.execute('SELECT * FROM weeks WHERE student=? AND week=?', (student, week)).fetchone())
    return row


def window_open(svc, c, row, now_dt):
    if model_of(row) != 'DAILY_LOG_V1':
        return True
    if _student_is_test(c, row['student']):
        return True
    if not row.get('due_friday'):
        return False
    due = parse_date(row['due_friday'])
    if now_dt.date() == due and friday_open(due) <= now_dt <= friday_close(due):
        return True
    unix = int(now_dt.timestamp())
    hit = c.execute('SELECT 1 FROM practical_overrides WHERE student=? AND week=? AND opens_at<=? AND closes_at>=?', (row['student'], row['week'], unix, unix)).fetchone()
    return hit is not None


def require_window(svc, c, row):
    row = roll_if_overdue(svc, c, row)
    if model_of(row) != 'DAILY_LOG_V1':
        return row
    now_dt = svc.local_now()
    if window_open(svc, c, row, now_dt):
        return row
    due = parse_date(row['due_friday']) if row.get('due_friday') else None
    extra = {}
    if due is not None:
        extra = {'opensAtISO': iso(friday_open(due)), 'closesAtISO': iso(friday_close(due))}
    raise Invalid('PRACTICAL_WINDOW_CLOSED', error='PRACTICAL_WINDOW_CLOSED', **extra)


def _files_for(c, entry_id):
    return list(c.execute('SELECT * FROM daily_entry_files WHERE entry=? ORDER BY id', (entry_id,)))


def _append_revision(c, entry_id, revision, body, digest, saved):
    c.execute('INSERT INTO daily_entry_revisions(entry, revision, body, digest, saved) VALUES(?,?,?,?,?)', (entry_id, revision, canonical(body), digest, saved))


def _refresh_digest(c, entry_id, body):
    files = _files_for(c, entry_id)
    return content_digest(body, [f['digest'] for f in files])


def _count_context(svc, c, row, submitted_unix=None):
    now_dt = svc.local_now()
    issued, due, start = _bounds(row)
    assignment = _load_assignment(row)
    entries = collapse_test_duplicates(list(c.execute('SELECT * FROM daily_entries WHERE student=? AND week=? ORDER BY created, id', (row['student'], row['week']))))
    kw = dict(assignment=assignment, stage=row['stage'], issued_date=issued, due=due, window_start=start, submitted_unix=submitted_unix, now_dt=now_dt, test_account=_student_is_test(c, row['student']))
    return entries, kw, assignment, now_dt


class DailyMixin:
    def delete_daily_entry(self, student, entry_id):
        # Saved entries are permanent. Locked or not, the student cannot delete them.
        raise Invalid('DAY_LOCKED', error='DAY_LOCKED')

    def _open_log_row(self, c, student):
        row = self._week(c, student)
        if model_of(row) != 'DAILY_LOG_V1':
            raise Invalid('DAILY_LOG_NOT_ACTIVE')
        if row['state'] not in OPEN_STATES:
            raise Invalid('WEEK_CLOSED', error='WEEK_CLOSED')
        if c.execute("SELECT 1 FROM submissions WHERE student=? AND week=? AND state IN ('QUEUED','DELIVERED')", (student, row['week'])).fetchone():
            raise Invalid('WEEK_CLOSED', error='WEEK_CLOSED')
        assignment = _load_assignment(row)
        require(isinstance(assignment, dict) and assignment.get('dailyTasks'), 'DAILY_TASKS_REQUIRED')
        return row, assignment

    def daily_log_view(self, student, week='current'):
        now_dt = self.local_now()
        with self.db.tx() as c:
            current = self._week(c, student['student'])
            target = current
            if week not in (None, '', 'current'):
                require(str(week).isdigit(), 'WEEK_INVALID')
                found = c.execute('SELECT * FROM weeks WHERE student=? AND week=?', (student['student'], int(week))).fetchone()
                require(found is not None, 'WEEK_NOT_FOUND')
                target = dict(found)
            inactive = model_of(target) != 'DAILY_LOG_V1'
            submitted = c.execute("SELECT submitted_at FROM submissions WHERE student=? AND week=? AND state IN ('QUEUED','DELIVERED') ORDER BY created DESC", (target['student'], target['week'])).fetchone()
            submitted_unix = submitted['submitted_at'] if submitted and submitted.get('submitted_at') else None
            entries, kw, assignment, now_dt = _count_context(self, c, target, submitted_unix)
            days = [] if inactive else counted_days(entries, **kw)
            views = [] if inactive else [self._student_log_entry(c, target, e, _files_for(c, e['id']), now_dt, submitted_unix) for e in entries]
            previous = []
            if week in (None, '', 'current'):
                for old in c.execute('SELECT * FROM weeks WHERE student=? AND week<? ORDER BY week', (student['student'], current['week'])):
                    old = dict(old)
                    if model_of(old) != 'DAILY_LOG_V1':
                        continue
                    old_submitted = c.execute("SELECT submitted_at FROM submissions WHERE student=? AND week=? AND state IN ('QUEUED','DELIVERED') ORDER BY created DESC", (old['student'], old['week'])).fetchone()
                    old_unix = old_submitted['submitted_at'] if old_submitted and old_submitted.get('submitted_at') else None
                    old_entries = collapse_test_duplicates(list(c.execute('SELECT * FROM daily_entries WHERE student=? AND week=? ORDER BY created, id', (old['student'], old['week']))))
                    previous.append({'week': old['week'], 'stage': old['stage'], 'readOnly': True, 'entries': [self._student_log_entry(c, old, e, _files_for(c, e['id']), now_dt, old_unix) for e in old_entries]})
            due = target.get('due_friday')
            required = self.config.daily_log_min_days
            counted = len(days)
            warning = None
            if not inactive and target['state'] in OPEN_STATES:
                if counted < required:
                    warning = {
                        'fa': f'شما {counted} از {required} روز ثبت دارید. با کمتر از {required} روز واقعی، تمرین عملی نمی‌تواند قبول شود.',
                        'en': f'You have {counted} of {required} logged days. With fewer than {required} genuine days, the practical cannot pass.',
                    }
                else:
                    warning = {
                        'fa': f'روزهای ثبت‌شده: {counted} از {required}. قبول شدن هنوز به تأیید Echo بستگی دارد.',
                        'en': f'Logged days: {counted} of {required}. Passing still depends on Echo accepting the days.',
                    }
            opens = closes = None
            open_now = False
            if due and not inactive:
                due_d = parse_date(due)
                opens, closes = iso(friday_open(due_d)), iso(friday_close(due_d))
                open_now = window_open(self, c, target, now_dt)
            test_dates = None
            if not inactive and _student_is_test(c, target['student']):
                issued, due_day, _start = _bounds(target)
                test_dates = allowed_test_dates(issued, due_day)
        body = {
            'entries': views,
            'countedDays': counted if not inactive else 0,
            'requiredDays': self.config.daily_log_min_days,
            'dueFriday': due if not inactive else None,
            'nextLockAtISO': iso(next_local_midnight(now_dt.date())),
            'practicalModel': 'LEGACY' if inactive else 'DAILY_LOG_V1',
            'active': not inactive,
            'state': target['state'],
            'windowOpen': open_now,
            'opensAtISO': opens,
            'closesAtISO': closes,
            'warning': warning,
            'previousWeeks': previous,
        }
        if test_dates is not None:
            body['testMode'] = True
            body['allowedDates'] = test_dates
        return body

    def _is_test_student(self, student_id):
        rows = self.db.rows('SELECT is_test_account FROM students WHERE student=?', (student_id,))
        return bool(rows and rows[0].get('is_test_account'))

    def _daily_rate_ok(self, student_id):
        if self._is_test_student(student_id):
            return True
        return self.db.rate('daily:' + student_id, int(self.local_now().timestamp()), 30, 60)

    def _student_log_entry(self, c, week_row, stored, files, now_dt, submitted_unix=None):
        view = student_entry(stored, files, now_dt)
        issued, due, start = _bounds(week_row)
        view['countReason'] = entry_count_reason(
            stored,
            assignment=_load_assignment(week_row),
            stage=week_row['stage'],
            issued_date=issued,
            due=due,
            window_start=start,
            submitted_unix=submitted_unix,
            now_dt=now_dt,
            test_account=_student_is_test(c, week_row['student']),
        )
        return view

    def _revise_daily_row(self, c, entry, assignment, payload, now_dt, test, local, backdated):
        body = validate_daily_payload(payload, assignment, now_dt)
        digest = _refresh_digest(c, entry['id'], body)
        if test:
            eligible, reason = True, None
        else:
            eligible = local.weekday() < 5
            reason = None if eligible else 'WEEKEND'
        revision = int(entry['revision']) + 1
        unix = int(now_dt.timestamp())
        c.execute('UPDATE daily_entries SET local_date=?, updated=?, body=?, digest=?, revision=?, eligible=?, ineligible_reason=?, test_backdated=? WHERE id=?',
                  (local.isoformat(), unix, canonical(body), digest, revision, 1 if eligible else 0, reason, 1 if backdated else 0, entry['id']))
        _append_revision(c, entry['id'], revision, body, digest, unix)
        stored = dict(c.execute('SELECT * FROM daily_entries WHERE id=?', (entry['id'],)).fetchone())
        return stored, _files_for(c, entry['id'])

    def create_daily_entry(self, student, payload):
        if not self._daily_rate_ok(student['student']):
            raise Invalid('RATE_LIMITED', error='RATE_LIMITED')
        now_dt = self.local_now()
        with self.db.tx() as c:
            row, assignment = self._open_log_row(c, student['student'])
            test = _student_is_test(c, student['student'])
            issued, due, _start = _bounds(row)
            payload, local, backdated = _split_test_date(payload, test, issued, due, now_dt)
            # A test date that already has an entry is a revision, including after midnight.
            # Normal students keep the three-entry cap and always insert.
            if test and backdated:
                existing = c.execute(
                    'SELECT * FROM daily_entries WHERE student=? AND week=? AND local_date=? ORDER BY revision DESC, updated DESC, id DESC',
                    (student['student'], row['week'], local.isoformat()),
                ).fetchone()
                if existing:
                    stored, files = self._revise_daily_row(c, existing, assignment, payload, now_dt, test, local, True)
                    return self._student_log_entry(c, row, stored, files, now_dt)
            n = c.execute('SELECT count(*) AS n FROM daily_entries WHERE student=? AND week=? AND local_date=?', (student['student'], row['week'], local.isoformat())).fetchone()['n']
            require(n < 3, 'DAILY_ENTRY_LIMIT')
            body = validate_daily_payload(payload, assignment, now_dt)
            if test:
                eligible, reason = True, None
            else:
                eligible = local.weekday() < 5
                reason = None if eligible else 'WEEKEND'
            digest = content_digest(body, [])
            eid = 'de_' + uuid.uuid4().hex
            unix = int(now_dt.timestamp())
            c.execute('''INSERT INTO daily_entries(id,student,week,stage,local_date,created,updated,body,digest,revision,eligible,ineligible_reason,test_backdated)
                         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                      (eid, student['student'], row['week'], row['stage'], local.isoformat(), unix, unix, canonical(body), digest, 1, 1 if eligible else 0, reason, 1 if backdated else 0))
            _append_revision(c, eid, 1, body, digest, unix)
            stored = dict(c.execute('SELECT * FROM daily_entries WHERE id=?', (eid,)).fetchone())
            return self._student_log_entry(c, row, stored, [], now_dt)

    def update_daily_entry(self, student, entry_id, payload):
        if not self._daily_rate_ok(student['student']):
            raise Invalid('RATE_LIMITED', error='RATE_LIMITED')
        now_dt = self.local_now()
        with self.db.tx() as c:
            row, assignment = self._open_log_row(c, student['student'])
            test = _student_is_test(c, student['student'])
            entry = c.execute('SELECT * FROM daily_entries WHERE id=? AND student=?', (entry_id, student['student'])).fetchone()
            require(entry is not None and entry['week'] == row['week'], 'ENTRY_NOT_FOUND')
            issued, due, _start = _bounds(row)
            supplied = isinstance(payload, dict) and 'testLocalDate' in payload
            if supplied:
                payload, local, backdated = _split_test_date(payload, test, issued, due, now_dt)
                n = c.execute('SELECT count(*) AS n FROM daily_entries WHERE student=? AND week=? AND local_date=? AND id!=?', (student['student'], row['week'], local.isoformat(), entry_id)).fetchone()['n']
                require(n < 3, 'DAILY_ENTRY_LIMIT')
            else:
                local = parse_date(entry['local_date'])
                backdated = bool(entry.get('test_backdated'))
                if not test and now_dt >= next_local_midnight(local):
                    raise Invalid('DAY_LOCKED', error='DAY_LOCKED')
            # Test accounts may revise a backdated day after Amsterdam midnight.
            stored, files = self._revise_daily_row(c, entry, assignment, payload, now_dt, test, local, backdated)
            submitted = c.execute("SELECT submitted_at FROM submissions WHERE student=? AND week=? AND state IN ('QUEUED','DELIVERED') ORDER BY created DESC", (row['student'], row['week'])).fetchone()
            submitted_unix = submitted['submitted_at'] if submitted and submitted.get('submitted_at') else None
            return self._student_log_entry(c, row, stored, files, now_dt, submitted_unix)

    def add_daily_file(self, student, entry_id, uploaded):
        if not self._daily_rate_ok(student['student']):
            raise Invalid('RATE_LIMITED', error='RATE_LIMITED')
        from pathlib import Path
        from .uploads import store
        now_dt = self.local_now()
        name = uploaded.filename or ''
        ext = Path(name).suffix.lower()
        require(ext in ('.png', '.jpg', '.jpeg', '.webp'), 'FILE_TYPE_REJECTED')
        with self.db.tx() as c:
            row, _assignment = self._open_log_row(c, student['student'])
            test = _student_is_test(c, student['student'])
            entry = c.execute('SELECT * FROM daily_entries WHERE id=? AND student=?', (entry_id, student['student'])).fetchone()
            require(entry is not None and entry['week'] == row['week'], 'ENTRY_NOT_FOUND')
            local = parse_date(entry['local_date'])
            if not test and now_dt >= next_local_midnight(local):
                raise Invalid('DAY_LOCKED', error='DAY_LOCKED')
            require(c.execute('SELECT count(*) AS n FROM daily_entry_files WHERE entry=?', (entry_id,)).fetchone()['n'] < 4, 'MAX_4_SCREENSHOTS')
            fid = 'df_' + uuid.uuid4().hex
            data = store(uploaded.stream, self.config.root / 'uploads' / student['student'] / 'daily' / entry_id, fid, name)
            try:
                c.execute('INSERT INTO daily_entry_files(id,entry,path,digest,name,size,mime) VALUES(?,?,?,?,?,?,?)',
                          (fid, entry_id, data['path'], data['digest'], data['name'], data['size'], data['mime']))
                body = _entry_body(entry)
                digest = _refresh_digest(c, entry_id, body)
                revision = int(entry['revision']) + 1
                unix = int(now_dt.timestamp())
                c.execute('UPDATE daily_entries SET updated=?, digest=?, revision=? WHERE id=?', (unix, digest, revision, entry_id))
                _append_revision(c, entry_id, revision, body, digest, unix)
            except BaseException:
                Path(data['path']).unlink(missing_ok=True)
                raise
        return {'fileId': fid, 'name': data['name'], 'size': data['size'], 'mime': data['mime']}

    def echo_daily_log(self, student_id, week):
        ident(student_id) if False else None
        require(isinstance(student_id, str) and student_id.startswith('S'), 'STUDENT_NOT_FOUND')
        require(str(week).isdigit(), 'WEEK_INVALID')
        now_dt = self.local_now()
        with self.db.tx() as c:
            row = c.execute('SELECT * FROM weeks WHERE student=? AND week=?', (student_id, int(week))).fetchone()
            require(row is not None, 'WEEK_NOT_FOUND')
            row = dict(row)
            entries = collapse_test_duplicates(list(c.execute('SELECT * FROM daily_entries WHERE student=? AND week=? ORDER BY local_date, created, id', (student_id, int(week)))))
            out = [echo_entry(e, _files_for(c, e['id']), now_dt) for e in entries]
        return {'studentId': student_id, 'week': int(week), 'practicalModel': model_of(row), 'entries': out}

    def open_practical_window(self, student_id, reason):
        require(isinstance(reason, str) and 5 <= len(reason) <= 1000, 'OVERRIDE_REASON_REQUIRED')
        text(reason, 1000)
        now_dt = self.local_now()
        with self.db.tx() as c:
            row = c.execute('SELECT w.* FROM weeks w JOIN students s ON s.student=w.student AND s.current_week=w.week WHERE w.student=?', (student_id,)).fetchone()
            require(row is not None, 'STUDENT_NOT_FOUND')
            row = roll_if_overdue(self, c, dict(row))
            require(model_of(row) == 'DAILY_LOG_V1', 'DAILY_LOG_NOT_ACTIVE')
            require(row['state'] in OPEN_STATES, 'PRACTICAL_NOT_OPEN')
            opens = now_dt
            closes = friday_close(now_dt.date())
            if closes < opens:
                closes = opens
            oid = 'pw_' + uuid.uuid4().hex
            unix = int(now_dt.timestamp())
            c.execute('INSERT INTO practical_overrides(id,student,week,reason,opens_at,closes_at,created) VALUES(?,?,?,?,?,?,?)',
                      (oid, student_id, row['week'], reason, unix, int(closes.timestamp()), unix))
            self._event(c, 'window:' + oid, student_id, 'PRACTICAL_WINDOW_OVERRIDE', {'week': row['week'], 'reason': reason, 'opensAtISO': iso(opens), 'closesAtISO': iso(closes)})
        return {'student': student_id, 'week': row['week'], 'opensAtISO': iso(opens), 'closesAtISO': iso(closes)}

    def build_daily_log_packet(self, c, submission):
        row = c.execute('SELECT * FROM weeks WHERE student=? AND week=?', (submission['student'], submission['week'])).fetchone()
        if row is None or model_of(row) != 'DAILY_LOG_V1':
            return None
        row = dict(row)
        submitted_unix = submission.get('submitted_at') or submission.get('created')
        submitted_dt = datetime.fromtimestamp(int(submitted_unix), AMSTERDAM) if submitted_unix else self.local_now()
        entries, kw, _assignment, now_dt = _count_context(self, c, row, submitted_unix)
        # Count against the submission instant, not "now", so a later clock does not unlock Friday rows.
        kw['now_dt'] = submitted_dt
        chosen = counted_entries(entries, **kw)
        chosen_ids = {e['id'] for e in chosen}
        issued_dt = datetime.fromtimestamp(int(row['issued_at']), AMSTERDAM) if row.get('issued_at') else None
        packet_entries = []
        for e in entries:
            files = _files_for(c, e['id'])
            packet_entries.append(echo_entry(e, files, submitted_dt))
        days = sorted({parse_date(e['local_date']).isoformat() for e in chosen})
        calls = trade_call_summary(entries)
        unsafe = unsafe_daily_trades(entries)
        return {
            'timezone': 'Europe/Amsterdam',
            'assignmentIssuedAtISO': iso(issued_dt) if issued_dt else None,
            'windowStartLocalDate': row.get('window_start'),
            'dueFridayLocalDate': row.get('due_friday'),
            'submittedAtISO': iso(submitted_dt),
            'requiredDays': self.config.daily_log_min_days,
            'countedDays': len(days),
            'countedLocalDates': days,
            'tradeDays': calls['tradeDays'],
            'noTradeDays': calls['noTradeDays'],
            'tradesOnNoTradeDays': calls['tradesOnNoTradeDays'],
            'tradeOnNoTradeDay': calls['tradeOnNoTradeDay'],
            'unsafeDailyTrades': unsafe,
            'unsafeDailyTradeCount': len(unsafe),
            'weekTradeRiskSummary': week_trade_risk_summary(entries),
            'entries': packet_entries,
            '_countedIds': sorted(chosen_ids),
        }

    def build_daily_log_packet_public(self, submission):
        with self.db.tx() as c:
            packet=self.build_daily_log_packet(c, submission)
        if packet: packet.pop('_countedIds', None)
        return packet

    def counted_for_decision(self, c, submission):
        packet = self.build_daily_log_packet(c, submission)
        if not packet:
            return []
        ids = set(packet.pop('_countedIds'))
        return [{'entryId': e['entryId'], 'localDate': e['localDate']} for e in packet['entries'] if e['entryId'] in ids]

    def _named_student(self, c, student_id):
        require(isinstance(student_id, str) and SID.fullmatch(student_id) is not None, 'STUDENT_NOT_FOUND')
        row = c.execute('SELECT * FROM students WHERE student=?', (student_id,)).fetchone()
        require(row is not None and row['student'] == student_id, 'STUDENT_NOT_FOUND')
        return dict(row)

    def enable_test_account(self, student_id, week, reason):
        """Mark one named student and switch that student's week to DAILY_LOG_V1.

        Refuses any other id. The week must already belong to that student.
        """
        require(type(week) is int and 1 <= week <= 10000, 'WEEK_INVALID')
        require(isinstance(reason, str) and 5 <= len(reason) <= 1000, 'OVERRIDE_REASON_REQUIRED')
        text(reason, 1000)
        now_dt = self.local_now()
        issued = int(now_dt.timestamp())
        due = server_due_friday(now_dt).date().isoformat()
        start = window_start_after_issue(now_dt).isoformat()
        with self.db.tx() as c:
            student = self._named_student(c, student_id)
            row = c.execute('SELECT * FROM weeks WHERE student=? AND week=?', (student_id, week)).fetchone()
            require(row is not None and row['student'] == student_id, 'WEEK_NOT_FOUND')
            row = dict(row)
            stage = int(row['stage'])
            required = 1 if plan_policy(stage) == 'required' else 0
            state = row['state']
            if state not in ('LESSON_OPEN', 'QUIZ_SUBMITTED', 'QUIZ_ASSESSED'):
                state = 'LESSON_OPEN'
            new_stage = stage if int(student['stage']) < stage else int(student['stage'])
            c.execute('UPDATE students SET is_test_account=1, current_week=?, stage=? WHERE student=?', (week, new_stage, student_id))
            marked = c.execute('SELECT student, is_test_account FROM students WHERE student=?', (student_id,)).fetchone()
            require(marked is not None and marked['student'] == student_id and marked['is_test_account'], 'STUDENT_NOT_FOUND')
            c.execute('UPDATE weeks SET practical_model=?, issued_at=?, due_friday=?, window_start=?, plan_required=?, state=? WHERE student=? AND week=?',
                      ('DAILY_LOG_V1', issued, due, start, required, state, student_id, week))
            stored = c.execute('SELECT practical_model, state, plan_required FROM weeks WHERE student=? AND week=?', (student_id, week)).fetchone()
            require(stored['practical_model'] == 'DAILY_LOG_V1' and stored['state'] == state, 'WEEK_NOT_FOUND')
            self._event(c, 'test-account:' + uuid.uuid4().hex, student_id, 'TEST_ACCOUNT_ENABLED', {
                'student': student_id, 'week': week, 'reason': reason, 'practicalModel': 'DAILY_LOG_V1',
                'state': state, 'dueFriday': due, 'planRequired': bool(required),
            })
        return {
            'student': student_id,
            'isTestAccount': True,
            'week': week,
            'practicalModel': 'DAILY_LOG_V1',
            'state': state,
            'issuedAt': issued,
            'dueFriday': due,
            'windowStart': start,
            'planRequired': bool(required),
        }

    def disable_test_account(self, student_id):
        """Clear the flag on the named test student. The week model is left as it is."""
        with self.db.tx() as c:
            student = self._named_student(c, student_id)
            require(student['is_test_account'], 'TEST_ACCOUNT_REQUIRED')
            c.execute('UPDATE students SET is_test_account=0 WHERE student=?', (student_id,))
            cleared = c.execute('SELECT student, is_test_account FROM students WHERE student=?', (student_id,)).fetchone()
            require(cleared is not None and cleared['student'] == student_id and not cleared['is_test_account'], 'STUDENT_NOT_FOUND')
            self._event(c, 'test-account-off:' + uuid.uuid4().hex, student_id, 'TEST_ACCOUNT_DISABLED', {'student': student_id})
        return {'student': student_id, 'isTestAccount': False}

def trade_call_summary(rows):
    """Per local date. Only dayCall TRADE is a trade. conditionalPlan never counts.

    tradeDays is the number of dates with a TRADE entry. tradeOnNoTradeDay lists a
    date only when that date also has a NO_TRADE entry. No numeric penalty.
    """
    by = {}
    for row in rows:
        body = _entry_body(row)
        local = parse_date(row['local_date']).isoformat()
        calls = by.setdefault(local, set())
        call = body.get('dayCall')
        if call in ('TRADE', 'NO_TRADE'):
            calls.add(call)
    trade_days, no_trade_days, flagged = [], [], []
    for local, calls in by.items():
        if 'TRADE' in calls:
            trade_days.append(local)
        if calls == {'NO_TRADE'}:
            no_trade_days.append(local)
        if 'TRADE' in calls and 'NO_TRADE' in calls:
            flagged.append(local)
    trade_days.sort(); no_trade_days.sort(); flagged.sort()
    return {'tradeDays': len(trade_days), 'noTradeDays': len(no_trade_days), 'tradesOnNoTradeDays': len(flagged), 'tradeOnNoTradeDay': flagged, 'recordedTrades': len(trade_days)}

def week_has_recorded_trade(rows):
    return trade_call_summary(rows)['tradeDays'] > 0


def _stop_token(value):
    return re.sub(r'[^a-z]', '', str(value).lower())


def _is_hard_stop(value):
    return _stop_token(value) in HARD_STOPS


def _parse_num(value):
    if not isinstance(value, str):
        return None
    raw = value.strip().replace(',', '')
    if raw.endswith('%'):
        raw = raw[:-1].strip()
    if not raw:
        return None
    try:
        number = Decimal(raw)
    except InvalidOperation:
        return None
    if not number.is_finite():
        return None
    return number


def round_half_up_money(amount):
    """Arithmetic result as a 2-decimal string. Ties round away from zero (ROUND_HALF_UP)."""
    with localcontext() as ctx:
        ctx.prec = 120
        quantized = amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return format(quantized, 'f')


def _info_ratio(amount):
    with localcontext() as ctx:
        ctx.prec = 120
        quantized = amount.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
    return format(quantized, 'f')


def _trade_plans(rows):
    plans = []
    for row in rows:
        body = _entry_body(row)
        if body.get('dayCall') != 'TRADE':
            continue
        paper = (body.get('fields') or {}).get('paperPlan')
        if not isinstance(paper, dict):
            continue
        plans.append({'date': parse_date(row['local_date']).isoformat(), 'entryId': row['id'], 'paper': paper})
    plans.sort(key=lambda item: (item['date'], item['entryId']))
    return plans


def _unsafe_reasons(paper):
    reasons = []
    if not _is_hard_stop(paper.get('stopType')):
        reasons.append('MENTAL_STOP')
    risk_pct = _parse_num(paper.get('riskPct'))
    if risk_pct is not None and risk_pct > 1:
        reasons.append('RISK_OVER_1PCT')
    net_rr = _parse_num(paper.get('netRR'))
    if net_rr is not None and net_rr < 2:
        reasons.append('NET_RR_UNDER_2')
    return [code for code in UNSAFE_REASON_ORDER if code in reasons]


def unsafe_daily_trades(rows):
    """TRADE-day paper plans that break a daily risk rule. Not a HARD_BLOCK and not a score change."""
    flagged = []
    for item in _trade_plans(rows):
        reasons = _unsafe_reasons(item['paper'])
        if reasons:
            flagged.append({'date': item['date'], 'entryId': item['entryId'], 'reasons': reasons})
    return flagged


def _money_parts(paper):
    equity = _parse_num(paper.get('equity'))
    risk_pct = _parse_num(paper.get('riskPct'))
    net_rr = _parse_num(paper.get('netRR'))
    if equity is None or risk_pct is None or net_rr is None or equity <= 0 or risk_pct < 0 or net_rr < 0:
        return None
    risk_amount = equity * risk_pct / Decimal(100)
    return equity, risk_amount, risk_amount * net_rr


def week_trade_risk_summary(rows):
    """Means a grader can copy into riskEvidence when the week has trades and no Friday plan.

    currentEquity, riskAmount and netReward are the arithmetic means of those per-trade
    amounts, then rounded half-up to 2 decimals. riskAmount is equity * riskPct / 100.
    netReward is that risk amount times netRR. avgRiskPct and avgNetRR are then
    riskAmount / currentEquity * 100 and netReward / riskAmount, using the rounded
    means. They are not the mean of the per-trade percents or ratios.
    stopType is STRUCTURAL_HARD for every such week. A mental or missing hard stop
    is counted and listed in unsafeDailyTrades; it does not change stopType.
    """
    plans = _trade_plans(rows)
    if not plans:
        return None
    hard = mental = 0
    parts = []
    for item in plans:
        if _is_hard_stop(item['paper'].get('stopType')):
            hard += 1
        else:
            mental += 1
        parts.append(_money_parts(item['paper']))
    summary = {
        'source': 'WEEK_TRADES_AVERAGE',
        'tradeCount': len(plans),
        'hardStopCount': hard,
        'mentalOrNoStopCount': mental,
        'stopType': 'STRUCTURAL_HARD',
        'evidenceRefs': ['daily:' + item['entryId'] for item in plans],
        'currentEquity': None,
        'riskAmount': None,
        'netReward': None,
        'avgRiskPct': None,
        'avgNetRR': None,
    }
    if any(part is None for part in parts):
        return summary
    count = Decimal(len(parts))
    with localcontext() as ctx:
        ctx.prec = 120
        equity = sum((part[0] for part in parts), Decimal(0)) / count
        risk = sum((part[1] for part in parts), Decimal(0)) / count
        reward = sum((part[2] for part in parts), Decimal(0)) / count
    summary['currentEquity'] = round_half_up_money(equity)
    summary['riskAmount'] = round_half_up_money(risk)
    summary['netReward'] = round_half_up_money(reward)
    equity_q = Decimal(summary['currentEquity'])
    risk_q = Decimal(summary['riskAmount'])
    reward_q = Decimal(summary['netReward'])
    if equity_q > 0:
        summary['avgRiskPct'] = _info_ratio(risk_q * Decimal(100) / equity_q)
    if risk_q > 0:
        summary['avgNetRR'] = _info_ratio(reward_q / risk_q)
    return summary
