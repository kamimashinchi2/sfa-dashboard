"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { X } from "lucide-react";
import {
  SYNTHETIC_GOLD_SPEC,
  type RiskResult,
} from "../../lib/academy/contracts";
import { draftToRiskPrices, evaluateRisk, explainRiskStatus } from "../../lib/academy/risk";
import { buildDescriptiveGrid } from "../../lib/academy/grid";
import { unsafeRiskExample } from "../../lib/academy/fixtures";
import { useProgress } from "./ProgressProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  onResult?: (result: RiskResult) => void;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function computeRisk(
  equity: string,
  riskPct: string,
  entry: string,
  stop: string,
  target: string,
): RiskResult {
  const draft = draftToRiskPrices({ equity, riskPct, entry, stop, target });
  return evaluateRisk({
    spec: SYNTHETIC_GOLD_SPEC,
    equity: draft.equity,
    accountCurrency: "USD",
    conversion: "1",
    conversionUnits: "ACCOUNT_PER_PNL",
    direction: "LONG",
    entry: draft.entry,
    stop: draft.stop,
    target: draft.target,
    stopType: "HARD_STRUCTURAL",
    structuralEvidenceIds: ["ev-ui-1"],
    preEntry: "YES",
    riskPct: draft.riskPct,
    submittedLots: null,
    costs: {
      status: "KNOWN",
      fixedFee: "0",
      feePerLot: "0",
      slippageTicks: "0",
      pricesIncludeSpread: "YES",
    },
  });
}

export default function RiskGridCalculator({ open, onClose, onResult }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);
  const { progress } = useProgress();
  const locale = progress.locale;

  const [equity, setEquity] = useState("10000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("2500");
  const [stop, setStop] = useState("2492");
  const [target, setTarget] = useState("2516");
  const [anchor, setAnchor] = useState("2500");

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const t = window.setTimeout(() => closeRef.current?.focus(), 0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = previousOverflow;
      if (openerRef.current instanceof HTMLElement) {
        openerRef.current.focus();
      }
    };
  }, [open]);

  const result = useMemo(
    () => computeRisk(equity, riskPct, entry, stop, target),
    [equity, riskPct, entry, stop, target],
  );

  const runEval = () => {
    const evaluated = computeRisk(equity, riskPct, entry, stop, target);
    onResult?.(evaluated);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const nodes = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((el) => !el.hasAttribute("disabled"));
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const loadUnsafe = () => {
    setEquity(unsafeRiskExample.equity);
    setRiskPct(unsafeRiskExample.riskPct);
    setEntry(unsafeRiskExample.entry);
    setStop(unsafeRiskExample.stop);
    setTarget(unsafeRiskExample.target);
  };

  const grid = buildDescriptiveGrid(anchor);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-ink/70"
        inert
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-line bg-ink-elevated shadow-[-24px_0_60px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5">
          <div>
            <p className="text-[10px] tracking-[0.22em] text-teal-bright uppercase">
              SYNTHETIC ONLY
            </p>
            <h2 id={titleId} className="mt-2 font-display text-2xl text-paper">
              {locale === "fa" ? "ماشین‌حساب ریسک / شبکه" : "Risk Grid Calculator"}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label={locale === "fa" ? "بستن" : "Close"}
            onClick={onClose}
            className="min-h-11 min-w-11 border border-line p-2 text-fog hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <p className="text-sm text-fog">
            {locale === "fa"
              ? "ورودی خالی صفر نیست. ۲٪ = HARD_BLOCK بدون clamp خاموش."
              : "Empty input ≠ zero. 2% requests HARD_BLOCK — never silent clamp."}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["equity", equity, setEquity, "Equity"],
                ["riskPct", riskPct, setRiskPct, "Risk %"],
                ["entry", entry, setEntry, "Entry"],
                ["stop", stop, setStop, "Stop"],
                ["target", target, setTarget, "Target"],
              ] as const
            ).map(([key, value, setter, label]) => (
              <label key={key} className="block text-[10px] tracking-[0.16em] text-fog uppercase">
                {label}
                <input
                  className="mt-2 min-h-11 w-full border border-line bg-ink px-3 font-mono text-sm text-paper outline-none focus:border-gold/50"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  inputMode="decimal"
                />
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runEval}
              className="min-h-11 bg-gold px-4 text-sm font-semibold text-ink"
            >
              {locale === "fa" ? "ارزیابی" : "Evaluate"}
            </button>
            <button
              type="button"
              onClick={loadUnsafe}
              className="min-h-11 border border-line px-4 text-sm text-fog"
            >
              {locale === "fa" ? "مثال ناامن ۲٪" : "Load unsafe 2% example"}
            </button>
          </div>

          <div className="border border-line bg-ink/50 p-4 text-sm" aria-live="polite">
            <p
              className={
                result.status === "PASS_SIMULATION"
                  ? "font-mono text-teal-bright"
                  : result.status === "HARD_BLOCK"
                    ? "font-mono text-red-400"
                    : "font-mono text-gold-soft"
              }
            >
              {result.status}
            </p>
            <p className="mt-2 text-fog">{explainRiskStatus(result.status)}</p>
            <dl className="mt-3 space-y-1 font-mono text-xs text-paper">
              <div>maxLots: {result.maxLots ?? "—"}</div>
              <div>loss: {result.loss ?? "—"}</div>
              <div>grossRR: {result.grossRR ?? "—"}</div>
              <div>netRR: {result.netRR ?? "—"}</div>
            </dl>
            <ul className="mt-3 space-y-1 text-xs text-fog">
              {result.issues.map((i) => (
                <li key={`${i.code}-${i.field}`}>
                  {i.code}
                  {i.field ? ` · ${i.field}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-fog">
              Stops do not guarantee loss caps through gaps; margin sufficiency is separate.
            </p>
          </div>

          <div>
            <label className="block text-[10px] tracking-[0.16em] text-fog uppercase">
              Grid anchor (visible scenario)
              <input
                className="mt-2 min-h-11 w-full border border-line bg-ink px-3 font-mono text-sm text-paper"
                value={anchor}
                onChange={(e) => setAnchor(e.target.value)}
              />
            </label>
            <p className="mt-2 text-xs text-fog">
              Descriptive geometry only — not direction, targets, or signals.
            </p>
            {grid.ok ? (
              <ul className="mt-3 max-h-40 overflow-auto font-mono text-[11px] text-fog">
                {grid.lines.slice(0, 24).map((l) => (
                  <li key={`${l.kind}-${l.k}-${l.price}`}>
                    {l.kind} k={l.k} → {l.price}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-red-400">{grid.reason}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
