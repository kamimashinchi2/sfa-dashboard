"""The Python grader and the TypeScript grader pin the same shared vectors."""
import json
from pathlib import Path

from sfa_api.academy_rules import effective_rules
from sfa_api.config import Config
from sfa_api.grading import verdict
from sfa_api.risk import hard_block

ROOT = Path(__file__).resolve().parents[3]
VECTORS = json.loads((ROOT / "shared" / "scoring-vectors.json").read_text())
LEGACY = effective_rules(None, json.loads((ROOT / "shared" / "legacy-rules.json").read_text()))


def test_thresholds_match_the_shared_file():
    cfg = Config("postgresql://unused", "b" * 32, "c" * 64)
    assert cfg.quiz_approved == VECTORS["quiz"]["approvedMin"] == 80
    assert cfg.quiz_partial == VECTORS["quiz"]["partialMin"] == 60
    assert cfg.practical_approved == VECTORS["practical"]["approvedMin"] == 80
    assert cfg.practical_partial == VECTORS["practical"]["partialMin"] == 65
    assert VECTORS["practical"]["caps"] == {"risk": 40, "technicalMacro": 40, "journalPsychology": 20}


def test_quiz_and_practical_vectors_match_verdict():
    cfg = Config("postgresql://unused", "b" * 32, "c" * 64)
    for row in VECTORS["quizCases"]:
        assert verdict(row["score"], cfg.quiz_approved, cfg.quiz_partial, False) == row["verdict"]
    for row in VECTORS["practicalCases"]:
        total = row["risk"] + row["technicalMacro"] + row["journalPsychology"]
        assert total == row["total"]
        assert total <= 100
        assert row["risk"] <= 40 and row["technicalMacro"] <= 40 and row["journalPsychology"] <= 20
        result = verdict(total, cfg.practical_approved, cfg.practical_partial, row["hardBlock"])
        assert result == row["verdict"]
        assert (result != "NOT_APPROVED") is row["unlockEligible"]


def test_hard_block_vectors_match_risk_gate():
    for row in VECTORS["hardBlockCases"]:
        evidence = {
            "currentEquity": row["currentEquity"],
            "riskAmount": row["riskAmount"],
            "netReward": row["netReward"],
            "stopType": row["stopType"],
            "evidenceRefs": ["document:final-plan"],
        }
        assert hard_block(evidence, rules=LEGACY) is row["blocked"]
