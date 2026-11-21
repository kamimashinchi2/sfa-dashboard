# Rubric, schema and contract changes for the daily-log practical model (FINAL; needs SFA Platform code changes)

Status: **FINAL**. Approved by Kamyar 2026-11-19 ("approve all", relayed by Echo). D1–D5 and K1–K12 adopted as proposed. Follow-up decision 2026-11-19 (Kamyar via Echo, Q1/K10/G11): the Final Paper Plan is required in A8 only; in M1–M5, A6 and A7 a grounded no-trade conclusion with no plan is allowed, so decisions there may use `noPlan:true` + a reason instead of `riskEvidence` (§3A). Round 3 (2026-11-19, Kamyar via Echo; names aligned with PR #14 head `e402081` and its `docs/practical-redesign/grading-loop.md`): an A8 file with no plan is NOT_APPROVED with envelope `reasonCode:"PLAN_MISSING_REMEDIAL"` and a same-stage remedial (§3B); each daily entry carries a required `dayCall` and an optional `dayCallReason`, and `noPlan` is accepted only with zero recorded trades (§2, §3A). Items that were marked proposed or needing owner confirmation are now decided. Nothing here is implemented yet: repo changes go through SFA Platform as a PR that Kamyar reviews and deploys himself.

Base: repo `main` @ `ca0dd51`, `backend/sfa-academy-v6/` (`sfa_api/contracts.py`, `grading.py`, `risk.py`, `service.py`, `core.py`, `practical-decision.schema.json`, `assignment.schema.json`, `api-contract.md`) and the frontend `app/lib/academy/grading.ts` and `contracts.ts`.
None of this is implemented. It should be bundled into **its own PR**, separate from the quiz-leak and scoring-alignment PR, and reviewed by Kamyar before anything goes to main.

## 1. What stays the same
- The scores are `risk` 0–40, `technicalMacro` 0–40, and `journalPsychology` 0–20. Thresholds come from policy: practical approved at 80, partial at 65; quiz approved at 80, partial at 60.
- `riskRules` constants: `maxRiskPct:"1"`, `hardStructuralStop:true`, `minNetRR:"2"`, `noSignals:true`.
- `risk.hard_block(riskEvidence)` and `FINAL_HARD_BLOCK_MISMATCH` stay unchanged, and still apply to every decision that carries `riskEvidence` (all of A8; any other week where a plan was submitted). A `noPlan` decision (§3A) has no `riskEvidence`, so `hard_block()` is not called for it. A mental stop, no stop, risk above 1%, or net R:R below 2 still means `finalHardBlock:true`, which forces NOT_APPROVED.
- Same-stage remedial on NOT_APPROVED; `nextAssignment:null`; the 24h override; the APPROVAL_REQUIRED gate; stage 8 leads to DOSSIER_READY.

## 2. New: daily-log data in the grading API packet
Add `dailyLog` to every `practical_submission` queue item (`GET /echo/v1/queue`). It is built by the server only and never taken from the client:
```json
"dailyLog": {
  "timezone": "Europe/Amsterdam",
  "assignmentIssuedAtISO": "2026-11-23T10:02:11+01:00",
  "windowStartLocalDate": "2026-11-24",
  "dueFridayLocalDate": "2026-11-27",
  "submittedAtISO": "2026-11-27T18:40:03+01:00",
  "requiredDays": 3,
  "countedDays": 4,
  "countedLocalDates": ["2026-11-24","2026-11-25","2026-11-26","2026-11-27"],
  "entries": [
    {
      "entryId": "de_3f9c…",
      "localDate": "2026-11-24",
      "weekday": "TUE",
      "eligible": true,
      "ineligibleReason": null,
      "createdAtISO": "2026-11-24T07:41:55+01:00",
      "lastEditedAtISO": "2026-11-24T08:05:12+01:00",
      "lockedAtISO": "2026-11-25T00:00:00+01:00",
      "revisionCount": 2,
      "taskIds": ["M3-C1","M3-C2","S2a"],
      "fields": { "routine": {…}, "observations": "…", "currentApplication": "…", "spiralApplication": "…", "paperPlan": {…} | null, "selfCheck": "…" },
      "dayCall": "TRADE" | "NO_TRADE",
      "dayCallReason": "…" | null,
      "files": [{ "fileId": "…", "name": "…", "size": 0, "digest": "sha256…", "mime": "image/png" }],
      "contentDigest": "sha256 of canonical fields+file digests"
    }
  ]
}
```
- `countedDays` is the number of distinct `localDate` values among entries that meet all of these:
  - `eligible` (Mon–Fri; after the issue date; on or before the due Friday; created before `submittedAtISO`)
  - locked, or created on the due Friday before submission
  - the structural minimum is met: at least 1 core `taskId` for the current week, and, from stage 2 on, at least 1 spiral `taskId`
  - non-empty `observations` and `currentApplication`
- **Per-day call (decided 2026-11-19; names as in PR #14, `validate_daily_payload` and `trade_call_summary` in `sfa_api/daily.py`):**
  - Each entry has a required `dayCall` (`TRADE` | `NO_TRADE`; missing is `DAY_CALL_REQUIRED`) and an optional `dayCallReason` (up to 500 characters, `DAY_CALL_REASON_INVALID` otherwise), top-level on the entry next to `taskIds`. The server does **not** require a reason or check grounding, and does **not** require a complete plan on a TRADE entry: it only requires that a structured `paperPlan`, when present, has all the `PAPER_KEYS`. Grounding of NO_TRADE and risk evidence of TRADE are rubric matters for Mentor.
  - A **recorded trade** is an entry with `dayCall:"TRADE"` **or any entry with a structured `paperPlan`** (even if its call is `NO_TRADE`).
  - The `dailyLog` block adds, per week row, counts over every entry (eligible or not): `tradeDays` (dates with a recorded trade), `noTradeDays` (dates whose entries are all NO_TRADE with no plan), `tradesOnNoTradeDays` (the number of flagged dates), and `tradeOnNoTradeDay` (the flagged dates: a date with a NO_TRADE entry and a recorded trade). `recordedTrades` equals `tradeDays`. Built by the server only; the grader cannot change them.
  - **The server deducts nothing.** Scoring use is Mentor-side owner policy (`spec.md` §1.4A): a flagged trade lowers Risk Discipline and Journal & Psychology, as discretionary deductions with entry IDs quoted. It is not a HARD_BLOCK, not a `routineGate` input, and no other penalty is added.
  - The call is stored in the append-only revision history, so changing it later leaves a trace.
- Remedial weeks (decided D2): only entries belonging to the current `week` row are listed or counted. Earlier weeks' entries are available read-only through a new `GET /echo/v1/daily-log?student=…&week=…` for spiral and weakness evidence.
- Evidence references in decisions may use `daily:<entryId>` and `daily:<entryId>:file:<fileId>`.
- The packet never includes student contact details, credentials, or any answer key.

## 3. New: `routineGate` in sfa-practical-decision (schemaVersion 3)
Add the required object:
```json
"routineGate": {
  "requiredDays": 3,
  "serverCountedDays": 4,
  "genuineDays": 3,
  "genuineEntryIds": ["de_…","de_…","de_…"],
  "rejectedEntries": [{ "entryId": "de_…", "reason": "Template copied from 2026-11-24; no same-day observation time or source." }],
  "passed": true
}
```
Schema (JSON Schema additions): `requiredDays` const 3 (or policy value); `serverCountedDays` integer 0–31; `genuineDays` integer 0–31; `genuineEntryIds` array of ID pattern, max 93; `rejectedEntries` array of `{entryId: ID, reason: string 5..500}`, max 93; `passed` boolean. `additionalProperties:false`.

**Validation in `contracts.validate_decision` (Python is the reference):**
1. `routineGate.requiredDays == cfg.daily_log_min_days` (3).
2. `serverCountedDays ==` the server's own `countedDays` for the target submission. Mentor cannot inflate it (new error `ROUTINE_COUNT_MISMATCH`).
3. Every `genuineEntryIds` value is a counted entry of this submission's week. `genuineDays == len({localDate of genuineEntryIds})` and `genuineDays <= serverCountedDays`.
4. Every counted entry that is not in `genuineEntryIds` and sits on a counted day with no other genuine entry appears in `rejectedEntries` with a reason. Mentor must justify each removed day.
5. `passed == (genuineDays >= requiredDays)`.
6. The verdict becomes `expected = verdict(sum(scores), cfg.practical_approved, cfg.practical_partial, hard_block = o['finalHardBlock'] or not o['routineGate']['passed'])`.
7. `unlockNext == (expected != 'NOT_APPROVED' and stage < 8)`, as today. A failed gate therefore always means `unlockNext:false` plus a same-stage `remedialAssignment` for week+1.
8. The gate is **not** a risk event. It does not change `finalHardBlock`, and it is not written to `FINAL_PLAN_RISK_EVIDENCE`. Write a separate event `ROUTINE_GATE` with the gate object to the cumulative report.

Why it is separate from HARD_BLOCK: HARD_BLOCK is computed deterministically from risk evidence, while genuineness is a Mentor judgement bounded by a server count. Keeping them separate keeps the risk audit trail clean and lets the student see *why* they failed.

`grading.py`: change nothing in `verdict()`. Pass the OR'd flag in. Optionally add `routine_failed` as a named parameter for clarity.

## 3A. The `noPlan` path (decided 2026-11-19; names as in PR #14, head `e402081`)
**Rule:** the Final Paper Plan is **required in A8 only** (K10). In M1–M5, A6 and A7 it is optional, and a decision may use `noPlan:true` **only if the week had zero recorded trades** (`tradeDays` is 0, §2). Grounding of the no-trade days is judged as a normal `technicalMacro` rubric matter, with no separate penalty and no new penalty code.

**Envelope.** A practical decision is submitted as exactly one of:
```json
{ "requestId": "...", "leaseToken": "...", "decision": { ... }, "riskEvidence": { "currentEquity": "10000", "riskAmount": "99.20", "netReward": "220.80", "stopType": "STRUCTURAL_HARD", "evidenceRefs": ["..."] } }
```
```json
{ "requestId": "...", "leaseToken": "...", "decision": { ... }, "noPlan": true, "noPlanReason": "No Friday plan and no recorded trade this week. All five entries are NO_TRADE, grounded in daily:<entryId> rows at 14:35 and 15:20; no timestamped reaction for the 15-60 minute window." }
```
```json
{ "requestId": "...", "leaseToken": "...", "decision": { ... }, "reasonCode": "PLAN_MISSING_REMEDIAL" }
```
(the third is the A8 path, §3B). Allowed envelope keys: `requestId, leaseToken, decision, riskEvidence, noPlan, noPlanReason, reasonCode`.

**Week flag.** `weeks.plan_required` (set at week-row creation from `sfa_api/plan_policy.py`, the only default table: stages 1–7 `optional`, stage 8 `required`). The queue shows it as `weekPlanRequired` (boolean) and `planPolicy` (`required` | `optional`), the same bit.

**Server validation (practical decisions only):**
1. Exactly one of `riskEvidence`, `noPlan:true`, or `reasonCode`. Neither: `RISK_EVIDENCE_REQUIRED_PENDING`. `riskEvidence` with `noPlan`: `PLAN_AND_NO_PLAN_CONFLICT`; `reasonCode` with either: also `PLAN_AND_NO_PLAN_CONFLICT`.
2. `noPlan:true` on a week with `plan_required == true` (A8): `PLAN_REQUIRED_FOR_WEEK`. An A8 file with no plan uses §3B instead.
3. `noPlanReason`: required with `noPlan:true`, 20–500 characters, else `NO_PLAN_REASON_REQUIRED`.
4. `noPlan:true` when the week has any recorded trade (`dayCall:TRADE` or any structured paper plan on any entry of the week row): **`NO_PLAN_REQUIRES_ZERO_TRADES`**. The server computes this itself.
5. With `noPlan:true` (and with `reasonCode`), `finalHardBlock` must be `false`, else `FINAL_HARD_BLOCK_MISMATCH`.
6. The verdict rule is unchanged for `noPlan`: `verdict(sum(scores), cfg.practical_approved, cfg.practical_partial, hard_block = finalHardBlock or not routineGate.passed)`. The routine gate applies as usual.
7. Cumulative report: a `NO_PLAN` event (with `noPlanReason`) instead of `FINAL_PLAN_RISK_EVIDENCE`; `ROUTINE_GATE` is still written.
8. `riskEvidence` keeps the exact five keys whenever it is sent.

**PENDING (owner/Platform decision, open question 2): which trade the `riskEvidence` describes for a week that has recorded trades but no Friday plan.** Working proposal only: if the Friday file has a plan, `riskEvidence` is built from it, as today. If a non-A8 week has trades but no Friday plan, `riskEvidence` is built from the week's worst trade entry (any MENTAL or NONE stop; otherwise the highest `riskAmount` as a share of equity; otherwise the lowest net reward per unit of risk), with every trade's `daily:<entryId>` in `evidenceRefs`, and the server's `hard_block()` rule applies to that envelope. Mentor does not apply this until it is confirmed; until then such a request stays pending and is reported.

**PENDING (owner decision, open question 1): whether an unsafe daily trade is a HARD_BLOCK.** As written, `hard_block()` reads only the `riskEvidence` envelope. With a clean Friday plan, a daily TRADE with a mental stop, risk above 1% or net R:R below 1:2 is a Risk Discipline deduction. Not changed.

**Mentor's side (not enforced by the server):** Mentor uses `noPlan` only when the Friday file has no plan and the packet shows `tradeDays` 0; a plan that is in the file is graded and sent with `riskEvidence`.

**Student-visible:** "No Final Paper Plan this week (grounded no-trade week)" with the `noPlanReason`; the gate result as before. **Packet:** `weekPlanRequired`, `planPolicy` and the per-day fields in §2.

**Schema.** The `decision` object is unchanged for this path; `noPlan`, `noPlanReason` and `reasonCode` are envelope-level.

## 3B. A8 Friday file with no Final Paper Plan: `PLAN_MISSING_REMEDIAL` (decided 2026-11-19; as in PR #14, head `e402081`, `docs/practical-redesign/grading-loop.md`)
**Decision (Kamyar via Echo):** an A8 upload with no Final Paper Plan is a remedial with re-upload, not a plain "not approved" for the student. **Mapping (Platform, final):** there is no `REMEDIAL` verdict. The grader sends the existing practical decision with:
- `verdict: "NOT_APPROVED"`, `unlockNext: false`, `finalHardBlock: false`
- a same-stage `remedialAssignment` for week+1 (and `nextAssignment: null`)
- envelope `reasonCode: "PLAN_MISSING_REMEDIAL"`, with no `riskEvidence` and no `noPlan`

**Server checks:** the week's `plan_required` must be true (A8 only), else `PLAN_MISSING_A8_ONLY`. Any verdict other than NOT_APPROVED, or `unlockNext` true, with this code is `PLAN_MISSING_REMEDIAL_ONLY` (so is a `reasonCode` other than `PLAN_MISSING_REMEDIAL`). The verdict is not recomputed from the scores for this code, but the decision still carries the usual `scores` and, on DAILY_LOG_V1, `routineGate`. `noPlan` on A8 stays `PLAN_REQUIRED_FOR_WEEK`. A `PLAN_MISSING_REMEDIAL` event is written to the cumulative report.

**After delivery (ordinary remedial path):**
| Field | Value |
| --- | --- |
| stored `decision.verdict` | `NOT_APPROVED` |
| assessed week `practical_verdict` | `NOT_APPROVED` |
| next week `state` | `REMEDIAL_ISSUED` (the assessed week passes through `PRACTICAL_ASSESSED`) |
| next week `stage` | same stage (8); student `stage` unchanged |
| student `current_week` | week+1 |
| report `reasonCode` | `PLAN_MISSING_REMEDIAL` |

The next upload uses the new week's due Friday, as in any remedial; the daily count follows the ordinary remedial rule D2 (fresh count on the new week row).

**Student-visible:** the dashboard, the student Telegram line and the owner Telegram line say EN "plan missing: redo and re-upload" / FA «طرح نیست: دوباره انجام دهید و دوباره بارگذاری کنید» (PR #14's strings), not "not approved".

**Mentor's rule:** use this path only when the A8 Friday file has no Final Paper Plan at all. An A8 plan that is present but flawed is graded normally (HARD_BLOCK rules unchanged). Until PR #14 is deployed, an A8 Friday file with no plan stays pending and is reported.

## 4. Assignment changes (quiz decision `assignment` and practical `remedialAssignment`)
New required fields (assignment schemaVersion 2, accepted only when `practicalModel == "DAILY_LOG_V1"`):
```json
"dailyTasks": [
  { "taskId": "M3-C1", "kind": "CORE", "stage": 3, "skill": "H4/H1 direction vs M15/M5 execution", "task": {"fa":"…","en":"…"}, "minDays": 3 },
  { "taskId": "S2a",   "kind": "SPIRAL", "stage": 2, "skill": "PDH/PDL marking", "task": {"fa":"…","en":"…"}, "minDays": 1 },
  { "taskId": "W-weak-hard-stop", "kind": "WEAKNESS", "weaknessId": "weak-hard-stop", "task": {"fa":"…","en":"…"}, "minDays": 1 }
],
"dailyLogRequirement": { "minDays": 3, "eligibleWeekdays": ["MON","TUE","WED","THU","FRI"], "timezone": "Europe/Amsterdam", "freshCount": true },
"fridayDeliverable": { "fa": "…", "en": "…" }
```
- Validation: at least 1 CORE task. SPIRAL tasks must cover every earlier stage, the same rule as `spiralReview`. Every required weakness must have a WEAKNESS task or a `weaknessDrills` entry. `taskId` values must be unique and match `^[A-Za-z0-9_.:-]{1,40}$`.
- `dueAtISO`: **replace** the check at `service.py:194-195` (`timedelta(days=5) <= delta <= timedelta(days=9)` → `DUE_DATE_MUST_BE_ABOUT_ONE_WEEK`) with `dueAtISO == server_due_friday(issued_at)`. Under decided D4, that means 23:59:59 Europe/Amsterdam on the first Friday that has at least 4 eligible weekdays after the issue date. Error: `DUE_DATE_MUST_BE_SERVER_FRIDAY`. To avoid a race at midnight, the server should expose the computed value (`GET /echo/v1/queue` item: `nextDueFridayISO`).
- The existing `coreTasks`, `spiralReview`, `weaknessDrills`, `deliverables`, and `riskRules` stay, so the existing dashboard keeps rendering.

## 5. Queue policy additions
`GET /echo/v1/queue` → `policy` adds `dailyLogMinDays:3`, `dailyLogTimezone:"Europe/Amsterdam"`, `practicalWindow:"DUE_FRIDAY_ONLY"`, `practicalModel:"DAILY_LOG_V1"`. Config entries go in `config.py` and `/etc/sfa` (not secrets).

## 6. Frontend `grading.ts` and `contracts.ts`
- Mirror the verdict rule: NOT_APPROVED if `finalHardBlock || !routineGate.passed`, otherwise thresholds 80/65. There is no "owner review" path for a HARD_BLOCK at 80 or above. This is the alignment already reported, with Python as the reference.
- Type additions: `RoutineGate`, `DailyLogEntry`, `DailyTask`. Student-visible: the gate result (`genuineDays`, `passed`, rejected reasons), never other students' data, never Echo-only fields.

## 7. Migration and compatibility
- Submissions created before the switch stay on schemaVersion 2 with no gate. Decide the cutover by week row: `weeks.practical_model` (new column, default `LEGACY` for existing rows, `DAILY_LOG_V1` for weeks issued after deploy).
- Add `weeks.plan_required` (§3A) in the same migration: `true` for stage 8, `false` for stages 1–7.
- Phase 2 live test (kami, S10001) runs on the current model. Don't switch the model mid-test.

## 8. Tests SFA Platform should add
- Gate pass and fail at exactly 2 vs 3 genuine days.
- Mentor tries `genuineDays > serverCountedDays`, giving `ROUTINE_COUNT_MISMATCH`.
- High score (≥80) with a failed gate gives NOT_APPROVED, `unlockNext:false`, and a remedial assignment.
- HARD_BLOCK and failed gate together give NOT_APPROVED, and both are recorded.
- A remedial week has a fresh count, and the previous week's entries are excluded.
- `noPlan:true` with `noPlanReason` on M1–M5, A6 and A7 is accepted, with `finalHardBlock:false` and a `NO_PLAN` event, and no `FINAL_PLAN_RISK_EVIDENCE` event.
- `noPlan:true` on A8 (stage 8) is rejected with `PLAN_REQUIRED_FOR_WEEK`; A8 with valid `riskEvidence` is accepted.
- `noPlan:true` on a non-A8 week with any `dayCall:TRADE` entry, or any structured paper plan (even on a NO_TRADE entry), is rejected with `NO_PLAN_REQUIRES_ZERO_TRADES`; with `tradeDays` 0 it is accepted.
- A daily entry without `dayCall` is rejected (`DAY_CALL_REQUIRED`); a date with a NO_TRADE entry and a recorded trade shows in `tradeOnNoTradeDay` and `tradesOnNoTradeDays`, and the grader cannot change it; no points are deducted by the server.
- A8 Friday file with no plan: `reasonCode:"PLAN_MISSING_REMEDIAL"`, NOT_APPROVED, `unlockNext:false`, `finalHardBlock:false`, same-stage remedial and no `riskEvidence` is accepted; any other verdict with that code is `PLAN_MISSING_REMEDIAL_ONLY`; the code on a non-A8 week is `PLAN_MISSING_A8_ONLY`; `reasonCode` with `riskEvidence` or `noPlan` is `PLAN_AND_NO_PLAN_CONFLICT`; the next week is `REMEDIAL_ISSUED` at stage 8 with a new due Friday, and no `DOSSIER_READY`.
- Both `riskEvidence` and `noPlan` gives `PLAN_AND_NO_PLAN_CONFLICT`; neither gives `RISK_EVIDENCE_REQUIRED_PENDING`; `noPlan` without a reason gives `NO_PLAN_REASON_REQUIRED`; `noPlan` with `finalHardBlock:true` gives `FINAL_HARD_BLOCK_MISMATCH`.
- A `noPlan` decision with a failed routine gate still gives NOT_APPROVED.
- Due-Friday computation across DST changes (last Sunday of March and October) and for issue on each weekday.
