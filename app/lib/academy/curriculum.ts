import type { Lesson, MissionId, PracticalPlan, StageId, Text } from "./contracts";
import { PLANS } from "./practicalPlans";
import { packLessons } from "./v3Lessons";
import { M1_QUIZ, M2_QUIZ, M3_QUIZ, M4_QUIZ, M5_QUIZ } from "./weekQuizzes";

export type QuizItem = {
  id: string;
  kind: "mc" | "numeric" | "order";
  prompt: Text;
  /** For MC: options; for order: items to order */
  options?: Text[];
  /**
   * Correct option index, numeric string, or ordered option indices.
   * Client-safe banks omit this — answers live in server/answerKeyData.
   * Server hydration and unit fixtures may set it.
   */
  answer?: number | string | number[];
  rationale: Text;
  remediationTopic: string;
};

export { ASSESSMENT_CRITERIA_VERSION } from "./assessmentVersion";

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
  practicalPlan?: PracticalPlan;
};

export const stageTitles: Record<StageId, Text> = {
  0: {
    fa: "آمادگی",
    en: "Readiness",
  },
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
    lessons: packLessons("L01", "M1"),
    quiz: M1_QUIZ,
    practicalTask: PLANS.M1.practicalTask,
    practicalPlan: PLANS.M1.practicalPlan,
  },
  {
    id: "M2",
    stages: [2],
    title: {
      fa: "M2 — نقدینگی و انواع سفارش",
      en: "M2 — Liquidity & Order Types",
    },
    summary: {
      fa: "مکان‌ها، شرکت‌کنندگان، Limit/Stop، لغزش، PDH/PDL، سوئیپ در برابر تأیید.",
      en: "Venues, participants, Limit/Stop, slippage, PDH/PDL, sweep vs confirmation.",
    },
    href: "/academy/missions/M2",
    lessons: packLessons("L02", "M2"),
    quiz: M2_QUIZ,
    practicalTask: PLANS.M2.practicalTask,
    practicalPlan: PLANS.M2.practicalPlan,
  },
  {
    id: "M3",
    stages: [3],
    title: {
      fa: "M3 — ستاپ و ریسک",
      en: "M3 — Setup & Risk",
    },
    summary: {
      fa: "ریپلی، MSS بسته‌شده، جابه‌جایی، FVG/OB، مومنتوم/ریتریس، stop ساختاری و اندازه.",
      en: "Replay, closed MSS, displacement, FVG/OB, momentum/retracement, structural SL and sizing.",
    },
    href: "/academy/missions/M3",
    lessons: packLessons("L03", "M3"),
    quiz: M3_QUIZ,
    practicalTask: PLANS.M3.practicalTask,
    practicalPlan: PLANS.M3.practicalPlan,
  },
  {
    id: "M4",
    stages: [4],
    title: {
      fa: "M4 — زنجیره کلان",
      en: "M4 — Macro Transmission",
    },
    summary: {
      fa: "تورم Level/Direction/Momentum؛ Actual/Forecast/Previous/Revisions؛ NFP، JOLTS، Claims، Sahm — CONTEXT_ONLY.",
      en: "Inflation Level/Direction/Momentum; Actual/Forecast/Previous/Revisions; NFP, JOLTS, Claims, Sahm — CONTEXT_ONLY.",
    },
    href: "/academy/missions/M4",
    lessons: packLessons("L04", "M4"),
    quiz: M4_QUIZ,
    practicalTask: PLANS.M4.practicalTask,
    practicalPlan: PLANS.M4.practicalPlan,
  },
  {
    id: "M5",
    stages: [5],
    title: PLANS.M5.title!,
    summary: PLANS.M5.summary!,
    href: "/academy/missions/M5",
    lessons: packLessons("L05", "M5"),
    quiz: M5_QUIZ,
    practicalTask: PLANS.M5.practicalTask,
    practicalPlan: PLANS.M5.practicalPlan,
  },
];

export function getMission(id: string): MissionDef | undefined {
  return missions.find((m) => m.id === id);
}

export function missionsForStage(stage: StageId): MissionDef[] {
  return missions.filter((m) => m.stages.includes(stage));
}

/** Stage 0 is public readiness. Stages 1–8 stay preview-browsable. */
export const previewStages: StageId[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
