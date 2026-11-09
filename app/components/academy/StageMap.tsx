"use client";

import Link from "next/link";
import type { StageId } from "../../lib/academy/contracts";
import { advancedForStage } from "../../lib/academy/advancedCurriculum";
import { missionsForStage, stageTitles } from "../../lib/academy/curriculum";
import { t, ui } from "../../lib/academy/dictionary";
import { earnedStageProgress } from "../../lib/academy/unlock";
import { useProgress } from "./ProgressProvider";

const STAGES = [1, 2, 3, 4, 5, 6, 7, 8] as StageId[];

export default function StageMap() {
  const { progress, setSelectedStage } = useProgress();
  const locale = progress.locale;
  const earned = earnedStageProgress(progress);

  return (
    <section aria-labelledby="stage-map-heading" className="space-y-4">
      <div>
        <p className="text-[10px] font-medium tracking-[0.22em] text-teal-bright uppercase">
          {t(ui.stagesPreview, locale)}
        </p>
        <h2 id="stage-map-heading" className="mt-2 font-display text-3xl text-paper">
          {locale === "fa" ? "نقشه هشت‌مرحله‌ای" : "Eight-stage map"}
        </h2>
        <p className="mt-2 text-xs text-fog">
          {locale === "fa"
            ? `پیشرفت کسب‌شده: ${earned} مأموریت · Viewing Stage ${progress.selectedStage} جدا از پیشرفت کسب‌شده است.`
            : `Earned progression: ${earned} mission(s) · Viewing Stage ${progress.selectedStage} is separate from earned progress.`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
        {STAGES.map((id) => {
          const active = progress.selectedStage === id;
          const linked = missionsForStage(id);
          const adv = advancedForStage(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedStage(id)}
              aria-current={active ? "true" : undefined}
              className={`min-h-11 border px-3 py-3 text-start transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                active
                  ? "border-gold/70 bg-gold/10 text-paper"
                  : "border-line bg-ink/30 text-fog hover:text-paper"
              }`}
            >
              <span className="block font-mono text-[10px] tracking-[0.2em] text-teal-bright uppercase">
                PREVIEW · {id}
                {active ? " · VIEWING" : ""}
              </span>
              <span className="mt-1.5 block font-display text-sm leading-snug">
                {t(stageTitles[id], locale)}
              </span>
              <span className="mt-2 block text-[11px] text-fog">
                {[...linked.map((m) => m.id), ...adv.map((a) => a.id)].join(", ") ||
                  (locale === "fa" ? "عمق بعدی" : "Deferred depth")}
              </span>
            </button>
          );
        })}
      </div>
      <div className="border border-line bg-ink/40 p-4">
        <p className="text-sm text-fog">
          {locale === "fa"
            ? "مأموریت‌ها / ماژول‌های مرتبط با مرحله انتخاب‌شده:"
            : "Missions / modules for selected stage:"}
        </p>
        <ul className="mt-3 space-y-2">
          {missionsForStage(progress.selectedStage).map((m) => (
            <li key={m.id}>
              <Link
                href={m.href}
                className="text-sm text-gold-soft underline-offset-4 hover:underline"
              >
                {t(m.title, locale)}
              </Link>
            </li>
          ))}
          {advancedForStage(progress.selectedStage).map((a) => (
            <li key={a.id}>
              <Link
                href={a.href}
                className="text-sm text-gold-soft underline-offset-4 hover:underline"
              >
                {t(a.title, locale)} (advanced)
              </Link>
            </li>
          ))}
          {missionsForStage(progress.selectedStage).length === 0 &&
          advancedForStage(progress.selectedStage).length === 0 ? (
            <li className="text-sm text-fog">
              {locale === "fa"
                ? "این مرحله در پایلوت به‌صورت پیش‌نمایش است."
                : "This stage is PREVIEW-only in the pilot."}
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
