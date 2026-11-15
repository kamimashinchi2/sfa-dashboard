import type { AdvancedId, Lesson, StageId, Text } from "./contracts";
import type { QuizItem } from "./curriculum";
import { LESSON_PATCH } from "./weekLessons";
import { A6_QUIZ, A7_QUIZ, A8_QUIZ } from "./weekQuizzes";

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
    ...(LESSON_PATCH[rest.id] ?? {}),
  };
}

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
