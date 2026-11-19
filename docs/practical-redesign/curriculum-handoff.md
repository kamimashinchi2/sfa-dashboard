# Curriculum handoff for SFA Platform: content edits for the daily-log + Friday practical redesign

Status: **FINAL content brief**, from SFA Mentor, 2026-11-19 (Europe/Amsterdam). Basis: Kamyar approved the redesign in full ("approve all", relayed by Echo): D1–D5 and K1–K12 exactly as in `spec.md` (FINAL).
Repo: `kamimashinchi2/sfa-dashboard`. Files read at `main` = `ecd512d` (PR #12; read-only shallow clone at `/workspace/tmp/sfa-main`; nothing was pushed).
Authority for any rule: only the NotebookLM exports in `/workspace/academy/notebook-sources/`. Where this brief cannot map an item, or the source disagrees, it says **GAP** or **CONFLICT** (section 9).

Companion files (same folder): `spec.md` (per-week menus, rubric), `contract-changes.md` and `site-requirements.md` (server/UI work, not repeated here), `grading-loop-update.md`.

## 0. Rules for whoever implements this

1. **Content only, no signals, no advice.** Every plan is simulated/paper. `copyLanguage.test.ts` fails the build on the phrases "buy now", "sell now", "entry active" anywhere under `app/`. Order-type names such as "Buy Limit" or "Sell Stop" are fine.
2. **No answer keys in client files.** Quiz banks (`weekQuizzes.ts`) stay key-free; the key stays in `app/lib/academy/server/answerKeyData.ts`. This brief edits no key. `weekQuizzes.test.ts` asserts that a serialized quiz item has no answer field. Keep it green.
3. **Never invent a rule.** Add nothing beyond the sources and the text below. If in doubt, leave the existing text and ask Mentor.
4. **Sequencing (important).** The new student text says "log on at least 3 weekdays, upload only on Friday". Until Platform's daily-log PR is deployed, the live server runs the old model (schemaVersion 2, no daily log, no Friday window) and kami's Phase 2 test runs on it. So ship these content edits **in the same PR as the daily-log feature** (or behind the same `practicalModel` switch). Do not merge them alone. `practicalTask` is served to authorized students through `/api/mentor/content`.
5. **Bilingual:** Persian copy with financial terms kept in English (Equity, Lot, spread, PDH/PDL, MSS, FVG, HARD_BLOCK, and so on). The copy below is paste-ready. Keep it unless a source contradicts it.
6. **Hash note.** Quiz item text feeds `itemHash` (`quizHash.ts`), so the two quiz wording edits (section 5: M5-Q8 and A8-Q10) change those items' hashes for the new build. That is expected: keys are looked up per build commit and item id, and no answer changes. `practicalTask`, `summary`, and lesson text are not part of the hash.
7. Do not touch the live server or main directly. Kamyar reviews the PR and deploys.

## 1. Shared building blocks (add once, reuse in all 8 weeks)

### 1.1 New type, in `app/lib/academy/contracts.ts` (next to `Text` and `Lesson`)

```ts
export type PracticalPlan = {
  /** Daily core menu (baseline). The assignment Mentor issues (assignment.dailyTasks) is authoritative per student. */
  core: { id: string; text: Text }[];
  /** Spiral task description; null at stage 1 (nothing earlier to review). */
  spiral: Text | null;
  minimum: Text;
  /** Name and contents of the Friday upload. */
  friday: Text;
  /** The week's lesson question, answered in the Friday reflection. */
  reflection: Text;
  /** Optional week-specific caveat, shown under the plan. */
  note?: Text;
};
```

### 1.2 `MissionDef` (curriculum.ts) and `AdvancedModuleDef` (advancedCurriculum.ts)
Add `practicalPlan?: PracticalPlan;`. Pass it through exactly where `practicalTask` is passed: `app/api/mentor/content/route.ts` (about lines 131 and 147) and the type in `useAuthorizedContent.ts`. It is student-visible only after the same authorization as `practicalTask`, and contains no key and no Echo-only data. Render it under `practicalTask` in `MissionWorkspace.tsx` and `AdvancedTrack.tsx`: `minimum` and `friday` as plain paragraphs, `core` as a short list. Keep the UI plain.

### 1.3 Shared constants, exported from `curriculum.ts` (imported by `advancedCurriculum.ts`; curriculum.ts does not import the advanced file, so there is no cycle)

```ts
export const DAILY_LOG_RULES: Text = {
  en: "Log on at least 3 separate weekdays (Mon–Fri, Amsterdam time). The server stamps each entry and it locks at midnight. No live trade is needed, and every plan is simulated/paper only. Up to 3 entries per day (several entries on one day count as one day), up to 4 screenshots per entry. Entries made on the due Friday count if you save them before you upload the practical. The Friday practical can be uploaded only on the due Friday, 00:00–23:59 Amsterdam time. If that Friday passes without an upload, the window moves to the next Friday and the count restarts from the 5 weekdays before it; only the academy owner can open an exception. After a practical that is not approved, the remedial week starts a fresh count. Fewer than 3 genuine days means the practical cannot pass, whatever the Friday file looks like.",
  fa: "دست‌کم در ۳ روز کاری جداگانه (دوشنبه تا جمعه، به وقت آمستردام) گزارش روزانه ثبت کنید. سرور هر گزارش را مهر می‌کند و نیمه‌شب قفل می‌شود. معامله واقعی لازم نیست و هر پلن فقط شبیه‌سازی/کاغذی است. هر روز حداکثر ۳ گزارش (چند گزارش در یک روز، یک روز حساب می‌شود) و هر گزارش حداکثر ۴ اسکرین‌شات. گزارش‌های روز جمعه اگر پیش از بارگذاری تمرین ذخیره شوند حساب می‌شوند. تمرین جمعه فقط در همان جمعه‌ی سررسید، از ۰۰:۰۰ تا ۲۳:۵۹ به وقت آمستردام، بارگذاری می‌شود. اگر آن جمعه بدون بارگذاری بگذرد، پنجره به جمعه بعد می‌رود و شمارش از ۵ روز کاری پیش از آن جمعه از نو شروع می‌شود؛ فقط مالک آکادمی می‌تواند استثنا بدهد. بعد از تمرینی که تأیید نشود، هفته‌ی جبرانی شمارش را از صفر شروع می‌کند. کمتر از ۳ روز گزارش واقعی یعنی تمرین قبول نمی‌شود، هرچقدر فایل جمعه خوب باشد.",
};

export const ROUTINE_HEADER: Text[] = [
  { en: "R1 Time and session: entry time (Amsterdam) and the active session (London or New York).",
    fa: "R1 زمان و session: ساعت ثبت (آمستردام) و session فعال (London یا New York)." },
  { en: "R2 Calendar check: the high-impact events scheduled today, or write \"NEWS RISK: NOT ASSESSED\".",
    fa: "R2 تقویم اقتصادی: رویدادهای مهم امروز را بنویسید، یا بنویسید «NEWS RISK: NOT ASSESSED»." },
  { en: "R3 Freshness: is the data FRESH, RECENT, STALE, or UNKNOWN?",
    fa: "R3 تازگی داده: FRESH / RECENT / STALE / UNKNOWN." },
  { en: "R4 Pre-commitment check, one honest sentence: \"Did I want to act before my checklist was complete?\"",
    fa: "R4 چک پیش‌تعهد، یک جمله صادقانه: «آیا قبل از کامل‌شدن چک‌لیستم می‌خواستم کاری بکنم؟»" },
];

export const GENUINE_ENTRY: Text = {
  en: "A genuine entry is made the same day, has a live observation with instrument, time and source, applies this week's core task and (from week 2) one earlier-week task, is specific (levels, times, numbers) and not copied from another day, and contains no buy/sell signal. WAIT / NO_TRADE is a valid result.",
  fa: "گزارش «واقعی» یعنی همان روز ثبت شده باشد، مشاهده‌ی زنده با ابزار، ساعت و منبع داشته باشد، کار اصلی این هفته و (از هفته ۲) یک کار از هفته‌های قبل را انجام داده باشد، مشخص باشد (سطح، ساعت، عدد) و کپی روز دیگر نباشد، و هیچ سیگنال خرید/فروش نداشته باشد. «WAIT / NO_TRADE» نتیجه‌ای معتبر است.",
};

/** K10 (scope decided 2026-11-19, Q1): the Final Paper Plan is REQUIRED in A8 only (a conditional plan when the honest outcome is WAIT) and OPTIONAL in M1–M5, A6, A7, where NO_TRADE_RULE below applies. Use this worksheet text wherever a plan is written. */
export const FINAL_PLAN_WORKSHEET: Text = {
  en: "Final Paper Plan (optional in every week except week 8, where it is required and never blank; if you write one, write exactly one): current paper equity and account currency; risk at most 1%; hypothetical entry level; a hard structural stop and why it is structural; stop distance; point value per lot with its source (otherwise label it \"illustrative\"); Lot = (Equity × Risk %) / (Stop Distance × Point Value), rounded down; spread and costs; net R:R of at least 1:2. Label it \"simulated, not an order\". If your honest conclusion is WAIT and you write a plan, make it a conditional, not-triggered plan at a marked level. A mental stop, no stop, risk above 1%, or net R:R below 1:2 in this plan is a HARD_BLOCK.",
  fa: "پلن کاغذی نهایی (در همه‌ی هفته‌ها به‌جز هفته ۸ اختیاری است؛ در هفته ۸ لازم است و هرگز خالی نمی‌ماند؛ اگر می‌نویسید دقیقاً یک پلن): equity کاغذی فعلی و ارز حساب؛ ریسک حداکثر ۱٪؛ سطح ورود فرضی؛ stop سخت ساختاری و دلیل ساختاری‌بودنش؛ فاصله stop؛ point value هر lot با منبعش (وگرنه برچسب «آموزشی»)؛ Lot = (Equity × Risk %) / (Stop Distance × Point Value) گردشده به پایین؛ spread و هزینه‌ها؛ R:R خالص دست‌کم 1:2. برچسب: «شبیه‌سازی، سفارش نیست». اگر نتیجه صادقانه WAIT است و پلن می‌نویسید، آن را پلن شرطی و فعال‌نشده روی سطح علامت‌زده بنویسید. mental stop، نبود stop، ریسک بیش از ۱٪ یا R:R خالص کمتر از 1:2 در این پلن HARD_BLOCK است.",
};

/** Q1 (decided 2026-11-19): shown in the shared "How the weekly practical works" block, with FINAL_PLAN_WORKSHEET. Not shown in week 8. */
export const NO_TRADE_RULE: Text = {
  en: "A no-trade (WAIT) conclusion with no plan is valid, and often wise, in every week except week 8. It must be grounded: name the timestamped readings behind it, or write \"Observed reaction unavailable\" where you have no timestamped data for a window, and never infer an intraday path from a daily close. If you do write a Final Paper Plan it is graded in full: a mental stop, no stop, risk above 1% or net R:R below 1:2 in it is a HARD_BLOCK.",
  fa: "نتیجه‌ی «بدون معامله» (WAIT) بدون پلن، در همه‌ی هفته‌ها به‌جز هفته ۸ معتبر و اغلب عاقلانه است. باید مستند باشد: خوانش‌های دارای timestamp پشت آن را نام ببرید، یا جایی که برای یک پنجره داده‌ی دارای timestamp ندارید بنویسید «Observed reaction unavailable»، و مسیر درون‌روزی را هرگز از بسته‌شدن روزانه حدس نزنید. اگر پلن کاغذی نهایی بنویسید، کامل نمره‌دهی می‌شود: mental stop، نبود stop، ریسک بیش از ۱٪ یا R:R خالص کمتر از 1:2 در آن HARD_BLOCK است.",
};
```

**K8 wording for weeks 1–2** (used in the M1 and M2 `note` below): "structural" in weeks 1–2 means a stop at a stated level written before the hypothetical order; full structure (sweep extreme, swing) is taught from week 3. `stopType` stays STRUCTURAL_HARD vs MENTAL/NONE.

**K7 wording rule:** never say the sources or the framework "require" a daily routine, the 3-day minimum, or journal scoring. Say "this course asks" or "the academy requires". Those are owner policy, not source rules.

## 2. `app/lib/academy/curriculum.ts` (M1–M5)

General: each mission's `practicalTask` is replaced by the text below (a student-facing summary) and gets the new `practicalPlan`. Mission `title`, `summary` and `href` are kept for M1–M4 (checked against the patched lessons). M5 changes (K1). In every `practicalPlan`, `reflection` is the patched lesson question that already exists in `weekLessons.ts`.

The shared `DAILY_LOG_RULES`, `ROUTINE_HEADER`, `GENUINE_ENTRY`, `FINAL_PLAN_WORKSHEET` and `NO_TRADE_RULE` are rendered once, in a shared "How the weekly practical works" block, not repeated inside each plan object.

### 2.1 M1 (Stage 1)

```ts
practicalTask: {
  en: "Log on at least 3 weekdays, then upload the Friday \"contract and cost journal\": bid/ask/spread at a London and a New York observation time, a 1% sizing drill on your own paper equity (rounded down, point value sourced or labelled illustrative), margin vs your risk budget, and, optionally, one Final Paper Plan.",
  fa: "در دست‌کم ۳ روز کاری گزارش روزانه ثبت کنید، سپس جمعه «ژورنال قرارداد و هزینه» را بارگذاری کنید: bid/ask/spread در یک ساعت مشاهده‌ی London و یک ساعت New York، تمرین اندازه ۱٪ روی equity کاغذی خودتان (گردشده به پایین، point value با منبع یا برچسب «آموزشی»)، margin در برابر بودجه ریسک، و، اختیاری، یک پلن کاغذی نهایی.",
},
practicalPlan: {
  core: [
    { id: "M1-C1", text: { en: "Cost card: bid, ask, and spread for your instrument at two observation times, one in London and one in New York. Write that spread is a cost.", fa: "کارت هزینه: bid، ask و spread ابزار خود را در دو ساعت مشاهده، یکی در London و یکی در New York، ثبت کنید. بنویسید که spread هزینه است." } },
    { id: "M1-C2", text: { en: "Session log: which session is active, and how spread compares across the two times.", fa: "ثبت session: کدام session فعال است و spread در دو ساعت چه تفاوتی دارد." } },
    { id: "M1-C3", text: { en: "Sizing drill on your own paper equity at 1%: two stop distances, the formula, round down, and the point-value source (or \"illustrative\").", fa: "تمرین اندازه روی equity کاغذی خودتان با ریسک ۱٪: دو فاصله stop، فرمول، گرد کردن به پایین، و منبع point value (یا «آموزشی»)." } },
    { id: "M1-C4", text: { en: "Margin vs risk: the margin your demo or broker spec shows for the computed lot, set against the 1% budget, with one sentence on why free margin cannot set the lot.", fa: "margin در برابر ریسک: margin که مشخصات دمو یا بروکر برای lot محاسبه‌شده نشان می‌دهد را با بودجه ۱٪ مقایسه کنید و در یک جمله بنویسید چرا free margin نمی‌تواند lot را تعیین کند." } },
    { id: "M1-C5", text: { en: "Once: compare the spot quote with the matching CME contract specification page. Report specification facts only.", fa: "یک بار: قیمت spot را با صفحه مشخصات قرارداد CME مربوطه مقایسه کنید. فقط واقعیت‌های مشخصات را بنویسید." } },
  ],
  spiral: null,
  minimum: { en: "At least 3 genuine days. C1 every day, C3 on at least 2 days, C2 and C4 at least once each.", fa: "دست‌کم ۳ روز گزارش واقعی. C1 هر روز، C3 در دست‌کم ۲ روز، C2 و C4 هرکدام دست‌کم یک بار." },
  friday: { en: "\"My contract and cost journal\": a table of your logged days (time, session, bid/ask/spread); the synthetic gold contract card and its 1% budget for equity 10,000 as part 1; an optional Final Paper Plan worksheet (without a plan, a short no-trade conclusion grounded in your timestamped readings); and a 120–200 word reflection that names one cost you had been ignoring and says when spread was widest.", fa: "«ژورنال قرارداد و هزینه‌ی من»: جدول روزهای ثبت‌شده (ساعت، session، bid/ask/spread)؛ کارت قرارداد synthetic طلا و بودجه ۱٪ برای equity=10000 به‌عنوان بخش ۱؛ برگه پلن کاغذی نهایی (اختیاری؛ بدون پلن، یک نتیجه‌ی کوتاه «بدون معامله» مستند به خوانش‌های دارای timestamp)؛ و بازتاب ۱۲۰ تا ۲۰۰ کلمه‌ای که یک هزینه‌ی نادیده‌گرفته‌شده را نام می‌برد و می‌گوید spread کی بیشترین بود." },
  reflection: { en: "If you watch only the ask, which cost do you fail to see?", fa: "اگر فقط ask را ببینید، کدام هزینه را نمی‌بینید؟" },
  note: { en: "There is no universal pip or point value: cite the contract or broker spec, or label the value illustrative. In week 1 a \"structural\" stop only means a stop at a stated level, written before the hypothetical order. M1 is not the execution standard. A grounded no-trade conclusion with no plan is valid this week (see the shared no-trade rule).", fa: "point value یا pip جهانی وجود ندارد: به مشخصات قرارداد یا بروکر ارجاع دهید یا مقدار را «آموزشی» برچسب بزنید. در هفته ۱ «ساختاری» فقط یعنی stop در یک سطح مشخص که پیش از سفارش فرضی نوشته شده است. M1 استاندارد اجرا نیست. نتیجه‌ی «بدون معامله» مستند و بدون پلن در این هفته معتبر است (قاعده‌ی مشترک «بدون معامله» را ببینید)." },
},
```

M1 `title`, `summary` and lessons: no edit. K8 stays in `note`; `weekLessons.ts` M1 text is unchanged.

### 2.2 M2 (Stage 2)

```ts
practicalTask: {
  en: "Log on at least 3 weekdays, then upload the Friday \"liquidity map journal\": PDH/PDL level table (PWH/PWL on Monday), sweep vs confirmation, an order-type table, a Stage 1 sizing drill, and, optionally, a Final Paper Plan as a pending, not-triggered plan at a marked level. The old synthetic-fixture exercise stays as an optional, ungraded warm-up.",
  fa: "در دست‌کم ۳ روز کاری گزارش روزانه ثبت کنید، سپس جمعه «ژورنال نقشه نقدینگی» را بارگذاری کنید: جدول سطوح PDH/PDL (دوشنبه PWH/PWL)، sweep در برابر تأیید، جدول نوع سفارش، تمرین اندازه مرحله ۱، و، اختیاری، یک پلن کاغذی نهایی به‌صورت پلن در انتظار و فعال‌نشده روی یک سطح علامت‌زده. تمرین قدیمیِ فیکسچر synthetic فقط گرم‌کردن اختیاری و بدون نمره است.",
},
practicalPlan: {
  core: [
    { id: "M2-C1", text: { en: "Pre-session level map: mark PDH and PDL before London (plus PWH and PWL on Monday) on H1/H4 screenshots.", fa: "نقشه سطوح پیش از session: پیش از London، PDH و PDL را روی اسکرین‌شات‌های H1/H4 علامت بزنید (دوشنبه PWH و PWL هم)." } },
    { id: "M2-C2", text: { en: "Same-day follow-up: did price trade through a marked level and come back? Classify it as sweep observed, no sweep, or unclear, and say what it does not prove.", fa: "پیگیری همان روز: آیا قیمت از یک سطح علامت‌زده عبور کرد و برگشت؟ آن را «sweep مشاهده شد»، «sweep نبود» یا «نامشخص» طبقه‌بندی کنید و بنویسید چه چیزی را ثابت نمی‌کند." } },
    { id: "M2-C3", text: { en: "Order-type drill: for a conditional idea at a marked level, name the order type (Buy Limit below price, Sell Limit above, Buy Stop or Sell Stop) and what activates it. Paper only.", fa: "تمرین نوع سفارش: برای یک ایده شرطی روی سطح علامت‌زده، نوع سفارش (Buy Limit زیر قیمت، Sell Limit بالای قیمت، Buy Stop یا Sell Stop) و چیزی که آن را فعال می‌کند بنویسید. فقط کاغذی." } },
    { id: "M2-C4", text: { en: "Cost note: spread around a scheduled release vs at a quiet time (if you observed both), labelled as a slippage or fee risk.", fa: "یادداشت هزینه: spread حول یک انتشار برنامه‌ریزی‌شده در برابر زمان آرام (اگر هر دو را دیدید)، با برچسب ریسک slippage یا کارمزد." } },
  ],
  spiral: { en: "Stage 1: rotate bid/ask/spread at an observation time, session identification, margin vs risk budget, the sizing formula with round-down, wider stop means smaller lot, and spot vs futures. At least one sizing drill per week.", fa: "مرحله ۱: این‌ها را بچرخانید: bid/ask/spread در ساعت مشاهده، شناسایی session، margin در برابر بودجه ریسک، فرمول اندازه با گرد کردن به پایین، stop بازتر یعنی lot کوچک‌تر، و spot در برابر futures. هفته‌ای دست‌کم یک تمرین اندازه." },
  minimum: { en: "At least 3 genuine days. C1 and C2 on at least 3 days, C3 on at least 2 days, a Stage 1 task on at least 2 days.", fa: "دست‌کم ۳ روز گزارش واقعی. C1 و C2 در دست‌کم ۳ روز، C3 در دست‌کم ۲ روز، یک کار مرحله ۱ در دست‌کم ۲ روز." },
  friday: { en: "\"Liquidity map journal\": a 3–5 day level table (level, time touched, classification); the order-type table; and an optional Final Paper Plan as a pending, not-triggered plan at a marked level, with the hard stop beyond that level or the swept extreme, the formula, and net R:R of at least 1:2. Without a plan, add a short no-trade conclusion grounded in your timestamped level readings.", fa: "«ژورنال نقشه نقدینگی»: جدول سطوح ۳ تا ۵ روز (سطح، ساعت لمس، طبقه‌بندی)؛ جدول نوع سفارش؛ و پلن کاغذی نهایی اختیاری به‌صورت پلن در انتظار و فعال‌نشده روی یک سطح علامت‌زده، با stop سخت پشت آن سطح یا پشت extreme سوییپ‌شده، فرمول، و R:R خالص دست‌کم 1:2. بدون پلن، یک نتیجه‌ی کوتاه «بدون معامله» مستند به خوانش‌های دارای timestamp سطوح اضافه کنید." },
  reflection: { en: "What does a sweep prove, and what does it not prove?", fa: "یک sweep چه چیزی را ثابت می‌کند و چه چیزی را ثابت نمی‌کند؟" },
  note: { en: "A wick touch does not prove a fill. A sweep is not an entry. In week 2 a \"structural\" stop means a stop beyond the marked level, written before the hypothetical order. A grounded no-trade conclusion with no plan is valid this week (see the shared no-trade rule).", fa: "لمس با wick پر شدن سفارش را ثابت نمی‌کند. sweep ورود نیست. در هفته ۲ stop «ساختاری» یعنی stop پشت سطح علامت‌زده که پیش از سفارش فرضی نوشته شده است. نتیجه‌ی «بدون معامله» مستند و بدون پلن در این هفته معتبر است (قاعده‌ی مشترک «بدون معامله» را ببینید)." },
},
```

M2 `title`, `summary` and lessons: no edit. **Do not use** the CONTEXT Asian-session breakout example as a drill (no verified stop distance in the sources). For the `MissionWorkspace.tsx` M2 completion gate, see section 7.

### 2.3 M3 (Stage 3). Worked example: `spec.md` §5 (its Persian text is final)

```ts
practicalTask: {
  en: "Log on at least 3 weekdays applying H4/H1 direction, M15/M5 closed-candle structure, the sweep-reversal checklist, and a paper structural-stop sizing drill. On Friday upload the week table, an optional Final Paper Plan (or a short no-trade conclusion grounded in your timestamped readings), a 150–250 word reflection that cites your entry IDs, and the list of entry IDs.",
  fa: "در دست‌کم ۳ روز کاری گزارش روزانه ثبت کنید و جهت H4/H1، ساختار کندل‌بسته M15/M5، چک‌لیست sweep-reversal و تمرین اندازه با stop ساختاری کاغذی را به‌کار ببرید. جمعه جدول هفته، پلن کاغذی نهایی (اختیاری؛ یا یک نتیجه‌ی کوتاه «بدون معامله» مستند به خوانش‌های دارای timestamp)، بازتاب ۱۵۰ تا ۲۵۰ کلمه‌ای با ارجاع به شماره گزارش‌ها، و فهرست شماره گزارش‌ها را بارگذاری کنید.",
},
practicalPlan: {
  core: [
    { id: "M3-C1", text: { en: "Top-down read: on your main instrument (EURUSD, USDJPY or XAUUSD) mark direction on H4 and H1 with BOS/CHoCH evidence, then the latest closed-candle structure on M15/M5. FVG or OB is a location to study, not permission to enter. MA50/MA200 are descriptive only (no crossover rule in the sources). Screenshots show symbol, timeframe, and capture time.", fa: "خوانش بالا به پایین: روی ابزار اصلی هفته (EURUSD، USDJPY یا XAUUSD) جهت را روی H4 و H1 با شواهد BOS/CHoCH علامت بزنید. بعد آخرین ساختار کندل بسته‌شده را روی M15/M5 علامت بزنید. FVG یا OB فقط «محل مطالعه» است، نه اجازه ورود. MA50/MA200 فقط توصیفی است، چون قانون crossover در منابع نیست. اسکرین‌شات باید نماد، تایم‌فریم و ساعت capture داشته باشد." } },
    { id: "M3-C2", text: { en: "Sweep-reversal checklist: for one visible high or low, write step by step: confirmed sweep, closed-candle MSS through a protected level, displacement, then a defined zone (FVG/OB). Write where the chain stopped. WAIT / NO_TRADE is a valid result.", fa: "چک‌لیست Sweep Reversal: برای یک high/low قابل‌مشاهده، مرحله‌به‌مرحله بنویسید: sweep تأییدشده ← MSS با کندل بسته از سطح محافظت‌شده ← displacement ← ناحیه مشخص (FVG/OB). بنویسید زنجیره کجا متوقف شد. «WAIT / NO_TRADE» نتیجه‌ای معتبر است." } },
    { id: "M3-C3", text: { en: "Paper structural-stop and sizing drill: put the hard stop beyond the sweep extreme or swing and say why it is structural. Measure the stop distance. With your own paper equity and risk of at most 1%: Lot = (Equity × Risk %) / (Stop Distance × Point Value), rounded down. Name the point-value source or label it illustrative. The target must give at least 1:2 net after spread. If there is no valid setup, do the same arithmetic on a conditional, not-triggered plan at a marked level.", fa: "تمرین stop ساختاری و اندازه (کاغذی): stop سخت را پشت sweep extreme یا swing بگذارید و بگویید چرا ساختاری است. فاصله stop را اندازه بگیرید. با equity کاغذی خودتان و ریسک ≤۱٪ حساب کنید: Lot = (Equity × Risk %) / (Stop Distance × Point Value). به پایین گرد کنید. منبع point value را بنویسید (مشخصات بروکر/قرارداد)، وگرنه آن را «آموزشی» علامت بزنید. هدف باید بعد از spread دست‌کم 1:2 خالص باشد. اگر ستاپ معتبری نیست، همین حساب را برای یک پلن شرطی و فعال‌نشده روی سطح علامت‌زده انجام دهید." } },
  ],
  spiral: { en: "S1 (week 1): include spread at the observation time in net R:R and name the session. S2 (week 2): mark PDH/PDL before London (PWH/PWL on Monday); if price crossed a level and came back, say whether it was a sweep and what it does not prove (a wick is not a fill); for the conditional plan, name the order type and what activates it.", fa: "S1 (هفته ۱): spread را در ساعت مشاهده ثبت کنید و در R:R خالص بیاورید. session را بنویسید. S2 (هفته ۲): قبل از London، PDH/PDL را علامت بزنید (دوشنبه PWH/PWL هم). اگر قیمت از سطح عبور کرد و برگشت، بنویسید sweep بود یا نه، و چه چیزی را ثابت نمی‌کند (wick دلیل پر شدن سفارش نیست). برای پلن شرطی، نوع سفارش را نام ببرید و بگویید چه چیزی فعالش می‌کند." },
  minimum: { en: "At least 3 genuine days. C1 on all 3, C2 on at least 2, C3 with full arithmetic on at least 1, S1 and S2 at least once each.", fa: "دست‌کم ۳ روز گزارش واقعی. C1 در هر ۳ روز، C2 دست‌کم در ۲ روز، C3 با حساب کامل دست‌کم در ۱ روز، S1 و S2 هرکدام دست‌کم یک بار." },
  friday: { en: "(1) The week table: per day date/time, session, instrument, H4/H1 direction and evidence, M15/M5 structure, how far the sweep-reversal chain went, PDH/PDL status, spread. (2) A Final Paper Plan (optional), or a short no-trade conclusion grounded in your timestamped readings. (3) A 150–250 word reflection citing entry IDs: where the chain stopped most, one mistake you made and corrected, whether you were tempted to act before a closed-candle MSS, what you check first next week. (4) The list of daily entry IDs you used.", fa: "۱. جدول هفته: برای هر روز تاریخ/ساعت، session، ابزار، جهت H4/H1 و شواهدش، ساختار M15/M5، تا کجای زنجیره sweep reversal پیش رفت، وضعیت PDH/PDL، spread. ۲. پلن کاغذی نهایی (اختیاری)، یا یک نتیجه‌ی کوتاه «بدون معامله» مستند به خوانش‌های دارای timestamp. ۳. بازتاب ۱۵۰ تا ۲۵۰ کلمه‌ای با شماره گزارش‌ها: زنجیره بیشتر کجا متوقف شد، یک اشتباه که کردید و اصلاح کردید، آیا پیش از MSS با کندل بسته وسوسه شدید عمل کنید، هفته بعد اول چه چیزی را چک می‌کنید. ۴. شماره گزارش‌های روزانه‌ای که استفاده کردید." },
  reflection: { en: "Which timeframe pair is for direction, and which is for execution?", fa: "کدام جفت تایم‌فریم برای جهت است و کدام برای اجرا؟" },
  note: { en: "M1 is not the execution standard. No moving-average crossover rule, no RSI/Volume Profile/ZigZag/Renko setting, and no entry on a wick or an open candle is taught. A grounded no-trade conclusion with no plan is valid this week (see the shared no-trade rule).", fa: "M1 استاندارد اجرا نیست. هیچ قانون تقاطع میانگین متحرک، تنظیمات RSI/Volume Profile/ZigZag/Renko، یا ورود روی wick یا کندل باز آموزش داده نمی‌شود. نتیجه‌ی «بدون معامله» مستند و بدون پلن در این هفته معتبر است (قاعده‌ی مشترک «بدون معامله» را ببینید)." },
},
```

M3 `title` and `summary`: keep. The summary mentions "Replay"; that is an in-app tool name, not a source claim. "momentum" and "retracement" are in the sources. The current `practicalTask` (Risk Grid, "reject/correct the unsafe example until HARD_BLOCK clears") becomes an optional ungraded warm-up, labelled in the UI only.
**K6:** no edit needed. A search of `weekLessons.ts`, `weekQuizzes.ts` and `curriculum.ts` finds no mention of the Scout's Breakout-and-Pullback model, Range-Edge Reversal model, or setup state ladder, so nothing in M3 requires them. Do not add them.

### 2.4 M4 (Stage 4)

```ts
practicalTask: {
  en: "Log on at least 3 weekdays: a release log (Actual, Forecast, Previous, Revisions and components), a macro chain walk with UNVERIFIED links, and immediate vs durable. On Friday upload the \"macro context journal\". No entry comes from macro: a Final Paper Plan is optional, and if you write one it is built from Stage 3 structure and says \"macro is context only\". A grounded no-trade conclusion is also valid.",
  fa: "در دست‌کم ۳ روز کاری گزارش روزانه ثبت کنید: ثبت انتشار (Actual، Forecast، Previous، Revisions و اجزا)، قدم‌زدن در زنجیره کلان با حلقه‌های UNVERIFIED، و فوری در برابر پایدار. جمعه «ژورنال زمینه کلان» را بارگذاری کنید. هیچ ورودی از کلان نمی‌آید: پلن کاغذی نهایی اختیاری است و اگر بنویسید از ساختار مرحله ۳ ساخته می‌شود و می‌گوید «کلان فقط زمینه است». نتیجه‌ی «بدون معامله» مستند هم معتبر است.",
},
practicalPlan: {
  core: [
    { id: "M4-C1", text: { en: "Release log on a day with a material US release: Actual, Forecast, Previous, Revisions, and the components. Keep the release time and your observation time separate.", fa: "ثبت انتشار در روزی که انتشار مهم آمریکا دارد: Actual، Forecast، Previous، Revisions و اجزا. ساعت انتشار و ساعت مشاهده‌ی خودتان را جدا بنویسید." } },
    { id: "M4-C2", text: { en: "Chain walk: for that release or the day's main driver, fill each link (data and surprise, Fed reaction, US2Y/US10Y, real yields, DXY, VIX, cross-asset confirmation, Dow/gold) with evidence, or mark it UNVERIFIED. Stop where the evidence stops.", fa: "قدم‌زدن در زنجیره: برای همان انتشار یا محرک اصلی روز، هر حلقه (داده و surprise، واکنش Fed، US2Y/US10Y، real yields، DXY، VIX، تأیید بین‌بازاری، Dow/gold) را با شاهد پر کنید یا UNVERIFIED بنویسید. همان‌جا که شاهد تمام می‌شود، متوقف شوید." } },
    { id: "M4-C3", text: { en: "Fed-communications fallback, on a day with no material release: an FOMC statement or speech, or a FedWatch snapshot, with its timestamp. Keep current snapshots separate from historical ones. This counts as a core task.", fa: "جایگزین ارتباطات Fed، در روزی که انتشار مهم ندارد: یک بیانیه یا سخنرانی FOMC یا یک snapshot از FedWatch با timestamp. snapshotهای جاری را از تاریخی جدا نگه دارید. این یک کار اصلی حساب می‌شود." } },
    { id: "M4-C4", text: { en: "Immediate vs durable: one line on the first reaction and one on what remains unresolved.", fa: "فوری در برابر پایدار: یک خط درباره‌ی واکنش اول و یک خط درباره‌ی آنچه حل‌نشده مانده." } },
  ],
  spiral: { en: "Stage 3: describe the H4/H1 structure around the release time, with no entry from macro. Stage 2: was PDH/PDL swept on release day? Stage 1: release-time spread vs quiet-time spread. Rotate across the week.", fa: "مرحله ۳: ساختار H4/H1 حول زمان انتشار را توصیف کنید، بدون هیچ ورودی از کلان. مرحله ۲: آیا PDH/PDL روز انتشار sweep شد؟ مرحله ۱: spread زمان انتشار در برابر spread زمان آرام. در طول هفته بچرخانید." },
  minimum: { en: "At least 3 genuine days. C2 on at least 2 days, C1 on at least 1 day (if no material US release falls in the window, C3 on at least 2 days instead), and each of Stages 1, 2 and 3 at least once.", fa: "دست‌کم ۳ روز گزارش واقعی. C2 در دست‌کم ۲ روز، C1 در دست‌کم ۱ روز (اگر در پنجره انتشار مهم آمریکا نیست، به‌جایش C3 در دست‌کم ۲ روز)، و هر یک از مراحل ۱، ۲ و ۳ دست‌کم یک بار." },
  friday: { en: "\"Macro context journal\": the week's releases table; one completed chain table with UNVERIFIED links shown; the immediate vs durable split; and an optional Final Paper Plan, built from Stage 3 structure and not from the macro bias, with one line \"macro is context only\". Without a plan, add a short no-trade conclusion grounded in the release facts and timestamps you recorded.", fa: "«ژورنال زمینه کلان»: جدول انتشارهای هفته؛ یک جدول کامل زنجیره با حلقه‌های UNVERIFIED نمایان؛ تفکیک فوری و پایدار؛ و پلن کاغذی نهایی اختیاری که از ساختار مرحله ۳ ساخته شده نه از bias کلان، با یک خط «کلان فقط زمینه است». بدون پلن، یک نتیجه‌ی کوتاه «بدون معامله» مستند به واقعیت‌های انتشار و timestampهایی که ثبت کردید اضافه کنید." },
  reflection: { en: "What must sit between an economic release and any idea about price?", fa: "بین یک انتشار اقتصادی و هر ایده درباره قیمت چه چیزهایی باید باشد؟" },
  note: { en: "Jumping from one print to a trade idea costs points. A print is not a regime. A grounded no-trade conclusion with no plan is valid this week (see the shared no-trade rule). The sources give no list of \"material\" releases; use the labor list (NFP, unemployment rate, average hourly earnings, participation, jobless claims, JOLTS, ADP) and the inflation list (CPI, Core CPI, PPI, PCE, wage inflation).", fa: "پریدن از یک عدد به ایده معامله نمره کم می‌کند. یک عدد یک regime نیست. نتیجه‌ی «بدون معامله» مستند و بدون پلن در این هفته معتبر است (قاعده‌ی مشترک «بدون معامله» را ببینید). منابع فهرستی از انتشارهای «مهم» نمی‌دهند؛ فهرست نیروی کار (NFP، نرخ بیکاری، average hourly earnings، participation، jobless claims، JOLTS، ADP) و فهرست تورم (CPI، Core CPI، PPI، PCE، wage inflation) را به‌کار ببرید." },
},
```

M4 `title` and `summary`: keep (the summary names NFP, JOLTS, Claims and Sahm; all four are in the sources). The current `practicalTask` (align the synthetic CPI conditional graph to an accepted key, no entry/SL/TP) becomes the optional ungraded warm-up.

### 2.5 M5 (Stage 5), K1: realign to intermarket

Replace the mission `title`, `summary` and `practicalTask`, and add the plan:

```ts
title: { fa: "M5 — بین‌بازاری", en: "M5 — Intermarket" },
summary: {
  fa: "CROSS_ASSET_ENGINE (2s10s، TIPS real yields، DXY، VIX، اعتبار)، همبستگی وابسته به رژیم، بدون دوبار شمردن، bias کلان ورود نیست.",
  en: "CROSS_ASSET_ENGINE (2s10s, TIPS real yields, DXY, VIX, credit), regime-dependent correlation, no double counting, macro bias is not an entry.",
},
practicalTask: {
  en: "Log on at least 3 weekdays: a timestamped cross-asset matrix at a fixed daily time, a divergence check, a double-count audit, and first hour vs later. On Friday upload the \"weekly intermarket journal\" with one macro bias statement labelled \"not an entry\", and a trade / no-trade conclusion (a no-trade week is valid, but your explanation must match what you actually observed). A Final Paper Plan is optional.",
  fa: "در دست‌کم ۳ روز کاری گزارش روزانه ثبت کنید: ماتریس بین‌بازاری با timestamp در یک ساعت ثابت روزانه، بررسی واگرایی، ممیزی دوبار شمردن، و ساعت اول در برابر بعدتر. جمعه «ژورنال بین‌بازاری هفته» را با یک بیانیه bias کلان با برچسب «ورود نیست» و یک نتیجه‌ی «معامله / بدون معامله» بارگذاری کنید (هفته‌ی بدون معامله معتبر است، اما توضیح شما باید با آنچه واقعاً مشاهده کرده‌اید جور باشد). پلن کاغذی نهایی اختیاری است.",
},
practicalPlan: {
  core: [
    { id: "M5-C1", text: { en: "Cross-asset matrix at a fixed daily time: US2Y, US10Y, real yields, DXY, VIX, credit spreads, Dow, and gold. For each: latest direction, timestamp, meaning, confirms or contradicts, and data confidence.", fa: "ماتریس بین‌بازاری در یک ساعت ثابت روزانه: US2Y، US10Y، real yields، DXY، VIX، credit spreads، Dow و gold. برای هرکدام: آخرین جهت، timestamp، معنا، تأییدکننده یا متناقض، و اطمینان داده." } },
    { id: "M5-C2", text: { en: "Divergence check: is today's contradiction genuine, or caused by different observation times or data delays?", fa: "بررسی واگرایی: آیا تناقض امروز واقعی است یا از تفاوت ساعت مشاهده یا تأخیر داده می‌آید؟" } },
    { id: "M5-C3", text: { en: "Double-count audit: list the inputs behind the day's bias and strike any duplicate (for example US2Y, FedWatch and real yields can express the same policy expectation).", fa: "ممیزی دوبار شمردن: ورودی‌های پشت bias امروز را فهرست کنید و هر تکراری را خط بزنید (مثلاً US2Y، FedWatch و real yields می‌توانند همان انتظار سیاستی را بیان کنند)." } },
    { id: "M5-C4", text: { en: "First hour vs later: label the immediate reaction and the later one separately, and do not average them.", fa: "ساعت اول در برابر بعدتر: واکنش فوری و واکنش بعدی را جدا برچسب بزنید و میانگین نگیرید." } },
  ],
  spiral: { en: "Stage 4: put any release this week through the macro chain. Stage 3: structure on your main instrument. Stage 2: levels. Stage 1: cost and sizing. Each at least once.", fa: "مرحله ۴: هر انتشار این هفته را از زنجیره کلان عبور دهید. مرحله ۳: ساختار ابزار اصلی. مرحله ۲: سطوح. مرحله ۱: هزینه و اندازه. هرکدام دست‌کم یک بار." },
  minimum: { en: "At least 3 genuine days. C1 on at least 3 days, C2 or C3 on at least 2 days, each of Stages 1–4 at least once.", fa: "دست‌کم ۳ روز گزارش واقعی. C1 در دست‌کم ۳ روز، C2 یا C3 در دست‌کم ۲ روز، هر یک از مراحل ۱ تا ۴ دست‌کم یک بار." },
  friday: { en: "\"Weekly intermarket journal\": the matrix rows side by side; regime notes (what moved together, what diverged, and why correlation cannot be assumed); one macro bias statement with explicit invalidation, labelled \"not an entry\"; and a short trade / no-trade conclusion. A no-trade week is valid and often wise, but the explanation must match what actually happened: name the timestamped matrix rows, releases, divergence or unresolved link behind it. A Final Paper Plan built from structure is optional. If you write one and use gold grid levels for targets, label them \"geometry only\".", fa: "«ژورنال بین‌بازاری هفته»: ردیف‌های ماتریس کنار هم؛ یادداشت رژیم (چه چیزی با هم حرکت کرد، چه چیزی واگرا شد، و چرا همبستگی را نمی‌توان فرض کرد)؛ یک بیانیه bias کلان با ابطال صریح و برچسب «ورود نیست»؛ و یک نتیجه‌ی کوتاه «معامله / بدون معامله». هفته‌ی بدون معامله معتبر و اغلب عاقلانه است، اما توضیح باید با آنچه واقعاً رخ داد جور باشد: ردیف‌های ماتریس دارای timestamp، انتشارها، واگرایی یا حلقه‌ی حل‌نشده‌ای که پشت آن است را نام ببرید. پلن کاغذی نهایی که از ساختار ساخته شده اختیاری است. اگر نوشتید و از سطوح شبکه طلا برای هدف‌ها استفاده کردید، آن‌ها را «فقط هندسه» برچسب بزنید." },
  reflection: { en: "Why is 'gold and the dollar moved together today' not yet confirmation?", fa: "چرا «طلا و دلار امروز با هم حرکت کردند» هنوز تأیید نیست؟" },
  note: { en: "Correlation is regime-dependent; Dow and gold have no fixed inverse relationship. Without real yields and DXY, a gold bias is not proven. The gold grid is price geometry only: no grid-derived direction or signal. A no-trade conclusion must match your own recorded data: name the timestamped readings and releases behind it (a conclusion that contradicts them, cites an untimestamped reading, or relies on an unverified release is a shortfall in the Technical & Macro score, with no separate penalty). Where a window has no timestamped data, write \"Observed reaction unavailable\".", fa: "همبستگی به رژیم بستگی دارد؛ Dow و gold رابطه معکوس ثابت ندارند. بدون real yields و DXY، bias طلا ثابت نشده است. شبکه طلا فقط هندسه قیمت است: هیچ جهت یا سیگنالی از شبکه نمی‌آید. نتیجه‌ی «بدون معامله» باید با داده‌ی ثبت‌شده‌ی خودتان جور باشد: خوانش‌ها و انتشارهای دارای timestamp پشت آن را نام ببرید (نتیجه‌ای که با آن‌ها نمی‌خواند، به خوانش بدون timestamp استناد می‌کند، یا به انتشار تأییدنشده تکیه دارد، کمبودی در نمره‌ی «ساختار فنی و کلان» است، بدون جریمه‌ی جداگانه)؛ اگر برای پنجره‌ای داده‌ی دارای timestamp ندارید، «Observed reaction unavailable» بنویسید." },
},
```

The base lesson `M5-L1` inside `curriculum.ts` (title "Preregister the hypothesis", HARKing, train/test) is **dead copy at runtime**, because `LESSON_PATCH["M5-L1"]` overrides title, core, trap, reality and question. Still, it is Stage 6 text inside a Stage 5 mission. Replace its base fields with the patched M5-L1 strings from `weekLessons.ts` so nothing stale survives if the patch lookup ever changes. Do the same drift check for the M1–M4 base lessons (low priority; the patch wins at runtime, so only the base strings are stale).

## 3. `app/lib/academy/advancedCurriculum.ts` (A6–A8)

Add `practicalPlan?: PracticalPlan` to `AdvancedModuleDef`. Import the shared constants if they are rendered here.

### 3.1 A6 (Stage 6), K2: drop the TRAIN/TEST metrics

`title`, `summary` ("Falsifiable preregistration, leakage/OOS discipline, gross vs net evaluation") and `href`: keep.

```ts
practicalTask: {
  en: "Log on at least 3 weekdays. On your first logged day, lock a one-line falsifiable observation hypothesis (falsifier, allowed data, costs) before any outcome; on later days add timestamped forward observation rows and a failure log. On Friday upload a research note labelled IN-SAMPLE / EXPLORATORY. No significance tests, profit factor or win-rate statistics are required, and no live rule is promoted.",
  fa: "در دست‌کم ۳ روز کاری گزارش روزانه ثبت کنید. در اولین روز ثبت، پیش از هر نتیجه، یک فرضیه مشاهده‌ای ابطال‌پذیر یک‌خطی را قفل کنید (ابطال‌کننده، داده مجاز، هزینه‌ها)؛ در روزهای بعد ردیف‌های مشاهده‌ی رو به جلو با timestamp و گزارش شکست‌ها را اضافه کنید. جمعه یک یادداشت پژوهشی با برچسب IN-SAMPLE / EXPLORATORY بارگذاری کنید. آزمون معناداری، profit factor یا آمار win-rate لازم نیست و هیچ قاعده زنده‌ای ترویج نمی‌شود.",
},
practicalPlan: {
  core: [
    { id: "A6-C1", text: { en: "Preregistration, on your first logged day, locked before any outcome: one small falsifiable observation hypothesis on the week's live market (for example, \"on EURUSD, after a material US release, the 0–5, 5–15 and 15–60 minute windows and the later session are recorded separately\", or \"PDH sweeps followed by a closed M15 MSS\"). State the falsifier, the allowed data, and the costs to include.", fa: "پیش‌ثبت، در اولین روز ثبت و پیش از هر نتیجه: یک فرضیه مشاهده‌ای کوچک و ابطال‌پذیر روی بازار زنده‌ی این هفته (مثلاً «روی EURUSD، بعد از یک انتشار مهم آمریکا، پنجره‌های ۰ تا ۵، ۵ تا ۱۵ و ۱۵ تا ۶۰ دقیقه و جلسه‌ی بعدی جدا ثبت می‌شوند»، یا «sweepهای PDH که MSS بسته‌شده M15 بعدشان آمد»). ابطال‌کننده، داده مجاز و هزینه‌هایی که باید حساب شوند را بنویسید." } },
    { id: "A6-C2", text: { en: "Forward observation rows (later days): timestamped observations that meet or fail the hypothesis's conditions, with spread recorded. Missing data stays \"missing\", with a reason.", fa: "ردیف‌های مشاهده‌ی رو به جلو (روزهای بعد): مشاهده‌های دارای timestamp که شرایط فرضیه را برآورده یا نقض می‌کنند، همراه spread. داده‌ی ناموجود «missing» می‌ماند، با دلیل." } },
    { id: "A6-C3", text: { en: "Failure log: every row that went against the hypothesis, written down the same day.", fa: "گزارش شکست‌ها: هر ردیفی که برخلاف فرضیه بود، همان روز نوشته شود." } },
    { id: "A6-C4", text: { en: "\"Named tool, missing rule\" check: if a tool tempted you (MA, RSI, grid), write \"rule not in source\".", fa: "چک «ابزار نام‌برده، قاعده‌ی ناموجود»: اگر ابزاری وسوسه‌تان کرد (MA، RSI، شبکه)، بنویسید «rule not in source»." } },
  ],
  spiral: { en: "Stages 1–5: rotate one skill from each across the week, least recently reviewed first.", fa: "مراحل ۱ تا ۵: در طول هفته از هر مرحله یک مهارت بچرخانید، اول آن که دیرتر مرور شده." },
  minimum: { en: "At least 3 genuine days. C1 on your first counted day (if C1 is missing or dated after an outcome row, preregistration scores 0; that is a scoring deduction, not the gate), C2 on at least 2 later days, each of Stages 1–5 at least once.", fa: "دست‌کم ۳ روز گزارش واقعی. C1 در اولین روز شمرده‌شده (اگر C1 نباشد یا بعد از یک ردیف نتیجه تاریخ خورده باشد، پیش‌ثبت نمره ۰ می‌گیرد؛ این کسر نمره است نه گیت)، C2 در دست‌کم ۲ روز بعدی، هر یک از مراحل ۱ تا ۵ دست‌کم یک بار." },
  friday: { en: "\"Research note\": the preregistration as written (entry ID); the observation table; gross vs net after costs where an R-measure applies; the failures; the label IN-SAMPLE / EXPLORATORY, because a handful of rows is not evidence; and an optional Final Paper Plan (structure-based, risk rules unchanged; without a plan, a short no-trade conclusion grounded in your timestamped readings).", fa: "«یادداشت پژوهشی»: پیش‌ثبت همان‌طور که نوشته شد (شماره گزارش)؛ جدول مشاهده‌ها؛ ناخالص در برابر خالص بعد از هزینه‌ها وقتی اندازه R کاربرد دارد؛ شکست‌ها؛ برچسب IN-SAMPLE / EXPLORATORY چون چند ردیف شاهد نیست؛ و پلن کاغذی نهایی اختیاری (مبتنی بر ساختار، قواعد ریسک بدون تغییر؛ بدون پلن، یک نتیجه‌ی کوتاه «بدون معامله» مستند به خوانش‌های دارای timestamp)." },
  reflection: { en: "What has to be written down before the outcome window is opened?", fa: "پیش از باز کردن پنجره نتیجه چه چیزی باید نوشته شده باشد؟" },
  note: { en: "The words NORMAL, CAUTION and HARD_BLOCK apply only to the stated risk rules (1% cap, hard structural stop, minimum 1:2). Named tools (MA, RSI, Volume Profile, ZigZag, Renko) have no validated rule or settings in the sources. There is no statistics course in this curriculum. A grounded no-trade conclusion with no plan is valid this week (see the shared no-trade rule).", fa: "واژه‌های NORMAL، CAUTION و HARD_BLOCK فقط برای قواعد ریسک بیان‌شده به‌کار می‌روند (سقف ۱٪، stop سخت ساختاری، حداقل 1:2). ابزارهای نام‌برده (MA، RSI، Volume Profile، ZigZag، Renko) در منابع قاعده یا تنظیمات تأییدشده ندارند. در این دوره درس آمار وجود ندارد. نتیجه‌ی «بدون معامله» مستند و بدون پلن در این هفته معتبر است (قاعده‌ی مشترک «بدون معامله» را ببینید)." },
},
```

Also in `advancedCurriculum.ts`: the base A6 lesson strings are overridden at runtime by `LESSON_PATCH` (A6-L1/L2/L3). As for M5-L1, replace their base fields with the patched strings (or delete the base text) so no TRAIN/TEST or profit-factor wording remains in the file.

### 3.2 A7 (Stage 7), K3: drop STOP_GAP_LOSS and recovery %

Edit `summary`. Today it says "Current-equity sizing, drawdown/recovery paths, portfolio transparency." The patched lessons teach neither recovery % nor portfolio shocks, so use:

```ts
summary: {
  fa: "اندازه روی equity جاری، مسیر drawdown، بودجه ۱٪ که روی equity باقی‌مانده دوباره حساب می‌شود.",
  en: "Current-equity sizing, the drawdown path, and the 1% budget recalculated on remaining equity.",
},
```

The base A7 lessons in this file are stale and overridden at runtime, but they still contain the unsourced text: A7-L2 "Drawdown and recovery" (`recoveryPct = (peak/equity − 1)×100`, "Gaps can create STOP_GAP_LOSS", "What gain recovers a 20% drawdown?") and A7-L3 "Shared portfolio shocks" ("invent no portfolio cap", "diversification credit"). Replace their base fields with the patched A7-L1/L2/L3 strings from `weekLessons.ts` (titles "The three hard risk rules", "Sizing is arithmetic", "Drawdown and the journal").

```ts
practicalTask: {
  en: "Log on at least 3 weekdays: a daily paper plan on current paper equity (or WAIT with a conditional plan), a paper-ledger update, a stop-doubling drill and a three-losses scenario note. On Friday upload the \"risk ledger and drawdown review\". Recovery percentages and gap-loss labels are not required.",
  fa: "در دست‌کم ۳ روز کاری گزارش روزانه ثبت کنید: پلن کاغذی روزانه روی equity کاغذی جاری (یا WAIT با پلن شرطی)، به‌روزرسانی دفتر کاغذی، تمرین دو برابر شدن stop و یادداشت سناریوی سه زیان. جمعه «دفتر ریسک و بازبینی drawdown» را بارگذاری کنید. درصد بازیابی و برچسب gap-loss لازم نیست.",
},
practicalPlan: {
  core: [
    { id: "A7-C1", text: { en: "Daily paper plan on current paper equity: the full worksheet (equity, 1% budget, entry, hard structural stop, stop distance, point-value source or \"illustrative\", Lot rounded down, costs, net R:R of at least 1:2), or WAIT with a conditional plan.", fa: "پلن کاغذی روزانه روی equity کاغذی جاری: برگه کامل (equity، بودجه ۱٪، ورود، stop سخت ساختاری، فاصله stop، منبع point value یا «آموزشی»، Lot گردشده به پایین، هزینه‌ها، R:R خالص دست‌کم 1:2)، یا WAIT با پلن شرطی." } },
    { id: "A7-C2", text: { en: "Paper ledger update: the result of earlier paper plans against invalidation, measured against price only. Update the equity path; the next budget is 1% of the new equity.", fa: "به‌روزرسانی دفتر کاغذی: نتیجه‌ی پلن‌های کاغذی قبلی در برابر ابطال، فقط با قیمت سنجیده شود. مسیر equity را به‌روز کنید؛ بودجه بعدی ۱٪ equity جدید است." } },
    { id: "A7-C3", text: { en: "Stop-doubling drill: same budget, double the stop distance, compute the new lot, and show the money at risk is unchanged.", fa: "تمرین دو برابر شدن stop: همان بودجه، فاصله stop دو برابر، lot جدید را حساب کنید و نشان دهید مبلغ در معرض ریسک تغییر نکرده است." } },
    { id: "A7-C4", text: { en: "Scenario note: if the next three paper plans all hit their stops, what are the drawdown and the next budget?", fa: "یادداشت سناریو: اگر سه پلن کاغذی بعدی همه به stop بخورند، drawdown و بودجه بعدی چیست؟" } },
  ],
  spiral: { en: "Stages 1–6: rotate across the week. For Stage 6, state the falsifier of this week's paper approach before Friday.", fa: "مراحل ۱ تا ۶: در طول هفته بچرخانید. برای مرحله ۶، ابطال‌کننده‌ی رویکرد کاغذی این هفته را پیش از جمعه بنویسید." },
  minimum: { en: "At least 3 genuine days. C1 on at least 3 days, C2 on at least 2, C3 and C4 at least once each, each of Stages 1–6 at least once.", fa: "دست‌کم ۳ روز گزارش واقعی. C1 در دست‌کم ۳ روز، C2 در دست‌کم ۲ روز، C3 و C4 هرکدام دست‌کم یک بار، هر یک از مراحل ۱ تا ۶ دست‌کم یک بار." },
  friday: { en: "\"Risk ledger and drawdown review\": every paper plan of the week as journal rows; the equity path with the budget recomputed at each step; the largest drawdown; any plan that would have been a HARD_BLOCK and why; and an optional Final Paper Plan (without one, a short no-trade conclusion grounded in your timestamped readings; your daily paper plans still count).", fa: "«دفتر ریسک و بازبینی drawdown»: هر پلن کاغذی هفته به‌صورت ردیف ژورنال؛ مسیر equity با بودجه‌ی بازمحاسبه‌شده در هر گام؛ بزرگ‌ترین drawdown؛ هر پلنی که HARD_BLOCK می‌شد و دلیلش؛ و پلن کاغذی نهایی اختیاری (بدون آن، یک نتیجه‌ی کوتاه «بدون معامله» مستند به خوانش‌های دارای timestamp؛ پلن‌های کاغذی روزانه‌ی شما همچنان حساب می‌شوند)." },
  reflection: { en: "After three illustrative 1% losses, what is the risk cap on the next plan?", fa: "بعد از سه زیان آموزشی ۱٪، سقف ریسک طرح بعدی چیست؟" },
  note: { en: "The three hard rules are 1% risk, a mandatory hard stop, and net R:R of at least 1:2; a mental stop is a HARD_BLOCK. NORMAL and CAUTION never relax them. There is no universal point value. Raising risk after a loss breaks the cap. A grounded no-trade conclusion with no plan is valid this week (see the shared no-trade rule).", fa: "سه قاعده سخت: ریسک ۱٪، stop سخت اجباری، و R:R خالص دست‌کم 1:2؛ mental stop یک HARD_BLOCK است. NORMAL و CAUTION هرگز آن‌ها را سست نمی‌کنند. point value جهانی وجود ندارد. بالا بردن ریسک بعد از زیان سقف را می‌شکند. نتیجه‌ی «بدون معامله» مستند و بدون پلن در این هفته معتبر است (قاعده‌ی مشترک «بدون معامله» را ببینید)." },
},
```

### 3.3 A8 (Stage 8), K4 and K5

`title`, `summary` ("Point-in-time release thesis, conditional observations, counterevidence and review") and `href`: keep. The base A8 lessons are overridden by `LESSON_PATCH` (A8-L1/L2/L3). Replace their base fields with the patched strings from `weekLessons.ts` (after the section 4 edits), so the base "freeze/reveal packets" and "authored baseline and tolerance" wording does not remain in the file.

```ts
practicalTask: {
  en: "Log on at least 3 weekdays around one scheduled release: a pre-release entry locked before the release (Actual left blank), a release-day entry for EURUSD, USDJPY and XAUUSD plus US2Y and DXY in the 0–5, 5–15 and 15–60 minute windows, and a later-session entry kept separate, plus a priced-in check. On Friday upload the \"capstone notebook\", written as study notes, not signals. A positive result leads to senior-mentor review only.",
  fa: "در دست‌کم ۳ روز کاری، حول یک انتشار برنامه‌ریزی‌شده گزارش ثبت کنید: گزارش پیش از انتشار که پیش از انتشار قفل می‌شود (Actual خالی)، گزارش روز انتشار برای EURUSD، USDJPY و XAUUSD به‌علاوه US2Y و DXY در پنجره‌های ۰ تا ۵، ۵ تا ۱۵ و ۱۵ تا ۶۰ دقیقه، و گزارش جلسه‌ی بعدی که جدا نگه داشته می‌شود، به‌همراه چک «از قبل در قیمت بود». جمعه «دفتر پایانی» را به‌صورت یادداشت مطالعه، نه سیگنال، بارگذاری کنید. نتیجه مثبت فقط به بازبینی با mentor ارشد می‌رسد.",
},
practicalPlan: {
  core: [
    { id: "A8-C1", text: { en: "Pre-release entry, locked before the release: the release you chose; Forecast, Previous, the pre-release positioning, and the pre-event pricing or expectations (if you cannot verify them, write \"Priced In unverified\"); Actual stays blank.", fa: "گزارش پیش از انتشار، قفل‌شده پیش از انتشار: انتشار انتخابی؛ Forecast، Previous، و موقعیت‌گیری پیش از انتشار، و قیمت‌گذاری یا انتظارات پیش از رویداد (اگر نمی‌توانید تأیید کنید، بنویسید «Priced In unverified»)؛ Actual خالی می‌ماند." } },
    { id: "A8-C2", text: { en: "Release-day entry: for EURUSD, USDJPY and XAUUSD, plus US2Y and DXY, the 0–5 minute window (initial reaction), the 5–15 minute window (interpretation) and the 15–60 minute window (confirmation or reversal), each with observation times. Where you have no timestamped intraday data for a window, write \"Observed reaction unavailable\"; never infer an intraday path from a daily close.", fa: "گزارش روز انتشار: برای EURUSD، USDJPY و XAUUSD به‌علاوه US2Y و DXY، پنجره‌ی ۰ تا ۵ دقیقه (واکنش اولیه)، ۵ تا ۱۵ دقیقه (فاز تفسیر) و ۱۵ تا ۶۰ دقیقه (تأیید یا برگشت)، هرکدام با ساعت مشاهده. اگر برای پنجره‌ای داده‌ی intraday دارای timestamp ندارید، بنویسید «Observed reaction unavailable»؛ مسیر intraday را هرگز از بسته‌شدن روزانه حدس نزنید." } },
    { id: "A8-C3", text: { en: "Later-session entry (later the same day or the next day): the later session (the dominant narrative, or the session close) for the same three instruments, recorded separately from the 0–5 / 5–15 / 15–60 minute windows, plus the revision note.", fa: "گزارش جلسه‌ی بعدی (بعدتر همان روز یا روز بعد): جلسه‌ی بعدی (روایت غالب، یا بسته‌شدن جلسه) برای همان سه ابزار، جدا از پنجره‌های ۰–۵ / ۵–۱۵ / ۱۵–۶۰ دقیقه ثبت شود، به‌همراه یادداشت revision." } },
    { id: "A8-C4", text: { en: "Priced-in check: what was expected beforehand, and did the later session agree with the earlier 0–60 minute windows?", fa: "چک «از قبل در قیمت بود»: پیش از انتشار چه انتظاری بود، و آیا جلسه‌ی بعدی با پنجره‌های ۰ تا ۶۰ دقیقه‌ی قبلی هم‌نظر بود؟" } },
  ],
  spiral: { en: "Stages 1–7: each at least once across the week. For Stage 7, add the Final Paper Plan (if you write one) as a ledger row.", fa: "مراحل ۱ تا ۷: هرکدام دست‌کم یک بار در طول هفته. برای مرحله ۷، پلن کاغذی نهایی را (اگر می‌نویسید) به‌صورت یک ردیف دفتر اضافه کنید." },
  minimum: { en: "At least 3 genuine days, including C1 on a day before the release and C2 on the release day (both server-timestamped), and each of Stages 1–7 at least once.", fa: "دست‌کم ۳ روز گزارش واقعی، شامل C1 در روزی پیش از انتشار و C2 در روز انتشار (هر دو با مهر زمان سرور)، و هر یک از مراحل ۱ تا ۷ دست‌کم یک بار." },
  friday: { en: "\"Capstone notebook\": the three-instrument table with the 0–5, 5–15 and 15–60 minute windows and the later session kept separate; the Actual/Forecast/Previous/Revisions comparison; a priced-in discussion; a conclusion written as study notes, not signals; and the Final Paper Plan, which is required in this week (never blank, K10; it is optional in every other week): a conditional plan with a hard stop, 1% risk and net 1:2 if your honest conclusion is WAIT.", fa: "«دفتر پایانی»: جدول سه‌ابزاری با پنجره‌های ۰ تا ۵، ۵ تا ۱۵ و ۱۵ تا ۶۰ دقیقه و جلسه‌ی بعدی جدا؛ مقایسه Actual/Forecast/Previous/Revisions؛ بحث «از قبل در قیمت بود»؛ نتیجه‌گیری به‌صورت یادداشت مطالعه، نه سیگنال؛ و پلن کاغذی نهایی که در این هفته لازم است (هرگز خالی نمی‌ماند، K10؛ در هر هفته‌ی دیگر اختیاری است): اگر نتیجه صادقانه WAIT است، پلن شرطی با stop سخت، ریسک ۱٪ و 1:2 خالص." },
  reflection: { en: "What would make a finished-looking notebook still incomplete?", fa: "چه چیزی یک دفتر ظاهراً تمام را هنوز ناقص می‌کند؟" },
  note: { en: "You must observe a live scheduled release in the window: the sources hold no historical release data. Your mentor picks the release when issuing this week; if none falls inside the window, the week moves to the next release week. A positive result unlocks senior-mentor review only. There is no stage 9, graduation, funded account or live book. A grounded no-trade conclusion does not replace the Final Paper Plan this week: if the honest outcome is WAIT, write the conditional plan.", fa: "باید یک انتشار برنامه‌ریزی‌شده‌ی زنده را در پنجره مشاهده کنید: منابع داده‌ی تاریخی انتشار ندارند. mentor شما هنگام صدور این هفته انتشار را انتخاب می‌کند؛ اگر هیچ انتشاری در پنجره نیفتد، هفته به هفته‌ی انتشار بعدی می‌رود. نتیجه مثبت فقط بازبینی mentor ارشد را باز می‌کند. مرحله ۹، فارغ‌التحصیلی، حساب تأمین‌شده یا دفتر زنده وجود ندارد. نتیجه‌ی «بدون معامله» مستند در این هفته جای پلن کاغذی نهایی را نمی‌گیرد: اگر نتیجه صادقانه WAIT است، پلن شرطی را بنویسید." },
},
```

**Decided 2026-11-19 (Kamyar via Echo):** K4 = the A8 windows are the NotebookLM ones: 0–5 / 5–15 / 15–60 minutes, then the later session (XASSET item 20 and the MACRO "Market reaction window"). K10 = the A8 Final Paper Plan is always required, never blank. The old "15 min / 4 h" example windows are removed from the practical (above), the A6 example (3.1) and the lesson worked examples (section 4). The A8 quiz item that said "otherwise leave risk idle" is fixed in section 5.

## 4. `app/lib/academy/weekLessons.ts`

**Five required edits.** Two concern M5-L1 (the gold-grid overreach, and the grounded no-trade wording, G11); three replace the old "15 min / 4 h" example windows and the "risk idle" wording for A6/A8 (decisions of 2026-11-19: NotebookLM windows 0–5 / 5–15 / 15–60 minutes then the later session, and the A8 Final Paper Plan always required).

**(a) M5-L1 `reality`.** Today it says "Targets in the framework, when used, come from grid levels after direction is already argued from fundamentals." In the sources that rule appears only under the heading "Gold grid / price geometry". Replace with:

```ts
reality: tx(
  "Macro bias describes pressure and environment. The coordinator says it is not an entry, a stop, or a target. In the gold grid notes, direction is argued from fundamentals and targets are read from grid levels. That grid is price geometry for gold only, not a signal.",
  "Macro bias فشار و محیط را توصیف می‌کند. هماهنگ‌کننده می‌گوید این ورود، stop، یا هدف نیست. در یادداشت‌های شبکه طلا، جهت از بنیادها استدلال می‌شود و هدف‌ها از سطوح شبکه خوانده می‌شوند. آن شبکه فقط هندسه قیمت برای طلاست، نه سیگنال.",
),
```

**(b) A6-L1 `workedExample`** (removes "first 15 minutes and the next 4 hours"):

```ts
workedExample: tx(
  "Illustrative research note, not a result. Hypothesis: after a CPI surprise, the 0–5, 5–15 and 15–60 minute windows and the later session are recorded separately for EURUSD. Falsifier: if the later windows do not differ from a no-surprise sample after costs, the idea fails. You do not drop the losing days.",
  "یادداشت پژوهشی آموزشی است، نه نتیجه. فرضیه: بعد از surprise در CPI، پنجره‌های ۰ تا ۵، ۵ تا ۱۵ و ۱۵ تا ۶۰ دقیقه و جلسه‌ی بعدی برای EURUSD جدا ثبت می‌شوند. ابطال: اگر پنجره‌های بعدی بعد از هزینه با نمونه بدون surprise فرق نکنند، ایده شکست می‌خورد. روزهای بازنده را حذف نمی‌کنید.",
),
```

**(c) A8-L1 `workedExample`** (removes "first 15 minutes" and "next 4 hours"; the plan stays a separate conditional Final Paper Plan):

```ts
workedExample: tx(
  "Illustrative release, not history. In the 0–5 minute window EURUSD dips, USDJPY rises, and gold dips. By the 15–60 minute window gold retraces and the dollar move fades, and the later session is written as its own row. The notebook's conclusion is 'immediate and later disagree,' not a trade. Risk arithmetic stays the 10,000 / 100 / hard-stop sketch, written as a separate conditional Final Paper Plan.",
  "انتشار آموزشی است، نه تاریخ. در پنجره‌ی ۰ تا ۵ دقیقه EURUSD پایین می‌آید، USDJPY بالا می‌رود، و طلا پایین می‌آید. تا پنجره‌ی ۱۵ تا ۶۰ دقیقه طلا برمی‌گردد و حرکت دلار کم‌رنگ می‌شود، و جلسه‌ی بعدی ردیف جداگانه دارد. نتیجه دفتر این است که «فوری و بعدی ناسازگارند»، نه یک معامله. حساب ریسک همان طرح 10,000 / 100 / stop سخت می‌ماند، به‌صورت پلن کاغذی نهایی شرطی و جدا.",
),
```

**(d) A8-L2 `workedExample`** (removes "The 1:2 and 1% rules are idle because there is no structural plan", which contradicts K10):

```ts
workedExample: tx(
  "Illustrative CPI: actual equals forecast, previous is revised up, US2Y barely moves, gold's first spike fades. You write 'little new information versus expectations; revision noted.' You do not add a buy. The Final Paper Plan is still written from structure, as a conditional plan with a hard stop, 1% risk, and net 1:2.",
  "CPI آموزشی: واقعی برابر forecast است، قبلی به بالا revise شده، US2Y کم حرکت می‌کند، جهش اول طلا محو می‌شود. می‌نویسید «اطلاعات تازه نسبت به انتظار کم است؛ revision ثبت شد.» خرید اضافه نمی‌کنید. پلن کاغذی نهایی همچنان از ساختار نوشته می‌شود، به‌صورت پلن شرطی با stop سخت، ریسک ۱٪ و 1:2 خالص.",
),
```

**(e) M5-L1 `workedExample`** (resolves G11, decided 2026-11-19: keep the no-trade wording, but the no-trade reasoning must be grounded in what was actually observed; no conditional-plan requirement for M5). Sources only: GDATA-P §5.2 (timestamped observations), XASSET item 20 ("Do not infer intraday paths from daily closes"), the MACRO "Market reaction window" ("Never treat the first candle as the final market interpretation"), and the sources' "Observed reaction unavailable" wording. The times in the example are illustrative.

```ts
workedExample: tx(
  "Illustrative snapshot, not a signal. Real yields up, DXY up, gold down on the first hour, then gold retraces while yields stay up. You label the first hour as the immediate reaction and the later retrace as unresolved. You do not average them into one trade. If you then write 'no trade this week', that is a valid conclusion only when it matches what was actually observed: you name the timestamped readings behind it (for example, 'real yields and DXY rose at 14:35 and gold retraced by 15:20, so the chain is unresolved'). A no-trade conclusion that does not match the data you recorded, or that has no timestamped reading behind it, is not grounded. If you have no timestamped data for a window, you write 'Observed reaction unavailable' and do not infer an intraday path from a daily close. Equity and the 1% budget stay unused.",
  "تصویر آموزشی است، نه سیگنال. Real yields بالا، DXY بالا، طلا در ساعت اول پایین، سپس طلا برمی‌گردد در حالی که بازده بالا می‌ماند. ساعت اول را واکنش فوری می‌نامید و بازگشت بعدی را حل‌نشده. آن‌ها را به یک معامله میانگین نمی‌کنید. اگر بعد بنویسید «این هفته معامله نمی‌کنم»، این نتیجه فقط وقتی معتبر است که با آنچه واقعاً مشاهده شد جور باشد: خوانش‌های دارای timestamp پشت آن را نام می‌برید (مثلاً «real yields و DXY ساعت ۱۴:۳۵ بالا رفتند و طلا تا ۱۵:۲۰ برگشت، پس زنجیره حل‌نشده است»). نتیجه‌ی «بدون معامله» که با داده‌ی ثبت‌شده‌ی شما نمی‌خواند، یا خوانش دارای timestamp پشتش نیست، مستند نیست. اگر برای یک پنجره داده‌ی دارای timestamp ندارید، می‌نویسید «Observed reaction unavailable» و مسیر درون‌روزی را از بسته‌شدن روزانه حدس نمی‌زنید. Equity و بودجه ۱٪ بدون استفاده می‌مانند.",
),
```

K8 lives in the plan `note`, not in lesson text. Otherwise the patched lessons contain no `STOP_GAP`, TRAIN/TEST metric wording, or recovery %.

## 5. `app/lib/academy/weekQuizzes.ts`

**First edit: M5-Q8** (the same gold-grid overreach). The stem is "Targets, when the framework uses them:" (FA "هدف‌ها، وقتی چارچوب از آن‌ها استفاده می‌کند:"). It generalises a gold-only geometry note to the whole framework.
- Stem EN: "In the gold grid notes (price geometry, not a signal), targets:" and FA: "در یادداشت‌های شبکه طلا (هندسه قیمت، نه سیگنال)، هدف‌ها:"
- Rationale EN: "Direction is argued from fundamentals; the gold grid notes read targets from grid levels. It is geometry, not a signal." and FA: "جهت از بنیادها استدلال می‌شود؛ یادداشت‌های شبکه طلا هدف را از سطوح شبکه می‌خواند. این هندسه است، نه سیگنال."
- **Do not change** the options (text, order, count), the item id, `kind`, or `remediationTopic`, so the server key for this item does not change. Do not edit `answerKeyData.ts`.
- This item's `itemHash` changes for the new build (rule 6 in section 0). Re-run `quizHash.test.ts`, `quizLeak.test.ts` and `weekQuizzes.test.ts`.

**Second edit: A8-Q10** (K10: the Final Paper Plan is always required). The fourth ordering item currently reads "Apply 1%, hard stop, and 1:2 only if a structure plan exists; otherwise leave risk idle" (FA "۱٪، stop سخت، و 1:2 را فقط اگر طرح ساختار وجود دارد اعمال کنید؛ وگرنه ریسک را بیکار بگذارید"). Replace that one option's text with:
- EN: "Write the Final Paper Plan with 1%, a hard stop, and net 1:2, as a conditional plan if there is no valid setup"
- FA: "پلن کاغذی نهایی را با ۱٪، stop سخت و 1:2 خالص بنویسید، اگر ستاپ معتبری نیست به‌صورت پلن شرطی"
- Keep the four options in the same positions. The author order stays the answer order, so the server key is unchanged; only this item's `itemHash` changes. Do not touch `answerKeyData.ts`.

No other quiz edit is required by K1–K12 and the 2026-11-19 A8 decisions.

## 6. `app/lib/curriculum.ts` (public stage pages): stale rules from the earlier audit

This English-only file feeds `StageGrid.tsx`, `StagePanel.tsx` and `AudioLectureCard.tsx` (overview pages) and is separate from `app/lib/academy/curriculum.ts`. It predates the NotebookLM rebuild and states rules that are **not in the sources, or contradict them**. Edit these strings, English only (the file has no Persian fields; adding Persian is a separate decision). Where I found no source, the replacement removes the claim.

| Stage | Stale text (field) | Problem | Replace with |
|---|---|---|---|
| 1 | principle "London–New York overlap as the primary execution window" | Sources say "Preferred sessions: London and New York"; no overlap rule | "London and New York are the preferred sessions" |
| 1 | principle "EUR/USD and XAU/USD lot math before any discretionary entry" | implies fixed point values | "Lot math with a sourced or illustrative point value before any hypothetical plan" |
| 1 | milestone "Convert a stop distance into dollars risked for EUR/USD and XAU/USD" | same | add "(point value from the contract spec, or labelled illustrative)" |
| 1 | mission "Map one London–NY overlap session… hypothetical 1.0% risk size…" | overlap; old weekly model | "Log on at least 3 weekdays, noting spread at a London and a New York observation time, and size a hypothetical 1% plan on your own paper equity. Upload the Friday contract and cost journal." |
| 2 | principle "Sweeps often precede Break of Structure or Change of Character" | not a stated rule; a sweep is not an entry | "A sweep is not an entry. A wick touch does not prove a fill" |
| 2 | principle "Never chase a sweep — wait for displacement and retest logic" | belongs to M3; "retest logic" untaught here | "Confirmation comes after a sweep, never with it" |
| 2 | principle "HTF (4H) bias… LTF (15m) times entry" | RULES: H4/H1 direction, M15/M5 execution; M1 not the standard | "H4 and H1 for direction, M15 and M5 for execution reading" |
| 2 | mission "…annotate HH/HL or LH/LL on 4H… define the exact order type for a 15m execution plan" | old weekly model | "Log on at least 3 weekdays marking PDH/PDL (PWH/PWL on Monday), classifying sweeps, and naming order types. Upload the Friday liquidity map journal." |
| 3 | principle "Rejection wicks at levels beat indicator crossovers for entries" | not in sources; contradicts "a wick does not prove a fill" | remove; use "Structure words in the sources: OB, BOS, CHoCH, FVG, MSS, read on closed candles" |
| 3 | principle "Session opens and range breaks create continuation signatures" | not in sources | remove; use "Sweep-reversal path (Scout v3.0): confirmed sweep, closed-candle MSS, displacement, then an FVG/OB zone" |
| 3 | principle "EMA / VWAP may frame context" | VWAP absent; sources name MA50/MA200 only | "MA50 and MA200 are named; no crossover rule, applied price, or shift was recovered, so they stay descriptive. RSI, Volume Profile, ZigZag and Renko have no recovered settings" |
| 3 | principle "Impulse vs corrective legs define where risk belongs" | not in sources | "The stop is structural invalidation beyond the sweep extreme or swing" |
| 3 | milestones "impulse → pullback → continuation"; "Write a PA thesis…"; "R:R ≥ 1:2 on a hypothetical entry" | old model; not net of spread | "Walk the sweep-reversal chain on a real chart and write where it stopped"; "No signal wording in any entry"; "Net R:R of at least 1:2 after spread on a hypothetical plan" |
| 3 | mission "Capture three price-action examples… entry logic, hard stop, target…" | old model | "Log on at least 3 weekdays applying H4/H1 direction, M15/M5 closed-candle structure and a paper structural-stop drill. Upload the Friday week table; a Final Paper Plan is optional." |
| 4 | overview "Macro sets bias; price action still times the trade" | macro bias is not an entry | "Macro bias is context, not an entry" |
| 4 | principle "CPI, NFP, PCE define calendar risk and stand-down windows" | "stand-down windows" not in sources | "Compare Actual, Forecast, Previous and Revisions for labor and inflation releases; if the calendar was not checked write NEWS RISK: NOT ASSESSED" |
| 4 | principle "USD strength regimes transmit directly into EUR/USD" | not in sources | remove; use "Do not extrapolate a macro regime from one print" |
| 4 | principle "Gold behaves as a real-rate and risk-sentiment hybrid" | only partly supported ("Real Yields are especially important for Gold") | "Real yields are especially important for gold, but Dow and gold have no fixed inverse relationship" |
| 4 | milestones "Map the brief to EUR/USD and XAU/USD directional bias"; "List three sessions you would stand down for event risk" | bias drifts toward entry; stand-down not in sources | "Fill the macro chain link by link and mark UNVERIFIED links"; "Separate the immediate reaction from the durable one" |
| 4 | mission "…before Sunday prep… explicit stand-down windows" | Sunday prep and stand-down not in sources | "Log on at least 3 weekdays: release log, chain walk with UNVERIFIED links, immediate vs durable. Upload the Friday macro context journal." |
| 5 | principles "UST yields ↔ USD ↔ EUR/USD is a primary transmission path"; "Real yields often inverse XAU/USD tendency" | "primary path" and "inverse" not in sources; correlation is regime-dependent | "Chain order from the coordinator: yields including real yields, DXY, VIX and cross-asset response"; "Correlation is regime-dependent" |
| 5 | principle "Sunday intermarket prep prevents midweek narrative drift" | not in sources | "Timestamp every observation and avoid double counting one input" |
| 5 | milestones "Chart 10Y yield vs EUR/USD over three months…"; "Update an intermarket prep sheet before the next London open" | not in sources; old model | "Fill a timestamped cross-asset matrix"; "Explain one gold move with real yields and DXY, not either alone" |
| 5 | mission "…State the bias it implies for EUR/USD this week…" | bias drifts toward entry | "Log on at least 3 weekdays with a cross-asset matrix; upload the Friday intermarket journal with one macro bias statement labelled not an entry." |
| 6 | all principles, milestones and the mission ("Tag every trade"; "Expectancy, average R, drawdown"; "Tag ≥20 historical examples"; "max adverse excursion"; "keep, refine, or retire") | none of this is in the sources; there is no Week 6 statistics course (K2) | principles from the roadmap: "Write a falsifiable hypothesis, the allowed data and the costs before the outcome window"; "Account for spread and fees"; "Avoid look-ahead bias and overfitting"; "Test out of sample and document failures". Milestones: "Preregister one observation hypothesis"; "Record timestamped forward rows and failures"; "Label the result IN-SAMPLE / EXPLORATORY". Mission: the A6 `practicalTask` text |
| 7 | principles "Forex: Lot = (Equity × risk%) ÷ (Stop Pips × 10)" and "Gold: Lot = … × 100" | hard-codes point values; the sources have no universal pip or point value | "Lot Size = (Equity × Risk %) ÷ (Stop Distance × Point Value), rounded down; point value sourced or labelled illustrative" |
| 7 | milestone "…using the Institutional Position Sizer"; mission "Use the Institutional Position Sizing Calculator on six hypothetical trades (3 FX, 3 gold)" | the "Institutional Position Sizer" is not in the sources; formula above | "Size paper plans with the source formula and show one plan rejected for net R:R below 1:2". Mission: the A7 `practicalTask` text |
| 8 | principle "Post-trade evaluation uses Stage 6 research metrics"; milestone "Present findings with Echo and a clear pass/fail self-score"; mission "…then discuss with Echo" | Stage 6 metrics are not taught; a positive result unlocks senior-mentor review only; Echo is not the senior mentor | principles "One release, three instruments, with immediate and later windows kept separate" and "A Final Paper Plan is always written, as a conditional plan with a hard stop and net 1:2 if there is no valid setup"; milestone "Write conclusions as study notes, not signals"; mission: the A8 `practicalTask` text plus "A positive result leads to senior-mentor review only" |
| all | `audioNote` "NotebookLM audio overview… Placeholder" | claims an audio that may not exist | if no recording exists, remove the claim; Mentor cannot confirm (GAP G6) |

`ESSENTIAL_LINKS` and per-stage `links`: unchanged. BabyPips, CME, BIS and Banque de France are publishers in `01_verified_resources.md` (the exact URLs differ in places); the Federal Reserve, CME FedWatch and BIS GLI links are not in that list. Flagged only (GAP G7).

## 7. Related non-content items spotted (outside the four files; Platform decides)

1. `MissionWorkspace.tsx` mounts a per-mission widget: M2/M3 simulators, M4 `MacroTransmissionBuilder`, **M5 `JournalBuilder`** (the research journal: hypothesis, falsification, split), M1/M3 Risk Grid. In `AdvancedTrack.tsx`, A6 `ResearchLab` shows TRAIN/TEST metrics and A7 `EquityDrawdownLab` shows recovery % and `STOP_GAP_LOSS` (`equity.ts`). Under K1–K3 these are no longer the graded practical. Recommend labelling each "Optional warm-up, not graded", and moving the research `JournalBuilder` off M5. **Spec gap:** the spec only says M2's old fixture becomes optional C0. The fate of the M3, M4 and M5 widgets and the A6 and A7 labs is not decided. Default to "optional, ungraded, labelled"; do not delete code without Kamyar.
2. `MissionWorkspace.tsx` about line 72 gates local completion on `practicalValidated` for M2. Unlock is server-driven (Mentor's decision), so local widget completion must not gate anything.
3. `app/lib/sizing.ts` hard-codes Forex "× 10" and Gold "× 100" point values and `FOREX_PIP_SIZE`; no importer was found under `app/`. It contradicts "no universal pip or point value". Remove it, or make the point value an explicit input.
4. `grading.ts` and `contracts.ts` verdict alignment: covered in `contract-changes.md` §6.

## 8. K/D item map: where each is implemented

| Item | Implemented in |
|---|---|
| D1–D5, K11, K12 | server and UI per `contract-changes.md` and `site-requirements.md`; student wording in `DAILY_LOG_RULES` (1.3) |
| K1 | `curriculum.ts` M5 title, summary, practicalTask, practicalPlan, base lesson (2.5); widget note in section 7 |
| K2 | `advancedCurriculum.ts` A6 (3.1); `ResearchLab` note in section 7 |
| K3 | `advancedCurriculum.ts` A7 summary and practicalTask, base A7 lessons (3.2); `EquityDrawdownLab` note in section 7 |
| K4 | A8 plan wording (3.3), A6-C1 example (3.1), lessons A6-L1 and A8-L1 (section 4). Decided 2026-11-19: windows 0–5 / 5–15 / 15–60 minutes, then the later session |
| K5 | A8 `note` (3.3). Choosing the release and extending the week are Mentor and Kamyar actions at issue time, not repo content |
| K6 | no edit needed, verified (2.3) |
| K7 | wording rule in section 1.3 |
| K8 | M1 and M2 `note` (2.1, 2.2) |
| K9 | M4 `M4-C3` and `minimum` (2.4) |
| K10 | `FINAL_PLAN_WORKSHEET` and `NO_TRADE_RULE` (1.3), the plan/friday/note text of every week (2.1–2.5, 3.1–3.3), lesson A8-L2 and quiz A8-Q10 (sections 4 and 5). Scope decided 2026-11-19 (Q1): the Final Paper Plan is **required in A8 only** (never blank); M1–M5, A6, A7: optional, a grounded no-trade conclusion with no plan is allowed; the server side is `noPlan:true` (`contract-changes.md` §3A) |

## 9. Gaps and conflicts (read before building)

- **Resolved 2026-11-19 (Kamyar via Echo), no longer open:**
  - **K10 scope and Q1 (2026-11-19):** the always-required Final Paper Plan applies to **A8 only**, never blank. In **M1–M5, A6 and A7** the plan is optional and a grounded no-trade conclusion with no plan is allowed (timestamped readings, or "Observed reaction unavailable"; never inferred from daily closes). This brief's plan, friday and note text for all eight weeks, `NO_TRADE_RULE`, lesson A8-L2 and quiz A8-Q10 follow it. `spec.md` §1.5 and `contract-changes.md` §3A carry the same rule.
  - **K4:** A8 uses the NotebookLM windows 0–5 / 5–15 / 15–60 minutes, then the later session (XASSET item 20, MACRO "Market reaction window"). The "15 min / 4 h" example windows are replaced in the A8 plan, the A6 example, and lessons A6-L1 and A8-L1. Where a window has no timestamped intraday data the student writes "Observed reaction unavailable" (source wording) and never infers an intraday path from a daily close.
- **G1, no universal pip or point value.** Every plan says "sourced or illustrative". `lib/sizing.ts` contradicts it (section 7).
- **G2, no MA crossover rule; no RSI, Volume Profile, ZigZag or Renko settings.** Stated in the M3 and A6 notes.
- **G3, M1 is not the execution standard.** Stated in the M1 and M3 notes.
- **G4, the gold grid is geometry only.** M5 `friday` and `note`, the M5-L1 `reality` edit, M5-Q8.
- **G5, no Week 6 statistics course; no Week 8 historical release data.** A6 and A8 notes.
- **G6, audio claims.** `audioNote` fields say a NotebookLM audio overview exists; Mentor cannot verify that any audio file exists.
- **G7, resource links.** Per-stage `links` include sites not in `01_verified_resources.md` (Federal Reserve, CME FedWatch, BIS GLI, BabyPips sub-pages). Not edited.
- **G8, psychology and routine.** The sources hold no psychology or routine framework. R4 is a self-observation line, never a scored diagnosis. All routine and Journal & Psychology scoring is owner policy (K7).
- **G9, "material" releases.** No list in the sources; M4 uses the RULES labor and inflation lists.
- **G10, Persian for `app/lib/curriculum.ts`.** The file is English-only; no Persian is provided for it.
- **G11, resolved 2026-11-19 (Kamyar via Echo):** the M5-L1 no-trade wording stays (a no-trade week is valid and often wise), tightened so the reasoning must match the real observed data and releases (paste-ready in section 4e). No conditional-plan requirement is added to M5, and since Q1 the same exemption covers every week except A8.
- **Q1, resolved 2026-11-19 (Kamyar via Echo):** the grounded no-trade exemption applies to every week except A8. M1–M5, A6, A7: a no-trade conclusion with no plan is allowed if grounded in timestamped readings or marked "Observed reaction unavailable", never inferred from daily closes; the Final Paper Plan is optional. A8 always requires it (K10). An ungrounded conclusion is an ordinary `technicalMacro` rubric shortfall; no separate penalty exists anywhere in this brief or in `spec.md`.
- **Q2, resolved 2026-11-19 (server side, Platform):** decisions use `noPlan:true` + a reason instead of `riskEvidence`; `weeks.plan_required` is false for M1–A7 and true for A8; a no-plan decision on A8 is rejected with `PLAN_REQUIRED_FOR_WEEK`. Specified in `contract-changes.md` §3A. Until Platform deploys it, the live server still rejects a decision without `riskEvidence`, so Mentor holds a no-plan practical as pending and reports it.
- **L1, leftover (incentive):** with the plan optional, a student who submits a plan can get a HARD_BLOCK while one who submits none cannot. Mitigation in the rubric: Risk 40 is still scored on the daily drills and spiral sizing tasks, and Mentor never records `noPlan` for a file that contains a plan. Weeks with little daily sizing work (M4, M5, A6) leave thin Risk evidence in a no-plan week. Kamyar may want a minimum risk drill there; not added, because nothing relayed asks for it.
- **L2, leftover (blank A8 file):** the rules say A8's plan is never blank, but not what happens to an A8 Friday file with no plan: the server will reject `noPlan` there, and Mentor cannot send `riskEvidence` without a plan. Mentor holds it pending and reports it. Kamyar and Platform should say whether it becomes NOT_APPROVED/remedial or a re-upload.
- **L3, leftover (naming):** `noPlanReason` and the error codes `PLAN_AND_NO_PLAN_CONFLICT` and `NO_PLAN_REASON_REQUIRED` are proposed names; `weeks.plan_required` is my reading of "week table" (a per-week server flag), not the student-facing M3 week table. Platform's final names win.
- **Not mappable to the four files:** D1–D5, K11 and K12 (server and UI work), the K5 release pick (a Mentor and Kamyar action), and the widget decisions in section 7.

## 10. Acceptance checks before opening the PR

1. `rg -n "STOP_GAP|TRAIN|recovery %|recoveryPct|Preregister the hypothesis|Institutional Position|stand-down|VWAP|× 10|× 100" app --glob '!*.test.*'` returns hits only in the optional warm-up widgets named in section 7 (`ResearchLab`, `EquityDrawdownLab`, `equity.ts`, `research.ts`, `sizing.ts` if kept), and none in curriculum, lesson, or quiz text.
2. No quiz answer or key appears in any file this brief touches (`curriculum.ts`, `advancedCurriculum.ts`, `weekLessons.ts`, `weekQuizzes.ts`, `contracts.ts`, `app/lib/curriculum.ts`). `answerKeyData.ts` is untouched.
3. Also run: `rg -n "next 4 hours|first 15 minutes|۴ ساعت|۱۵ دقیقه اول|leave risk idle|ریسک را بیکار|rules are idle" app --glob '!*.test.*'` returns nothing. Tests green: `weekQuizzes.test.ts`, `quizLeak.test.ts`, `quizHash.test.ts`, `copyLanguage.test.ts`, `studentCopy.test.ts`, `stageRegistry.test.ts`.
4. Every student string above exists in both `en` and `fa`.
5. Nothing here is merged separately from the daily-log PR (section 0, rule 4).
6. Plan wording: `rg -n "exactly one Final Paper Plan|one Final Paper Plan\.|always required" app/lib/academy` hits only week 8 (A8) text; every other week says the plan is optional. `NO_TRADE_RULE` is rendered once in the shared block and not in week 8.
