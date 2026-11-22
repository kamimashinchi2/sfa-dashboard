import type { AdvancedId, Lesson, PracticalPlan, StageId, Text } from "./contracts";
import type { QuizItem } from "./curriculum";
import { PLANS } from "./practicalPlans";
import { packLessons } from "./v3Lessons";
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
  practicalPlan?: PracticalPlan;
};

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
    lessons: packLessons("L06", "A6"),
    quiz: A6_QUIZ,
    practicalTask: PLANS.A6.practicalTask,
    practicalPlan: PLANS.A6.practicalPlan,
  },
  {
    id: "A7",
    stages: [7],
    title: {
      fa: "A7 — آزمایشگاه equity و drawdown",
      en: "A7 — Equity Risk & Drawdown Lab",
    },
    summary: PLANS.A7.summary!,
    href: "/academy/advanced/A7",
    featureFlag: "advancedAssessedEnabled",
    lessons: packLessons("L07", "A7"),
    quiz: A7_QUIZ,
    practicalTask: PLANS.A7.practicalTask,
    practicalPlan: PLANS.A7.practicalPlan,
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
    lessons: packLessons("L08", "A8"),
    quiz: A8_QUIZ,
    practicalTask: PLANS.A8.practicalTask,
    practicalPlan: PLANS.A8.practicalPlan,
  },
];

export function getAdvanced(id: string): AdvancedModuleDef | undefined {
  return advancedModules.find((m) => m.id === id);
}

export function advancedForStage(stage: StageId): AdvancedModuleDef[] {
  return advancedModules.filter((m) => m.stages.includes(stage));
}
