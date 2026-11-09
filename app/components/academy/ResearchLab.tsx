"use client";

import { useMemo, useState } from "react";
import {
  evaluateResearch,
  lockHypothesis,
  researchFixtureHypothesis,
  RESEARCH_FIXTURE_ROWS,
  reviseHypothesis,
} from "../../lib/academy/research";
import { useProgress } from "./ProgressProvider";

const CLOCK = "2024-03-01T00:00:00.000Z";

export default function ResearchLab({ readOnly }: { readOnly?: boolean }) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const [hyp, setHyp] = useState(() => researchFixtureHypothesis());
  const [frozen, setFrozen] = useState(false);
  const [testRevealed, setTestRevealed] = useState(false);
  const [tunedAfter, setTunedAfter] = useState(false);

  const locked = hyp.lockedAt != null;

  const evald = useMemo(() => {
    if (!locked) return null;
    return evaluateResearch({
      hypothesis: hyp,
      rows: RESEARCH_FIXTURE_ROWS,
      parametersFrozen: frozen,
      tunedAfterTestReveal: tunedAfter,
      clockISO: CLOCK,
    });
  }, [hyp, locked, frozen, tunedAfter]);

  const trainRows = RESEARCH_FIXTURE_ROWS.filter(
    (r) => r.eventAt <= hyp.trainEnd,
  );

  return (
    <div className="space-y-4 border border-line bg-ink/30 p-4">
      <h3 className="font-display text-xl text-paper">
        {locale === "fa" ? "آزمایشگاه پژوهش (SYNTHETIC)" : "Research Lab (SYNTHETIC)"}
      </h3>
      <p className="text-xs text-fog">
        n=4 per partition · educational only · no Sharpe / durable-edge claims
      </p>
      <dl className="grid gap-2 text-xs text-fog sm:grid-cols-2">
        <div>
          <dt>claim</dt>
          <dd className="font-mono text-paper">{hyp.claim}</dd>
        </div>
        <div>
          <dt>version</dt>
          <dd className="font-mono text-gold-soft">
            v{hyp.version} parent={String(hyp.parentVersion)} digest=
            {hyp.canonicalDigest ?? "—"}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 border border-gold/50 px-3 text-sm text-gold-soft"
          disabled={readOnly || locked}
          onClick={() => setHyp((h) => lockHypothesis(h, CLOCK))}
        >
          Lock hypothesis
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-3 text-sm text-fog"
          disabled={readOnly || !locked}
          onClick={() => setFrozen(true)}
        >
          Freeze parameters
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-3 text-sm text-fog"
          disabled={readOnly || !frozen}
          onClick={() => setTestRevealed(true)}
        >
          Reveal TEST
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-3 text-sm text-fog"
          disabled={readOnly}
          onClick={() => {
            if (testRevealed) setTunedAfter(true);
            setHyp((h) =>
              reviseHypothesis(h, {
                parameterVersion: `p${h.version + 1}`,
                claim: `${h.claim} (revised)`,
              }),
            );
            setFrozen(false);
          }}
        >
          Revise (new version)
        </button>
      </div>

      <div className="text-xs text-fog">
        <p className="text-teal-bright">TRAIN only (pre-reveal)</p>
        <ul className="font-mono">
          {trainRows.map((r) => (
            <li key={r.id}>
              {r.id} gross={r.grossR} cost={r.costR}
            </li>
          ))}
        </ul>
        {testRevealed ? (
          <>
            <p className="mt-2 text-teal-bright">TEST partition</p>
            <ul className="font-mono">
              {RESEARCH_FIXTURE_ROWS.filter(
                (r) => r.eventAt >= hyp.testStart,
              ).map((r) => (
                <li key={r.id}>
                  {r.id} gross={r.grossR} cost={r.costR}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2">TEST hidden until freeze + reveal</p>
        )}
      </div>

      {evald ? (
        <div className="font-mono text-xs text-gold-soft" aria-live="polite">
          <p>
            TRAIN sum={evald.train?.sumNetR} mean={evald.train?.meanNetR} wins=
            {evald.train?.wins}/{evald.train?.n} PF=
            {evald.train?.profitFactor ?? evald.train?.profitFactorReason}
          </p>
          {testRevealed ? (
            <p>
              {evald.test?.label} sum={evald.test?.sumNetR} mean=
              {evald.test?.meanNetR} wins={evald.test?.wins}/{evald.test?.n} PF=
              {evald.test?.profitFactor ?? evald.test?.profitFactorReason}
            </p>
          ) : null}
          <ul>
            {evald.issues.map((i) => (
              <li key={`${i.field}-${i.code}`}>
                {i.code} · {i.field}
              </li>
            ))}
          </ul>
          {evald.contaminated ? <p>EXPLORATORY — untouched sample required</p> : null}
        </div>
      ) : null}
    </div>
  );
}
