# Site requirements for SFA Platform: daily application log + Friday practical (FINAL)

Status: **FINAL**. Approved by Kamyar 2026-11-19 ("approve all", relayed by Echo). D1–D5 and K1–K12 adopted as proposed. Round 3 (2026-11-19, Kamyar via Echo; names as in PR #14 head `e402081`): the daily log gets a required per-day `dayCall` (TRADE / NO_TRADE) with an optional `dayCallReason` (below), and an A8 Friday file with no plan shows "plan missing: redo and re-upload" (NOT_APPROVED with `reasonCode:"PLAN_MISSING_REMEDIAL"`). Items that were marked proposed or needing owner confirmation are now decided. Nothing here is implemented yet: repo changes go through SFA Platform as a PR that Kamyar reviews and deploys himself.

These requirements go in their own PR, separate from the quiz-leak fix. Kamyar reviews before main. Kamyar deploys. Storage stays in Postgres plus local files (`/var/lib/sfa/uploads`), with no Google Drive and no email. Telegram is used for notifications only. Keep the student UI simple.

## 1. Daily log entries (dashboard)
- **Card:** "Today's log", shown only while the week state is `ASSIGNMENT_ISSUED` or `REMEDIAL_ISSUED`, on eligible days. The card shows:
  - the week's daily task menu, as checkboxes taken from `assignment.dailyTasks`
  - the routine header (R1 time and session are auto-filled from the server clock and are read-only; R2 calendar or "NEWS RISK: NOT ASSESSED"; R3 freshness select; R4 one line)
  - "What I observed (time and source)"
  - "How I applied this week's lesson"
  - "How I applied earlier weeks"
  - **"Today's call" (required; names as in PR #14, head `e402081`):** two buttons, EN "Trade today" / "No trade today" (FA «امروز معامله» / «امروز بدون معامله»), saved as `dayCall` = `TRADE` | `NO_TRADE` (missing: `DAY_CALL_REQUIRED`).
    - **No trade today:** shows one optional short field `dayCallReason` (up to 500 characters; EN "Short reason from timestamped readings, or Observed reaction unavailable"). The server does not check grounding; Mentor judges it.
    - **Trade today:** the entry should carry a complete paper plan (below). The server does not require it, but the rubric needs full risk evidence for a trade (equity, risk at most 1%, hard structural stop, sourced point value, lot rounded down, costs, net R:R at least 1:2).
    - A notice under the buttons: "A paper trade recorded on a day you called No trade is flagged to your mentor and counts against your Risk and Journal & Psychology scores. A filled Paper plan block counts as a trade."
    - The server counts a recorded trade as `dayCall:TRADE` **or any structured paper plan on the entry**. On a No trade entry, tell students to write conditional plans and sizing drills in the text fields, not in the Paper plan block.
    - **Gap to close (PR #14 as written):** the daily-log card in the PR sends `paperPlan: null` and shows no Paper plan block, so a Trade entry has no structured risk evidence. Recommended: show the Paper plan block when "Trade today" is chosen.
    - The call is stored in the append-only revision history, so changing it later leaves a trace.
  - an optional structured "Paper plan" block (equity, risk %, entry, stop level, stop type, point value and its source, lot, spread/costs, target, net R:R; labelled "Simulated — not an order")
  - "Self-check"
  - up to 4 screenshots (png/jpg/webp via the existing `uploads.store` checks)
- A persistent banner reads: "No live trade required. No signals."
- **Progress chip:** "Logged days: 2 / 3 (Mon–Fri, Amsterdam time)", with the next lock time shown.
- **Timestamps are server-only:** `created_at` and `updated_at` come from the DB server clock. `local_date` = `created_at` converted with `zoneinfo('Europe/Amsterdam')` (decided). The client time is ignored.
- **Editing:** allowed until 23:59:59 Europe/Amsterdam on `local_date`. After that the entry is **locked**: reject PUT/DELETE with `DAY_LOCKED`, and use a lazy check `now >= next_local_midnight(local_date)` so no cron job is needed. Every save writes an append-only revision (`daily_entry_revisions`). The grading packet exposes `revisionCount`, `lastEditedAtISO`, and the final content. Entries cannot be deleted by the student once saved (only edited while open).
- **Limits:**
  - 3 entries per local day (decided)
  - field length caps (for example 4,000 characters each)
  - the existing contact-detail filter (`contracts.text`)
  - rate limits per the existing `db.rate`
- **Per-day call at save (PR #14):** a missing `dayCall` is rejected (`DAY_CALL_REQUIRED`), an over-long reason is `DAY_CALL_REASON_INVALID`, and a structured paper plan must have all keys (`PAPER_PLAN_INVALID`). The week summary can show the server counts from the queue block (`tradeDays`, `noTradeDays`, `tradesOnNoTradeDays`, `tradeOnNoTradeDay`), for example "Trade days: 1, No-trade days: 3".
- **Friday upload with no plan:** for weeks where a plan is optional nothing changes in the form. For A8 the form says the Final Paper Plan is required. If the A8 file has no plan, the decision is NOT_APPROVED with envelope `reasonCode:"PLAN_MISSING_REMEDIAL"` and a same-stage remedial (`contract-changes.md` §3B). The student dashboard, the student Telegram line and the owner Telegram line say EN "plan missing: redo and re-upload" / FA «طرح نیست: دوباره انجام دهید و دوباره بارگذاری کنید» and not "not approved"; the next upload uses the new week's due Friday.
- **Eligibility:** Mon–Fri only count. Weekend saves are allowed but flagged `eligible:false`, reason `WEEKEND`. Entries dated after the practical submission are rejected (`WEEK_CLOSED`).
- **Remedial week (decided):** a fresh count. Entries are keyed by `(student, week)`, so earlier weeks are read-only history on the dashboard ("Previous weeks' logs").
- **Suggested tables (migration_002):**
  - `daily_entries(id TEXT PK, student TEXT, week INT, stage INT, local_date DATE, created BIGINT, updated BIGINT, body TEXT, digest TEXT, revision INT, eligible BOOL, ineligible_reason TEXT)`, with an index on `(student, week, local_date)`
  - `daily_entry_revisions(entry TEXT, revision INT, body TEXT, digest TEXT, saved BIGINT, PK(entry,revision))`
  - `daily_entry_files(id TEXT PK, entry TEXT, path TEXT, digest TEXT, name TEXT, size INT, mime TEXT)`
  - `weeks`: add `issued_at BIGINT`, `due_friday DATE`, `practical_model TEXT DEFAULT 'LEGACY'`, `plan_required BOOLEAN DEFAULT 0` (1 for stage 8 only; see `contract-changes.md` §3A)
- **Endpoints (student, session cookie):**
  - `GET /api/v1/daily-log?week=current` gives `{entries, countedDays, requiredDays, dueFriday, nextLockAtISO}`
  - `POST /api/v1/daily-log` creates today's entry
  - `PUT /api/v1/daily-log/<id>` edits while unlocked
  - `POST /api/v1/daily-log/<id>/files` uploads one file per call

## 2. Friday-only practical upload window
- Replace the dueAt check at `service.py:194-195` (assignment `dueAtISO` must be 5–9 days ahead) with the server-computed due Friday: the first Friday with at least 4 eligible weekdays after the issue date (decided D4), at 23:59:59 Europe/Amsterdam. The server, not Mentor, computes it, and the assignment's `dueAtISO` must equal it.
- `core.new_submission`, `service.upload`, and `core.submit` must all require `now_local.date() == weeks.due_friday` (00:00:00–23:59:59 Europe/Amsterdam). Otherwise return `PRACTICAL_WINDOW_CLOSED` with `{opensAtISO, closesAtISO}`. Today these only check the week state, with no time window.
- Dashboard: "Practical upload opens Friday 27 Nov, 00:00, and closes 23:59 (Amsterdam time)", plus a countdown. Show the gate status before submit: "You have 2 of 3 logged days. With fewer than 3 genuine days, the practical cannot pass." This is a warning only. Don't block the submit, because the student may still want feedback.
- **Missed Friday (decided D5):**
  - When the due Friday passes with no submission, the week moves to `PRACTICAL_OVERDUE`, a new state allowed from `ASSIGNMENT_ISSUED` or `REMEDIAL_ISSUED`.
  - `due_friday` moves to the next Friday, and the count resets to the 5 weekdays before it.
  - Only an admin/CLI override (Kamyar) can open an exceptional window, and it must log a reason.
  - Add these transitions to `core._transition`'s `allowed` map.
- DST: compute with `zoneinfo`, never fixed offsets. Test the last Sunday of March and of October.

## 3. Grading API exposure (Echo Bearer)
- Add `dailyLog` (structure in `contract-changes.md` §2) to each `practical_submission` queue item, with entry IDs, local dates, server timestamps, lock times, revision counts, task IDs, fields, file metadata, and `countedDays`.
- Entry files must be retrievable by Mentor through the same authenticated file path as practical files.
- `GET /echo/v1/daily-log?student=&week=` returns read-only history for earlier weeks, for spiral and weakness evidence.
- `POST /echo/v1/decisions` validates `routineGate` (contract §3) and the server-Friday `dueAtISO` (contract §4).
- Queue `policy` adds `dailyLogMinDays`, `dailyLogTimezone`, `practicalWindow`, and `practicalModel`.

## 4. Entitlements and dashboard after grading
- A failed gate leads to NOT_APPROVED, a remedial week (week+1, same stage), and a fresh daily-log card. The decision feedback shows "Routine gate: 2 of 3 genuine days", with Mentor's reasons for each rejected day.
- `GET /api/v1/entitlements` is unchanged. Unlock still happens only after delivery of a positive practical decision.

## 5. Optional
- An opt-in Telegram reminder (notification only) at a fixed Amsterdam time on weekdays when today's entry is missing.
- A "Copy yesterday's headers" option is **deliberately not offered**, because it would encourage template entries.

## 6. Out of scope and rules
- No answer keys or private grading data in any daily-log response. Never print `ECHO_ACADEMY_API_KEY` or other secrets.
- Cloud agents never touch the live server. Kamyar deploys with the documented installer command.
- No change to the Phase 2 live test model (kami) until this PR is reviewed and deployed.
