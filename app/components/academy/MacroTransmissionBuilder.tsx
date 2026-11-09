"use client";

import { useMemo, useState } from "react";
import { cpiMacroAlternatives } from "../../lib/academy/fixtures";
import {
  SYNTHETIC_CPI_SEED,
  scoreMacroGraph,
  type MacroEdge,
  type MacroNodeId,
} from "../../lib/academy/macro";
import { t, ui } from "../../lib/academy/dictionary";
import { useProgress } from "./ProgressProvider";

const NODES: MacroNodeId[] = [
  "DATA",
  "SURPRISE_PRICED_IN",
  "FED_REPRICING",
  "US2Y",
  "US10Y",
  "TIPS_REAL_YIELDS",
  "DXY",
  "VIX",
  "GOLD",
  "US30",
];

export default function MacroTransmissionBuilder({
  onAssessedScore,
  readOnly,
}: {
  onAssessedScore?: (score: number | null, assessedCredit: boolean) => void;
  readOnly?: boolean;
}) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const [from, setFrom] = useState<MacroNodeId>("DATA");
  const [to, setTo] = useState<MacroNodeId>("SURPRISE_PRICED_IN");
  const [condition, setCondition] = useState("NOT_PRICED");
  const [edges, setEdges] = useState<MacroEdge[]>([]);
  const [fromPreset, setFromPreset] = useState(false);
  const [studentAuthored, setStudentAuthored] = useState(false);
  const [assumptions, setAssumptions] = useState("Surprise not priced in");
  const [conclusions, setConclusions] = useState(
    "Conditional USD bid window\nGold bias unproven without TIPS/DXY evidence completeness",
  );

  const scored = useMemo(
    () =>
      scoreMacroGraph(
        {
          edges,
          assumptions: assumptions
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          conclusions: conclusions
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          fromAnswerKeyPreset: fromPreset,
          studentAuthored,
        },
        cpiMacroAlternatives,
      ),
    [edges, assumptions, conclusions, fromPreset, studentAuthored],
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-teal-bright">{t(ui.contextOnly, locale)}</p>
      <div className="border border-line bg-ink/40 p-4 text-sm text-fog">
        <p className="font-mono text-xs text-gold-soft">
          CPI seed SYNTHETIC · actual {SYNTHETIC_CPI_SEED.actualPct}% · forecast{" "}
          {SYNTHETIC_CPI_SEED.forecastPct}% · surprise +{SYNTHETIC_CPI_SEED.surprisePp}pp
        </p>
        <p className="mt-2 text-xs">{SYNTHETIC_CPI_SEED.notice}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="text-xs text-fog">
          From
          <select
            className="mt-1 min-h-11 border border-line bg-ink px-2 text-paper"
            value={from}
            disabled={readOnly}
            onChange={(e) => setFrom(e.target.value as MacroNodeId)}
          >
            {NODES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fog">
          To
          <select
            className="mt-1 min-h-11 border border-line bg-ink px-2 text-paper"
            value={to}
            disabled={readOnly}
            onChange={(e) => setTo(e.target.value as MacroNodeId)}
          >
            {NODES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fog">
          Condition
          <input
            className="mt-1 min-h-11 border border-line bg-ink px-2 font-mono text-paper"
            value={condition}
            disabled={readOnly}
            onChange={(e) => setCondition(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="min-h-11 self-end border border-gold/50 px-3 text-sm text-gold-soft"
          disabled={readOnly}
          onClick={() => {
            setFromPreset(false);
            setStudentAuthored(true);
            setEdges((prev) => [...prev, { from, to, condition }]);
          }}
        >
          Add edge
        </button>
        <button
          type="button"
          className="min-h-11 self-end border border-line px-3 text-sm text-fog"
          disabled={readOnly}
          onClick={() => {
            setEdges(cpiMacroAlternatives[0].edges);
            setFromPreset(true);
            setStudentAuthored(false);
            setAssumptions(cpiMacroAlternatives[0].assumptions.join("\n"));
            setConclusions(cpiMacroAlternatives[0].conclusions.join("\n"));
          }}
        >
          Load answer-key preset (demo — no assessed credit)
        </button>
        <button
          type="button"
          className="min-h-11 self-end border border-line px-3 text-sm text-fog"
          disabled={readOnly}
          onClick={() => {
            setFromPreset(false);
            setStudentAuthored(true);
            setEdges([]);
          }}
        >
          Clear edges
        </button>
      </div>

      <ul className="font-mono text-xs text-fog">
        {edges.map((e, i) => (
          <li key={`${edgeKey(e)}-${i}`}>
            {e.from} → {e.to} [{e.condition}]
          </li>
        ))}
      </ul>

      <label className="block text-xs text-fog">
        Assumptions
        <textarea
          className="mt-1 min-h-20 w-full border border-line bg-ink px-3 py-2 text-sm text-paper"
          value={assumptions}
          disabled={readOnly}
          onChange={(e) => {
            setFromPreset(false);
            setAssumptions(e.target.value);
          }}
        />
      </label>
      <label className="block text-xs text-fog">
        Conclusions (never entry/SL/TP)
        <textarea
          className="mt-1 min-h-20 w-full border border-line bg-ink px-3 py-2 text-sm text-paper"
          value={conclusions}
          disabled={readOnly}
          onChange={(e) => {
            setFromPreset(false);
            setConclusions(e.target.value);
          }}
        />
      </label>

      <p className="font-mono text-sm text-gold-soft" aria-live="polite">
        {scored.status} · score {scored.score ?? "—"} · best{" "}
        {scored.bestAlternativeId ?? "—"} · assessedCredit=
        {String(scored.assessedCredit)}
        {scored.macroAsEntry ? " · MACRO_AS_ENTRY" : ""}
      </p>
      {scored.macroAsEntry ? (
        <div className="border border-red-400/40 bg-ink/50 p-3 text-sm text-red-300">
          <p className="font-mono text-xs">
            MACRO_AS_ENTRY: Macro is CONTEXT_ONLY, it describes pressure and
            environment, never entry/SL/TP
          </p>
          {scored.rewritePrompt ? (
            <p className="mt-2 text-xs text-gold-soft">{scored.rewritePrompt}</p>
          ) : null}
        </div>
      ) : null}
      {scored.notes
        .filter((n) => n.startsWith("MACRO_AS_ENTRY"))
        .map((n) => (
          <p key={n} className="text-xs text-red-300">
            {n}
          </p>
        ))}
      {scored.edgeFeedback.length ? (
        <ul className="space-y-1 text-xs text-fog">
          {scored.edgeFeedback.map((f) => (
            <li key={`${f.edge}-${f.status}`} className="font-mono">
              [{f.status}] {f.edge}: {f.reason}
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        className="min-h-11 border border-gold/50 px-3 text-sm text-gold-soft"
        disabled={readOnly}
        onClick={() =>
          onAssessedScore?.(
            scored.assessedCredit ? scored.score : null,
            scored.assessedCredit,
          )
        }
      >
        {locale === "fa" ? "ثبت نمره assessed" : "Commit assessed score"}
      </button>
    </div>
  );
}

function edgeKey(e: MacroEdge): string {
  return `${e.from}>${e.to}:${e.condition}`;
}
