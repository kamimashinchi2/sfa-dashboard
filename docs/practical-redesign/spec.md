# SFA practical redesign: daily application log + Friday practical (spec v1.0, FINAL)

Status: **FINAL**. Approved by Kamyar 2026-11-19 ("approve all", relayed by Echo). D1–D5 and K1–K12 adopted as proposed. Follow-up decisions 2026-11-19 (Kamyar via Echo): K4 = A8 uses the NotebookLM windows 0–5 / 5–15 / 15–60 minutes then the later session; K10 = A8's Final Paper Plan is always required, never blank, and K10's scope is A8 only; G11 = M5 keeps its no-trade wording, grounded in observed data; Q1 = the grounded no-trade exemption applies to every week except A8 (M1–M5, A6, A7: no plan is allowed when the no-trade conclusion is grounded; the Final Paper Plan is optional there; A8 always requires the plan). Follow-up decisions 2026-11-19 (Kamyar via Echo, round 3): (a) an A8 upload with no Final Paper Plan is a remedial with re-upload: stored verdict NOT_APPROVED (there is no REMEDIAL verdict), envelope `reasonCode:"PLAN_MISSING_REMEDIAL"`, and the student sees "plan missing: redo and re-upload" instead of "not approved" (names as in PR #14, head `e402081`); (b) no minimum risk drill is added; (c) no-trade is a **per-day** call: every daily entry carries TRADE or NO_TRADE (§1.4A), and `noPlan` applies only when the whole week had zero recorded trades. Items that were marked proposed or needing owner confirmation are now decided. Nothing here is implemented yet: repo changes go through SFA Platform as a PR that Kamyar reviews and deploys himself. Author: SFA Mentor, 2026-11-19 (Europe/Amsterdam).
Scope: weekly practicals M1–M5 and A6–A8 at repo `main` = `ca0dd51`.
Companion files in this folder:
- `contract-changes.md`: rubric, schema, and contract changes (these need SFA Platform code changes)
- `grading-loop-update.md`: the practical sections, now merged into `echo-weekly-grading-loop.md` (pre-redesign copy: `echo-weekly-grading-loop.pre-redesign.md`)
- `site-requirements.md`: dashboard, server, and API requirements for SFA Platform

## 0. Sources read (only these are authority)

| Short name | File |
|---|---|
| ROADMAP | `notebook-sources/02_curriculum_roadmap.md` (identical to `8-Stage_Forex_Curriculum_Roadmap.md`) |
| RULES | `notebook-sources/Trading_Framework_and_Rules_Addendum.md` |
| CONTEXT | `notebook-sources/trading_curriculum_context_addendum.md` |
| SCOUT | `notebook-sources/Market_Maker_Scout_v3.0_and_Decision_Engine.md` + `trading_curriculum_part2.md` (section `SOURCE: Market_Maker_Scout_Unified_v3_0.txt`, line ~945) |
| ORCH | `trading_curriculum_part2.md` (section `SOURCE: XAUUSD_Master_Orchestrator_Decision_Engine_ChatGPT_v1_4_1.txt`, line ~1307; §4.2 "Required data", §4.3 "Freshness", §5.8 PRICED-IN DISCIPLINE) |
| MACRO | `notebook-sources/Macro_Coordinator_and_Cross-Asset_Engines.md` + `trading_curriculum_part1.md` (`01_Macro_Coordinator_Dow_Gold_FINAL_v2(1).txt`) |
| XASSET | `trading_curriculum_part1.md` §`04_Cross_Asset_Intelligence_Agent_FINAL_v2.txt` (line ~2906; items 17 DIVERGENCE, 19 PRICED IN, 20 EVENT STUDY, 21 MATRIX, 22 SCENARIOS) |
| FEDP | `trading_curriculum_part2.md` (Fed Policy Repricing Engine, top of file; §5 historical/priced-in "Priced In تایید نشده", §7 sources list) |
| GDATA-P | `trading_curriculum_part2.md` §`Global_Data_Protocol_ChatGPT_Edition_v1_1.txt` (line ~271; §5.1 TRUTH AND SOURCES, §5.2 TIME DISCIPLINE, §5.3 RELEASE DISCIPLINE) |
| RES | `notebook-sources/01_verified_resources.md` |
| LESSONS | repo `app/lib/academy/weekLessons.ts` (`LESSON_PATCH`; this overrides title/core/trap/reality/question in `curriculum.ts` and `advancedCurriculum.ts`) |
| PRACT-NOW | `practicalTask` in `curriculum.ts` (M1–M5) and `advancedCurriculum.ts` (A6–A8) |
| LOOP | `/workspace/academy/echo-weekly-grading-loop.md` |
| SCHEMA | `backend/sfa-academy-v6/practical-decision.schema.json`, `assignment.schema.json`, `sfa_api/contracts.py`, `sfa_api/grading.py`, `sfa_api/risk.py`, `sfa_api/service.py`, `sfa_api/core.py` |

**Not source-based (owner policy, as Kamyar approved via Echo):** the 3-day minimum, the Friday-only practical, the daily cadence, and moving routine quality into the 20%. The NotebookLM sources contain no rule on daily routines, journal-quality scoring, or trader psychology beyond the points cited in §1.4. Every routine element below is assembled from source checklists, and each element cites its source.

## 1. The model (applies to every week)

### 1.1 Weekly flow
1. Lesson, then quiz. The quiz is APPROVED or PARTIALLY_APPROVED, and Mentor issues the week's assignment (`ASSIGNMENT_ISSUED`), or `REMEDIAL_ISSUED` after a failed practical.
2. **Daily application log:** from the day after the assignment is issued until the due Friday, the student logs on at least **3 separate eligible days**.
3. **Friday practical:** this is the only upload window, on the due Friday from 00:00:00 to 23:59:59 Europe/Amsterdam. It synthesises the daily entries.
4. Mentor grades the practical (three scoped reviews, then synthesis). The routine gate and the HARD_BLOCK gate are both checked.

### 1.2 Defaults (**decided**)
- **D1. Time zone (decided):** Europe/Amsterdam local time decides every day boundary for every student, wherever they live. That covers which calendar day an entry belongs to, when it locks, which days are eligible, and the Friday upload window. DST is handled by the IANA zone.
- **D2. Remedial week (decided):** a remedial week starts a **fresh** 3-day count. Entries from earlier weeks never count toward the new week's gate. They stay in history, read-only, as spiral and weakness evidence (for example to show a recurring error).
- D3. Eligible days (decided): Monday to Friday (Amsterdam), from the day after the assignment is issued, up to and including the due Friday, and only before the practical is submitted. Spot FX is closed at the weekend, and the brief requires live-market application. Weekend entries may be saved but **do not count**.
- D4. Due Friday (decided): the server computes the first Friday such that at least **4** eligible weekdays fall between the issue day (exclusive) and that Friday (inclusive). That gives the student a 1-day buffer over the 3-day minimum. The result is a due date about 4–10 days after issue. Examples: issued Monday, due that Friday; issued Tuesday to Sunday, due the following Friday. `dueAtISO` = that Friday 23:59:59 Europe/Amsterdam.
- D5. Missed Friday (decided): the week becomes `PRACTICAL_OVERDUE` and the window moves to the next Friday. The gate then counts only entries from the 5 weekdays before that new Friday, a fresh count in the spirit of D2. Kamyar (not Mentor) may open an exceptional window.
- D6. Several entries on one day count as **one** day. The cap is 3 entries per day, so students can't pad a single day.

### 1.3 What makes a daily entry "genuine"
The server counts **days** (structural check). Mentor decides **genuineness**. Mentor can only *remove* days from the server count, never add one, and must give a reason for each removal. An entry is genuine only if **all** of the following hold:
1. **Same-day, server-stamped.** The server's `createdAt` falls on that Amsterdam date. The entry locked at local midnight with no later edits; the server enforces this. The client clock is ignored.
2. **Live observation with time discipline.** It records the instrument, the observation time (Amsterdam), and the data source for every market fact. It keeps reference period, release time, observation time, and retrieval time apart (GDATA-P §5.2). If the calendar wasn't checked, it says "NEWS RISK: NOT ASSESSED", never "no news" (ORCH §4.3). Screenshots show symbol, timeframe, and capture time. A screenshot proves only what is visibly readable (GDATA-P §5.1 item 6; SCOUT §4.3).
3. **Applies THIS week's lesson** to that day's market. At least one *core* task from the week's menu is done on that day's data.
4. **Applies an earlier week (from M2 on).** At least one *spiral* task, taken from an earlier stage's taught skills.
5. **Specific and non-repetitive.** It names levels, times, release fields, or arithmetic that can be checked. It is not a template copied from another day, a generic statement ("market was bullish"), or a narrative reconstructed after the outcome.
6. **No signals, no live trade required.** Any plan is labelled *simulated / paper / conditional* and carries a hard structural stop. Every entry carries a TRADE or NO_TRADE call (§1.4A). "WAIT / NO_TRADE" is a valid, gradable outcome (CONTEXT: "If no valid setup exists, WAIT/NO TRADE remains valid"). Untouched planned levels are pending ideas, not executed positions (RULES).
7. **Honest.** Errors and mistaken expectations are recorded, not edited away. Because entries lock, the log is naturally free of look-ahead (ROADMAP Stage 6 "collect timestamped data, avoid look-ahead bias").

Hard gate: **fewer than 3 genuine days means NOT_APPROVED** (see §3), whatever the Friday write-up looks like.

### 1.4 Routine elements (every entry, every week; feeds the Journal & Psychology 20)
Every entry starts with a 4-line "routine header", built only from source checklists:
- R1 Time and session: entry time (Amsterdam) and the active session. London and New York are the preferred sessions (RULES).
- R2 Calendar check: the high-impact events scheduled today, or "NEWS RISK: NOT ASSESSED" (ORCH §4.2 "Economic calendar and imminent high-impact events"; ORCH §4.3).
- R3 Freshness: whether the data is live or from an earlier capture, labelled FRESH, RECENT, STALE, or UNKNOWN (ORCH §4.3 freshness labels).
- R4 Pre-commitment check (Socratic, one line): "Did I want to act before my checklist was complete?" This is grounded only in the general discipline language: CONTEXT "overtrading diagnostics" (no method recovered), part2 l.1881 "Confidence reflects evidence quality and coherence, not emotional conviction", and LESSONS A7-L3 "raising risk after a loss... breaks the 1% cap". **Gap:** the sources contain no psychology framework, so we must not invent one. R4 stays a self-observation, never a scored diagnosis.

### 1.4A Daily call: TRADE or NO_TRADE (decided 2026-11-19, Kamyar via Echo; every week, M1–A8; names as in PR #14, head `e402081`)
Every `DAILY_LOG_V1` entry carries a required `dayCall` = `TRADE` | `NO_TRADE` and an optional short `dayCallReason` (up to 500 characters).
- **NO_TRADE** (valid, often wise; CONTEXT "If no valid setup exists, WAIT/NO TRADE remains valid") must be **grounded**: the student gives, in `dayCallReason` or the entry's observation text, the timestamped readings behind it, or writes "Observed reaction unavailable" where no timestamped data exists for a window. An intraday path is never inferred from a daily close (XASSET item 20; MACRO "Market reaction window"; GDATA-P §5.2). **The server does not check grounding** (the reason is optional text); Mentor judges it.
- **TRADE** means the student records a **paper trade** (a hypothetical entry taken on that day's data). Its entry should carry a paper plan with **full risk evidence**: current paper equity, risk at most 1%, entry, a **hard structural stop** (never mental), point value with its source (or *illustrative*), lot rounded down, spread and costs, and **net R:R of at least 1:2**. It is simulated, not an order. **The server does not enforce this either**: it only requires that any structured `paperPlan` is complete (all keys present). Missing or weak risk evidence on a TRADE day is a rubric matter.
- **What the server counts as a recorded trade (PR #14):** an entry with `dayCall: TRADE`, **or any entry that has a structured paper plan**, even if its call is NO_TRADE. A conditional or sizing-drill plan therefore belongs in the entry's text fields on a NO_TRADE day, not in the structured Paper plan block.
- **A trade on a no-trade day is flagged.** Per Amsterdam date: if the date has a NO_TRADE entry **and** a recorded trade (TRADE call or structured plan), the date is listed. The queue `dailyLog` block reports `tradeDays`, `noTradeDays`, `tradesOnNoTradeDays` (counts) and `tradeOnNoTradeDay` (the dates). `noTradeDays` counts dates whose entries are all NO_TRADE with no plan. The count covers every entry of the week row. **The server deducts no points**: scoring is the rubric's job.
- **Week level.** The week has *zero recorded trades* when `tradeDays` is 0. Only then may a week with no Final Paper Plan be graded with `noPlan:true` (§1.5); otherwise the server answers `NO_PLAN_REQUIRES_ZERO_TRADES`. A week with any recorded trade is graded with `riskEvidence`.
- **Scoring guidance (owner policy, Kamyar 2026-11-19; guidance only, not an official cap, no other penalty is added):**
  - A flagged trade on a no-trade day is graded as a breach of the student's own pre-commitment. It lowers **Risk Discipline** (rule discipline) and **Journal & Psychology** (honesty and pre-commitment adherence, R4). Mentor quotes the entry IDs and explains the deduction. It is **not** a HARD_BLOCK and does not touch the routine gate by itself.
  - TRADE entries with incomplete risk evidence (no hard stop, risk above 1%, no net R:R, no sourced point value) are ordinary Risk Discipline deductions, as daily drill errors already are. **Pending owner decision (open question 1):** whether an unsafe daily trade should instead be a HARD_BLOCK. Not changed.
  - An ungrounded NO_TRADE call is an ordinary `technicalMacro` shortfall (§1.5). No minimum risk drill is required.

### 1.5 Risk evidence and the Final Paper Plan (A8 required; optional in every other week)
Risk is 40% of every week, and the server's `hard_block()` (`sfa_api/risk.py`) needs final-plan risk evidence **when a plan exists**. **Decided 2026-11-19 (Kamyar via Echo, Q1/K10/G11):**

- **A8 only: one Final Paper Plan worksheet is always required, never blank (K10).** If the honest conclusion is WAIT, it is a *conditional, not triggered* plan at a marked level (still gradable for arithmetic and stop discipline). The decision carries `riskEvidence`. A no-plan decision on A8 is rejected by the server (`PLAN_REQUIRED_FOR_WEEK`). **If the A8 Friday file has no plan (decided 2026-11-19; mapping as in PR #14):** the decision is verdict `NOT_APPROVED`, `unlockNext:false`, `finalHardBlock:false`, with a same-stage remedial assignment for week+1, and the envelope carries `reasonCode:"PLAN_MISSING_REMEDIAL"` (no `riskEvidence`, no `noPlan`). There is no `REMEDIAL` verdict. The student sees "plan missing: redo and re-upload" (FA «طرح نیست: دوباره انجام دهید و دوباره بارگذاری کنید»), never "not approved", and re-uploads on the new week's due Friday. Contract details in `contract-changes.md` §3B.
- **M1–M5, A6, A7: the Final Paper Plan is optional, and `noPlan` is allowed only when the week had zero recorded trades (§1.4A).** A grounded no-trade week (every entry NO_TRADE, each with grounding, or marked "Observed reaction unavailable") may be graded with no plan: the decision then carries `noPlan:true` plus a reason (20–500 characters) instead of `riskEvidence` (`contract-changes.md` §3A). A no-plan week has no risk event, so `finalHardBlock` is false. **If the week has any TRADE entry, `noPlan` is not accepted**, even when there is no Friday plan; the decision carries `riskEvidence` (from the Friday plan if present; for a week with trades but no Friday plan, **which trade the envelope describes is a pending owner question**, working proposal: the worst trade, see `contract-changes.md` §3A).
- **If a student does submit a plan in any week, it is graded in full** (arithmetic, stop, net R:R), and the HARD_BLOCK rules are unchanged: a mental or no stop, more than 1%, or net R:R below 1:2 in the plan. Mentor may not record `noPlan` to skip a plan that is in the file.

Worksheet contents for any plan that is written:
- current paper equity and account currency
- risk at most 1%
- hypothetical entry level
- **hard structural stop** and why it is structural
- stop distance in price units
- point value per lot, with its source (the broker or contract spec). Otherwise it is marked *illustrative*, because there is no universal pip value (RULES; LESSONS A7-L2).
- lot = (Equity × Risk %) / (Stop Distance × Point Value), **rounded down**
- spread and costs
- **net** R:R of at least 1:2

**Grading a no-plan week:** the grounding of the no-trade calls is judged inside the normal Technical & Macro rubric (does the explanation match the student's own timestamped entries and the week's real releases?). An ungrounded call is an ordinary `technicalMacro` shortfall, quoted with entry IDs. There is **no separate penalty and no points deduction rule** for it. **No minimum risk drill is added (decided 2026-11-19).** Risk 40 is scored on the risk evidence that exists: the daily risk drills and spiral sizing tasks (for example the C3 sizing drills in M1–M3, the Stage 1 spiral task, the A7 paper plans and ledger), rounding down, net-of-cost R:R and no signal language.

### 1.6 Rubric mapping (unchanged weights and thresholds)
- **Risk Discipline, 0–40:** the Final Paper Plan when one is submitted (always in A8; optional elsewhere, see §1.5), the full risk evidence of any daily TRADE entries, **a flagged trade on a no-trade day (§1.4A, owner policy; discretionary, quoted)**, plus the accuracy of daily risk drills, rounding down, net-of-cost R:R, and no signal language. HARD_BLOCK rules are unchanged (RULES "Universal Risk Rule"; SCOUT "Stop Loss"; LESSONS A7-L1).
- **Technical & Macro Structure (`technicalMacro`), 0–40:** application of **this week's** lesson across the daily entries and Friday synthesis, *plus* correct application of **earlier weeks** (spiral). *Guidance only, not an official cap:* about 25 for current-week application and about 15 for spiral application. M1 has no earlier stage, so all 40 points come from current-week application.
- **Journal & Psychology (`journalPsychology`), 0–20:** routine quality. That means timeliness (entries made around the observation, as server timestamps show), consistency of the R1–R4 header, honest recording of WAIT and of errors, and a specific Friday reflection that refers to the dated entries. A flagged trade on a no-trade day also counts against honesty and pre-commitment adherence here (§1.4A, owner policy; discretionary). *Guidance only:* about 8 for consistency and timeliness, about 8 for honesty and reflection, and about 4 for habit-checklist adherence.
- Verdict: APPROVED at 80 or above, PARTIALLY_APPROVED at 65–79, NOT_APPROVED below 65 (policy). **Any** proven final-plan HARD_BLOCK, **or** a failed routine gate, means NOT_APPROVED. A no-plan week has no final plan, so it cannot produce a final-plan HARD_BLOCK.

### 1.7 Assignment construction (weekly)
Mentor still personalises each assignment (LOOP §12–14):
- `coreTasks` are drawn from the week's core menu below.
- `spiralReview` covers **every** earlier stage. Server rule: `contracts.validate_assignment` requires every earlier stage to be covered. Mentor rotates the *least recently reviewed* taught skill of each earlier stage, using the spiral menus below.
- `weaknessDrills` covers every OPEN or IMPROVING weakness, scheduled as daily-log tasks with an entry-level acceptance criterion.
- New: the `dailyTasks` field and `dailyLogRequirement` (see `contract-changes.md`).

### 1.8 Spiral skill bank (only what the patched lessons teach)
| Stage | Taught skills available for spiral tasks (LESSONS) |
|---|---|
| 1 (M1) | S1a: bid/ask/spread as a cost at an observation time. S1b: session identification (London/NY). S1c: margin vs risk budget. S1d: sizing formula plus round-down. S1e: wider stop gives a smaller lot. S1f: spot OTC vs exchange futures. |
| 2 (M2) | S2a: PDH/PDL/PWH/PWL marking. S2b: sweep vs confirmation, and why a wick touch doesn't prove a fill. S2c: order-type naming (Buy/Sell Limit, Buy/Sell Stop) and what activates each. S2d: slippage and fees as costs. S2e: the PDH-sell preference applies only when the setup is valid. |
| 3 (M3) | S3a: H4/H1 direction vs M15/M5 execution reading. S3b: OB/BOS/CHoCH/FVG/MSS on closed candles. S3c: the sweep-reversal chain. S3d: structural stop beyond the sweep extreme or swing. S3e: MA50/MA200 used descriptively only. |
| 4 (M4) | S4a: Actual/Forecast/Previous/Revisions. S4b: macro chain link-by-link, with UNVERIFIED links. S4c: headline vs core. S4d: an unchanged rate can still reprice. S4e: immediate vs durable. |
| 5 (M5) | S5a: cross-asset snapshot (2s10s, real yields, DXY, VIX, credit). S5b: correlation is regime-dependent. S5c: no double counting (GDATA). S5d: macro bias is not an entry. S5e: gold grid as geometry only. |
| 6 (A6) | S6a: write the falsifier before the outcome window. S6b: costs inside the test. S6c: record failures next to passes. S6d: "named tool, missing rule", so no invented rule. |
| 7 (A7) | S7a: recalculate 1% on current equity. S7b: the stop-distance doubling drill. S7c: an illustrative drawdown path. S7d: the journal row (plan, stop type, sizing, result vs invalidation). |

## 2. Per-week specification

Notation: **C** = core task (this week), **S** = spiral task (earlier stage), **min** = minimum frequency across the ≥3 genuine days. Every entry also carries the R1–R4 routine header (§1.4). "Instrument" is any of EURUSD, USDJPY, XAUUSD (ROADMAP Stage 8; RULES). The student picks one main instrument per week and may add more.

### M1, Stage 1: Foundations and contract cards
- **Teaches (LESSONS M1-L1, M1-L2):** base/quote, bid/ask, spread as a cost, pip and lot, spot OTC vs futures, margin is collateral and not a risk budget, London/NY sessions, leverage, the 1% cap, the sizing formula, no mental stop, and that a wider stop means a smaller lot.
- **Daily menu:**
  - C1 Cost card: bid, ask, and spread for the instrument at two observation times, one in London and one in New York. State that spread is a cost.
  - C2 Session log: which session is active, and how spread compares across the two times.
  - C3 Sizing drill on own paper equity at 1%: two stop distances, the formula, round down, and the point-value source (or "illustrative").
  - C4 Margin vs risk: the margin your demo/broker spec shows for the computed lot, set against the 1% budget, with one sentence on why free margin cannot set the lot.
  - C5 (once) Spot vs futures: compare the spot quote with the matching CME contract spec page (RES #2, #6). Report spec facts only.
- **Spiral:** none (first stage). The server's validate_assignment already accepts an empty spiral at stage 1.
- **Minimum:** ≥3 genuine days; C1 on every day; C3 on ≥2 days; C2 and C4 at least once each.
- **Friday deliverable:** "My contract and cost journal". Contents: a table of the logged days (time, session, bid/ask/spread); the current practical's synthetic gold contract card and its 1% budget for equity 10,000 as part 1; an **optional** Final Paper Plan worksheet (§1.5) or, without a plan, a short grounded no-trade conclusion; and a 120–200 word reflection. The reflection names one cost the student had been ignoring, says when spread was widest, and answers the lesson question: "If you watch only the ask, which cost do you fail to see?"
- **Rubric:** Risk 40: sizing arithmetic, rounding down, budget vs margin, hard stop written (in the drills and in any plan submitted). Technical/macro 40: correct base/quote, spread, pip, and session facts with timestamps. Journal 20: routine header, timeliness, reflection.
- **Sources:** LESSONS M1-L1/L2; ROADMAP Stage 1; RULES (sessions, risk rules, sizing formula); RES #2, #6.
- **Gaps:** no universal pip or point value, so the student must cite the spec or mark the value illustrative. **M1 is not the execution standard**, so timeframe-based execution is not taught in M1. A structural stop at M1 is only "a stop written before the hypothetical order at a stated level". See decision K8.

### M2, Stage 2: Liquidity and order types
- **Teaches (LESSONS M2-L1):** participants and venues, OTC vs exchange, Limit vs Stop, slippage and fees as costs, PDH/PDL/PWH/PWL, that a sweep is not an entry, that a wick doesn't prove a fill, and the PDH-sell preference only when the setup is valid.
- **Daily menu:**
  - C1 Pre-session level map: mark PDH and PDL before London (plus PWH and PWL on Monday), on H1/H4 screenshots.
  - C2 Same-day follow-up: did price trade through a marked level and come back? Classify it as *sweep observed*, *no sweep*, or *unclear*, and say what it does **not** prove.
  - C3 Order-type drill: for a conditional idea at a marked level, name the order type (Buy Limit below price, Sell Limit above, Buy Stop or Sell Stop) and what activates it. Paper only.
  - C4 Cost note: spread around a scheduled release vs at a quiet time (if observed), labelled as a slippage or fee risk.
- **Spiral (Stage 1):** rotate S1a to S1f, with at least one sizing drill (S1d) per week.
- **Minimum:** ≥3 genuine days; C1 and C2 on ≥3 days; C3 on ≥2 days; Stage 1 spiral on ≥2 days.
- **Friday deliverable:** "Liquidity map journal". Contents: a 3–5 day level table (level, time touched, classification); the order-type table; an **optional** Final Paper Plan as a *pending, not triggered* plan at a marked level, with the hard stop beyond that level or the swept extreme, the formula, and net R:R of at least 2 (without a plan, a short no-trade conclusion grounded in the timestamped level readings); and a reflection answering "What does a sweep prove, and what does it not prove?"
- **Rubric:** Risk 40: the Final Paper Plan if submitted, the sizing drill, and order-type correctness. Technical/macro 40: level marking, sweep vs confirmation honesty (about 25), plus Stage 1 spiral accuracy (about 15). Journal 20.
- **Sources:** LESSONS M2-L1; ROADMAP Stage 2; RULES ("Reference levels", PDH preference, "Untouched planned levels imply pending orders"); CONTEXT ("Forex order types"); SCOUT ("Sweep Reversal" sequence, used only to say that confirmation comes after a sweep).
- **Gaps:** the Asian-session breakout in CONTEXT has **no verified stop distance**, so it must not be used as a drill. The current practical ("synthetic fixture, mark one PDH and one sweep") becomes optional C0 practice and no longer serves as the deliverable.

### M3, Stage 3: Structure, setup, and the structural stop (**worked example in §5**)
- **Teaches (LESSONS M3-L1):** H4/H1 direction and M15/M5 execution (M1 is not the standard); OB/BOS/CHoCH/FVG/MSS; MA50/MA200 descriptive only; indicators don't prove edge; the sweep-reversal path (sweep, closed-candle MSS through a protected level, displacement, then an FVG/OB zone); the stop beyond the sweep extreme or swing; net R:R of at least 1:2; risk of at most 1%.
- **Daily menu, spiral, minimum, Friday deliverable, rubric:** see §5. Spiral covers Stages 1 and 2.
- **Sources:** LESSONS M3-L1; SCOUT (three models, stop loss, freshness §4.3); RULES (timeframes, MA note, structure terms); ROADMAP Stage 3 ("Indicators are descriptive tools, not proof of predictive edge").
- **Gaps:** **no MA crossover rule**. The Scout's other two models (Breakout-and-Pullback, Range-Edge Reversal) and the setup state ladder are in SCOUT but **not taught in the M3 lesson**, so they are not required (decision K6). RSI, Volume Profile, ZigZag, and Renko are named with **no settings recovered**, so they are excluded.

### M4, Stage 4: Macro transmission (CONTEXT_ONLY)
- **Teaches (LESSONS M4-L1):** the macro chain, from data and surprise vs expectations through the Fed reaction function, US2Y, US10Y, real yields, DXY, VIX, and cross-asset confirmation to Dow and gold. Never jump from one print to price. Headline vs core. An unchanged rate can still reprice. The INFLATION, LABOR, and FED_POLICY engines. Immediate vs durable effects. Without real yields and DXY, a gold bias is not proven.
- **Daily menu:**
  - C1 Release log on a day with a material US release: Actual, Forecast, Previous, Revisions, and the components (RULES "Macro checklist"; GDATA-P §5.3). Record release time vs observation time.
  - C2 Chain walk: for that release or the day's main driver, fill each chain link with evidence, or mark it UNVERIFIED. Stop where the evidence stops.
  - C3 Fed-expectations snapshot on a day with no material release: an FOMC statement or speech, or a FedWatch snapshot, with timestamp (FEDP §7 sources list; MACRO FED_POLICY_ENGINE). Keep current snapshots separate from historical ones.
  - C4 Immediate vs durable: one line on what was the first reaction and what remains unresolved.
- **Spiral:** Stage 3 means describing the H4/H1 structure around the release time, with **no entry from macro**. Stage 2 means whether PDH/PDL was swept on release day. Stage 1 means release-time spread vs quiet spread. Rotate across the week.
- **Minimum:** ≥3 genuine days; C2 on ≥2 days; C1 on ≥1 day (if no material release falls in the window, C3 on ≥2 days instead; see gap); each of Stages 1, 2, and 3 at least once.
- **Friday deliverable:** "Macro context journal". Contents: the week's releases table; one completed chain table with UNVERIFIED links shown; the immediate vs durable split; an **optional** Final Paper Plan, which if written **must be built from Stage 3 structure and not from the macro bias** and say in one line "macro is context only" (without a plan, a short no-trade conclusion grounded in the recorded release facts and timestamps); and a reflection on "What must sit between an economic release and any idea about price?"
- **Rubric:** Risk 40: the Final Paper Plan if submitted, built independently of macro; otherwise the Stage 1 spiral sizing task(s) and signal-free wording. Technical/macro 40: chain discipline, A/F/P/R, headline vs core (about 25), plus spiral (about 15). An *automatic deduction* applies for any "print means trade" jump, and Mentor quotes the entry. Journal 20.
- **Sources:** LESSONS M4-L1; MACRO; RULES (macro checklist); CONTEXT ("Possible scenario, not invariant rule"); GDATA-P §5.2–§5.3; FEDP §7 sources list.
- **Gaps:** whether a material release falls in the window depends on the calendar, and the sources give no fallback. The proposal is the C3 fallback (decision K9). The sources give **no list of "material" releases**; the RULES labour and inflation list is used as the default.

### M5, Stage 5: Intermarket (practical realigned to the lesson)
- **Teaches (LESSONS M5-L1):** CROSS_ASSET_ENGINE (2s10s, TIPS real yields, DXY, VIX, credit), plus equities, gold, and oil. Correlation is regime-dependent. Confirmation is a check, not a second copy of the same reason (GDATA, no double counting). Macro bias is pressure, not an entry. Targets come from grid levels only after direction is argued from fundamentals.
- **Daily menu:**
  - C1 Cross-asset matrix at a fixed daily time: US2Y, US10Y, real yields, DXY, VIX, credit spreads, Dow, and gold, each with its latest direction, **timestamp**, meaning, confirms/contradicts, and data confidence (XASSET item 21).
  - C2 Divergence check: is today's contradiction genuine, or caused by different observation times or data delays (XASSET item 17)?
  - C3 Double-count audit: list the inputs behind the day's bias and strike any duplicate (GDATA).
  - C4 First hour vs later: label the immediate reaction and the later one separately, without averaging them (LESSONS M5-L1 worked example).
- **Spiral:** Stage 4 means putting any release this week through the chain. Stage 3 means structure on the main instrument. Stage 2 means levels. Stage 1 means cost and sizing. Each at least once.
- **Minimum:** ≥3 genuine days; C1 on ≥3 days; C2 or C3 on ≥2 days; each of Stages 1–4 at least once.
- **Friday deliverable:** "Weekly intermarket journal". Contents: the matrix rows side by side; the week's regime notes (what moved together, what diverged, and why correlation can't be assumed); one macro bias statement with explicit invalidation, labelled *not an entry*; a short **trade / no-trade conclusion**: a no-trade week is valid and often wise (LESSONS M5-L1 worked example), but the explanation must be **grounded in what was actually observed** (it must match the student's own timestamped matrix rows and the week's real releases, and name the input, divergence or unresolved link that led to it); a Final Paper Plan built from structure is **optional** (as in every week except A8; no conditional-plan requirement; if one is written and gold grid levels are used for targets, they are labelled *geometry only*); and a reflection on "Why is 'gold and the dollar moved together today' not yet confirmation?"
- **Rubric:** Risk 40: the Final Paper Plan if one is submitted; in a grounded no-trade week, the Stage 1 sizing spiral task(s), the absence of signal language, and the no-trade reasoning (guidance, owner policy K7). Technical/macro 40: matrix discipline, timestamps, no double count, regime humility (about 25), plus spiral (about 15). Journal 20. **Grounding check (Mentor, inside the normal Technical & Macro rubric):** compare the no-trade explanation with the matrix rows and release facts. A conclusion that contradicts the recorded data, cites a reading with no timestamp, or relies on an unverified release is an ordinary `technicalMacro` shortfall, quoted with entry IDs; there is no separate penalty. Where a window has no timestamped data, "Observed reaction unavailable" is the correct entry, and an intraday path inferred from a daily close is a flaw (XASSET item 20; MACRO "Market reaction window"; GDATA-P §5.2).
- **Decision G11 (decided 2026-11-19, Kamyar via Echo):** keep the M5-L1 no-trade wording, tightened so that the no-trade reasoning must match the real observed data and releases. No conditional-plan requirement in M5. **Q1 (decided 2026-11-19):** the same grounded no-trade exemption now applies to every week except A8 (§1.5, K10). Server side: `noPlan:true` + reason, see `contract-changes.md` §3A.
- **Sources:** LESSONS M5-L1; ROADMAP Stage 5; MACRO (CROSS_ASSET_ENGINE, GDATA); XASSET items 17, 21, 22; RULES (gold grid).
- **Mismatch (decision K1):** the current practical (PRACT-NOW: "hypothesis/falsification/split") and the base lesson title in `curriculum.ts` ("Preregister the hypothesis"; mission title "Research & Journal") are **Stage 6 content**. The patched lesson and the quiz are intermarket. This spec realigns the practical to intermarket. **Gap:** the gold grid is geometry only, so no grid-derived direction or signal.

### A6, Stage 6: Research lab (practical realigned to the patched lessons)
- **Teaches (LESSONS A6-L1/L2/L3):** write the falsifier, the allowed data, and the costs before the outcome window. Changing the rule after seeing the result is not out-of-sample. Look-ahead bias. Spread and fees belong in the test. A missing print stays missing. Out-of-sample means a later window not used to choose the rule. Document failures. Avoid overfitting. Named tools have no validated rule. The archive is not a complete system (no MA crossover; the grid is geometry). The words NORMAL, CAUTION, and HARD_BLOCK apply only to the stated risk rules.
- **Daily menu:**
  - C1 (first log day, locked before any outcome) Preregistration: one small, falsifiable **observation** hypothesis on the week's live market. Examples: "on EURUSD, after a material US release, the 0–5, 5–15 and 15–60 minute windows and the later session are recorded separately", or "PDH sweeps that are followed by a closed M15 MSS". State the falsifier, the allowed data, and the costs to include. Because the entry locks at midnight, the server timestamp proves it was written beforehand.
  - C2 (following days) Forward observation rows: timestamped observations that meet or fail the hypothesis's conditions, spread recorded, missing data left as "missing" with a reason.
  - C3 Failure log: every row that went against the hypothesis, written down the same day.
  - C4 "Named tool, missing rule" check: if a tool tempted you (MA, RSI, grid), write "rule not in source".
- **Spiral:** rotate Stages 1–5, one skill each across the week, least-recently-reviewed first.
- **Minimum:** ≥3 genuine days; C1 on the first counted day (if C1 is missing or dated after any outcome row, the research part scores 0 for preregistration; it is a scoring deduction, not the gate); C2 on ≥2 later days; each of Stages 1–5 at least once.
- **Friday deliverable:** "Research note". Contents: the preregistration as written (entry ID); the observation table; gross vs net after costs where an R-measure applies; the failures; and the label **IN-SAMPLE / EXPLORATORY**, since a handful of rows is not evidence and **no live rule is promoted**. Also an **optional** Final Paper Plan (one plan, structure-based, risk rules unchanged; without a plan, a short grounded no-trade conclusion) and a reflection on "What has to be written down before the outcome window is opened?"
- **Rubric:** Risk 40: the Final Paper Plan if submitted, plus correct use of the HARD_BLOCK, NORMAL, and CAUTION words (and, without a plan, the Stage 1 spiral sizing task). Technical/macro 40: falsifiability, timing integrity, costs, honest failures (about 25), plus spiral (about 15). Journal 20.
- **Sources:** LESSONS A6-L1/L2/L3; ROADMAP Stage 6; XASSET item 20 (event-study windows "when timestamped intraday data exist"); SCOUT (risk states).
- **Mismatch (decision K2):** PRACT-NOW asks for "TRAIN/TEST metrics" and a revised version. The base lesson text ("TRAIN-only tuning; freeze before TEST", profit factor with NO_LOSSES) is **overridden** by the patched lessons, which teach out-of-sample as a concept but no TRAIN/TEST metric set. **Gap:** there is **no Week 6 statistics course**, so the practical requires no significance tests, profit factor, or win-rate statistics.

### A7, Stage 7: Risk discipline and simulation (practical realigned to the patched lessons)
- **Teaches (LESSONS A7-L1/L2/L3):** the three hard rules (1%, mandatory hard stop, net R:R of at least 1:2), with a mental stop as HARD_BLOCK. NORMAL and CAUTION do not relax them. The sizing formula, rounded down. No universal point value. A tighter stop used to justify a larger size hides risk. Demo or paper review, with no live money required. Drawdown. Raising risk after a loss breaks the cap. A journal row covers plan, stop type, sizing arithmetic, and result vs invalidation. Recalculate 1% on the remaining equity.
- **Daily menu:**
  - C1 Daily paper plan on **current** paper equity: the full worksheet (§1.5), or WAIT with a conditional plan. On a NO_TRADE day write the conditional plan in the text fields, not in the structured Paper plan block, because the server counts a structured plan as a recorded trade (§1.4A).
  - C2 Paper ledger update: the result vs invalidation of earlier paper plans, measured against price only. Equity path updated. The next budget is 1% of the new equity.
  - C3 Stop-doubling drill: same budget, double the stop distance, compute the new lot, and show the dollar risk is unchanged.
  - C4 Scenario note (ROADMAP Stage 7 "scenario analysis"): if the next three paper plans all hit their stops, what are the drawdown and the next budget?
- **Spiral:** rotate Stages 1–6. Stage 6 means stating the falsifier of the week's paper approach before Friday.
- **Minimum:** ≥3 genuine days; C1 on ≥3 days; C2 on ≥2 days; C3 and C4 at least once; each of Stages 1–6 at least once.
- **Friday deliverable:** "Risk ledger and drawdown review". Contents: every paper plan of the week as journal rows; the equity path, with the budget recomputed at each step; the largest drawdown; any plan that would have been HARD_BLOCKed and why; an **optional** Final Paper Plan (without one, a short grounded no-trade conclusion; the daily paper plans above still count); and a reflection on "After three illustrative 1% losses, what is the risk cap on the next plan?"
- **Rubric:** Risk 40: ledger arithmetic, current-equity budgeting, rounding down, no risk increase after losses, the Final Paper Plan if submitted. Technical/macro 40: structural stop placement in each plan (about 25), plus spiral (about 15). Journal 20: ledger honesty, including losing paper plans.
- **Sources:** LESSONS A7-L1/L2/L3; ROADMAP Stage 7; RULES; SCOUT ("Risk Control States").
- **Mismatch (decision K3):** PRACT-NOW asks for "three −1% steps and a STOP_GAP_LOSS gap example". The base lessons (recovery %, STOP_GAP_LOSS, shared portfolio shocks) are **overridden** by the patched lessons. **Recovery % and STOP_GAP_LOSS do not appear in the NotebookLM sources.** They appear only in the original A7 base text, and gap risk is mentioned in the review skill. This spec drops them from the required deliverable. **Gap:** no universal pip value.

### A8, Stage 8: Capstone notebook (practical realigned to the patched lessons)
- **Teaches (LESSONS A8-L1/L2/L3):** compare EURUSD, USDJPY, and XAUUSD on the **same selected release**. The immediate move and the later repricing go in separate rows. Actual, Forecast, Previous, and Revisions. Already priced in. Fed expectations can move without a rate change. US2Y is not a trigger. The notebook can be complete without an order. A positive result unlocks only senior-mentor review.
- **Daily menu:**
  - C1 Pre-release entry, locked before the release: the release chosen; Forecast, Previous, and the pre-event pricing or expectations (ORCH §5.8, otherwise "Priced In unverified"); **Actual = blank**.
  - C2 Release-day entry: the **0–5 minute (initial reaction), 5–15 minute (interpretation) and 15–60 minute (confirmation or reversal)** windows for all three instruments, plus US2Y and DXY, each with observation times. Where there is no timestamped intraday data for a window, write "Observed reaction unavailable"; never infer an intraday path from a daily close (XASSET item 20; MACRO "Market reaction window").
  - C3 Later-session entry (later the same day or the next day): the **later session** view (the dominant narrative, or the session close) for the same three instruments, recorded separately from the 0–5 / 5–15 / 15–60 minute windows, plus the revision note.
  - C4 Priced-in check: what was expected beforehand, and whether the later session agreed with the earlier 0–60 minute windows.
- **Spiral:** rotate Stages 1–7, each at least once across the week. Stage 7 means the Final Paper Plan ledger row.
- **Minimum:** ≥3 genuine days, of which C1 is on a day **before** the release and C2 on release day (both server-timestamped). Each of Stages 1–7 at least once.
- **Friday deliverable:** "Capstone notebook". Contents: the three-instrument table with the 0–5, 5–15 and 15–60 minute windows and the later session kept separate; the A/F/P/R comparison; a priced-in discussion; a conclusion written as study notes, **not signals**; the Final Paper Plan, **always required and never blank (K10; A8 is the only week where a plan is mandatory)**, as a conditional plan with a hard stop if the honest conclusion is WAIT; and a reflection on "What would make a finished-looking notebook still incomplete?" A positive verdict leads to DOSSIER_READY, then AWAITING_SENIOR_MENTOR, with `unlockNext:false`. **If the Friday file has no plan (decided 2026-11-19): verdict NOT_APPROVED with a same-stage remedial and envelope `reasonCode:"PLAN_MISSING_REMEDIAL"` (§1.5, `contract-changes.md` §3B); the student sees "plan missing: redo and re-upload" (FA «طرح نیست: دوباره انجام دهید و دوباره بارگذاری کنید»).**
- **Rubric:** Risk 40: no signal language, the plan with a hard stop, arithmetic. Technical/macro 40: window separation, A/F/P/R, priced-in reasoning (about 25), plus spiral (about 15). Journal 20.
- **Sources:** LESSONS A8-L1/L2/L3; ROADMAP Stage 8; RULES (macro checklist); XASSET items 19 and 20; GDATA-P §5.2–§5.3; ORCH §5.8 PRICED-IN DISCIPLINE; FEDP §5 "Priced In unverified".
- **Decision K4 (decided 2026-11-19, Kamyar via Echo):** A8 uses the NotebookLM windows **0–5 / 5–15 / 15–60 minutes, then the later session** (XASSET item 20: "Compare pre-release, 0–5m, 5–15m, 15–60m and session-close moves when timestamped intraday data exist. Do not infer intraday paths from daily closes"; MACRO "Market reaction window": 0–5 initial reaction, 5–15 interpretation, 15–60 confirmation or reversal, later session dominant narrative). The earlier "15 min / 4 h" windows are **removed everywhere**: in the repo they were only illustrative worked examples, and the exports contain no "4 hours". PRACT-NOW's "freeze/reveal two synthetic packets" is dropped (K1–K3 style realignment). **Gap:** there is **no Week 8 historical release data** in the sources, so the student must observe a **live** release during the window. That makes Week 8 scheduling depend on the release calendar (decision K5). **Decision K10 for A8 (decided 2026-11-19):** the Final Paper Plan is always required; there is no "blank" option.

## 3. Grading changes (summary; details in `contract-changes.md` and `grading-loop-update.md`)
- New **routine gate**, analogous to HARD_BLOCK but separate from it:
  - `serverCountedDays` is set by the server.
  - `genuineDays` is set by Mentor and can be at most `serverCountedDays`. Mentor lists the genuine entry IDs and the rejected entries with reasons.
  - `passed = genuineDays ≥ 3`.
  - If `passed == false`: verdict NOT_APPROVED, `unlockNext:false`, a remedial assignment that starts a fresh count (D2). The scores are still recorded honestly, so the student sees where they stood. The gate is not a risk event, so it is kept out of `finalHardBlock` and out of `FINAL_PLAN_RISK_EVIDENCE`.
- Verdict = `verdict(total, 80, 65, hard_block = finalHardBlock OR NOT routineGate.passed)`. The thresholds don't change.
- **No-plan path (decided 2026-11-19; PR #14 names):** M1–M5, A6, A7 decisions may carry `noPlan:true` + `noPlanReason` (20–500 characters) instead of `riskEvidence`, **only when the week had zero recorded trades** (`NO_PLAN_REQUIRES_ZERO_TRADES` otherwise); A8 may not (`PLAN_REQUIRED_FOR_WEEK`). An A8 Friday file with no plan uses envelope `reasonCode:"PLAN_MISSING_REMEDIAL"` (NOT_APPROVED, `unlockNext:false`, same-stage remedial; any other verdict with that code is `PLAN_MISSING_REMEDIAL_ONLY`). Details in `contract-changes.md` §3A and §3B.
- **Per-day call (decided 2026-11-19; PR #14 names):** each daily entry has a required `dayCall` (TRADE or NO_TRADE) and an optional `dayCallReason`; the queue `dailyLog` block carries `tradeDays`, `noTradeDays`, `tradesOnNoTradeDays` and `tradeOnNoTradeDay`; the server deducts nothing (`contract-changes.md` §2).
- `grading.ts` (frontend) must implement the same rule. That is part of the 40/40/20 and HARD_BLOCK alignment already sent to SFA Platform, which keeps the Python backend as the reference.

## 4. Decisions (D and K lists, all adopted by Kamyar 2026-11-19) and source gaps
| ID | Decision | Outcome (decided) |
|---|---|---|
| D1 | Europe/Amsterdam day boundaries for all students | Adopt (decided) |
| D2 | Remedial week: fresh 3-day count; old entries are history only | Adopt (decided) |
| D3 | Only Mon–Fri entries count; weekend entries are saved but not counted | Adopt |
| D4 | Due Friday = first Friday with at least 4 eligible weekdays after issue | Adopt (replaces the 5–9 day dueAt check) |
| D5 | Missed Friday: roll to the next Friday with a fresh 5-weekday count; only Kamyar opens exceptions | Adopt |
| K1 | M5 practical is hypothesis/falsification but lesson and quiz are intermarket; base title in `curriculum.ts` still says "Preregister the hypothesis" | Practical follows intermarket. Fix the base `curriculum.ts` M5 title, summary, and practicalTask in the redesign PR |
| K2 | A6 practical asks for TRAIN/TEST metrics the patched lesson doesn't teach; no Week 6 statistics course | Drop the metrics; use preregistration, forward rows, and costs, labelled EXPLORATORY |
| K3 | A7 practical asks for STOP_GAP_LOSS and recovery %; neither is in the NotebookLM sources or patched lessons | Drop them; if Kamyar wants gap risk taught, it needs a lesson first, sourced from the review skill |
| K4 | A8 windows: the practical, lesson examples and quiz must use one set | **Decided 2026-11-19:** use the NotebookLM windows 0–5 / 5–15 / 15–60 minutes, then the later session. The "15 min / 4 h" example windows are replaced everywhere (A8 and the A6 example) |
| K5 | No Week 8 historical data, so A8 needs a live release in the window | Mentor picks a scheduled release when issuing A8; if none falls within the window, extend to the next release week (Kamyar to approve) |
| K6 | The Scout's other two models and the state ladder are not taught in M3 | Keep them out of required tasks; Kamyar can decide to add them to the M3 lesson |
| K7 | Routine-quality scoring has no source basis (owner policy only) | Accept as owner policy; the guidance bands in §1.6 are not official caps |
| K8 | In M1/M2, "structural" stop is a stop at a stated level written before the hypothetical order (full structure comes in M3) | Accept for weeks 1–2; `stopType` stays STRUCTURAL_HARD vs MENTAL/NONE |
| K9 | M4 week with no material US release | C3 Fed-communications fallback counts as core |
| K10 | Weeks where the honest outcome is WAIT | **Scope decided 2026-11-19 (Kamyar via Echo, Q1): the always-required conditional Final Paper Plan applies to A8 only** (never blank; `noPlan` is rejected there, and a blank A8 Friday file is NOT_APPROVED with `reasonCode:"PLAN_MISSING_REMEDIAL"`, a same-stage remedial). **M1–M5, A6, A7: no-trade is a per-day call (§1.4A); a week with zero recorded trades (`tradeDays` 0) and grounded NO_TRADE days may be graded with `noPlan`.** A trade on a no-trade day is flagged by the server and penalised by the rubric in Risk and Journal & Psychology (owner policy); the server deducts nothing. An ungrounded call is a normal `technicalMacro` shortfall; no minimum risk drill |
| K11 | Count Friday entries made before the practical upload? | Yes, Friday counts if logged before submission |
| K12 | Entries per day cap (3) and attachment cap (4 per entry) | Adopt |

Source gaps that must be respected (no invented rules): **no MA crossover rule**; **no universal pip or point value**; **M1 is not the execution standard**; **the gold grid is geometry only**; **no Week 6 statistics course**; **no Week 8 historical release data**; RSI, Volume Profile, ZigZag, and Renko have no recovered settings; the Asian-breakout stop distance is not verified; and there is no psychology or routine framework in the sources.

## 5. Worked example week: M3 (student-facing, FA + EN)

### 5.1 Student-facing (Persian)
**هفته M3: ساختار، ستاپ و stop ساختاری**

**این هفته چه می‌کنید؟** دست‌کم در **۳ روز کاری جداگانه** (دوشنبه تا جمعه به وقت آمستردام) یک گزارش روزانه در داشبورد ثبت کنید. هر گزارش همان روز قفل می‌شود و بعد از نیمه‌شب قابل ویرایش نیست. هیچ معامله واقعی لازم نیست. هر پلن فقط **شبیه‌سازی/کاغذی** است.

**سرآیند هر گزارش (۴ خط):**
1. ساعت ثبت (آمستردام) و session فعال (London یا New York).
2. تقویم اقتصادی امروز را دیدم؟ رویدادهای مهم را بنویسید، یا بنویسید «NEWS RISK: NOT ASSESSED».
3. تازگی داده: FRESH / RECENT / STALE / UNKNOWN.
4. «آیا قبل از کامل‌شدن چک‌لیستم می‌خواستم کاری بکنم؟» یک جمله صادقانه.

**تصمیم روز (در هر گزارش):** **امروز معامله (TRADE)** یا **امروز بدون معامله (NO_TRADE)**. «بدون معامله» باید مستند باشد: در «دلیل کوتاه» خوانش‌های دارای timestamp پشت آن را نام ببرید، یا جایی که داده‌ی دارای timestamp ندارید بنویسید «Observed reaction unavailable». «معامله» یعنی معامله‌ی **کاغذی** با پلن کامل در همان گزارش: equity کاغذی، ریسک ≤۱٪، سطح ورود، stop سخت ساختاری (نه mental)، point value با منبعش، lot گردشده به پایین، هزینه‌ها و R:R خالص ≥ 1:2. اگر در روزی که «بدون معامله» نوشته‌اید معامله‌ی کاغذی ثبت کنید، این مورد برای mentor علامت می‌خورد و از نمره‌ی ریسک و ژورنال و روان‌شناسی کم می‌شود. هر بلوک «پلن کاغذی» ساختاریافته معامله‌ی ثبت‌شده حساب می‌شود؛ در روز «بدون معامله» حساب پلن شرطی یا تمرین اندازه را در متن بنویسید، نه در آن بلوک.

**کارهای اصلی این هفته (هر روز دست‌کم یکی):**
- **C1، خوانش بالا به پایین:** روی ابزار اصلی هفته (EURUSD، USDJPY یا XAUUSD) جهت را روی **H4 و H1** با شواهد BOS/CHoCH علامت بزنید. بعد آخرین ساختار **کندل بسته‌شده** را روی **M15/M5** علامت بزنید. FVG یا OB فقط «محل مطالعه» است، نه اجازه ورود. MA50/MA200 فقط توصیفی است، چون قانون crossover در منابع نیست. اسکرین‌شات باید نماد، تایم‌فریم و ساعت capture داشته باشد.
- **C2، چک‌لیست Sweep Reversal:** برای یک high/low قابل‌مشاهده، مرحله‌به‌مرحله بنویسید: sweep تأییدشده ← MSS با کندل بسته از سطح محافظت‌شده ← displacement ← ناحیه مشخص (FVG/OB). بنویسید زنجیره کجا متوقف شد. «WAIT / NO_TRADE» نتیجه‌ای معتبر است.
- **C3، تمرین stop ساختاری و اندازه (کاغذی):** stop سخت را **پشت sweep extreme یا swing** بگذارید و بگویید چرا ساختاری است. فاصله stop را اندازه بگیرید. با equity کاغذی خودتان و ریسک ≤۱٪ حساب کنید: Lot = (Equity × Risk %) / (Stop Distance × Point Value). **به پایین گرد کنید.** منبع point value را بنویسید (مشخصات بروکر/قرارداد)، وگرنه آن را «آموزشی» علامت بزنید. هدف باید بعد از spread دست‌کم **1:2 خالص** باشد. اگر ستاپ معتبری نیست، همین حساب را برای یک پلن **شرطی و فعال‌نشده** روی سطح علامت‌زده انجام دهید.

**مرور مارپیچی (هفته‌های قبل):**
- **S1 (هفته ۱):** spread را در ساعت مشاهده ثبت کنید و در R:R خالص بیاورید. session را بنویسید.
- **S2 (هفته ۲):** قبل از London، PDH/PDL را علامت بزنید (دوشنبه PWH/PWL هم). اگر قیمت از سطح عبور کرد و برگشت، بنویسید sweep بود یا نه، و چه چیزی را **ثابت نمی‌کند** (wick دلیل پر شدن سفارش نیست). برای پلن شرطی، نوع سفارش را نام ببرید (Buy Limit / Sell Limit / Buy Stop / Sell Stop) و بگویید چه چیزی فعالش می‌کند.

**حداقل‌ها برای کل هفته:**
- دست‌کم ۳ روز کاری جداگانه با گزارش «واقعی» (پایین را ببینید).
- C1 در هر ۳ روز. C2 دست‌کم در ۲ روز. C3 با حساب کامل دست‌کم در ۱ روز.
- S1 و S2 هرکدام دست‌کم یک بار.

**گزارش «واقعی» یعنی:** همان روز ثبت شده باشد، مشاهده‌ی زنده‌ی همان روز با ساعت و منبع داشته باشد، کار اصلی این هفته و یک کار مرور مارپیچی را انجام داده باشد، مشخص باشد (سطح، ساعت، عدد) نه کلی یا کپی روز دیگر، و هیچ سیگنال خرید/فروش نداشته باشد.
**مهم:** کمتر از ۳ روز گزارش واقعی یعنی تمرین جمعه **قبول نمی‌شود**، هرچقدر هم گزارش جمعه خوب باشد.

**تمرین جمعه (فقط جمعه ۰۰:۰۰ تا ۲۳:۵۹ به وقت آمستردام بارگذاری می‌شود):** یک فایل PDF/DOCX/MD همراه اسکرین‌شات‌های برچسب‌دار:
1. **جدول هفته:** برای هر روز: تاریخ/ساعت، session، ابزار، جهت H4/H1 و شواهدش، ساختار M15/M5، تا کجای زنجیره sweep reversal پیش رفت، وضعیت PDH/PDL، spread.
2. **پلن کاغذی نهایی (اختیاری):** اگر می‌نویسید، یک پلن: بهترین پلن شرطی هفته، یا پلن شرطی فعال‌نشده. شامل: equity کاغذی فعلی، ریسک ≤۱٪، سطح ورود فرضی، محل stop سخت ساختاری و دلیلش، فاصله stop، point value و منبعش، lot گردشده به پایین، spread/هزینه‌ها، R:R خالص ≥ 1:2. برچسب: «شبیه‌سازی، سفارش نیست». اگر پلن نمی‌نویسید (فقط وقتی مجاز است که در کل هفته هیچ معامله‌ی کاغذی ثبت نکرده باشید)، یک نتیجه‌ی کوتاه «بدون معامله» بنویسید که مستند باشد: خوانش‌های دارای timestamp پشت آن را نام ببرید، یا جایی که داده‌ی دارای timestamp ندارید بنویسید «Observed reaction unavailable»؛ مسیر درون‌روزی را هرگز از بسته‌شدن روزانه حدس نزنید.
3. **بازتاب (۱۵۰ تا ۲۵۰ کلمه):** زنجیره بیشتر کجا متوقف شد؟ یک اشتباه که کردید و اصلاح کردید (با شماره گزارش روزانه)؟ آیا پیش از MSS با کندل بسته وسوسه شدید عمل کنید؟ هفته بعد اول چه چیزی را چک می‌کنید؟ و پاسخ پرسش درس: «کدام جفت تایم‌فریم برای جهت است و کدام برای اجرا؟»
4. **شماره گزارش‌های روزانه‌ای** که استفاده کردید.

**نمره‌دهی:** ریسک ۴۰ / ساختار فنی و کلان ۴۰ / ژورنال و روان‌شناسی ۲۰. تأیید ≥۸۰، تأیید جزئی ۶۵ تا ۷۹. **اگر پلن نهایی بنویسید: mental stop یا نبود stop، ریسک بیش از ۱٪، یا R:R خالص کمتر از 1:2 در آن = HARD_BLOCK = رد**، هرچه نمره باشد.

### 5.2 Same week (English, for review)
**Week M3: Structure, setup and the structural stop.** Log on at least **3 separate weekdays** (Mon–Fri, Amsterdam time). Each entry locks at midnight. No real trade is needed; every plan is simulated.

**Routine header (every entry):**
1. Entry time and session.
2. Calendar checked, or "NEWS RISK: NOT ASSESSED".
3. Freshness label.
4. "Did I want to act before my checklist was complete?"

**Day call (every entry):** "Trade today" (TRADE) or "No trade today" (NO_TRADE). NO_TRADE must be grounded: in the short reason, name the timestamped readings behind it, or write "Observed reaction unavailable" where you have no timestamped data. TRADE means a **paper** trade with a full plan in the same entry: paper equity, risk at most 1%, entry, a hard structural stop (never mental), point value with its source, lot rounded down, costs, and net R:R of at least 1:2. A paper trade recorded on a day you called NO_TRADE is flagged to your mentor and counts against your Risk and Journal & Psychology scores. A structured Paper plan block counts as a recorded trade, so on a NO_TRADE day write any conditional plan or sizing-drill arithmetic in the text fields instead.

**Core tasks:**
- **C1:** H4/H1 direction with BOS/CHoCH evidence, then M15/M5 closed-candle structure. FVG/OB are locations, not permission. MA50/200 are descriptive only. Screenshots labelled with symbol, timeframe, and capture time.
- **C2:** walk the sweep-reversal checklist (confirmed sweep, closed-candle MSS through a protected level, displacement, then an FVG/OB zone), and record where it stopped. WAIT is valid.
- **C3:** paper structural-stop and sizing drill. Stop beyond the sweep extreme or swing; formula; round down; point-value source or "illustrative"; at least 1:2 net after spread. If there's no valid setup, do it on a conditional, not-triggered plan.

**Spiral:**
- **S1:** spread at observation time included in net R:R; session named.
- **S2:** PDH/PDL before London (plus PWH/PWL on Monday); sweep or not, and what a wick doesn't prove; order type for the conditional plan and what activates it.

**Minimum:** 3 genuine days; C1 on all 3; C2 on 2; C3 (full arithmetic) on 1; S1 and S2 at least once each. Fewer than 3 genuine days means the practical cannot pass.

**Friday deliverable:**
1. The week table.
2. A Final Paper Plan worksheet (optional; you may skip it only if you recorded no paper trade all week). If you write no plan, add a short no-trade conclusion that is grounded: name the timestamped readings behind it, or write "Observed reaction unavailable" where you have no timestamped data, and never infer an intraday path from a daily close.
3. A 150–250 word reflection, citing entry IDs and answering the lesson question.
4. The list of entry IDs used.

### 5.3 M3 rubric (Mentor-facing)
| Pillar | Evidence | What earns points / loses points |
|---|---|---|
| Risk 40 | Final Paper Plan if submitted; C3 entries; S1 spread | Correct formula and units, rounded down; budget at most 1% of *current* paper equity; stop beyond the sweep extreme or swing and written before the hypothetical entry; net R:R of at least 2 *after* spread; point value sourced or labelled illustrative; no signal wording. **HARD_BLOCK** if a submitted final plan has a mental or no stop, risk above 1%, or net R:R below 2. With no plan (zero trades all week), Risk is scored on the C3 drills and S1 spread only. A flagged trade on a no-trade day lowers Risk (owner policy, discretionary, entry IDs quoted); a TRADE entry with incomplete risk evidence is an ordinary deduction. |
| Technical/Macro 40 (≈25 current + ≈15 spiral, guidance) | C1/C2 screenshots and entries; week table; S2 entries | Correct timeframe roles; MSS only on *closed* candles; displacement and zone identified, not assumed; honest chain-stop and WAIT; a no-trade conclusion grounded in timestamped entries (an ungrounded one is an ordinary shortfall here, no separate penalty); FVG/OB as location; MA descriptive; S2: correct PDH/PDL, sweep vs confirmation, order-type activation. Deductions: calling an entry on a wick, an MSS from an open candle, M1 used as execution, an invented MA crossover, or naming RSI/ZigZag settings. |
| Journal & Psychology 20 (≈8 consistency + ≈8 honesty/reflection + ≈4 habits, guidance) | Routine header R1–R4; server timestamps; reflection | Entries made around the observation (not end-of-day reconstructions), all four header lines present, errors and WAIT days recorded, a reflection specific to dated entries, and the lesson question answered. A flagged trade on a no-trade day counts against honesty and pre-commitment (owner policy, discretionary). |
| **Routine gate** | Server count + Mentor genuineness | Fewer than 3 genuine days means NOT_APPROVED, whatever the score. Each rejected day gets a reason in `routineGate.rejectedEntries`. |

**M3 sources:**
- LESSONS M3-L1, plus M1-L1/L2 and M2-L1 for the spiral
- SCOUT: Sweep Reversal, Stop Loss, the 1.0% cap, and the 1:2 minimum, plus §4.3 freshness for screenshots
- RULES: H4/H1 and M15/M5, M1 not standard, the MA note, PDH/PDL/PWH/PWL, the sizing formula, and zero mental stop
- CONTEXT: order types and WAIT/NO TRADE
- ORCH §4.2 (calendar) and §4.3 (NEWS RISK: NOT ASSESSED)
- GDATA-P §5.2 (time discipline)
