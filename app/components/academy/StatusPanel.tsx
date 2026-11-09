"use client";

import { Activity, Bot, Shield } from "lucide-react";
import { publicStageTitles } from "../../lib/academy/publicCatalog";
import { resolveBuildStamp } from "../../lib/academy/buildStamp";
import { t } from "../../lib/academy/dictionary";
import { earnedStageProgress } from "../../lib/academy/unlock";
import { useProgress } from "./ProgressProvider";

export default function StatusPanel() {
  const { progress, hydrated } = useProgress();
  const locale = progress.locale;
  const earned = earnedStageProgress(progress);
  const stamp = resolveBuildStamp();
  const stageLabel = hydrated
    ? `${locale === "fa" ? "مشاهده مرحله" : "Viewing Stage"} ${progress.selectedStage}: ${t(publicStageTitles[progress.selectedStage], locale)} · earned ${earned}`
    : locale === "fa"
      ? "…"
      : "…";

  return (
    <ul className="flex flex-wrap items-center gap-2 sm:gap-3">
      <li className="inline-flex items-center gap-2 border border-line bg-ink/40 px-2.5 py-1.5">
        <Activity className="h-3.5 w-3.5 text-teal-bright" aria-hidden />
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] tracking-[0.16em] text-fog uppercase">
            {locale === "fa" ? "وضعیت دانشجو" : "Student Status"}
          </span>
          <span className="max-w-[18rem] truncate font-mono text-[11px] text-gold-soft sm:text-xs">
            {stageLabel}
          </span>
          <span className="font-mono text-[10px] text-fog">{stamp.label}</span>
        </span>
      </li>
      <li className="inline-flex items-center gap-2 border border-line bg-ink/40 px-2.5 py-1.5">
        <Shield className="h-3.5 w-3.5 text-teal-bright" aria-hidden />
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] tracking-[0.16em] text-fog uppercase">
            {locale === "fa" ? "قاعده ریسک" : "Risk Rule"}
          </span>
          <span className="font-mono text-[11px] text-gold-soft sm:text-xs">
            1.0% Max Risk Cap
          </span>
        </span>
      </li>
      <li className="inline-flex items-center gap-2 border border-line bg-ink/40 px-2.5 py-1.5">
        <Bot className="h-3.5 w-3.5 text-teal-bright" aria-hidden />
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] tracking-[0.16em] text-fog uppercase">
            {locale === "fa" ? "منتور AI" : "Live AI Mentor"}
          </span>
          <span className="font-mono text-[11px] text-gold-soft sm:text-xs">
            Echo Online
          </span>
        </span>
      </li>
    </ul>
  );
}
