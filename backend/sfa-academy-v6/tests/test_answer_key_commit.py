"""Answer-key lookup accepts the short build stamp Next already stores."""
import json
from pathlib import Path

import pytest

from sfa_api.contracts import Invalid
from sfa_api.grading import assess, load_key, normalize_commit
from .vectors import key, payload


FULL = "2302f9e" + ("a" * 33)
SHORT = "2302f9e"


def write_key(directory: Path, commit: str, name: str = "key.json"):
    directory.mkdir(parents=True, exist_ok=True)
    body = key()
    body["commit"] = commit
    (directory / name).write_text(json.dumps(body))
    return body


def test_normalize_commit_strips_and_lowercases():
    assert normalize_commit("  CA0DD51  ") == "ca0dd51"
    assert normalize_commit(FULL.upper()) == FULL
    assert normalize_commit(None) is None
    assert normalize_commit("zzzzzzz") is None
    assert normalize_commit("abc123") is None
    assert normalize_commit("abc123g") is None
    assert normalize_commit("") is None
    assert normalize_commit(123) is None


def test_short_sha_matches_full_sha_key(tmp_path):
    write_key(tmp_path, FULL)
    loaded = load_key(tmp_path, SHORT)
    assert loaded["commit"] == FULL
    assert load_key(tmp_path, FULL)["commit"] == FULL
    assert load_key(tmp_path, "  " + FULL.upper() + "\n")["commit"] == FULL


def test_uppercase_key_commit_matches_lowercase_stamp(tmp_path):
    write_key(tmp_path, FULL.upper())
    assert load_key(tmp_path, SHORT)["commit"] == FULL.upper()
    assert load_key(tmp_path, FULL)["commit"] == FULL.upper()


def test_prefix_matching_two_keys_is_rejected(tmp_path):
    write_key(tmp_path, FULL, "one.json")
    write_key(tmp_path, SHORT + ("b" * 33), "two.json")
    with pytest.raises(Invalid):
        load_key(tmp_path, SHORT)


def test_invalid_commit_returns_none(tmp_path):
    write_key(tmp_path, FULL)
    assert load_key(tmp_path, "zzzzzzz") is None
    assert load_key(tmp_path, "abc123") is None
    assert load_key(tmp_path, None) is None
    assert load_key(tmp_path, "not-a-commit") is None


def test_ambiguous_prefix_becomes_unverified(tmp_path):
    write_key(tmp_path, FULL, "one.json")
    write_key(tmp_path, SHORT + ("b" * 33), "two.json")
    quiz = payload()
    quiz["buildCommit"] = SHORT
    cfg = type("Cfg", (), {"answer_key_path": str(tmp_path), "quiz_approved": 80, "quiz_partial": 60})()
    result = assess(quiz, cfg)
    assert result["status"] == "UNVERIFIED"
    assert result["reason"] == "ANSWER_KEY_UNAVAILABLE_OR_INVALID"


def test_short_sha_unverified_quiz_is_recomputed_on_refresh(svc, account):
    student, _session = account
    quiz = payload()
    quiz["buildCommit"] = SHORT
    body = {k: quiz[k] for k in ("attemptId", "quizId", "buildCommit")} | {
        "items": [
            {k: item[k] for k in ("itemId", "itemHash", "kind", "studentAnswer", "touched", "reflection")}
            for item in quiz["items"]
        ]
    }
    first = svc.quiz_submit(body, student)
    assert first["assessment"]["status"] == "UNVERIFIED"
    assert first["assessment"]["reason"] == "ANSWER_KEY_MISSING"
    keys = Path(svc.config.answer_key_path)
    write_key(keys, FULL.upper())
    svc.refresh_assessments()
    stored = json.loads(svc.db.rows("SELECT assessment FROM quizzes WHERE attempt=?", (body["attemptId"],))[0]["assessment"])
    assert stored["status"] == "RECOMPUTED"
    assert stored["verdict"] == "APPROVED"
    assert stored["score"] == 100
