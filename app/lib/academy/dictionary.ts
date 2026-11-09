import type { Locale, Text } from "./contracts";

export function t(text: Text, locale: Locale): string {
  return text[locale];
}

export const ui = {
  academyTitle: {
    fa: "آکادمی هوشمند بازارهای مالی",
    en: "Smart Financial Academy",
  },
  pilotNotice: {
    fa: "نسخه آزمایشی آموزشی محلی — داده‌ها شبیه‌سازی‌شده‌اند. هویت امن یا entitlement نیست.",
    en: "Local educational demo — data are SYNTHETIC. Practice state only; not secure identity or entitlement.",
  },
  syntheticBanner: {
    fa: "شبیه‌سازی‌شده / SYNTHETIC — واقعیت تاریخی نیست",
    en: "SYNTHETIC / شبیه‌سازی‌شده — not historical fact",
  },
  stagesPreview: {
    fa: "پیش‌نمایش مراحل (PREVIEW)",
    en: "Stage PREVIEW (browsable)",
  },
  missions: {
    fa: "مأموریت‌های آزمایشی",
    en: "Pilot missions",
  },
  localeToggle: {
    fa: "English",
    en: "فارسی",
  },
  riskHardBlock: {
    fa: "HARD_BLOCK — نقض قطعی قاعده",
    en: "HARD_BLOCK — proven rule violation",
  },
  riskUnverified: {
    fa: "UNVERIFIED — اطلاعات ناقص",
    en: "UNVERIFIED — missing information",
  },
  setupOnly: {
    fa: "ارزیابی ساختار: SETUP_ONLY",
    en: "Structure evaluates SETUP_ONLY",
  },
  contextOnly: {
    fa: "ارزیابی کلان: CONTEXT_ONLY — بدون ورود/حد ضرر/هدف",
    en: "Macro evaluates CONTEXT_ONLY — never entry/SL/TP",
  },
  audioUnavailable: {
    fa: "پخش صوتی در دسترس نیست (هنوز منتشر نشده)",
    en: "Audio briefing unavailable (not published)",
  },
  journalExport: {
    fa: "خروجی محلی Markdown/JSON",
    en: "Export local Markdown/JSON",
  },
  progressReset: {
    fa: "بازنشانی پیشرفت تمرین",
    en: "Reset practice progress",
  },
} as const satisfies Record<string, Text>;

export type UiKey = keyof typeof ui;
