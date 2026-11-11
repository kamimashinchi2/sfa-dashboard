"""Four student journeys plus the owner actions the CLI exposes.
Telegram stays disabled. Answer keys stay out of the student payload.
"""
import io, json, os, subprocess, time
from pathlib import Path
import pytest
from werkzeug.datastructures import FileStorage
from sfa_api.contracts import Invalid
from sfa_api.uploads import store
from .vectors import qdecision, pdecision, payload

def quiz_body(correct, stage, attempt):
    p = payload(correct, stage, attempt)
    return {k: p[k] for k in ("attemptId", "quizId", "buildCommit")} | {
        "items": [{k: i[k] for k in ("itemId", "itemHash", "kind", "studentAnswer", "touched", "reflection")} for i in p["items"]]
    }

def join(svc, email, password="correct horse battery staple", name="Learner", token=None, days=30, uses=100):
    token = token or svc.invite(days, uses).rsplit("/", 1)[1]
    session = svc.signup({"inviteToken": token, "email": email, "displayName": name, "password": password, "acceptDataNotice": True})
    return svc.auth(session), session, token

def grade(svc, student, correct, stage):
    body = quiz_body(correct, stage, f"try-{stage}-{correct}-{os.urandom(3).hex()}")
    svc.quiz_submit(body, student)
    packet = json.loads(svc.db.rows("SELECT body FROM quizzes WHERE attempt=?", (body["attemptId"],))[0]["body"])
    decision = qdecision(svc, packet)
    decision["feedback"] = {
        "en": "Look again at the hard structural stop. What would change if risk stayed under one percent?",
        "fa": "دوباره به استاپ ساختاری سخت نگاه کن. اگر ریسک زیر یک درصد بماند چه چیزی عوض می‌شود؟",
    }
    rid = "quiz:" + body["attemptId"]
    svc.decision(decision, rid, svc.claim(rid)["leaseToken"])
    return decision

def evidence(kind):
    base = {"currentEquity": "10000", "riskAmount": "50", "netReward": "200", "stopType": "STRUCTURAL_HARD", "evidenceRefs": ["file:final-plan"]}
    if kind == "mental":
        base["stopType"] = "MENTAL"
    elif kind == "risk":
        base["riskAmount"] = "101"
        base["netReward"] = "300"
    elif kind == "rr":
        base["riskAmount"] = "100"
        base["netReward"] = "150"
    return base

def practical(svc, student, filename="work.txt", data=b"Structural hard stop, equity, and net reward."):
    sid = svc.draft(student)
    svc.upload(student, sid, FileStorage(stream=io.BytesIO(data), filename=filename))
    svc.submit_practical(student, sid)
    return sid

def grade_practical(svc, sid, score=90, kind="ok"):
    blocked = kind != "ok"
    decision = pdecision(svc, sid, score, blocked)
    rid = "practical:" + sid
    svc.decision(decision, rid, svc.claim(rid)["leaseToken"], evidence(kind))
    return decision

def test_diligent_student_finishes_eight_weeks(svc, bank):
    student, _, _ = join(svc, "diligent@example.test", name="Diligent Learner")
    with pytest.raises(Invalid):
        svc.authorize(student, 2)
    for stage in range(1, 9):
        ent = svc.entitlements(student["student"])
        assert (ent["unlockedStage"], ent["status"]) == (stage, "LESSON_OPEN")
        if stage < 8:
            with pytest.raises(Invalid):
                svc.authorize(student, stage + 1)
        decision = grade(svc, student, 7 if stage == 1 else 10, stage)
        assert decision["verdict"] in ("APPROVED", "PARTIALLY_APPROVED")
        assert "fa" in decision["feedback"] and "en" in decision["feedback"]
        assert svc.entitlements(student["student"])["unlockedStage"] == stage
        if stage > 1:
            assignment = json.loads(svc.db.rows("SELECT assignment FROM weeks WHERE student=? AND week=?", (student["student"], svc.entitlements(student["student"])["currentWeek"]))[0]["assignment"])
            assert {row["stage"] for row in assignment["spiralReview"]} == set(range(1, stage))
        sid = practical(svc, student, filename=f"week-{stage}.txt")
        done = grade_practical(svc, sid, 90, "ok")
        if stage < 8:
            assert done["unlockNext"] is True
            assert svc.entitlements(student["student"])["unlockedStage"] == stage + 1
        else:
            assert done["unlockNext"] is False
            final = svc.entitlements(student["student"])
            assert final["unlockedStage"] == 8 and final["status"] == "AWAITING_SENIOR_MENTOR"
    report = svc.report(student["student"])
    assert "AWAITING_SENIOR_MENTOR" in report["markdown"]
    assert svc.me(student)["telegramEnabled"] is False

def test_careless_student_is_stopped_before_bad_work_is_accepted(svc, bank, tmp_path):
    with pytest.raises(Invalid):
        svc.login({"email": "nobody@example.test", "password": "wrong-password"})
    student, _, token = join(svc, "careless@example.test", name="Careless Learner", uses=1)
    with pytest.raises(Invalid):
        svc.signup({"inviteToken": token, "email": "other@example.test", "displayName": "Other", "password": "correct horse battery staple", "acceptDataNotice": True})
    expired = svc.invite(days=1, max_uses=1).rsplit("/", 1)[1]
    with svc.db.tx() as c:
        c.execute("UPDATE invites SET expires=0")
    with pytest.raises(Invalid):
        svc.signup({"inviteToken": expired, "email": "late@example.test", "displayName": "Late", "password": "correct horse battery staple", "acceptDataNotice": True})
    with pytest.raises(Invalid):
        svc.login({"email": "careless@example.test", "password": "short"})
    grade(svc, student, 10, 1)
    sid = svc.draft(student)
    with pytest.raises(Invalid, match="EMPTY_FILE"):
        store(io.BytesIO(b""), tmp_path, "empty", "notes.txt")
    with pytest.raises(Invalid, match="FILE_TYPE_REJECTED"):
        store(io.BytesIO(b"not a photo"), tmp_path, "heic", "photo.heic")
    with pytest.raises(Invalid, match="FILE_TOO_LARGE"):
        store(io.BytesIO(b"a" * (20 * 1024 * 1024 + 1)), tmp_path, "big", "big.txt")
    persian = "گزارش-هفته.txt".encode().decode()
    svc.upload(student, sid, FileStorage(stream=io.BytesIO("استاپ ساختاری سخت.".encode()), filename=persian))
    saved = svc.file_list(sid)[0]["name"]
    assert saved == persian
    for n in range(11):
        svc.upload(student, sid, FileStorage(stream=io.BytesIO(b"note"), filename=f"extra-{n}.txt"))
    with pytest.raises(Invalid, match="MAX_12_FILES"):
        svc.upload(student, sid, FileStorage(stream=io.BytesIO(b"note"), filename="extra-last.txt"))
    queued = svc.submit_practical(student, sid)
    assert svc.submit_practical(student, queued) == queued

def test_failing_student_retakes_and_hits_hard_blocks(svc, bank):
    student, _, _ = join(svc, "failing@example.test", name="Failing Learner")
    rejected = grade(svc, student, 4, 1)
    assert rejected["verdict"] == "NOT_APPROVED" and rejected["assignment"] is None
    assert svc.entitlements(student["student"])["unlockedStage"] == 1
    with pytest.raises(Invalid):
        svc.draft(student)
    partial = grade(svc, student, 6, 1)
    assert partial["verdict"] == "PARTIALLY_APPROVED"
    assert svc.entitlements(student["student"])["status"] == "ASSIGNMENT_ISSUED"
    sid = practical(svc, student)
    mental = grade_practical(svc, sid, 100, "mental")
    assert mental["verdict"] == "NOT_APPROVED" and mental["finalHardBlock"] is True
    assert svc.entitlements(student["student"])["status"] == "REMEDIAL_ISSUED"
    assert svc.entitlements(student["student"])["unlockedStage"] == 1
    risk = grade_practical(svc, practical(svc, student), 100, "risk")
    assert risk["verdict"] == "NOT_APPROVED"
    reward = grade_practical(svc, practical(svc, student), 100, "rr")
    assert reward["verdict"] == "NOT_APPROVED"
    opened = grade_practical(svc, practical(svc, student), 70, "ok")
    assert opened["verdict"] == "PARTIALLY_APPROVED" and opened["unlockNext"] is True
    assert svc.entitlements(student["student"])["unlockedStage"] == 2
    assert svc.entitlements(student["student"])["status"] == "LESSON_OPEN"

def test_confused_student_recovery_second_device_and_privacy(svc, bank):
    student, first, _ = join(svc, "confused@example.test", name="Confused Learner")
    second = svc.login({"email": "confused@example.test", "password": "correct horse battery staple"})
    assert svc.auth(first)["student"] == svc.auth(second)["student"]
    link = svc.reset_link("confused@example.test")
    svc.reset_password({"token": link.rsplit("/", 1)[1], "password": "a-new-horse-battery"})
    with pytest.raises(Invalid):
        svc.auth(first)
    with pytest.raises(Invalid):
        svc.auth(second)
    fresh = svc.login({"email": "confused@example.test", "password": "a-new-horse-battery"})
    student = svc.auth(fresh)
    with pytest.raises(Invalid):
        svc.login({"email": "confused@example.test", "password": "correct horse battery staple"})
    decision = grade(svc, student, 10, 1)
    feedback = svc.quiz_feedback(student, decision["attemptId"])
    assert "correctAnswer" not in json.dumps(feedback)
    echo = svc.queue()
    assert echo == []
    other, _, _ = join(svc, "other-confused@example.test", name="Other Learner")
    with pytest.raises(Invalid):
        svc.quiz_feedback(other, decision["attemptId"])
    with pytest.raises(Invalid):
        svc.authorize(student, 8)
    assert "answer" not in json.dumps(svc.me(student))

def test_owner_override_window_and_admin_role(svc, bank):
    student, _, _ = join(svc, "override@example.test", name="Override Learner")
    decision = grade(svc, student, 10, 1)
    with svc.db.tx() as c:
        c.execute("UPDATE mentor_decisions SET delivered_at=? WHERE id=?", (0, decision["decisionId"]))
    with pytest.raises(Invalid, match="OVERRIDE_WINDOW_CLOSED"):
        svc.override(decision["decisionId"], "Too late to retract")
    with svc.db.tx() as c:
        c.execute("UPDATE mentor_decisions SET delivered_at=? WHERE id=?", (int(time.time()), decision["decisionId"]))
    svc.override(decision["decisionId"], "Mentor correction within a day")
    assert svc.db.rows("SELECT state FROM mentor_decisions WHERE id=?", (decision["decisionId"],))[0]["state"] == "RETRACTED"
    assert any(item["kind"] == "quiz_assessment" for item in svc.queue())
    with svc.db.tx() as c:
        c.execute("UPDATE students SET role='ADMIN' WHERE email=?", ("override@example.test",))
    assert svc.me(svc.auth(svc.login({"email": "override@example.test", "password": "correct horse battery staple"})))["role"] == "ADMIN"
    status = svc.db.rows("SELECT count(*) AS n FROM students")[0]["n"]
    assert status >= 1

def test_postgres_backup_restore_roundtrip(pg_url, tmp_path):
    from sfa_api.config import Config
    from sfa_api.service import Service
    dump = tmp_path / "sfa.dump"
    cfg = Config("postgresql://unused", "b" * 32, "c" * 64, root=tmp_path, answer_key_path=str(tmp_path / "keys"), origin="https://academy.example.test")
    cfg.database_url = pg_url
    svc = Service(cfg)
    student, _, _ = join(svc, "backup@example.test", name="Backup Learner")
    sid = student["student"]
    bind = pg_url.split("@", 1)[1]
    host, port_db = bind.split(":")
    port, dbname = port_db.split("/")
    pg = next(Path(p) for p in ("/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/15/bin") if Path(p, "pg_dump").is_file())
    env = {**os.environ, "PGHOST": host, "PGPORT": port, "PGUSER": "postgres", "PGDATABASE": dbname}
    subprocess.run([str(pg / "pg_dump"), "--format=custom", "--file", str(dump)], check=True, env=env)
    tables = (
        "files", "submissions", "quizzes", "events", "mentor_decisions", "decisions", "weeks",
        "weaknesses", "notifications", "outbox", "responses", "sessions", "resets", "links",
        "claims", "invites", "nonces", "rate", "settings", "legacy_imports", "students", "schema_migrations",
    )
    with svc.db.tx() as c:
        for table in tables:
            c.execute("DELETE FROM " + table)
    assert svc.db.rows("SELECT 1 FROM students WHERE student=?", (sid,)) == []
    subprocess.run([str(pg / "pg_restore"), "--data-only", "--disable-triggers", "--dbname", dbname, str(dump)], check=True, env=env)
    assert svc.db.rows("SELECT email FROM students WHERE student=?", (sid,))[0]["email"] == "backup@example.test"
