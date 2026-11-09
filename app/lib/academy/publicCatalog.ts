/**
 * Public marketing / outline catalog — safe for client bundles.
 * No lesson bodies, quiz prompts, options, or answer keys.
 */
import type { AdvancedId, MissionId, StageId, Text } from "./contracts";

export type PublicMissionOutline = {
  id: MissionId;
  stages: StageId[];
  title: Text;
  summary: Text;
  href: string;
  deferred?: boolean;
};

export type PublicAdvancedOutline = {
  id: AdvancedId;
  stages: StageId[];
  title: Text;
  summary: Text;
  href: string;
};

export const publicStageTitles: Record<StageId, Text> = {
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

export const publicMissions: PublicMissionOutline[] = [
  {
    id: "M1",
    stages: [1],
    title: {
      fa: "M1 — مکانیک و بودجه ریسک",
      en: "M1 — Mechanics & Risk Budget",
    },
    summary: {
      fa: "pip/tick، قرارداد synthetic، بودجه ۱٪، و برچسب داده آموزشی.",
      en: "pip/tick, synthetic contract, 1% budget, and educational data labels.",
    },
    href: "/academy/missions/M1",
  },
  {
    id: "M2",
    stages: [2, 3],
    title: {
      fa: "M2 — نقدینگی و انواع سفارش",
      en: "M2 — Liquidity & Order Types",
    },
    summary: {
      fa: "مکان‌ها، Limit/Stop، PDH/PDL، سوئیپ در برابر تأیید.",
      en: "Venues, Limit/Stop, PDH/PDL, sweep vs confirmation.",
    },
    href: "/academy/missions/M2",
  },
  {
    id: "M3",
    stages: [3, 7],
    title: {
      fa: "M3 — ستاپ و ریسک",
      en: "M3 — Setup & Risk",
    },
    summary: {
      fa: "MSS، جابه‌جایی، FVG/OB، stop ساختاری و اندازه.",
      en: "MSS, displacement, FVG/OB, structural SL and sizing.",
    },
    href: "/academy/missions/M3",
  },
  {
    id: "M4",
    stages: [4, 5],
    title: {
      fa: "M4 — کلان و انتقال",
      en: "M4 — Macro & Transmission",
    },
    summary: {
      fa: "Fed، بازده، و مسیر انتقال بین‌بازاری (آموزشی).",
      en: "Fed, yields, and intermarket transmission (educational).",
    },
    href: "/academy/missions/M4",
  },
  {
    id: "M5",
    stages: [6, 7, 8],
    title: {
      fa: "M5 — دفتر و روان‌شناسی تمرین",
      en: "M5 — Journal & Practice Psychology",
    },
    summary: {
      fa: "فرضیه، ابطال، عادت‌های تمرین بدون سیگنال زنده.",
      en: "Hypothesis, falsification, practice habits without live signals.",
    },
    href: "/academy/missions/M5",
  },
];

export const publicAdvanced: PublicAdvancedOutline[] = [
  {
    id: "A6",
    stages: [6],
    title: {
      fa: "A6 — آزمایشگاه پژوهش",
      en: "A6 — Research Lab",
    },
    summary: {
      fa: "فرضیه، پنجره زمانی، و آزمون کمی synthetic.",
      en: "Hypothesis, windows, and synthetic quantitative tests.",
    },
    href: "/academy/advanced/A6",
  },
  {
    id: "A7",
    stages: [7],
    title: {
      fa: "A7 — drawdown و انضباط",
      en: "A7 — Drawdown & Discipline",
    },
    summary: {
      fa: "مسیر زیان synthetic و سقف‌های انضباطی.",
      en: "Synthetic drawdown paths and discipline caps.",
    },
    href: "/academy/advanced/A7",
  },
  {
    id: "A8",
    stages: [8],
    title: {
      fa: "A8 — کپستون بین‌دارایی",
      en: "A8 — Cross-Asset Capstone",
    },
    summary: {
      fa: "ترکیب مهارت‌های قبلی در یک دفتر پایانی آموزشی.",
      en: "Combine prior skills into an educational capstone notebook.",
    },
    href: "/academy/advanced/A8",
  },
];

export function publicMissionOutline(
  id: string,
): PublicMissionOutline | undefined {
  return publicMissions.find((m) => m.id === id);
}

export function publicAdvancedOutline(
  id: string,
): PublicAdvancedOutline | undefined {
  return publicAdvanced.find((m) => m.id === id);
}

/**
 * Bridge / quiz-result stage binding (contracts.py MISSIONS).
 * M1..M5 → 1..5, A6..A8 → 6..8. Used for transport + content entitlement.
 */
export function bridgeStageForId(id: string): number | null {
  const map: Record<string, number> = {
    M1: 1,
    M2: 2,
    M3: 3,
    M4: 4,
    M5: 5,
    A6: 6,
    A7: 7,
    A8: 8,
  };
  return map[id] ?? null;
}

/**
 * Curriculum primary stage (stages[0]) for journal/UI registry.
 * Note: M5 primary is 6 in curriculum, while bridge stage for M5 is 5.
 */
export function curriculumPrimaryStage(id: string): number | null {
  const map: Record<string, number> = {
    M1: 1,
    M2: 2,
    M3: 3,
    M4: 4,
    M5: 6,
    A6: 6,
    A7: 7,
    A8: 8,
  };
  return map[id] ?? null;
}

/** @deprecated prefer bridgeStageForId for gating/transport */
export function stageNumberForId(id: string): number | null {
  return bridgeStageForId(id);
}
