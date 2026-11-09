"use client";

import { useMemo, useState } from "react";
import {
  sweepReversalFrames,
  sweepReversalScenario,
} from "../../lib/academy/fixtures";
import { evaluateSetup, validateAnnotations } from "../../lib/academy/setup";
import { ui, t } from "../../lib/academy/dictionary";
import { useProgress } from "./ProgressProvider";
import ReplayChart from "./ReplayChart";

export default function SetupValidator({
  onPracticalResult,
  readOnly,
}: {
  onPracticalResult?: (pass: boolean, evidence: Record<string, unknown>) => void;
  readOnly?: boolean;
}) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const [cursor, setCursor] = useState(0);
  const [markedPdh, setMarkedPdh] = useState(false);
  const [markedSweep, setMarkedSweep] = useState(false);
  const [orderType, setOrderType] = useState<
    "LIMIT" | "STOP" | "MARKET" | null
  >(null);
  const [annotationMsg, setAnnotationMsg] = useState<string | null>(null);

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
      <header className="space-y-1">
        <h2 className="font-display text-xl text-paper">
          Market Maker Scout v3.0 · SETUP_ONLY
        </h2>
        <p className="text-sm text-teal-bright">{t(ui.setupOnly, locale)}</p>
        <p className="text-xs text-fog">
          {locale === "fa"
            ? "فقط شواهد ساختار را توصیف می‌کند؛ مجوز معامله نیست؛ ریسک جداگانه بررسی می‌شود."
            : "Describes structure evidence only; not permission to trade; risk is reviewed separately."}
        </p>
      </header>
      <ReplayChart
        frames={sweepReversalFrames}
        cursor={cursor}
        onCursor={setCursor}
      />
      <div className="border border-line bg-ink/50 p-4" aria-live="polite">
        <p className="font-mono text-gold-soft">{result.state}</p>
        <ul className="mt-2 text-xs text-fog">
          {result.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 text-xs text-fog">
          <p className="text-teal-bright">
            {locale === "fa" ? "شواهد و مرزها" : "Evidence & boundaries"}
          </p>
          <p className="font-mono">
            momentum [{result.evidence.momentumBand?.low}–{result.evidence.momentumBand?.high}] ·
            retracement [{result.evidence.retracementZone?.low}–{result.evidence.retracementZone?.high}] ·
            chase {result.evidence.chaseBoundary} · inv {result.evidence.invalidationLevel}
          </p>
          <ul>
            {result.evidence.zones.map((z) => (
              <li key={z.id} className="font-mono">
                {z.kind} {z.id}: [{z.low}–{z.high}] known@{z.knownAtFrame} ev=
                {z.evidenceIds.join(",")}
              </li>
            ))}
            {result.evidence.zones.length === 0 ? (
              <li>NO_VISIBLE_ZONES_YET</li>
            ) : null}
          </ul>
          <p className="font-mono">
            facts:{" "}
            {Object.entries(result.evidence.observedFacts)
              .map(([k, v]) => `${k}:${v}`)
              .join(" ") || "—"}
          </p>
          <ul className="text-[11px] text-fog/80">
            {result.evidence.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </div>

      <fieldset className="border border-line p-4" disabled={readOnly}>
        <legend className="px-1 text-sm text-paper">
          {locale === "fa"
            ? "حاشیه PDH / سوئیپ و نوع سفارش"
            : "PDH / sweep annotation & order choice"}
        </legend>
        <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-fog">
          <input
            type="checkbox"
            checked={markedPdh}
            onChange={(e) => setMarkedPdh(e.target.checked)}
          />
          {locale === "fa" ? "علامت PDH روی شواهد" : "Mark PDH on evidence"}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-fog">
          <input
            type="checkbox"
            checked={markedSweep}
            onChange={(e) => setMarkedSweep(e.target.checked)}
          />
          {locale === "fa" ? "علامت سوئیپ روی شواهد" : "Mark sweep on evidence"}
        </label>
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Order type"
        >
          {(["LIMIT", "STOP", "MARKET"] as const).map((o) => (
            <label key={o} className="flex min-h-11 items-center gap-2 text-sm text-fog">
              <input
                type="radio"
                name="order-type"
                checked={orderType === o}
                onChange={() => setOrderType(o)}
              />
              {o}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 min-h-11 border border-gold/50 px-3 text-sm text-gold-soft"
          onClick={() => {
            const v = validateAnnotations({
              scenario: sweepReversalScenario,
              frames: sweepReversalFrames,
              cursor,
              markedPdh,
              markedSweep,
              orderType,
            });
            setAnnotationMsg(
              v.pass
                ? "ANNOTATION_PASS"
                : `ANNOTATION_FAIL: ${v.reasons.join(", ")}`,
            );
            onPracticalResult?.(v.pass, {
              markedPdh,
              markedSweep,
              orderType,
              cursor,
              state: result.state,
              reasons: v.reasons,
            });
          }}
        >
          {locale === "fa" ? "اعتبارسنجی حاشیه" : "Validate annotations"}
        </button>
        {annotationMsg ? (
          <p className="mt-2 font-mono text-xs text-gold-soft" aria-live="polite">
            {annotationMsg}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] text-fog">
          {locale === "fa"
            ? "تیک «تمرین کامل» به‌تنهایی صلاحیت عملی را ثابت نمی‌کند."
            : "A checked “task complete” box alone cannot prove practical competence."}
        </p>
      </fieldset>
    </div>
  );
}
