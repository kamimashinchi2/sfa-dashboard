# Grading loop: plan missing on A8, and the daily trade call

This file is the server's rule. `echo-weekly-grading-loop.md`, `grading-loop-update.md`, `spec.md`, `contract-changes.md`, `curriculum-handoff.md`, and `site-requirements.md` are Mentor's notes, copied as written. Where those notes use a different working name, the code name in the table below is the one the server stores. Where they still say a structured paper plan on a no-trade day counts as a trade, or that the server does not check grounding, this file is the later rule.

## Name mapping

| Mentor working name | Code name |
| --- | --- |
| structured paper plan / Paper plan block | `paperPlan`, and only on a `dayCall:"TRADE"` entry |
| conditional plan in the text (A7-C1 WAIT, M3-C3 fallback) | `conditionalPlan`, optional, and only on a `dayCall:"NO_TRADE"` entry |
| timestamped readings in `dayCallReason` or the observation | `groundingRefs`, a short list. The exact marker `Observed reaction unavailable` may be `dayCallReason` or one of the refs |
| recorded trade (`dayCall:TRADE` or any paper plan) | a `dayCall:"TRADE"` entry only. `tradeDays` is the number of those dates |
| `weeks.plan_required` | the stored column. The queue shows the same bit as `weekPlanRequired` and `planPolicy` |
| Technical & Macro / Journal & Psychology / Risk | `scores.technicalMacro`, `scores.journalPsychology`, `scores.risk` |
| HARD_BLOCK | `finalHardBlock`, computed only from the Friday `riskEvidence` envelope |

## A8 with no Final Paper Plan

There is no `REMEDIAL` verdict. The grader sends the existing practical decision with:

- `verdict: "NOT_APPROVED"`
- `unlockNext: false`
- `finalHardBlock: false`
- a same-stage `remedialAssignment` for week+1
- envelope `reasonCode: "PLAN_MISSING_REMEDIAL"`
- no `riskEvidence` and no `noPlan`

`validate_decision` accepts that shape on a week whose `plan_required` flag is true (A8 only). Any other verdict on this code is `PLAN_MISSING_REMEDIAL_ONLY`. `noPlan` on A8 is still `PLAN_REQUIRED_FOR_WEEK`. Sending `riskEvidence` or `noPlan` with the code is `PLAN_AND_NO_PLAN_CONFLICT`.

The decision still carries `scores` and, on `DAILY_LOG_V1`, `routineGate`. Both are stored. The verdict is not `verdict(scores)` and a passed or failed gate does not change it. The student report, the student dashboard, and the student Telegram line show "plan missing: redo and re-upload" / "طرح نیست: دوباره انجام دهید و دوباره بارگذاری کنید" plus the feedback. They do not include `scores`, `routineGate`, or the words "not approved". The Echo report keeps the stored scores and gate.

After delivery the state fields are the ordinary remedial path:

| Field | Value |
| --- | --- |
| stored `decision.verdict` | `NOT_APPROVED` |
| assessed week `practical_verdict` | `NOT_APPROVED` |
| assessed week `state` | `REMEDIAL_ISSUED` is the next week, after `PRACTICAL_ASSESSED` |
| next week `state` | `REMEDIAL_ISSUED` |
| next week `stage` | same stage (8) |
| student `stage` | unchanged |
| student `current_week` | week+1 |
| report `reasonCode` | `PLAN_MISSING_REMEDIAL` |

The next upload uses that new week's due Friday, same as any other remedial.

## Per-day trade call

Each `DAILY_LOG_V1` entry has `dayCall: "TRADE" | "NO_TRADE"`.

- A trade is a `TRADE` entry. `tradeDays` in the queue packet is the number of dates with one. `noPlan` is rejected with `NO_PLAN_REQUIRES_ZERO_TRADES` when that count is above 0.
- `paperPlan` is required on a `TRADE` entry and rejected on a `NO_TRADE` entry. The server checks that the fields are present (entry, hard stop, target, size/risk %, and the rest of the worksheet). It does not apply the Friday HARD_BLOCK rules to a daily plan.
- `conditionalPlan` is optional and only legal on a `NO_TRADE` entry. It does not count as a trade, does not raise `tradeOnNoTradeDay`, and does not block `noPlan`. Use it for a WAIT plan (A7-C1) or a fallback plan (M3-C3).
- A `NO_TRADE` entry needs at least one `groundingRefs` item, or the exact marker `Observed reaction unavailable`.
- `tradeOnNoTradeDay` lists a date only when that date has both a `TRADE` entry and a `NO_TRADE` entry. The server does not invent a point penalty.

## Open, not implemented

Two owner questions stay open. The server does not guess them:

- whether an unsafe daily paper trade (mental stop, risk above 1%, net R:R below 1:2) is a HARD_BLOCK even when the Friday plan is clean
- whether `riskEvidence` for a week with trades but no Friday plan is built from the week's worst trade
