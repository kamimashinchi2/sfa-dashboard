import json
from pathlib import Path

from sfa_api.academy_rules import effective_rules, rules_for_stage
from sfa_api.paper_fields import classify_stop, parse_lenient_decimal
from sfa_api.risk import hard_block

ROOT = Path(__file__).resolve().parents[3]
APPROVED = json.loads((ROOT / "content" / "v3" / "rules.json").read_text())
LEGACY = effective_rules(None, json.loads((ROOT / "shared" / "legacy-rules.json").read_text()))


def evidence(stop="STRUCTURAL_HARD", risk="100", reward="200", **extra):
    body = {
        "currentEquity": "10000",
        "riskAmount": risk,
        "netReward": reward,
        "stopType": stop,
        "evidenceRefs": ["p"],
    }
    body.update(extra)
    return body


def test_legacy_fixture_still_blocks_a_mental_stop():
    assert hard_block(evidence("MENTAL"), rules=LEGACY) is True
    assert hard_block(evidence("NONE"), rules=LEGACY) is True
    assert hard_block(evidence(), rules=LEGACY) is False


def test_approved_file_changes_the_stop_gate():
    rules = effective_rules(None, APPROVED)
    assert rules["stopBlockMode"] == "NO_STOP_ONLY"
    assert rules["mentalStopIsHardBlock"] is False
    assert hard_block(evidence("MENTAL"), rules=rules) is False
    assert hard_block(evidence("NONE"), rules=rules) is True
    assert hard_block(evidence(stopMoved="unplanned"), rules=rules) is True
    assert hard_block(evidence(stopMoved="planned"), rules=rules) is False
    assert hard_block(evidence(), rules=rules) is False


def test_two_percent_is_allowed_only_in_l05():
    l05 = effective_rules("L05", APPROVED)
    l01 = effective_rules("L01", APPROVED)
    assert l05["maxRiskPctPerTrade"] == "2.00"
    assert l01["maxRiskPctPerTrade"] == "1.00"
    assert hard_block(evidence(risk="200", reward="400"), rules=l05) is False
    assert hard_block(evidence(risk="201", reward="500"), rules=l05) is True
    assert hard_block(evidence(risk="200", reward="400"), rules=l01) is True


def test_l05_packet_carries_situations_and_hides_approval():
    packet = rules_for_stage(5, APPROVED)
    assert packet["dailyActiveRiskCap"] == "STUDENT_PRESTATED"
    assert "75" in packet["weeklyCompliancePause"]
    assert packet["situations"]
    assert "approval" not in packet
    assert "Kamyar" not in json.dumps(packet)


def test_reset_test_account_refuses_a_student_and_clears_a_flagged_one(svc, account):
    from sfa_api.contracts import Invalid
    import pytest
    student, _session = account
    with pytest.raises(Invalid, match="TEST_ACCOUNT_REQUIRED"):
        svc.reset_test_account(student["student"])
    svc.enable_test_account(student["student"], 1, "bot E2E test")
    wiped = svc.reset_test_account(student["student"])
    assert wiped["reset"] is True and wiped["isTestAccount"] is True
    row = svc.db.rows("SELECT is_test_account, stage, current_week FROM students WHERE student=?", (student["student"],))[0]
    assert row["is_test_account"] and row["stage"] == 1 and row["current_week"] == 1
    assert len(svc.db.rows("SELECT week FROM weeks WHERE student=?", (student["student"],))) == 1


def test_old_free_text_paper_fields_parse():
    assert classify_stop("Hard structural stop (below the swept low)") == "HARD_STRUCTURAL"
    assert classify_stop("mental") == "MENTAL"
    assert classify_stop("") == "NONE"
    assert parse_lenient_decimal("1% (100)") == parse_lenient_decimal("1.00")
    assert parse_lenient_decimal("about 2.2") == parse_lenient_decimal("2.20")
