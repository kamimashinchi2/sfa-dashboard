# Rubric, schema and contract changes for the daily-log practical model (FINAL; needs SFA Platform code changes)

Status: **FINAL**. Approved by Kamyar 2026-11-19 ("approve all", relayed by Echo). D1–D5 and K1–K12 adopted as proposed. Follow-up decision 2026-11-19 (Kamyar via Echo, Q1/K10/G11): the Final Paper Plan is required in A8 only; in M1–M5, A6 and A7 a grounded no-trade conclusion with no plan is allowed, so decisions there may use `noPlan:true` + a reason instead of `riskEvidence` (§3A). Items that were marked proposed or needing owner confirmation are now decided. Nothing here is implemented yet: repo changes go through SFA Platform as a PR that Kamyar reviews and deploys himself.

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

## 3A. New: the `noPlan` path (decided 2026-11-19, Kamyar via Echo)
**Rule:** the Final Paper Plan is **required in A8 only** (K10). In M1–M5, A6 and A7 it is optional, and a no-trade conclusion with no plan is allowed when it is grounded (timestamped readings, or "Observed reaction unavailable"; never an intraday path inferred from a daily close). Today every practical decision needs `riskEvidence` (`RISK_EVIDENCE_REQUIRED_PENDING`), so a no-plan practical cannot be submitted. Change:

**Envelope.** A practical decision is submitted as exactly one of:
```json
{ "requestId": "...", "leaseToken": "...", "decision": { ... }, "riskEvidence": { "currentEquity": "10000", "riskAmount": "99.20", "netReward": "220.80", "stopType": "STRUCTURAL_HARD", "evidenceRefs": ["..."] } }
```
```json
{ "requestId": "...", "leaseToken": "...", "decision": { ... }, "noPlan": true, "noPlanReason": "No Final Paper Plan in the Friday file. No-trade conclusion grounded in daily:<entryId> rows at 14:35 and 15:20; no timestamped reaction for the 15-60 minute window." }
```
(`noPlanReason` is the proposed field name for the reason; SFA Platform may rename it, and Mentor will follow the final name.)

**Week table.** Add `weeks.plan_required` (boolean, new column). Default by stage when the week row is created: `true` for stage 8 (A8), `false` for stages 1–7. It is set by the server, never by the client or Mentor. Existing rows get `false`, except an existing stage 8 row, which gets `true`.

**Server validation (practical decisions only; quizzes never carry either field):**
1. Exactly one of `riskEvidence` or `noPlan:true`. Neither: `RISK_EVIDENCE_REQUIRED_PENDING` (unchanged, the request stays pending). Both: `PLAN_AND_NO_PLAN_CONFLICT` (proposed code).
2. `noPlan:true` on a week with `plan_required == true`: rejected with **`PLAN_REQUIRED_FOR_WEEK`**. The request stays pending. If an A8 Friday file has no plan, Mentor does not invent one: it reports the request to Kamyar and Platform for a decision (the rules do not say what happens to a blank A8 Friday file; see leftover conflicts in `curriculum-handoff.md` §9).
3. `noPlanReason`: required with `noPlan:true`, a string of 20–500 characters, passed through the same text filters as feedback. Missing or too short: `NO_PLAN_REASON_REQUIRED`.
4. With `noPlan:true`, the decision's `finalHardBlock` must be `false` (no plan, so no risk event); otherwise `FINAL_HARD_BLOCK_MISMATCH`.
5. The verdict rule is unchanged: `verdict(sum(scores), cfg.practical_approved, cfg.practical_partial, hard_block = finalHardBlock or not routineGate.passed)`. The routine gate (§3) applies to `noPlan` decisions exactly as to others.
6. Cumulative report: for a `noPlan` decision write a `NO_PLAN` event (with `noPlanReason`) instead of `FINAL_PLAN_RISK_EVIDENCE`. `ROUTINE_GATE` is still written.
7. `riskEvidence` stays mandatory, with the exact five keys, whenever it is sent, and for every A8 decision.

**Mentor's side (not enforced by the server):** Mentor records `noPlan` only when the Friday file has no Final Paper Plan; a plan that is in the file is graded and sent with `riskEvidence` (so a student cannot avoid HARD_BLOCK by Mentor skipping a submitted plan). Whether the no-trade reasoning is grounded is a normal `technicalMacro` rubric matter. There is no separate penalty and no new points deduction.

**Student-visible:** the feedback shows "No Final Paper Plan this week (grounded no-trade conclusion)" with the `noPlanReason`; the gate result is shown as before.

**Packet.** Add `weekPlanRequired: boolean` (copy of `weeks.plan_required`) to the `dailyLog` object of every `practical_submission` queue item (§2), so Mentor sees whether `noPlan` is allowed before deciding.

**Schema.** `practical-decision.schema.json` is unchanged for the `decision` object (no new field inside `decision`); the two new fields are envelope-level. `api-contract.md` documents the XOR rule and the three new error codes. Frontend `contracts.ts`: add `NoPlanEnvelope` and `weekPlanRequired` to `DailyLogPacket`.

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
- Both `riskEvidence` and `noPlan` gives `PLAN_AND_NO_PLAN_CONFLICT`; neither gives `RISK_EVIDENCE_REQUIRED_PENDING`; `noPlan` without a reason gives `NO_PLAN_REASON_REQUIRED`; `noPlan` with `finalHardBlock:true` gives `FINAL_HARD_BLOCK_MISMATCH`.
- A `noPlan` decision with a failed routine gate still gives NOT_APPROVED.
- Due-Friday computation across DST changes (last Sunday of March and October) and for issue on each weekday.
