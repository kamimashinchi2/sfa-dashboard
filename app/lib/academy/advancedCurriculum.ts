import type { AdvancedId, Lesson, StageId, Text } from "./contracts";
import type { QuizItem } from "./curriculum";

export type AdvancedModuleDef = {
  id: AdvancedId;
  stages: StageId[];
  title: Text;
  summary: Text;
  href: string;
  featureFlag: "advancedAssessedEnabled";
  lessons: Lesson[];
  quiz: QuizItem[];
  practicalTask: Text;
};

function lesson(
  partial: Omit<Lesson, "selfReviewRubric" | "missionId"> & {
    missionId?: Lesson["missionId"];
    selfReviewRubric?: Text[];
  },
): Lesson {
  const { selfReviewRubric, missionId, ...rest } = partial;
  return {
    ...rest,
    missionId: missionId ?? "M5",
    selfReviewRubric: selfReviewRubric ?? [
      {
        fa: "آیا سازوکار را بدون شعار توضیح دادم؟",
        en: "Did I explain the mechanism without slogans?",
      },
      {
        fa: "آیا تله خرده‌فروشی را نام بردم؟",
        en: "Did I name the retail trap?",
      },
      {
        fa: "آیا واقعیت نهادی را از سیگنال جدا کردم؟",
        en: "Did I separate institutional reality from signals?",
      },
    ],
  };
}

const A6_QUIZ: QuizItem[] = [
  {
    id: "A6-Q1",
    kind: "mc",
    prompt: {
      fa: "پیش‌ثبت فرضیه قبل از افشا شامل چیست؟",
      en: "Preregistration before reveal must include:",
    },
    options: [
      { fa: "فقط رنگ چارت", en: "Chart colors only" },
      {
        fa: "eligibility، outcome، baseline، falsification، هزینه‌ها، missing policy، اسپلیت",
        en: "eligibility, outcome, baseline, falsification, costs, missing policy, split",
      },
      { fa: "فقط XP", en: "XP only" },
      { fa: "هویت منتور", en: "Mentor identity" },
    ],
    answer: 1,
    rationale: {
      fa: "همه عناصر قبل از reveal قفل می‌شوند.",
      en: "All elements lock before reveal.",
    },
    remediationTopic: "a6-prereg",
  },
  {
    id: "A6-Q2",
    kind: "mc",
    prompt: {
      fa: "تنظیم پارامتر بعد از دیدن TEST چه برچسبی می‌گیرد؟",
      en: "Tuning parameters after TEST exposure is labeled:",
    },
    options: [
      { fa: "OOS معتبر", en: "Valid OOS" },
      { fa: "EXPLORATORY", en: "EXPLORATORY" },
      { fa: "PASS اجباری", en: "Forced PASS" },
      { fa: "حذف TRAIN", en: "Drop TRAIN" },
    ],
    answer: 1,
    rationale: {
      fa: "آلودگی TEST → EXPLORATORY؛ نیاز به نمونه بکر.",
      en: "TEST contamination → EXPLORATORY; need untouched sample.",
    },
    remediationTopic: "a6-contamination",
  },
  {
    id: "A6-Q3",
    kind: "numeric",
    prompt: {
      fa: "TRAIN gross [2,-1,2,-1] cost 0.1 → sum netR؟",
      en: "TRAIN gross [2,-1,2,-1] cost 0.1 → sum netR?",
    },
    answer: "1.6",
    rationale: {
      fa: "۱٫۹−۱٫۱+۱٫۹−۱٫۱ = ۱٫۶",
      en: "1.9−1.1+1.9−1.1 = 1.6",
    },
    remediationTopic: "a6-train-sum",
  },
  {
    id: "A6-Q4",
    kind: "numeric",
    prompt: {
      fa: "همان TRAIN → mean netR؟",
      en: "Same TRAIN → mean netR?",
    },
    answer: "0.4",
    rationale: { fa: "۱٫۶/۴ = ۰٫۴", en: "1.6/4 = 0.4" },
    remediationTopic: "a6-train-mean",
  },
  {
    id: "A6-Q5",
    kind: "numeric",
    prompt: {
      fa: "TEST gross [-1,-1,2,-1] cost 0.1 → mean netR؟",
      en: "TEST gross [-1,-1,2,-1] cost 0.1 → mean netR?",
    },
    answer: "-0.35",
    rationale: {
      fa: "net مجموع −۱٫۴؛ میانگین −۰٫۳۵",
      en: "net sum −1.4; mean −0.35",
    },
    remediationTopic: "a6-test-mean",
  },
  {
    id: "A6-Q6",
    kind: "mc",
    prompt: {
      fa: "بدون مشاهده باخت، profit factor؟",
      en: "With no losing observations, profit factor is:",
    },
    options: [
      { fa: "Infinity", en: "Infinity" },
      { fa: "null / NO_LOSSES", en: "null / NO_LOSSES" },
      { fa: "۰", en: "0" },
      { fa: "۱", en: "1" },
    ],
    answer: 1,
    rationale: {
      fa: "PF تهی است نه بی‌نهایت.",
      en: "PF is null — not Infinity.",
    },
    remediationTopic: "a6-pf",
  },
  {
    id: "A6-Q7",
    kind: "mc",
    prompt: {
      fa: "هزینه ناشناخته چه می‌شود؟",
      en: "Unknown observation cost becomes:",
    },
    options: [
      { fa: "صفر", en: "Zero" },
      { fa: "null / UNVERIFIED metrics", en: "null / UNVERIFIED metrics" },
      { fa: "۱", en: "1" },
      { fa: "نادیده", en: "Ignored" },
    ],
    answer: 1,
    rationale: {
      fa: "هزینه ناشناخته صفر فرض نمی‌شود.",
      en: "Unknown costs are never coerced to zero.",
    },
    remediationTopic: "a6-cost",
  },
  {
    id: "A6-Q8",
    kind: "order",
    prompt: {
      fa: "ترتیب انضباط پژوهش:",
      en: "Research discipline order:",
    },
    options: [
      { fa: "قفل فرضیه", en: "Lock hypothesis" },
      { fa: "فقط TRAIN", en: "TRAIN only" },
      { fa: "فریز پارامتر", en: "Freeze parameters" },
      { fa: "افشای TEST", en: "Reveal TEST" },
    ],
    answer: [0, 1, 2, 3],
    rationale: {
      fa: "قفل→TRAIN→فریز→TEST",
      en: "Lock→TRAIN→freeze→TEST",
    },
    remediationTopic: "a6-order",
  },
  {
    id: "A6-Q9",
    kind: "mc",
    prompt: {
      fa: "digest فرضیه چه چیزی را نشان می‌دهد؟",
      en: "A hypothesis digest indicates:",
    },
    options: [
      { fa: "زمان ثبت ضددستکاری", en: "Tamper-proof registration time" },
      {
        fa: "سازگاری محتوای قفل‌شده — نه اثبات زمان اصیل",
        en: "Locked content consistency — not authentic registration time",
      },
      { fa: "گارانتی سود", en: "Profit guarantee" },
      { fa: "هویت کاربر", en: "User identity" },
    ],
    answer: 1,
    rationale: {
      fa: "digest سازگاری است نه timestamp معتبر.",
      en: "Digest is consistency, not attested time.",
    },
    remediationTopic: "a6-digest",
  },
  {
    id: "A6-Q10",
    kind: "mc",
    prompt: {
      fa: "آیا n=4 synthetic اجازه ادعای Sharpe پایدار می‌دهد؟",
      en: "Does n=4 synthetic allow durable Sharpe claims?",
    },
    options: [
      { fa: "بله", en: "Yes" },
      { fa: "خیر", en: "No" },
    ],
    answer: 1,
    rationale: {
      fa: "فیکسچر کوچک ≠ ادعای آماری بادوام.",
      en: "Tiny fixtures forbid durable statistical claims.",
    },
    remediationTopic: "a6-limits",
  },
];

const A7_QUIZ: QuizItem[] = [
  {
    id: "A7-Q1",
    kind: "numeric",
    prompt: {
      fa: "10000 با سه بازده −۱٪ → equity پایانی؟",
      en: "10000 with three −1% returns → ending equity?",
    },
    answer: "9702.99",
    rationale: {
      fa: "۹۹۰۰، ۹۸۰۱، ۹۷۰۲٫۹۹",
      en: "9900, 9801, 9702.99",
    },
    remediationTopic: "a7-path",
  },
  {
    id: "A7-Q2",
    kind: "numeric",
    prompt: {
      fa: "پس از دو −۱٪ از ۱۰۰۰۰، بودجه ۱٪ بعدی؟",
      en: "After two −1% from 10000, next 1% budget?",
    },
    answer: "98.01",
    rationale: {
      fa: "equity=۹۸۰۱ → بودجه ۹۸٫۰۱",
      en: "equity=9801 → budget 98.01",
    },
    remediationTopic: "a7-budget",
  },
  {
    id: "A7-Q3",
    kind: "mc",
    prompt: {
      fa: "گپ که زیان ۲٪ بعد از طرح ۱٪ بسازد؟",
      en: "A gap causing 2% loss after a valid 1% plan is:",
    },
    options: [
      { fa: "اثبات ریسک بیش‌ازحد برنامه‌ریزی‌شده", en: "Proof of excessive planned risk" },
      { fa: "STOP_GAP_LOSS", en: "STOP_GAP_LOSS" },
      { fa: "PASS بی‌قید", en: "Unconditional PASS" },
      { fa: "نادیده", en: "Ignore" },
    ],
    answer: 1,
    rationale: {
      fa: "زیان تحقق‌یافته ≠ طرح؛ برچسب STOP_GAP_LOSS.",
      en: "Realized ≠ plan; label STOP_GAP_LOSS.",
    },
    remediationTopic: "a7-gap",
  },
  {
    id: "A7-Q4",
    kind: "numeric",
    prompt: {
      fa: "برای جبران drawdown ۲۰٪ چند٪ رشد لازم است؟",
      en: "Recovery from 20% drawdown requires what % gain?",
    },
    answer: "25",
    rationale: {
      fa: "۱/۰٫۸ − ۱ = ۰٫۲۵ → ۲۵٪",
      en: "1/0.8 − 1 = 0.25 → 25%",
    },
    remediationTopic: "a7-recovery",
  },
  {
    id: "A7-Q5",
    kind: "mc",
    prompt: {
      fa: "سه زیان ۱۰۰ روی equity ۱۰۰۰۰ یعنی چند٪ تمرکز stop؟",
      en: "Three $100 stops on $10000 equity is what stop concentration %?",
    },
    options: [
      { fa: "۱", en: "1" },
      { fa: "۳", en: "3" },
      { fa: "۲", en: "2" },
      { fa: "۱۰", en: "10" },
    ],
    answer: 1,
    rationale: {
      fa: "۳۰۰/۱۰۰۰۰ = ۳٪ — گزارش تمرکز بدون سقف ساختگی.",
      en: "300/10000 = 3% — report concentration; no invented cap.",
    },
    remediationTopic: "a7-portfolio",
  },
  {
    id: "A7-Q6",
    kind: "mc",
    prompt: {
      fa: "در equity≤۰ چه باید کرد؟",
      en: "When equity≤0 the lab must:",
    },
    options: [
      { fa: "ادامه sizing", en: "Continue sizing" },
      {
        fa: "توقف replay، پرچم insolvency، recovery=null",
        en: "Stop replay, flag insolvency, recovery=null",
      },
      { fa: "reset خاموش", en: "Silent reset" },
      { fa: "دوبرابر lot", en: "Double lots" },
    ],
    answer: 1,
    rationale: {
      fa: "ورشکستگی آموزشی توقف می‌کند.",
      en: "Educational insolvency stops the path.",
    },
    remediationTopic: "a7-insolvency",
  },
  {
    id: "A7-Q7",
    kind: "mc",
    prompt: {
      fa: "اگر OHLC هم stop و هم target را بدون ترتیب بزند؟",
      en: "If OHLC touches both stop and target without order evidence:",
    },
    options: [
      { fa: "همیشه نتیجه مطلوب", en: "Always the favorable outcome" },
      { fa: "AMBIGUOUS یا قاعده محافظه‌کار افشا‌شده", en: "AMBIGUOUS or disclosed conservative rule" },
      { fa: "نادیده stop", en: "Ignore stop" },
      { fa: "Infinity R:R", en: "Infinity R:R" },
    ],
    answer: 1,
    rationale: {
      fa: "هرگز نتیجه مطلوب را خودسرانه انتخاب نکنید.",
      en: "Never pick the favorable outcome unilaterally.",
    },
    remediationTopic: "a7-ambiguous",
  },
  {
    id: "A7-Q8",
    kind: "order",
    prompt: {
      fa: "ترتیب ارزیابی ریسک شبیه‌سازی:",
      en: "Simulation risk evaluation order:",
    },
    options: [
      { fa: "Stop ساختاری سخت", en: "Hard structural stop" },
      { fa: "سقف ۱٪", en: "1% ceiling" },
      { fa: "netRR≥۲", en: "netRR≥2" },
      { fa: "ثبت نتیجه", en: "Record result" },
    ],
    answer: [0, 1, 2, 3],
    rationale: {
      fa: "ساختار→سقف→R:R→ثبت",
      en: "Structure→cap→R:R→record",
    },
    remediationTopic: "a7-order",
  },
  {
    id: "A7-Q9",
    kind: "mc",
    prompt: {
      fa: "رد مثال ناامن آموزشی؟",
      en: "Rejecting an unsafe teaching example counts as:",
    },
    options: [
      { fa: "شکست", en: "Failure" },
      { fa: "یادگیری موفق", en: "Successful learning" },
      { fa: "مجوز ۲٪", en: "2% permission" },
      { fa: "حذف XP", en: "XP wipe" },
    ],
    answer: 1,
    rationale: {
      fa: "رد آگاهانه = موفقیت آموزشی.",
      en: "Conscious rejection = learning success.",
    },
    remediationTopic: "a7-reject",
  },
  {
    id: "A7-Q10",
    kind: "mc",
    prompt: {
      fa: "آیا ۱٪ تحقق‌یافته تضمین می‌شود؟",
      en: "Is a 1% realized loss cap guaranteed?",
    },
    options: [
      { fa: "بله همیشه", en: "Yes always" },
      { fa: "خیر — گپ می‌تواند بیشتر کند", en: "No — gaps can exceed it" },
    ],
    answer: 1,
    rationale: {
      fa: "طرح ۱٪ سقف تحقق را تضمین نمی‌کند.",
      en: "A 1% plan does not guarantee realized cap.",
    },
    remediationTopic: "a7-no-guarantee",
  },
];

const A8_QUIZ: QuizItem[] = [
  {
    id: "A8-Q1",
    kind: "mc",
    prompt: {
      fa: "قبل از releasedAt مقدار actual چیست؟",
      en: "Before releasedAt, actual must be:",
    },
    options: [
      { fa: "forecast", en: "forecast" },
      { fa: "null", en: "null" },
      { fa: "prior", en: "prior" },
      { fa: "۰", en: "0" },
    ],
    answer: 1,
    rationale: {
      fa: "پیش از انتشار actual در دسترس نیست.",
      en: "Pre-release actual is null.",
    },
    remediationTopic: "a8-prerelease",
  },
  {
    id: "A8-Q2",
    kind: "mc",
    prompt: {
      fa: "بازنگری آینده روی اسنپ‌شات گذشته؟",
      en: "Future revisions changing earlier snapshots?",
    },
    options: [
      { fa: "ممنوع", en: "Forbidden" },
      { fa: "مجاز", en: "Allowed" },
      { fa: "فقط برای طلا", en: "Only for gold" },
    ],
    answer: 0,
    rationale: {
      fa: "vintage جدا می‌ماند.",
      en: "Keep vintage intact.",
    },
    remediationTopic: "a8-revisions",
  },
  {
    id: "A8-Q3",
    kind: "mc",
    prompt: {
      fa: "timestamp بدون offset؟",
      en: "Timestamp without offset?",
    },
    options: [
      { fa: "رد — مبهم DST", en: "Reject — ambiguous DST" },
      { fa: "قبول با فرض UTC", en: "Accept as UTC" },
      { fa: "تبدیل خودکار به CET", en: "Auto-convert to CET" },
    ],
    answer: 0,
    rationale: {
      fa: "ISO با offset الزامی است.",
      en: "Zoned ISO required.",
    },
    remediationTopic: "a8-tz",
  },
  {
    id: "A8-Q4",
    kind: "numeric",
    prompt: {
      fa: "EURUSD 1.1000→1.1011 بازده٪ پنجره ۰–۵؟",
      en: "EURUSD 1.1000→1.1011 return % for 0–5?",
    },
    answer: "0.1",
    rationale: {
      fa: "(۱٫۱۰۱۱/۱٫۱۰۰۰−۱)×۱۰۰ ≈ ۰٫۱",
      en: "(1.1011/1.1000−1)×100 ≈ 0.1",
    },
    remediationTopic: "a8-ret",
  },
  {
    id: "A8-Q5",
    kind: "mc",
    prompt: {
      fa: "نقطه Gold15m مفقود چه می‌کند؟",
      en: "Missing Gold 15m point makes:",
    },
    options: [
      { fa: "بازده صفر", en: "Zero returns" },
      {
        fa: "هر دو پنجره مجاور ناقص (null با دلیل)",
        en: "Both adjacent windows incomplete (null with reasons)",
      },
      { fa: "درون‌یابی آینده", en: "Future interpolation" },
      { fa: "PASS", en: "PASS" },
    ],
    answer: 1,
    rationale: {
      fa: "نقطه مفقود = null با دلیل؛ نه صفر.",
      en: "Missing → null with reasons — not zero.",
    },
    remediationTopic: "a8-missing",
  },
  {
    id: "A8-Q6",
    kind: "mc",
    prompt: {
      fa: "درصد بازده mid توصیفی است یا P&L اجرایی؟",
      en: "Mid-return percentages are:",
    },
    options: [
      { fa: "توصیفی — نه اجرایی", en: "Descriptive — not executable" },
      { fa: "P&L اجرایی", en: "Executable P&L" },
      { fa: "سیگنال ورود", en: "Entry signal" },
    ],
    answer: 0,
    rationale: {
      fa: "درصد mid سیگنال اجرا نیست.",
      en: "Mid returns are descriptive only.",
    },
    remediationTopic: "a8-descriptive",
  },
  {
    id: "A8-Q7",
    kind: "order",
    prompt: {
      fa: "ترتیب تمرین capstone:",
      en: "Capstone exercise order:",
    },
    options: [
      { fa: "فریز انتظارات", en: "Freeze expectations" },
      { fa: "افشای بسته ۱", en: "Reveal packet 1" },
      { fa: "ثبت ضدشواهد", en: "Log counterevidence" },
      { fa: "افشای بسته ۲", en: "Reveal packet 2" },
    ],
    answer: [0, 1, 2, 3],
    rationale: {
      fa: "قبل از هر افشا فریز کنید.",
      en: "Freeze before each reveal.",
    },
    remediationTopic: "a8-order",
  },
  {
    id: "A8-Q8",
    kind: "mc",
    prompt: {
      fa: "حداقل چند بسته تألیف‌شده در تمرین؟",
      en: "Minimum authored packets in the exercise?",
    },
    options: [
      { fa: "۱", en: "1" },
      { fa: "۲", en: "2" },
      { fa: "۱۰", en: "10" },
      { fa: "۰", en: "0" },
    ],
    answer: 1,
    rationale: {
      fa: "حداقل دو بسته — نه کفایت آماری.",
      en: "At least two packets — not statistical sufficiency.",
    },
    remediationTopic: "a8-packets",
  },
  {
    id: "A8-Q9",
    kind: "mc",
    prompt: {
      fa: "بازه‌های اندازه‌گیری بازده؟",
      en: "Return measurement intervals?",
    },
    options: [
      { fa: "۰–۵، ۵–۱۵، ۱۵–۶۰ دقیقه", en: "0–5, 5–15, 15–60 minutes" },
      { fa: "۱س، ۱ر، ۱م", en: "1h, 1d, 1m" },
      { fa: "فقط سوئینگ", en: "Swing only" },
    ],
    answer: 0,
    rationale: {
      fa: "بازه‌های تعریف‌شده آموزشی.",
      en: "Authored teaching intervals.",
    },
    remediationTopic: "a8-windows",
  },
  {
    id: "A8-Q10",
    kind: "mc",
    prompt: {
      fa: "نمایش زمان محلی آموزشی؟",
      en: "Teaching display timezone?",
    },
    options: [
      { fa: "Europe/Amsterdam CET/CEST", en: "Europe/Amsterdam CET/CEST" },
      { fa: "فقط UTC خام", en: "Raw UTC only" },
      { fa: "وقت محلی دستگاه", en: "Device local time" },
    ],
    answer: 0,
    rationale: {
      fa: "نمایش آمستردام؛ ذخیره ISO.",
      en: "Display Amsterdam; store ISO.",
    },
    remediationTopic: "a8-display-tz",
  },
];

export const advancedModules: AdvancedModuleDef[] = [
  {
    id: "A6",
    stages: [6],
    title: {
      fa: "A6 — آزمایشگاه پژوهش",
      en: "A6 — Research Lab",
    },
    summary: {
      fa: "پیش‌ثبت ابطال‌پذیر، انضباط نشت/OOS، ارزیابی ناخالص در برابر خالص.",
      en: "Falsifiable preregistration, leakage/OOS discipline, gross vs net evaluation.",
    },
    href: "/academy/advanced/A6",
    featureFlag: "advancedAssessedEnabled",
    lessons: [
      lesson({
        id: "A6-L1",
        stages: [6],
        title: { fa: "پیش‌ثبت ابطال‌پذیر", en: "Falsifiable preregistration" },
        core: {
          fa: "قبل از افشا، فرضیه و ابطال و اسپلیت را قفل کنید.",
          en: "Lock hypothesis, falsification and split before reveal.",
        },
        trap: {
          fa: "تله: HARKing پس از دیدن نتیجه.",
          en: "Trap: HARKing after outcomes.",
        },
        reality: {
          fa: "نهادها پیش‌ثبت را از داستان پسینی جدا می‌کنند.",
          en: "Institutions separate preregistration from post-hoc stories.",
        },
        question: {
          fa: "کدام فیلدها قبل از reveal اجباری‌اند؟",
          en: "Which fields are mandatory before reveal?",
        },
      }),
      lesson({
        id: "A6-L2",
        stages: [6],
        title: { fa: "نشت و انضباط OOS", en: "Leakage and OOS discipline" },
        core: {
          fa: "فقط TRAIN برای تنظیم؛ فریز قبل از TEST.",
          en: "TRAIN-only tuning; freeze before TEST.",
        },
        trap: {
          fa: "تله: تنظیم بعد از دیدن TEST.",
          en: "Trap: tuning after TEST exposure.",
        },
        reality: {
          fa: "آلودگی → EXPLORATORY تا نمونه بکر.",
          en: "Contamination → EXPLORATORY until untouched sample.",
        },
        question: {
          fa: "اگر بعد از TEST پارامتر عوض شود چه برچسبی؟",
          en: "If parameters change after TEST, what label?",
        },
      }),
      lesson({
        id: "A6-L3",
        stages: [6],
        title: { fa: "ناخالص در برابر خالص", en: "Gross versus net" },
        core: {
          fa: "netR = grossR − costR؛ هزینه ناشناخته صفر نیست.",
          en: "netR = grossR − costR; unknown cost ≠ zero.",
        },
        trap: {
          fa: "تله: نادیده گرفتن هزینه و ادعای Infinity PF.",
          en: "Trap: ignoring costs and inventing Infinity PF.",
        },
        reality: {
          fa: "بدون باخت PF=null با NO_LOSSES.",
          en: "No losses → PF null with NO_LOSSES.",
        },
        question: {
          fa: "بدون باخت profit factor چیست؟",
          en: "With no losses, what is profit factor?",
        },
      }),
    ],
    quiz: A6_QUIZ,
    practicalTask: {
      fa: "فرضیه synthetic را قفل کنید، متریک TRAIN/TEST را محاسبه و نسخه را ویرایش کنید.",
      en: "Lock the synthetic hypothesis, compute TRAIN/TEST metrics, then revise a version.",
    },
  },
  {
    id: "A7",
    stages: [7],
    title: {
      fa: "A7 — آزمایشگاه equity و drawdown",
      en: "A7 — Equity Risk & Drawdown Lab",
    },
    summary: {
      fa: "اندازه روی equity جاری، مسیر drawdown/recovery، شفافیت پرتفوی.",
      en: "Current-equity sizing, drawdown/recovery paths, portfolio transparency.",
    },
    href: "/academy/advanced/A7",
    featureFlag: "advancedAssessedEnabled",
    lessons: [
      lesson({
        id: "A7-L1",
        stages: [7],
        title: {
          fa: "اندازه روی equity جاری",
          en: "Current-equity sizing and units",
        },
        core: {
          fa: "بودجه بعدی = equity جاری × ۱٪.",
          en: "Next budget = current equity × 1%.",
        },
        trap: {
          fa: "تله: بودجه ثابت روی equity اولیه.",
          en: "Trap: freezing budget on starting equity.",
        },
        reality: {
          fa: "هر گام بودجه را از equity جاری می‌سازد.",
          en: "Each step rebuilds budget from current equity.",
        },
        question: {
          fa: "بعد از −۱٪ از ۱۰۰۰۰ بودجه بعدی؟",
          en: "After −1% from 10000, next budget?",
        },
      }),
      lesson({
        id: "A7-L2",
        stages: [7],
        title: { fa: "Drawdown و recovery", en: "Drawdown and recovery" },
        core: {
          fa: "recoveryPct = (peak/equity − ۱)×۱۰۰؛ در صفر null.",
          en: "recoveryPct = (peak/equity − 1)×100; null at zero.",
        },
        trap: {
          fa: "تله: فرض تضمین سقف ۱٪ تحقق‌یافته.",
          en: "Trap: assuming a guaranteed 1% realized cap.",
        },
        reality: {
          fa: "گپ می‌تواند STOP_GAP_LOSS بسازد.",
          en: "Gaps can create STOP_GAP_LOSS.",
        },
        question: {
          fa: "جبران ۲۰٪ افت به چند٪ رشد نیاز دارد؟",
          en: "What gain recovers a 20% drawdown?",
        },
      }),
      lesson({
        id: "A7-L3",
        stages: [7],
        title: {
          fa: "شوک مشترک پرتفوی",
          en: "Shared portfolio shocks",
        },
        core: {
          fa: "جمع دلار stop و درصد را گزارش کنید؛ سقف ساختگی نسازید.",
          en: "Sum stop dollars and %; invent no portfolio cap.",
        },
        trap: {
          fa: "تله: ادعای تنوع بدون مدل.",
          en: "Trap: claiming diversification credit without a model.",
        },
        reality: {
          fa: "شفافیت تمرکز ≠ ممنوعیت ساختگی.",
          en: "Concentration transparency ≠ fabricated prohibition.",
        },
        question: {
          fa: "۳×۱۰۰ روی ۱۰۰۰۰ چند درصد است؟",
          en: "3×100 on 10000 is what percent?",
        },
      }),
    ],
    quiz: A7_QUIZ,
    practicalTask: {
      fa: "مسیر سه −۱٪ را بازپخش کنید و یک مثال گپ STOP_GAP_LOSS را برچسب بزنید.",
      en: "Replay three −1% steps and label a STOP_GAP_LOSS gap example.",
    },
  },
  {
    id: "A8",
    stages: [8],
    title: {
      fa: "A8 — کپستون چنددارایی",
      en: "A8 — Cross-Asset Capstone",
    },
    summary: {
      fa: "تز point-in-time، مشاهدات شرطی، ضدشواهد و بازبینی.",
      en: "Point-in-time release thesis, conditional observations, counterevidence and review.",
    },
    href: "/academy/advanced/A8",
    featureFlag: "advancedAssessedEnabled",
    lessons: [
      lesson({
        id: "A8-L1",
        stages: [8],
        title: {
          fa: "تز انتشار point-in-time",
          en: "Point-in-time release thesis",
        },
        core: {
          fa: "actual پیش از release تهی است؛ forecast باید از قبل موجود باشد.",
          en: "Pre-release actual is null; forecast must pre-exist.",
        },
        trap: {
          fa: "تله: بازنویسی گذشته با revision آینده.",
          en: "Trap: rewriting history with future revisions.",
        },
        reality: {
          fa: "اسنپ‌شات vintage جدا می‌ماند.",
          en: "Vintage snapshots stay separate.",
        },
        question: {
          fa: "قبل از release مقدار actual؟",
          en: "Actual value before release?",
        },
      }),
      lesson({
        id: "A8-L2",
        stages: [8],
        title: {
          fa: "مشاهدات شرطی",
          en: "Conditional observations",
        },
        core: {
          fa: "بازه‌های ۰–۵/۵–۱۵/۱۵–۶۰ با baseline و تحمل تألیف‌شده.",
          en: "0–5/5–15/15–60 with authored baseline and tolerance.",
        },
        trap: {
          fa: "تله: درون‌یابی با نمونه آینده.",
          en: "Trap: interpolating with future samples.",
        },
        reality: {
          fa: "نقطه مفقود → null با دلیل.",
          en: "Missing points → null with reasons.",
        },
        question: {
          fa: "اگر Gold15m نباشد چه می‌شود؟",
          en: "If Gold 15m is missing, what happens?",
        },
      }),
      lesson({
        id: "A8-L3",
        stages: [8],
        title: {
          fa: "ضدشواهد و بازبینی",
          en: "Counterevidence and review",
        },
        core: {
          fa: "حداقل دو بسته؛ فریز قبل از هر افشا.",
          en: "At least two packets; freeze before each reveal.",
        },
        trap: {
          fa: "تله: ورود/SL/TP از یک چاپ.",
          en: "Trap: inventing entry/SL/TP from one print.",
        },
        reality: {
          fa: "CONTEXT_ONLY؛ منتور جدا از نمره عینی.",
          en: "CONTEXT_ONLY; mentor separate from objective score.",
        },
        question: {
          fa: "حداقل چند بسته تألیف‌شده؟",
          en: "Minimum authored packets?",
        },
      }),
    ],
    quiz: A8_QUIZ,
    practicalTask: {
      fa: "دو بسته synthetic را فریز/افشا کنید و بازده‌های پنجره‌ای را با دلیل نقص ثبت کنید.",
      en: "Freeze/reveal two synthetic packets and log window returns with incompleteness reasons.",
    },
  },
];

export function getAdvanced(id: string): AdvancedModuleDef | undefined {
  return advancedModules.find((m) => m.id === id);
}

export function advancedForStage(stage: StageId): AdvancedModuleDef[] {
  return advancedModules.filter((m) => m.stages.includes(stage));
}
