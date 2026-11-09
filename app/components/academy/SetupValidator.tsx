"use client";

import { useMemo, useState } from "react";
import { sweepReversalFrames, sweepReversalScenario } from "../../lib/academy/fixtures";
import { evaluateSetup } from "../../lib/academy/setup";
import { ui, t } from "../../lib/academy/dictionary";
import { useProgress } from "./ProgressProvider";
import ReplayChart from "./ReplayChart";

export default function SetupValidator() {
  const { progress } = useProgress();
  const locale = progress.locale;
  const [cursor, setCursor] = useState(0);
  const result = useMemo(
    () =>
      evaluateSetup({
        scenario: sweepReversalScenario,
        frames: sweepReversalFrames,
        cursor,
        studentHypotheses: {},
      }),
    [cursor],
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-teal-bright">{t(ui.setupOnly, locale)}</p>
      <ReplayChart frames={sweepReversalFrames} cursor={cursor} onCursor={setCursor} />
      <div className="border border-line bg-ink/50 p-4" aria-live="polite">
        <p className="font-mono text-gold-soft">{result.state}</p>
        <ul className="mt-2 text-xs text-fog">
          {result.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
