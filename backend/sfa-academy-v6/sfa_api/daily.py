"""Europe/Amsterdam daily log and the Friday-only practical window.

Day boundaries use zoneinfo. The client clock is ignored.
LEGACY weeks never enter this module's gates.
"""
import hashlib, json, re, uuid
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo
from .contracts import Invalid, canonical, ident, require, text

AMSTERDAM = ZoneInfo('Europe/Amsterdam')
# Preferred-session label from the Amsterdam clock. London cash is the morning
# until 14:00; New York cash is from 14:00. The header only allows these two.
SESSION_AT = ((9, 14, 'LONDON'),)
FRESHNESS = ('FRESH', 'RECENT', 'STALE', 'UNKNOWN')
PAPER_KEYS = ('equity', 'riskPct', 'entry', 'stopLevel', 'stopType', 'pointValue', 'pointValueSource', 'lot', 'spreadCosts', 'target', 'netRR')
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


def structural_ok(body, assignment, stage):
    ids = set(body.get('taskIds') or [])
    tasks = _tasks(assignment)
    cores = {t['taskId'] for t in tasks if isinstance(t, dict) and t.get('kind') == 'CORE'}
    spirals = {t['taskId'] for t in tasks if isinstance(t, dict) and t.get('kind') == 'SPIRAL'}
    if not ids & cores:
        return False
    if stage >= 2 and not ids & spirals:
        return False
    fields = body.get('fields') or {}
    if not str(fields.get('observations') or '').strip():
        return False
    if not str(fields.get('currentApplication') or '').strip():
        return False
    return True


def entry_counts(row, *, assignment, stage, issued_date, due, window_start, submitted_unix, now_dt):
    if not row.get('eligible'):
        return False
    local = parse_date(row['local_date'])
    if local.weekday() >= 5:
        return False
    if issued_date is not None and not local > issued_date:
        return False
    if window_start is not None and local < window_start:
        return False
    if due is not None and local > due:
        return False
    if submitted_unix is not None and int(row['created']) > int(submitted_unix):
        return False
    locked = now_dt >= next_local_midnight(local)
    if not locked and (due is None or local != due):
        return False
    return structural_ok(_entry_body(row), assignment, stage)


def counted_entries(rows, **kw):
    out = []
    for row in rows:
        if entry_counts(row, **kw):
            out.append(row)
    return out


def counted_days(rows, **kw):
    return sorted({parse_date(r['local_date']).isoformat() for r in counted_entries(rows, **kw)})


def validate_daily_payload(payload, assignment, now_dt):
    require(isinstance(payload, dict), 'DAILY_LOG_INVALID')
    allowed = {'taskIds', 'routine', 'observations', 'currentApplication', 'spiralApplication', 'paperPlan', 'selfCheck', 'dayCall', 'dayCallReason'}
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
    paper = payload.get('paperPlan', None)
    if paper is not None:
        require(isinstance(paper, dict) and set(paper) == set(PAPER_KEYS), 'PAPER_PLAN_INVALID')
        paper = {k: paper[k].strip() if isinstance(paper[k], str) else paper[k] for k in PAPER_KEYS}
        for k in PAPER_KEYS:
            text(paper[k], 200)
    fields = {
        'routine': routine,
        'observations': observations.strip(),
        'currentApplication': current.strip(),
        'spiralApplication': spiral.strip(),
        'paperPlan': paper,
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
    entries = list(c.execute('SELECT * FROM daily_entries WHERE student=? AND week=? ORDER BY created, id', (row['student'], row['week'])))
    kw = dict(assignment=assignment, stage=row['stage'], issued_date=issued, due=due, window_start=start, submitted_unix=submitted_unix, now_dt=now_dt)
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
            views = [] if inactive else [student_entry(e, _files_for(c, e['id']), now_dt) for e in entries]
            previous = []
            if week in (None, '', 'current'):
                for old in c.execute('SELECT * FROM weeks WHERE student=? AND week<? ORDER BY week', (student['student'], current['week'])):
                    old = dict(old)
                    if model_of(old) != 'DAILY_LOG_V1':
                        continue
                    old_entries = list(c.execute('SELECT * FROM daily_entries WHERE student=? AND week=? ORDER BY created, id', (old['student'], old['week'])))
                    previous.append({'week': old['week'], 'stage': old['stage'], 'readOnly': True, 'entries': [student_entry(e, _files_for(c, e['id']), now_dt) for e in old_entries]})
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
        return {
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

    def create_daily_entry(self, student, payload):
        if not self.db.rate('daily:' + student['student'], int(self.local_now().timestamp()), 30, 60):
            raise Invalid('RATE_LIMITED', error='RATE_LIMITED')
        now_dt = self.local_now()
        with self.db.tx() as c:
            row, assignment = self._open_log_row(c, student['student'])
            local = now_dt.date()
            n = c.execute('SELECT count(*) AS n FROM daily_entries WHERE student=? AND week=? AND local_date=?', (student['student'], row['week'], local.isoformat())).fetchone()['n']
            require(n < 3, 'DAILY_ENTRY_LIMIT')
            body = validate_daily_payload(payload, assignment, now_dt)
            eligible = local.weekday() < 5
            reason = None if eligible else 'WEEKEND'
            digest = content_digest(body, [])
            eid = 'de_' + uuid.uuid4().hex
            unix = int(now_dt.timestamp())
            c.execute('''INSERT INTO daily_entries(id,student,week,stage,local_date,created,updated,body,digest,revision,eligible,ineligible_reason)
                         VALUES(?,?,?,?,?,?,?,?,?,?,?,?)''',
                      (eid, student['student'], row['week'], row['stage'], local.isoformat(), unix, unix, canonical(body), digest, 1, 1 if eligible else 0, reason))
            _append_revision(c, eid, 1, body, digest, unix)
            stored = dict(c.execute('SELECT * FROM daily_entries WHERE id=?', (eid,)).fetchone())
        return student_entry(stored, [], now_dt)

    def update_daily_entry(self, student, entry_id, payload):
        if not self.db.rate('daily:' + student['student'], int(self.local_now().timestamp()), 30, 60):
            raise Invalid('RATE_LIMITED', error='RATE_LIMITED')
        now_dt = self.local_now()
        with self.db.tx() as c:
            row, assignment = self._open_log_row(c, student['student'])
            entry = c.execute('SELECT * FROM daily_entries WHERE id=? AND student=?', (entry_id, student['student'])).fetchone()
            require(entry is not None and entry['week'] == row['week'], 'ENTRY_NOT_FOUND')
            local = parse_date(entry['local_date'])
            if now_dt >= next_local_midnight(local):
                raise Invalid('DAY_LOCKED', error='DAY_LOCKED')
            body = validate_daily_payload(payload, assignment, now_dt)
            digest = _refresh_digest(c, entry_id, body)
            # Weekend flag stays with the original local date, not the edit clock.
            eligible = local.weekday() < 5
            reason = None if eligible else 'WEEKEND'
            revision = int(entry['revision']) + 1
            unix = int(now_dt.timestamp())
            c.execute('UPDATE daily_entries SET updated=?, body=?, digest=?, revision=?, eligible=?, ineligible_reason=? WHERE id=?',
                      (unix, canonical(body), digest, revision, 1 if eligible else 0, reason, entry_id))
            _append_revision(c, entry_id, revision, body, digest, unix)
            stored = dict(c.execute('SELECT * FROM daily_entries WHERE id=?', (entry_id,)).fetchone())
            files = _files_for(c, entry_id)
        return student_entry(stored, files, now_dt)

    def add_daily_file(self, student, entry_id, uploaded):
        if not self.db.rate('daily:' + student['student'], int(self.local_now().timestamp()), 30, 60):
            raise Invalid('RATE_LIMITED', error='RATE_LIMITED')
        from pathlib import Path
        from .uploads import store
        now_dt = self.local_now()
        name = uploaded.filename or ''
        ext = Path(name).suffix.lower()
        require(ext in ('.png', '.jpg', '.jpeg', '.webp'), 'FILE_TYPE_REJECTED')
        with self.db.tx() as c:
            row, _assignment = self._open_log_row(c, student['student'])
            entry = c.execute('SELECT * FROM daily_entries WHERE id=? AND student=?', (entry_id, student['student'])).fetchone()
            require(entry is not None and entry['week'] == row['week'], 'ENTRY_NOT_FOUND')
            local = parse_date(entry['local_date'])
            if now_dt >= next_local_midnight(local):
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
            entries = list(c.execute('SELECT * FROM daily_entries WHERE student=? AND week=? ORDER BY local_date, created, id', (student_id, int(week))))
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

def _recorded_trade(body):
    return (body.get('fields') or {}).get('paperPlan') is not None

def trade_call_summary(rows):
    """Per local date. A recorded trade is dayCall TRADE or a paper plan. No numeric penalty."""
    by = {}
    for row in rows:
        body = _entry_body(row)
        local = parse_date(row['local_date']).isoformat()
        slot = by.setdefault(local, {'calls': set(), 'plan': False})
        call = body.get('dayCall')
        if call:
            slot['calls'].add(call)
        if _recorded_trade(body):
            slot['plan'] = True
    trade_days = []
    no_trade_days = []
    flagged = []
    for local, slot in by.items():
        recorded = 'TRADE' in slot['calls'] or slot['plan']
        if recorded:
            trade_days.append(local)
        if slot['calls'] == {'NO_TRADE'} and not slot['plan']:
            no_trade_days.append(local)
        if 'NO_TRADE' in slot['calls'] and recorded:
            flagged.append(local)
    trade_days.sort(); no_trade_days.sort(); flagged.sort()
    return {'tradeDays': len(trade_days), 'noTradeDays': len(no_trade_days), 'tradesOnNoTradeDays': len(flagged), 'tradeOnNoTradeDay': flagged, 'recordedTrades': len(trade_days)}

def week_has_recorded_trade(rows):
    for row in rows:
        body = _entry_body(row)
        if body.get('dayCall') == 'TRADE' or _recorded_trade(body):
            return True
    return False
