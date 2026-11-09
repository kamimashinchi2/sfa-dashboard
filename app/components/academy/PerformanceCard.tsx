"use client";

import type { RiskStatus } from "../../lib/academy/contracts";
import { performanceCard } from "../../lib/academy/grading";
import { useProgress } from "./ProgressProvider";

export default function PerformanceCard({
  riskScore,
  technicalMacroScore,
  journalingScore,
  riskStatus,
}: {
  riskScore: number | null;
  technicalMacroScore: number | null;
  journalingScore: number | null;
  riskStatus: RiskStatus | null;
}) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const card = performanceCard({
    riskScore,
    technicalMacroScore,
    journalingScore,
    riskStatus,
  });

  return (
    <div className="border border-line bg-ink/40 p-4">
      <h3 className="font-display text-xl text-paper">
        {locale === "fa" ? "کارت عملکرد (مرور منتور)" : "Performance card (reviewer pillars)"}
      </h3>
      <p className="mt-2 text-xs text-fog">
        40% risk / 40% technical+macro / 20% journaling — psychology never auto-invented.
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-2 font-mono text-xs text-gold-soft">
        <div>risk: {card.pillars.risk ?? "—"}</div>
        <div>tech/macro: {card.pillars.technicalMacro ?? "—"}</div>
        <div>journal: {card.pillars.journaling ?? "—"}</div>
      </dl>
      <p className="mt-3 text-sm text-paper">
        Total {card.total ?? "—"} · {card.advancement}
      </p>
    </div>
  );
}
