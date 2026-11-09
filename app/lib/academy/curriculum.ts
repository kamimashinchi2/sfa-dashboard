import type { Lesson, MissionId, StageId, Text } from "./contracts";
import {
  ASSESSMENT_CRITERIA_VERSION,
  M2_QUIZ,
  M3_QUIZ,
  M4_QUIZ,
  M5_QUIZ,
} from "./quizzes";

export type QuizItem = {
  id: string;
  kind: "mc" | "numeric" | "order";
  prompt: Text;
  /** For MC: options; for order: items to order */
  options?: Text[];
  /** Correct option index, numeric string, or ordered option indices */
  answer: number | string | number[];
  rationale: Text;
  remediationTopic: string;
};

export { ASSESSMENT_CRITERIA_VERSION };

export type MissionDef = {
  id: MissionId;
  stages: StageId[];
  title: Text;
  summary: Text;
  href: string;
  deferred?: boolean;
  lessons: Lesson[];
  quiz: QuizItem[];
  practicalTask: Text;
};

export const stageTitles: Record<StageId, Text> = {
  1: {
    fa: "مبانی و مکانیک FX",
    en: "FX Foundations & Mechanics",
  },
  2: {
    fa: "نقدینگی و انواع سفارش",
    en: "Liquidity Pools & Order Types",
  },
  3: {
    fa: "سواد چارت و پرایس اکشن",
    en: "Chart Literacy & Price Action",
  },
  4: {
    fa: "کلان بنیادی و سیاست فدرال",
    en: "Fundamental Macro & Fed Policy",
  },
  5: {
    fa: "بین‌بازاری و انتقال بازده",
    en: "Intermarket & Yield Transmission",
  },
  6: {
    fa: "آزمون کمی و پژوهش",
    en: "Quantitative Testing & Research",
  },
  7: {
    fa: "انضباط ریسک و ریاضی شبیه‌سازی",
    en: "Risk Discipline & Simulation Math",
  },
  8: {
    fa: "دفتر کلان پایانی",
    en: "Capstone Macro Notebook",
  },
};

function lesson(
  partial: Omit<Lesson, "selfReviewRubric"> & { selfReviewRubric?: Text[] },
): Lesson {
  return {
    selfReviewRubric: partial.selfReviewRubric ?? [
      {
        fa: "آیا سازوکار را بدون تکیه به شعار توضیح دادم؟",
        en: "Did I explain the mechanism without slogan language?",
      },
      {
        fa: "آیا تله خرده‌فروشی را مشخص کردم؟",
        en: "Did I name the retail trap explicitly?",
      },
      {
        fa: "آیا واقعیت نهادی را از سیگنال ورود جدا کردم؟",
        en: "Did I keep institutional reality separate from entry signals?",
      },
    ],
    ...partial,
  };
}

export const missions: MissionDef[] = [
  {
    id: "M1",
    stages: [1],
    title: {
      fa: "M1 — مبانی قرارداد و جلسه",
      en: "M1 — Foundations & Contract Cards",
    },
    summary: {
      fa: "پایه/نقل، bid/ask، اسپرد، pip/tick/lot، مارجین در برابر ریسک، جلسات، اسپات در برابر فیوچرز.",
      en: "Base/quote, bid/ask, spread, pip/tick/lot, margin vs risk, sessions, spot vs futures.",
    },
    href: "/academy/missions/M1",
    lessons: [
      lesson({
        id: "M1-L1",
        missionId: "M1",
        stages: [1],
        title: {
          fa: "پایه، نقل و اسپرد",
          en: "Base, quote and spread",
        },
        core: {
          fa: "در جفت ارز، ارز پایه در برابر ارز نقل قیمت‌گذاری می‌شود؛ اسپرد فاصله bid و ask است و هزینه معامله است نه سیگنال.",
          en: "In an FX pair the base is priced in the quote; spread is bid–ask distance — a cost, not a signal.",
        },
        trap: {
          fa: "تله خرده‌فروشی: تعقیب کندل بدون محاسبه هزینه اسپرد و ارزش pip.",
          en: "Retail trap: chasing candles without pricing spread cost and pip value.",
        },
        reality: {
          fa: "میزهای نهادی اول هزینه اجرا و نقدینگی جلسه را اندازه می‌گیرند؛ بعد ساختار.",
          en: "Institutional desks size execution cost and session liquidity before structure.",
        },
        question: {
          fa: "اگر فقط ask را ببینید و bid را نادیده بگیرید، کدام هزینه پنهان می‌ماند؟",
          en: "If you only watch the ask and ignore the bid, which cost stays hidden?",
        },
      }),
      lesson({
        id: "M1-L2",
        missionId: "M1",
        stages: [1],
        title: {
          fa: "مارجین در برابر بودجه ریسک",
          en: "Margin versus risk budget",
        },
        core: {
          fa: "مارجین وثیقه کارگزاری است؛ بودجه ریسک (مثلاً ۱٪) محدودیت زیان برنامه‌ریزی‌شده است و جایگزین هم نیستند.",
          en: "Margin is broker collateral; a risk budget (e.g. 1%) is planned loss capacity — they are not substitutes.",
        },
        trap: {
          fa: "تله: «مارجین دارم پس اندازه را بالا ببرم» بدون سقف ۱٪.",
          en: "Trap: “I have margin so I can size up” without the 1% ceiling.",
        },
        reality: {
          fa: "واقعیت نهادی: اهرم در دسترس ≠ مجوز ریسک؛ اندازه از stop و بودجه می‌آید.",
          en: "Institutional reality: available leverage ≠ risk permission; size comes from stop and budget.",
        },
        question: {
          fa: "چرا مارجین آزاد نمی‌تواند به‌تنهایی lot را توجیه کند؟",
          en: "Why can free margin alone never justify lot size?",
        },
      }),
    ],
    quiz: [
      {
        id: "M1-Q1",
        kind: "mc",
        prompt: {
          fa: "اسپرد عمدتاً چیست؟",
          en: "Spread is primarily:",
        },
        options: [
          { fa: "سیگنال ورود", en: "An entry signal" },
          { fa: "هزینه معامله", en: "A trading cost" },
          { fa: "تأیید MSS", en: "MSS confirmation" },
          { fa: "هدف سود", en: "A profit target" },
        ],
        answer: 1,
        rationale: {
          fa: "اسپرد فاصله bid/ask و هزینه اجراست.",
          en: "Spread is the bid/ask gap — an execution cost.",
        },
        remediationTopic: "spread-cost",
      },
      {
        id: "M1-Q2",
        kind: "numeric",
        prompt: {
          fa: "اگر ریسک ۱٪ روی ۱۰٬۰۰۰ باشد، بودجه چند دلار است؟",
          en: "At 1% risk on 10,000 equity, what is the dollar budget?",
        },
        answer: "100",
        rationale: {
          fa: "۱۰۰۰۰ × ۰٫۰۱ = ۱۰۰",
          en: "10000 × 0.01 = 100",
        },
        remediationTopic: "risk-budget",
      },
      {
        id: "M1-Q3",
        kind: "mc",
        prompt: {
          fa: "هم‌پوشانی لندن–نیویورک بیشتر چه چیزی را افزایش می‌دهد؟",
          en: "The London–New York overlap most increases:",
        },
        options: [
          { fa: "مارجین اجباری", en: "Forced margin" },
          { fa: "نقدینگی جلسه", en: "Session liquidity" },
          { fa: "نرخ بهره فدرال", en: "Fed funds rate" },
          { fa: "حداقل lot", en: "Minimum lot size" },
        ],
        answer: 1,
        rationale: {
          fa: "هم‌پوشانی اوج مشارکت و نقدینگی را می‌آورد.",
          en: "Overlap concentrates participation and liquidity.",
        },
        remediationTopic: "sessions",
      },
      {
        id: "M1-Q4",
        kind: "mc",
        prompt: {
          fa: "قرارداد synthetic طلای آکادمی چند اونس در هر lot فرض می‌کند؟",
          en: "The Academy synthetic gold contract assumes how many oz per lot?",
        },
        options: [
          { fa: "1", en: "1" },
          { fa: "10", en: "10" },
          { fa: "100", en: "100" },
          { fa: "1000", en: "1000" },
        ],
        answer: 2,
        rationale: {
          fa: "مشخصات آموزشی: ۱۰۰ oz/lot.",
          en: "Educational spec: 100 oz/lot.",
        },
        remediationTopic: "contract-card",
      },
      {
        id: "M1-Q5",
        kind: "mc",
        prompt: {
          fa: "اسپات در برابر فیوچرز: کدام درست است؟",
          en: "Spot versus futures — which is true?",
        },
        options: [
          {
            fa: "همیشه یک قیمت یکسان دارند",
            en: "They always share one identical price",
          },
          {
            fa: "فیوچرز سررسید و مشخصات قرارداد دارد",
            en: "Futures carry expiry and contract specs",
          },
          {
            fa: "اسپات همیشه بدون اسپرد است",
            en: "Spot never has spread",
          },
          {
            fa: "فیوچرز یعنی بدون مارجین",
            en: "Futures means no margin",
          },
        ],
        answer: 1,
        rationale: {
          fa: "فیوچرز مشخصات، سررسید و مدل تحویل دارد.",
          en: "Futures embed specs, expiry and delivery models.",
        },
        remediationTopic: "spot-futures",
      },
      {
        id: "M1-Q6",
        kind: "order",
        prompt: {
          fa: "ترتیب درست آماده‌سازی قبل از اندازه:",
          en: "Correct prep order before sizing:",
        },
        options: [
          { fa: "تعیین بودجه ریسک", en: "Set risk budget" },
          { fa: "تعیین stop ساختاری", en: "Define structural stop" },
          { fa: "محاسبه lot", en: "Compute lots" },
          { fa: "ارسال سفارش", en: "Send order" },
        ],
        answer: [0, 1, 2, 3],
        rationale: {
          fa: "بودجه → stop → lot → اجرا.",
          en: "Budget → stop → lots → execution.",
        },
        remediationTopic: "sizing-order",
      },
      {
        id: "M1-Q7",
        kind: "mc",
        prompt: {
          fa: "pip و tick در همه قراردادها همیشه مساوی‌اند؟",
          en: "Are pip and tick always identical across contracts?",
        },
        options: [
          { fa: "بله", en: "Yes" },
          { fa: "خیر — به مشخصات قرارداد بستگی دارد", en: "No — depends on contract specs" },
        ],
        answer: 1,
        rationale: {
          fa: "باید tickSize قرارداد را بخوانید.",
          en: "Read the contract tickSize.",
        },
        remediationTopic: "pip-tick",
      },
      {
        id: "M1-Q8",
        kind: "numeric",
        prompt: {
          fa: "اگر tickSize طلا ۰٫۰۱ و فاصله stop برابر ۸ باشد، چند tick است؟",
          en: "Gold tickSize 0.01 and stop distance 8 → how many ticks?",
        },
        answer: "800",
        rationale: {
          fa: "۸ / ۰٫۰۱ = ۸۰۰",
          en: "8 / 0.01 = 800",
        },
        remediationTopic: "tick-math",
      },
      {
        id: "M1-Q9",
        kind: "mc",
        prompt: {
          fa: "کدام جمله درست است؟",
          en: "Which statement is correct?",
        },
        options: [
          {
            fa: "مارجین سقف زیان ۱٪ را تضمین می‌کند",
            en: "Margin guarantees the 1% loss cap",
          },
          {
            fa: "بودجه ریسک از equity و risk% ساخته می‌شود",
            en: "Risk budget is built from equity and risk%",
          },
        ],
        answer: 1,
        rationale: {
          fa: "بودجه = equity × risk%/100",
          en: "Budget = equity × risk%/100",
        },
        remediationTopic: "risk-budget",
      },
      {
        id: "M1-Q10",
        kind: "mc",
        prompt: {
          fa: "داده‌های این پورتال چه برچسبی باید داشته باشند؟",
          en: "Portal data must be labeled:",
        },
        options: [
          { fa: "تاریخی تأییدشده", en: "Verified historical" },
          { fa: "SYNTHETIC / شبیه‌سازی‌شده", en: "SYNTHETIC / شبیه‌سازی‌شده" },
        ],
        answer: 1,
        rationale: {
          fa: "همه فیکسچرها آموزشی و synthetic هستند.",
          en: "All fixtures are educational and synthetic.",
        },
        remediationTopic: "synthetic-label",
      },
    ],
    practicalTask: {
      fa: "کارت قرارداد synthetic طلا را کامل کنید و بودجه ۱٪ برای equity=10000 را بنویسید.",
      en: "Complete the synthetic gold contract card and write the 1% budget for equity=10000.",
    },
  },
  {
    id: "M2",
    stages: [2, 3],
    title: {
      fa: "M2 — نقدینگی و انواع سفارش",
      en: "M2 — Liquidity & Order Types",
    },
    summary: {
      fa: "مکان‌ها، شرکت‌کنندگان، Limit/Stop، لغزش، PDH/PDL، سوئیپ در برابر تأیید.",
      en: "Venues, participants, Limit/Stop, slippage, PDH/PDL, sweep vs confirmation.",
    },
    href: "/academy/missions/M2",
    lessons: [
      lesson({
        id: "M2-L1",
        missionId: "M2",
        stages: [2, 3],
        title: {
          fa: "سوئیپ در برابر تأیید",
          en: "Sweep versus confirmation",
        },
        core: {
          fa: "سوئیپ نقدینگی فراتر از سوئینگ می‌تواند مقدمه جابه‌جایی باشد؛ به‌تنهایی ورود نیست.",
          en: "A liquidity sweep beyond a swing can precede displacement; alone it is not an entry.",
        },
        trap: {
          fa: "تله: ورود دقیقاً روی فتیله سوئیپ بدون بسته شدن ساختاری.",
          en: "Trap: entering on the sweep wick without closed structural confirmation.",
        },
        reality: {
          fa: "واقعیت: تأیید بعد از جابه‌جایی و شواهد فریم بسته معنا دارد.",
          en: "Reality: confirmation matters after displacement on closed-frame evidence.",
        },
        question: {
          fa: "چرا لمس فتیله به‌تنهایی fill شدن سفارش را ثابت نمی‌کند؟",
          en: "Why does a wick touch alone not prove an order fill?",
        },
      }),
    ],
    quiz: M2_QUIZ,
    practicalTask: {
      fa: "روی فیکسچر synthetic، یک PDH و یک سوئیپ را علامت بزنید و نوع سفارش پیشنهادی را بنویسید (بدون اجرای واقعی).",
      en: "On the synthetic fixture, mark one PDH and one sweep and name the intended order type (no live execution).",
    },
  },
  {
    id: "M3",
    stages: [3, 7],
    title: {
      fa: "M3 — ستاپ و ریسک",
      en: "M3 — Setup & Risk",
    },
    summary: {
      fa: "ریپلی، MSS بسته‌شده، جابه‌جایی، FVG/OB، مومنتوم/ریتریس، stop ساختاری و اندازه.",
      en: "Replay, closed MSS, displacement, FVG/OB, momentum/retracement, structural SL and sizing.",
    },
    href: "/academy/missions/M3",
    lessons: [
      lesson({
        id: "M3-L1",
        missionId: "M3",
        stages: [3, 7],
        title: {
          fa: "Stop ساختاری و سقف ۱٪",
          en: "Structural stop and the 1% cap",
        },
        core: {
          fa: "Stop باید شواهد ساختاری داشته باشد؛ risk% بالای ۱٪ در شبیه‌سازی HARD_BLOCK است.",
          en: "Stops need structural evidence; risk% above 1% is HARD_BLOCK in simulation.",
        },
        trap: {
          fa: "تله: stop ذهنی یا گشاد کردن stop برای حفظ lot.",
          en: "Trap: mental stops or widening stops to keep lot size.",
        },
        reality: {
          fa: "اندازه از فاصله stop می‌آید؛ فاصله از اندازه پیروی نمی‌کند.",
          en: "Size follows stop distance; distance does not follow desired size.",
        },
        question: {
          fa: "اگر دانشجو ۲٪ درخواست کند، وضعیت صحیح موتور چیست؟",
          en: "If a student requests 2%, what is the correct engine status?",
        },
      }),
    ],
    quiz: M3_QUIZ,
    practicalTask: {
      fa: "در Risk Grid، مثال ناامن ارائه‌شده را رد/اصلاح کنید تا HARD_BLOCK برطرف شود.",
      en: "In the Risk Grid, reject/correct the provided unsafe example until HARD_BLOCK clears.",
    },
  },
  {
    id: "M4",
    stages: [4, 5],
    title: {
      fa: "M4 — زنجیره کلان",
      en: "M4 — Macro Transmission",
    },
    summary: {
      fa: "تورم Level/Direction/Momentum؛ Actual/Forecast/Previous/Revisions؛ NFP، JOLTS، Claims، Sahm — CONTEXT_ONLY.",
      en: "Inflation Level/Direction/Momentum; Actual/Forecast/Previous/Revisions; NFP, JOLTS, Claims, Sahm — CONTEXT_ONLY.",
    },
    href: "/academy/missions/M4",
    lessons: [
      lesson({
        id: "M4-L1",
        missionId: "M4",
        stages: [4, 5],
        title: {
          fa: "سورپرایز داده و انتقال مشروط",
          en: "Data surprise and conditional transmission",
        },
        core: {
          fa: "سورپرایز CPI فقط در صورت قیمت‌گذاری‌نشدن می‌تواند مسیر Fed repricing → yields → DXY/gold را فعال کند.",
          en: "A CPI surprise can activate Fed repricing → yields → DXY/gold only when not already priced in.",
        },
        trap: {
          fa: "تله: از یک چاپ، ورود طلا با SL/TP ساختن.",
          en: "Trap: turning one print into a gold entry with SL/TP.",
        },
        reality: {
          fa: "کلان CONTEXT_ONLY است؛ بدون Real Yields/DXY نمی‌توان bias طلا را اثبات کرد.",
          en: "Macro is CONTEXT_ONLY; missing Real Yields/DXY cannot prove a gold bias.",
        },
        question: {
          fa: "اگر TIPS و DXY غایب باشند، آیا bias طلا قابل اثبات است؟",
          en: "If TIPS and DXY evidence are missing, can a gold bias be proven?",
        },
      }),
    ],
    quiz: M4_QUIZ,
    practicalTask: {
      fa: "گراف شرطی synthetic CPI را با یکی از کلیدهای پذیرفته‌شده هم‌تراز کنید — بدون entry/SL/TP.",
      en: "Align the synthetic CPI conditional graph to an accepted key — no entry/SL/TP.",
    },
  },
  {
    id: "M5",
    stages: [6, 7, 8],
    title: {
      fa: "M5 — پژوهش و ژورنال (capstone-lite)",
      en: "M5 — Research & Journal (capstone-lite)",
    },
    summary: {
      fa: "فرضیه، ابطال، تقسیم train/test قبل از افشای نتیجه؛ هزینه، look-ahead، overfitting.",
      en: "Hypothesis, falsification, train/test split BEFORE outcome reveal; costs, look-ahead, overfitting.",
    },
    href: "/academy/missions/M5",
    lessons: [
      lesson({
        id: "M5-L1",
        missionId: "M5",
        stages: [6, 7, 8],
        title: {
          fa: "پیش‌ثبت فرضیه",
          en: "Preregister the hypothesis",
        },
        core: {
          fa: "قبل از دیدن نتیجه، فرضیه، ابطال و تقسیم داده را قفل کنید.",
          en: "Lock hypothesis, falsification and data split before seeing outcomes.",
        },
        trap: {
          fa: "تله: داستان‌سازی پس از دیدن نتیجه (HARKing).",
          en: "Trap: storytelling after the outcome (HARKing).",
        },
        reality: {
          fa: "پژوهش نهادی پیش‌ثبت را از داستان پسینی جدا می‌کند.",
          en: "Institutional research separates preregistration from post-hoc stories.",
        },
        question: {
          fa: "چرا افشای نتیجه قبل از train/test پژوهش را خراب می‌کند؟",
          en: "Why does revealing outcomes before train/test corrupt the research?",
        },
      }),
    ],
    quiz: M5_QUIZ,
    practicalTask: {
      fa: "پیش‌نویس ژورنال را با فرضیه/ابطال/اسپلیت پر و به‌صورت محلی export کنید.",
      en: "Fill the journal draft with hypothesis/falsification/split and export locally.",
    },
  },
];

export function getMission(id: string): MissionDef | undefined {
  return missions.find((m) => m.id === id);
}

export function missionsForStage(stage: StageId): MissionDef[] {
  return missions.filter((m) => m.stages.includes(stage));
}

/** Stages 1–8 remain PREVIEW-browsable even without earned progression. */
export const previewStages: StageId[] = [1, 2, 3, 4, 5, 6, 7, 8];
