# Grading loop: plan missing on A8, and the daily trade call

## A8 with no Final Paper Plan

There is no `REMEDIAL` verdict. The grader sends the existing practical decision with:

- `verdict: "NOT_APPROVED"`
- `unlockNext: false`
- `finalHardBlock: false`
- a same-stage `remedialAssignment` for week+1
- envelope `reasonCode: "PLAN_MISSING_REMEDIAL"`
- no `riskEvidence` and no `noPlan`

The server checks that the week's `plan_required` flag is true (A8 only). Any other verdict on this code is `PLAN_MISSING_REMEDIAL_ONLY`. `noPlan` on A8 is still `PLAN_REQUIRED_FOR_WEEK`.

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

The next upload uses that new week's due Friday, same as any other remedial. The student dashboard, the student Telegram line, and the owner Telegram line say "plan missing: redo and re-upload" / "طرح نیست: دوباره انجام دهید و دوباره بارگذاری کنید". They do not say "not approved".

## Per-day trade call

Each `DAILY_LOG_V1` entry has `dayCall: "TRADE" | "NO_TRADE"` and an optional short `dayCallReason`. A recorded trade is `dayCall: "TRADE"` or a paper plan on the entry. The queue `dailyLog` block reports `tradeDays`, `noTradeDays`, `tradesOnNoTradeDays`, and `tradeOnNoTradeDay` (the dates). The server does not invent a point penalty. `noPlan` is accepted only when that week has zero recorded trades (`NO_PLAN_REQUIRES_ZERO_TRADES` otherwise), and only when `plan_required` is false.
