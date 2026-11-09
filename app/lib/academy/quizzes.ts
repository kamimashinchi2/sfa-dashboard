import type { QuizItem } from "./curriculum";

/** Substantive M2–M5 objective banks (assessmentCriteriaVersion 2). No answer-revealing labels. */

export const M2_QUIZ: QuizItem[] = [
  {
    id: "M2-Q1",
    kind: "mc",
    prompt: {
      fa: "سوئیپ نقدینگی فراتر از سوئینگ اساساً چه معنایی دارد؟",
      en: "A liquidity sweep beyond a swing primarily means:",
    },
    options: [
      { fa: "تأیید ورود فوری", en: "Immediate entry confirmation" },
      {
        fa: "احتمال جابه‌جایی نقدینگی که به‌تنهایی سیگنال ورود نیست",
        en: "Possible liquidity run that alone is not an entry signal",
      },
      { fa: "اثبات FVG", en: "Proof of an FVG" },
      { fa: "لغو همه سفارش‌های حدی", en: "Cancellation of all limit orders" },
    ],
    rationale: {
      fa: "سوئیپ مقدمه است نه مجوز ورود؛ تأیید ساختاری بعداً می‌آید.",
      en: "A sweep can precede displacement; it is not entry permission by itself.",
    },
    remediationTopic: "sweep-vs-confirmation",
  },
  {
    id: "M2-Q2",
    kind: "mc",
    prompt: {
      fa: "تفاوت اصلی Limit و Stop چیست؟",
      en: "The core difference between Limit and Stop orders is:",
    },
    options: [
      {
        fa: "Limit همیشه با slippage پر می‌شود؛ Stop هرگز",
        en: "Limits always slip; stops never do",
      },
      {
        fa: "Limit در قیمت بهتر یا مساوی فعال می‌شود؛ Stop وقتی بازار به سطح مخالف برسد",
        en: "Limits trigger at equal-or-better; stops trigger when price trades through the adverse level",
      },
      { fa: "هر دو فقط در فیوچرز کار می‌کنند", en: "Both work only in futures" },
      { fa: "Stop همان Limit معکوس است", en: "A stop is simply an inverted limit" },
    ],
    rationale: {
      fa: "Limit = قیمت مطلوب‌تر؛ Stop = عبور از سطح نامطلوب برای فعال‌سازی.",
      en: "Limit seeks equal-or-better; stop activates on adverse breach.",
    },
    remediationTopic: "order-types",
  },
  {
    id: "M2-Q3",
    kind: "mc",
    prompt: {
      fa: "PDH/PDL معمولاً چه نقشی در نقدینگی دارند؟",
      en: "PDH/PDL typically act as:",
    },
    options: [
      { fa: "اهداف اجباری سود", en: "Mandatory profit targets" },
      {
        fa: "سطوح مرجع که اغلب نقدینگی شبکه‌ای اطرافشان جمع می‌شود",
        en: "Reference levels where resting liquidity often clusters",
      },
      { fa: "جایگزین stop ساختاری", en: "Substitutes for structural stops" },
      { fa: "شاخص مارجین", en: "Margin indicators" },
    ],
    rationale: {
      fa: "ارتفاع/کف روز قبل مرجع نقدینگی‌اند نه دستور ورود خودکار.",
      en: "Prior day high/low are liquidity references, not auto-entry rules.",
    },
    remediationTopic: "pdh-pdl",
  },
  {
    id: "M2-Q4",
    kind: "mc",
    prompt: {
      fa: "لمس فتیله یک سطح به‌تنهایی ثابت می‌کند که سفارش Limit پر شده؟",
      en: "Does a wick touch alone prove a resting Limit was filled?",
    },
    options: [
      { fa: "بله همیشه", en: "Yes, always" },
      {
        fa: "خیر — بدون شواهد fill و زمان‌بندی اجرا، لمس فتیله کافی نیست",
        en: "No — without fill evidence and execution timing, a wick is insufficient",
      },
      { fa: "فقط در طلا", en: "Only in gold" },
      { fa: "فقط اگر اسپرد صفر باشد", en: "Only if spread is zero" },
    ],
    rationale: {
      fa: "لمس قیمت ≠ اثبات fill؛ مسیر سفارش و زمان اهمیت دارد.",
      en: "Price touch ≠ fill proof; order path and timing matter.",
    },
    remediationTopic: "wick-vs-fill",
  },
  {
    id: "M2-Q5",
    kind: "order",
    prompt: {
      fa: "ترتیب آموزشی مشاهده ساختار سوئیپ-بازگشت (LONG):",
      en: "Educational observation order for a LONG sweep-reversal:",
    },
    options: [
      { fa: "سوئیپ زیر سطح", en: "Sweep below level" },
      { fa: "MSS بسته شده", en: "Closed MSS" },
      { fa: "جابه‌جایی", en: "Displacement" },
      { fa: "ارزیابی ناحیه ورود", en: "Evaluate entry zone" },
    ],
    rationale: {
      fa: "سوئیپ → MSS بسته → جابه‌جایی → ناحیه؛ نه ورود روی فتیله اول.",
      en: "Sweep → closed MSS → displacement → zone — not entry on the first wick.",
    },
    remediationTopic: "structure-sequence",
  },
  {
    id: "M2-Q6",
    kind: "mc",
    prompt: {
      fa: "لغزش (slippage) بیشتر کجا دیده می‌شود؟",
      en: "Slippage is most associated with:",
    },
    options: [
      { fa: "سفارش Limit کاملاً محافظه‌کار در بازار آرام", en: "Fully conservative limits in quiet markets" },
      {
        fa: "فعال‌سازی Stop در حرکت سریع یا شکاف",
        en: "Stop activation during fast moves or gaps",
      },
      { fa: "فقط محاسبات pip", en: "Pip math alone" },
      { fa: "تغییر timezone نمایش", en: "Display timezone changes" },
    ],
    rationale: {
      fa: "Stopها در گپ/حرکت سریع بیشتر در معرض لغزش‌اند.",
      en: "Stops face more slippage in gaps and fast tape.",
    },
    remediationTopic: "slippage",
  },
  {
    id: "M2-Q7",
    kind: "mc",
    prompt: {
      fa: "شرکت‌کنندگان اصلی نقدینگی شامل چه کسانی می‌شوند؟",
      en: "Primary liquidity participants typically include:",
    },
    options: [
      { fa: "فقط خرده‌فروشان موبایل", en: "Only mobile retail traders" },
      {
        fa: "بازارسازان، مؤسسات، الگوریتم‌ها و جریان خرد",
        en: "Market makers, institutions, algos, and retail flow",
      },
      { fa: "فقط بانک مرکزی", en: "Only the central bank" },
      { fa: "فقط کارگزاری شما", en: "Only your broker" },
    ],
    rationale: {
      fa: "نقدینگی از ترکیب شرکت‌کنندگان می‌آید نه یک منبع واحد.",
      en: "Liquidity is multi-participant — not a single source.",
    },
    remediationTopic: "venues-participants",
  },
  {
    id: "M2-Q8",
    kind: "numeric",
    prompt: {
      fa: "اگر PDH آموزشی برابر ۲۵۰۰٫۵۰ باشد و سوئیپ LONG نیاز به low زیر سطح داشته باشد، کمینه عدد صحیح برای «زیر سطح» با tick ۰٫۰۱ چند است؟ (۲۵۰۰٫۴۹)",
      en: "Educational PDH=2500.50; LONG sweep needs low below level. With tick 0.01, what is the first price strictly below? (2500.49)",
    },
    rationale: {
      fa: "زیر ۲۵۰۰٫۵۰ با tick ۰٫۰۱ → ۲۵۰۰٫۴۹",
      en: "Strictly below 2500.50 at 0.01 tick → 2500.49",
    },
    remediationTopic: "pdh-sweep-math",
  },
  {
    id: "M2-Q9",
    kind: "mc",
    prompt: {
      fa: "تأیید بسته (closed confirmation) چرا مهم است؟",
      en: "Why does closed-bar confirmation matter?",
    },
    options: [
      { fa: "چون کارگزاری آن را الزام می‌کند", en: "Because brokers require it" },
      {
        fa: "چون فتیله در حال شکل‌گیری قابل بازنویسی است و شواهد زمان‌بندی‌شده نیاز به بسته شدن دارد",
        en: "Forming wicks can rewrite; timed evidence needs a closed bar",
      },
      { fa: "چون اسپرد را صفر می‌کند", en: "It zeros the spread" },
      { fa: "چون R:R را تضمین می‌کند", en: "It guarantees R:R" },
    ],
    rationale: {
      fa: "شواهد ساختاری روی فریم بسته پایدارتر ارزیابی می‌شود.",
      en: "Structural evidence is evaluated more stably on closed frames.",
    },
    remediationTopic: "closed-confirmation",
  },
  {
    id: "M2-Q10",
    kind: "mc",
    prompt: {
      fa: "کدام جمله درباره سوئیپ در برابر تأیید درست است؟",
      en: "Which statement about sweep versus confirmation is correct?",
    },
    options: [
      { fa: "سوئیپ = ورود خودکار", en: "Sweep equals automatic entry" },
      {
        fa: "سوئیپ می‌تواند مقدمه باشد؛ ورود به شواهد بعدی وابسته است",
        en: "A sweep may precede; entry depends on later evidence",
      },
      { fa: "تأیید همیشه قبل از سوئیپ است", en: "Confirmation always precedes the sweep" },
      { fa: "هر دو بی‌معنا هستند", en: "Both concepts are meaningless" },
    ],
    rationale: {
      fa: "ترتیب آموزشی: مشاهده سوئیپ سپس تأیید ساختاری.",
      en: "Teaching order: observe sweep, then structural confirmation.",
    },
    remediationTopic: "sweep-vs-confirmation",
  },
];

export const M3_QUIZ: QuizItem[] = [
  {
    id: "M3-Q1",
    kind: "mc",
    prompt: {
      fa: "در شبیه‌سازی آکادمی، risk% بالای ۱٪ چه وضعیتی می‌گیرد؟",
      en: "In Academy simulation, risk% above 1% yields which status?",
    },
    options: [
      { fa: "PASS_SIMULATION با هشدار", en: "PASS_SIMULATION with a warning" },
      { fa: "HARD_BLOCK", en: "HARD_BLOCK" },
      { fa: "UNVERIFIED بدون توضیح", en: "UNVERIFIED with no explanation" },
      { fa: "خاموش‌سازی بی‌صدا به ۱٪", en: "Silent clamp to 1%" },
    ],
    rationale: {
      fa: "سقف ۱٪ نقض قطعی است؛ بدون clamp خاموش.",
      en: "The 1% ceiling is a hard rule — never silent clamp.",
    },
    remediationTopic: "risk-cap",
  },
  {
    id: "M3-Q2",
    kind: "mc",
    prompt: {
      fa: "Stop ذهنی (mental) در موتور ریسک چه می‌شود؟",
      en: "A mental stop in the risk engine becomes:",
    },
    options: [
      { fa: "قابل قبول اگر R:R ≥ ۲", en: "Acceptable when R:R ≥ 2" },
      { fa: "HARD_BLOCK چون stop سخت ساختاری نیست", en: "HARD_BLOCK — not a hard structural stop" },
      { fa: "نادیده گرفته می‌شود", en: "Ignored" },
      { fa: "تبدیل به UNVERIFIED", en: "Converted to UNVERIFIED" },
    ],
    rationale: {
      fa: "فقط HARD_STRUCTURAL با شواهد مجاز است.",
      en: "Only HARD_STRUCTURAL with evidence is allowed.",
    },
    remediationTopic: "structural-stop",
  },
  {
    id: "M3-Q3",
    kind: "mc",
    prompt: {
      fa: "اندازه lot از چه چیزی پیروی می‌کند؟",
      en: "Lot size should follow:",
    },
    options: [
      { fa: "میل به سود بزرگ", en: "Desire for large profit" },
      {
        fa: "فاصله stop ساختاری و بودجه ریسک",
        en: "Structural stop distance and risk budget",
      },
      { fa: "حداکثر مارجین آزاد", en: "Maximum free margin" },
      { fa: "اسپرد لحظه‌ای تنها", en: "Spot spread alone" },
    ],
    rationale: {
      fa: "اندازه از stop و بودجه می‌آید؛ فاصله از اندازه پیروی نمی‌کند.",
      en: "Size follows stop and budget; distance does not follow desired size.",
    },
    remediationTopic: "sizing-from-stop",
  },
  {
    id: "M3-Q4",
    kind: "numeric",
    prompt: {
      fa: "equity=10000 و risk%=1 → بودجه دلار؟",
      en: "equity=10000 and risk%=1 → dollar budget?",
    },
    rationale: {
      fa: "۱۰۰۰۰ × ۰٫۰۱ = ۱۰۰",
      en: "10000 × 0.01 = 100",
    },
    remediationTopic: "risk-budget",
  },
  {
    id: "M3-Q5",
    kind: "mc",
    prompt: {
      fa: "هدف خالی (blank TP) در Risk Grid چه نتیجه‌ای می‌دهد؟",
      en: "A blank target in the Risk Grid should yield:",
    },
    options: [
      { fa: "PASS با R:R خیالی بزرگ", en: "PASS with a huge invented R:R" },
      { fa: "UNVERIFIED بدون R:R/lots", en: "UNVERIFIED without R:R/lots" },
      { fa: "HARD_BLOCK به‌خاطر ۲٪", en: "HARD_BLOCK for 2%" },
      { fa: "نادیده گرفتن فیلد", en: "Ignore the field" },
    ],
    rationale: {
      fa: "خالی ≠ صفر؛ بدون هدف، R:R قابل تأیید نیست.",
      en: "Empty ≠ zero; without a target, R:R stays unverified.",
    },
    remediationTopic: "blank-target",
  },
  {
    id: "M3-Q6",
    kind: "order",
    prompt: {
      fa: "ترتیب درست ارزیابی ستاپ قبل از اندازه:",
      en: "Correct order before sizing a setup:",
    },
    options: [
      { fa: "شواهد ساختار و stop", en: "Structure evidence and stop" },
      { fa: "بودجه ریسک ≤۱٪", en: "Risk budget ≤1%" },
      { fa: "محاسبه lot و net R:R", en: "Compute lots and net R:R" },
      { fa: "ثبت آموزشی (بدون اجرای واقعی)", en: "Educational log (no live execution)" },
    ],
    rationale: {
      fa: "ساختار → بودجه → اندازه → ثبت؛ نه برعکس.",
      en: "Structure → budget → size → log — never reversed.",
    },
    remediationTopic: "setup-risk-order",
  },
  {
    id: "M3-Q7",
    kind: "mc",
    prompt: {
      fa: "net R:R محافظه‌کار حداقل چقدر باید باشد؟",
      en: "Conservative net R:R must be at least:",
    },
    options: [
      { fa: "۱", en: "1" },
      { fa: "۲", en: "2" },
      { fa: "۳", en: "3" },
      { fa: "۰٫۵", en: "0.5" },
    ],
    rationale: {
      fa: "سقف آموزشی: netRR ≥ ۲ پس از هزینه‌ها.",
      en: "Teaching floor: netRR ≥ 2 after costs.",
    },
    remediationTopic: "net-rr",
  },
  {
    id: "M3-Q8",
    kind: "mc",
    prompt: {
      fa: "MSS بسته‌شده برای LONG چه چیزی را می‌طلبد؟",
      en: "Closed MSS for LONG requires:",
    },
    options: [
      { fa: "فقط فتیله بالای سوئینگ", en: "Only a wick above the swing" },
      {
        fa: "بسته شدن قیمت که سوئینگ از پیش شناخته‌شده را اکیداً قطع کند",
        en: "A close that strictly crosses a pre-known swing",
      },
      { fa: "برابری close با سطح", en: "Close equal to the level" },
      { fa: "هر کندل باز", en: "Any open candle" },
    ],
    rationale: {
      fa: "wick-only یا close مساوی MSS نیست.",
      en: "Wick-only or equal close is not MSS.",
    },
    remediationTopic: "mss-closed",
  },
  {
    id: "M3-Q9",
    kind: "mc",
    prompt: {
      fa: "رد کردن یک مثال ناامن آموزشی چه معنایی دارد؟",
      en: "Correctly rejecting an unsafe teaching example means:",
    },
    options: [
      { fa: "شکست مأموریت", en: "Mission failure" },
      { fa: "یادگیری موفق انضباط ریسک", en: "Successful risk-discipline learning" },
      { fa: "مجوز ۲٪ ریسک", en: "Permission for 2% risk" },
      { fa: "پاک شدن همه پیشرفت", en: "Wiping all progress" },
    ],
    rationale: {
      fa: "رد آگاهانه طرح ناامن بخشی از هدف آموزشی است.",
      en: "Conscious rejection of unsafe plans is learning success.",
    },
    remediationTopic: "unsafe-rejection",
  },
  {
    id: "M3-Q10",
    kind: "mc",
    prompt: {
      fa: "هزینه‌های ناشناخته (UNKNOWN costs) چه وضعیتی می‌گیرند؟",
      en: "Unknown costs produce which status?",
    },
    options: [
      { fa: "PASS با فرض صفر", en: "PASS assuming zero costs" },
      { fa: "UNVERIFIED", en: "UNVERIFIED" },
      { fa: "Infinity R:R", en: "Infinity R:R" },
      { fa: "نادیده گرفتن هدف", en: "Ignore the target" },
    ],
    rationale: {
      fa: "هزینه ناشناخته نمی‌تواند صفر فرض شود.",
      en: "Unknown costs must not be treated as zero.",
    },
    remediationTopic: "unknown-costs",
  },
];

export const M4_QUIZ: QuizItem[] = [
  {
    id: "M4-Q1",
    kind: "mc",
    prompt: {
      fa: "ارزیابی کلان در این پورتال چه برچسبی دارد؟",
      en: "Macro evaluation in this portal is labeled:",
    },
    options: [
      { fa: "EXECUTION_READY", en: "EXECUTION_READY" },
      { fa: "CONTEXT_ONLY", en: "CONTEXT_ONLY" },
      { fa: "AUTO_ENTRY", en: "AUTO_ENTRY" },
      { fa: "CERTIFIED_SIGNAL", en: "CERTIFIED_SIGNAL" },
    ],
    rationale: {
      fa: "کلان زمینه است نه سیگنال ورود/SL/TP.",
      en: "Macro is context — never entry/SL/TP.",
    },
    remediationTopic: "context-only",
  },
  {
    id: "M4-Q2",
    kind: "mc",
    prompt: {
      fa: "مسیر آموزشی انتقال: Data → … → Gold/Dow Bias شامل کدام حلقه میانی کلیدی است؟",
      en: "Teaching transmission path Data → … → Gold/Dow Bias includes which key middle hop?",
    },
    options: [
      { fa: "مستقیم Data → Gold", en: "Direct Data → Gold" },
      {
        fa: "Fed Repricing → US2Y → Real Yields → DXY",
        en: "Fed Repricing → US2Y → Real Yields → DXY",
      },
      { fa: "فقط VIX", en: "VIX only" },
      { fa: "فقط NFP", en: "NFP only" },
    ],
    rationale: {
      fa: "مسیر آموزشی کامل شامل Fed/yields/DXY است؛ علیت جهانی نیست.",
      en: "Teaching path includes Fed/yields/DXY — not universal causality.",
    },
    remediationTopic: "transmission-path",
  },
  {
    id: "M4-Q3",
    kind: "mc",
    prompt: {
      fa: "اگر TIPS و DXY غایب باشند، bias طلا چه می‌شود؟",
      en: "If TIPS and DXY evidence are missing, gold bias becomes:",
    },
    options: [
      { fa: "اثبات‌شده به‌خاطر CPI داغ", en: "Proven by hot CPI alone" },
      {
        fa: "غیرقابل اثبات — شواهد انتقال ناقص است",
        en: "Unproven — transmission evidence incomplete",
      },
      { fa: "ورود SHORT اجباری", en: "Mandatory SHORT entry" },
      { fa: "نادیده گرفتن سورپرایز", en: "Ignore the surprise" },
    ],
    rationale: {
      fa: "بدون Real Yields/DXY نمی‌توان bias طلا را اثبات کرد.",
      en: "Missing Real Yields/DXY cannot prove a gold bias.",
    },
    remediationTopic: "missing-tips-dxy",
  },
  {
    id: "M4-Q4",
    kind: "mc",
    prompt: {
      fa: "TIPS در این آموزش به چه معناست؟",
      en: "In this curriculum, TIPS means:",
    },
    options: [
      {
        fa: "بازده اسمی منهای CPI تحقق‌یافته",
        en: "Nominal yields minus realized CPI",
      },
      {
        fa: "بازده واقعی مشاهده‌شده (نه حساب سرانگشتی اسمی−CPI)",
        en: "Observed real yields (not nominal-minus-CPI arithmetic)",
      },
      { fa: "شاخص سهام", en: "An equity index" },
      { fa: "اسپرد طلا", en: "Gold spread" },
    ],
    rationale: {
      fa: "TIPS = مشاهده بازده واقعی؛ نه تفریق ساده.",
      en: "TIPS = observed real yields — not casual subtraction.",
    },
    remediationTopic: "tips-definition",
  },
  {
    id: "M4-Q5",
    kind: "order",
    prompt: {
      fa: "ترتیب آموزشی مسیر انتقال (شاخه اصلی):",
      en: "Teaching order for the primary transmission path:",
    },
    options: [
      { fa: "Data", en: "Data" },
      { fa: "Surprise", en: "Surprise" },
      { fa: "Fed Repricing", en: "Fed Repricing" },
      { fa: "US2Y → Real Yields → DXY → Gold bias", en: "US2Y → Real Yields → DXY → Gold bias" },
    ],
    rationale: {
      fa: "Data→Surprise→Fed→yields/DXY→bias؛ یال مستقیم GOLD←DATA رد می‌شود.",
      en: "Data→Surprise→Fed→yields/DXY→bias; direct GOLD←DATA is rejected.",
    },
    remediationTopic: "transmission-order",
  },
  {
    id: "M4-Q6",
    kind: "mc",
    prompt: {
      fa: "پیش‌فرض پاسخ‌کلید (answer-key preset) در ارزیابی چه اعتباری دارد؟",
      en: "What assessed credit do answer-key presets earn?",
    },
    options: [
      { fa: "۱۰۰٪ خودکار", en: "Automatic 100%" },
      {
        fa: "هیچ — فقط کمک نمایشی/منتور؛ اعتبار assessed نمی‌دهند",
        en: "None — demo/mentor aids only; no assessed credit",
      },
      { fa: "۵۰٪", en: "50%" },
      { fa: "فقط در فارسی", en: "Only in Persian" },
    ],
    rationale: {
      fa: "Preset نمایشی است؛ نمره assessed از کار دانشجو می‌آید.",
      en: "Presets are demos; assessed scores need student work.",
    },
    remediationTopic: "no-preset-credit",
  },
  {
    id: "M4-Q7",
    kind: "mc",
    prompt: {
      fa: "Actual/Forecast/Previous/Revisions را چگونه نگه می‌داریم؟",
      en: "How should Actual/Forecast/Previous/Revisions be handled?",
    },
    options: [
      { fa: "همه را در یک عدد ادغام کنیم", en: "Merge into one number" },
      {
        fa: "جدا نگه داریم؛ بازنگری‌های آینده اسنپ‌شات‌های قبلی را عوض نکنند",
        en: "Keep separate; future revisions must not rewrite earlier snapshots",
      },
      { fa: "فقط Actual مهم است", en: "Only Actual matters" },
      { fa: "Forecast را بعد از انتشار بسازیم", en: "Invent Forecast after release" },
    ],
    rationale: {
      fa: "جداسازی vintage و جلوگیری از look-ahead.",
      en: "Preserve vintage separation and avoid look-ahead.",
    },
    remediationTopic: "release-fields",
  },
  {
    id: "M4-Q8",
    kind: "mc",
    prompt: {
      fa: "دو بسته متناقض با CPI داغ یکسان چه چیزی را آموزش می‌دهند؟",
      en: "Two contradiction packets with identical hot CPI teach:",
    },
    options: [
      { fa: "ورود قطعی طلا", en: "Certain gold entries" },
      {
        fa: "نیاز به فرضیات و ضدشواهد؛ مسیر انتقال یکتا نیست",
        en: "Need assumptions and counterevidence; transmission is not unique",
      },
      { fa: "نادیده گرفتن DXY", en: "Ignoring DXY" },
      { fa: "حذف US2Y", en: "Dropping US2Y" },
    ],
    rationale: {
      fa: "همان چاپ می‌تواند مسیرهای متفاوت بسازد.",
      en: "The same print can support different conditional paths.",
    },
    remediationTopic: "contradiction-packets",
  },
  {
    id: "M4-Q9",
    kind: "numeric",
    prompt: {
      fa: "اگر actual=0.4 و forecast=0.2 باشد، سورپرایز به واحد درصد چند است؟",
      en: "If actual=0.4 and forecast=0.2, surprise in percentage points is?",
    },
    rationale: {
      fa: "۰٫۴ − ۰٫۲ = ۰٫۲",
      en: "0.4 − 0.2 = 0.2",
    },
    remediationTopic: "surprise-math",
  },
  {
    id: "M4-Q10",
    kind: "mc",
    prompt: {
      fa: "یال پشتیبانی‌نشده GOLD→DATA چه باید بکند؟",
      en: "An unsupported GOLD→DATA edge should:",
    },
    options: [
      { fa: "نمره کامل بدهد", en: "Award full credit" },
      {
        fa: "با دلیل رد لبه و شرایط مفقود، امتیاز را کم کند",
        en: "Reduce score with edge-specific rejection and missing-condition feedback",
      },
      { fa: "خودکار به DXY تبدیل شود", en: "Auto-convert to DXY" },
      { fa: "کل آزمون را پاک کند", en: "Wipe the quiz" },
    ],
    rationale: {
      fa: "هر یال ردشده باید توضیح اختصاصی داشته باشد.",
      en: "Each rejected edge needs a specific explanation.",
    },
    remediationTopic: "edge-rejection",
  },
];

export const M5_QUIZ: QuizItem[] = [
  {
    id: "M5-Q1",
    kind: "mc",
    prompt: {
      fa: "قبل از افشای نتیجه پژوهش چه چیزی باید قفل شود؟",
      en: "Before outcome reveal, research must lock:",
    },
    options: [
      { fa: "فقط رنگ نمودار", en: "Chart colors only" },
      {
        fa: "فرضیه، ابطال، اسپلیت، هزینه‌ها و سیاست داده مفقود",
        en: "Hypothesis, falsification, split, costs, and missing-data policy",
      },
      { fa: "فقط تعداد بردها", en: "Win count only" },
      { fa: "هویت منتور", en: "Mentor identity" },
    ],
    rationale: {
      fa: "پیش‌ثبت کامل قبل از دیدن نتیجه الزامی است.",
      en: "Full preregistration before seeing outcomes is required.",
    },
    remediationTopic: "preregistration",
  },
  {
    id: "M5-Q2",
    kind: "mc",
    prompt: {
      fa: "داستان‌سازی پس از دیدن نتیجه چه نامی دارد؟",
      en: "Storytelling after seeing the outcome is called:",
    },
    options: [
      { fa: "پیش‌ثبت", en: "Preregistration" },
      { fa: "HARKing / overfitting روایی", en: "HARKing / narrative overfitting" },
      { fa: "OOS معتبر", en: "Valid OOS" },
      { fa: "هزینه معامله", en: "Trading cost" },
    ],
    rationale: {
      fa: "HARKing پژوهش را فاسد می‌کند.",
      en: "HARKing corrupts the research claim.",
    },
    remediationTopic: "harking",
  },
  {
    id: "M5-Q3",
    kind: "mc",
    prompt: {
      fa: "netR چگونه محاسبه می‌شود؟",
      en: "How is netR computed?",
    },
    options: [
      { fa: "grossR + costR", en: "grossR + costR" },
      { fa: "grossR − costR", en: "grossR − costR" },
      { fa: "فقط grossR", en: "grossR alone" },
      { fa: "همیشه صفر", en: "Always zero" },
    ],
    rationale: {
      fa: "netR = grossR − costR؛ هزینه ناشناخته صفر نمی‌شود.",
      en: "netR = grossR − costR; unknown costs stay unknown.",
    },
    remediationTopic: "gross-vs-net",
  },
  {
    id: "M5-Q4",
    kind: "mc",
    prompt: {
      fa: "اگر هیچ مشاهده باخت نباشد، profit factor چه می‌شود؟",
      en: "If there are no losing observations, profit factor becomes:",
    },
    options: [
      { fa: "Infinity", en: "Infinity" },
      { fa: "null با دلیل NO_LOSSES", en: "null with NO_LOSSES reason" },
      { fa: "۰", en: "0" },
      { fa: "۱۰۰", en: "100" },
    ],
    rationale: {
      fa: "بدون باخت، PF تهی است نه بی‌نهایت.",
      en: "No losses → null PF with NO_LOSSES — not Infinity.",
    },
    remediationTopic: "profit-factor",
  },
  {
    id: "M5-Q5",
    kind: "order",
    prompt: {
      fa: "ترتیب انضباط train/test:",
      en: "Train/test discipline order:",
    },
    options: [
      { fa: "قفل فرضیه و پارامترها", en: "Lock hypothesis and parameters" },
      { fa: "فقط TRAIN را ببینید/تنظیم کنید", en: "View/tune on TRAIN only" },
      { fa: "افشای TEST پس از فریز", en: "Reveal TEST after freeze" },
      { fa: "ادعای OOS فقط روی نمونه دست‌نخورده", en: "OOS claim only on untouched sample" },
    ],
    rationale: {
      fa: "تنظیم بعد از TEST → EXPLORATORY؛ نیاز به نمونه بکر.",
      en: "Tuning after TEST → EXPLORATORY; need an untouched sample.",
    },
    remediationTopic: "train-test",
  },
  {
    id: "M5-Q6",
    kind: "mc",
    prompt: {
      fa: "نشت (leakage) یعنی چه؟",
      en: "Leakage means:",
    },
    options: [
      { fa: "اسپرد زیاد", en: "Wide spread" },
      {
        fa: "استفاده از اطلاعاتی که در زمان تصمیم در دسترس نبوده",
        en: "Using information that was not available at decision time",
      },
      { fa: "کمبود مارجین", en: "Margin shortfall" },
      { fa: "فونت بد", en: "Bad typography" },
    ],
    rationale: {
      fa: "نشت = اطلاعات آینده یا غیرمجاز در آموزش/ارزیابی.",
      en: "Leakage = future or unauthorized information in fit/eval.",
    },
    remediationTopic: "leakage",
  },
  {
    id: "M5-Q7",
    kind: "numeric",
    prompt: {
      fa: "TRAIN gross [2,-1,2,-1] با cost 0.1R روی هر مشاهده: mean netR؟",
      en: "TRAIN gross [2,-1,2,-1] with 0.1R cost each: mean netR?",
    },
    rationale: {
      fa: "net = [1.9,-1.1,1.9,-1.1]؛ میانگین ۰٫۴",
      en: "net=[1.9,-1.1,1.9,-1.1]; mean 0.4",
    },
    remediationTopic: "research-fixture",
  },
  {
    id: "M5-Q8",
    kind: "mc",
    prompt: {
      fa: "هم‌پوشانی پنجره outcome بین TRAIN و TEST چه می‌کند؟",
      en: "Overlapping TRAIN/TEST outcome windows should:",
    },
    options: [
      { fa: "نادیده گرفته شوند", en: "Be ignored" },
      {
        fa: "پاکسازی شوند — TRAIN outcomeEnd ≤ cutoff و TEST بعداً شروع شود",
        en: "Be purged — TRAIN outcomeEnd ≤ cutoff and TEST starts later",
      },
      { fa: "امتیاز دوگانه بدهند", en: "Double the score" },
      { fa: "Sharpe بسازند", en: "Create a Sharpe ratio" },
    ],
    rationale: {
      fa: "هم‌پوشانی آلودگی OOS است.",
      en: "Overlap contaminates the OOS claim.",
    },
    remediationTopic: "split-overlap",
  },
  {
    id: "M5-Q9",
    kind: "mc",
    prompt: {
      fa: "خروجی‌های موتور وارداتی PASS را چگونه رفتار کنیم؟",
      en: "How treat imported cached PASS engine outputs?",
    },
    options: [
      { fa: "اعتماد کامل", en: "Trust fully" },
      {
        fa: "اعتماد نکن؛ از رجیستری محلی بازمحاسبه کن → در غیر این صورت UNVERIFIED",
        en: "Do not trust; recompute from local registry or mark UNVERIFIED",
      },
      { fa: "دوبرابر XP بده", en: "Double XP" },
      { fa: "حذف ژورنال", en: "Delete the journal" },
    ],
    rationale: {
      fa: "واردات PASS احراز هویت‌شده نیست.",
      en: "Imported PASS is not authenticated.",
    },
    remediationTopic: "import-trust",
  },
  {
    id: "M5-Q10",
    kind: "mc",
    prompt: {
      fa: "آیا از فیکسچرهای کوچک می‌توان ادعای یال پایدار/Sharpe کرد؟",
      en: "May tiny fixtures support durable-edge or Sharpe claims?",
    },
    options: [
      { fa: "بله اگر PF>1", en: "Yes if PF>1" },
      {
        fa: "خیر — فقط برچسب synthetic و n کوچک؛ بدون ادعای آماری بادوام",
        en: "No — label synthetic and small n; no durable statistical claims",
      },
      { fa: "فقط در طلا", en: "Only for gold" },
      { fa: "اگر منتور تأیید کند خودکار", en: "Automatic if a mentor nods" },
    ],
    rationale: {
      fa: "n کوچک ≠ اثبات یال پایدار.",
      en: "Small n ≠ durable-edge proof.",
    },
    remediationTopic: "tiny-fixture-limits",
  },
];

export { ASSESSMENT_CRITERIA_VERSION } from "./assessmentVersion";
