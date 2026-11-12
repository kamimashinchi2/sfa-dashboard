"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  INSTRUMENT_PRESETS,
  customSpec,
  type CalcHistoryEntry,
  type ContractSpec,
  type Fact,
  type InstrumentPresetId,
  type RiskInput,
  type RiskResult,
  type StopType,
} from "../../lib/academy/contracts";
import {
  draftToRiskPrices,
  evaluateRisk,
  explainStopType,
} from "../../lib/academy/risk";
import { unsafeRiskExample } from "../../lib/academy/fixtures";
import {
  calcHistoryToSimRun,
  createPersistedStore,
  defaultCalcHistory,
  makeCalcHistoryEntry,
  pushCalcHistory,
  pushSimRun,
  simRunsStore,
  storageKey,
  type CalcHistoryStore,
} from "../../lib/academy/persist";
import { useProgress } from "./ProgressProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  onResult?: (result: RiskResult) => void;
  missionId?: string | null;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const calcStore = createPersistedStore<CalcHistoryStore>({
  key: storageKey("calcHistory"),
  version: 2,
  defaults: defaultCalcHistory,
  guard: (raw) => {
    if (!raw || typeof raw !== "object") {
      return { ok: false, value: null, reason: "BAD" };
    }
    const e = (raw as CalcHistoryStore).entries;
    if (!Array.isArray(e)) return { ok: false, value: null, reason: "BAD_ENTRIES" };
    return { ok: true, value: { entries: e.slice(0, 50) as CalcHistoryEntry[] } };
  },
});

function defaultPrices(preset: InstrumentPresetId): {
  entry: string;
  stop: string;
  target: string;
} {
  if (preset === "SYNTHETIC_EURUSD") {
    return { entry: "1.1000", stop: "1.0980", target: "1.1040" };
  }
  if (preset === "SYNTHETIC_USDJPY") {
    return { entry: "150.00", stop: "149.50", target: "151.00" };
  }
  return { entry: "2500", stop: "2492", target: "2516" };
}

export default function RiskGridCalculator({
  open,
  onClose,
  onResult,
  missionId = null,
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);
  const { progress } = useProgress();
  const locale = progress.locale;

  const [preset, setPreset] = useState<InstrumentPresetId>("SYNTHETIC_XAUUSD");
  const [accountCurrency] = useState("USD");
  const [conversion, setConversion] = useState("1");
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [stopType, setStopType] = useState<StopType>("HARD_STRUCTURAL");
  const [preEntry, setPreEntry] = useState<Fact>("UNKNOWN");
  const [equity, setEquity] = useState("10000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("2500");
  const [stop, setStop] = useState("2492");
  const [target, setTarget] = useState("2516");
  const [contractSize, setContractSize] = useState("100");
  const [pipSize, setPipSize] = useState("0.01");
  const [pipValue, setPipValue] = useState("1");
  const [lotStep, setLotStep] = useState("0.01");
  const [minLot, setMinLot] = useState("0.01");
  const [maxLot, setMaxLot] = useState("100");
  const [pnlCurrency, setPnlCurrency] = useState("USD");
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

  const applyPreset = (id: InstrumentPresetId) => {
    setPreset(id);
    if (id === "CUSTOM") return;
    const spec = INSTRUMENT_PRESETS[id];
    setContractSize(spec.contractSize);
    setPipSize(spec.pipSize);
    setPipValue(spec.pipValueQuotePerLot);
    setLotStep(spec.lotStep);
    setMinLot(spec.minLot);
    setMaxLot(spec.maxLot);
    setPnlCurrency(spec.pnlCurrency);
    setConversion(spec.pnlCurrency === accountCurrency ? "1" : "");
    const prices = defaultPrices(id);
    setEntry(prices.entry);
    setStop(prices.stop);
    setTarget(prices.target);
  };

  const activeSpec: ContractSpec = useMemo(() => {
    if (preset === "CUSTOM") {
      return customSpec({
        contractSize,
        pipSize,
        pipValueQuotePerLot: pipValue,
        tickSize: pipSize,
        tickValuePerLot: pipValue,
        lotStep,
        minLot,
        maxLot,
        pnlCurrency,
      });
    }
    return INSTRUMENT_PRESETS[preset];
  }, [
    preset,
    contractSize,
    pipSize,
    pipValue,
    lotStep,
    minLot,
    maxLot,
    pnlCurrency,
  ]);

  const parseConversion = (raw: string): string | null => {
    if (raw.trim() === "") return null;
    const normalized = raw.trim().replace(",", ".");
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
    return normalized.replace(/^0+(?=\d)/, "") || "0";
  };

  const buildInput = (): RiskInput => {
    const draft = draftToRiskPrices({ equity, riskPct, entry, stop, target });
    return {
      spec: activeSpec,
      equity: draft.equity,
      accountCurrency,
      conversion: parseConversion(conversion),
      conversionUnits: "ACCOUNT_PER_PNL",
      direction,
      entry: draft.entry,
      stop: draft.stop,
      target: draft.target,
      stopType,
      structuralEvidenceIds:
        stopType === "HARD_STRUCTURAL" ? ["ev-ui-1"] : [],
      preEntry,
      riskPct: draft.riskPct,
      submittedLots: null,
      costs: {
        status: "KNOWN",
        fixedFee: "0",
        feePerLot: "0",
        slippageTicks: "0",
        pricesIncludeSpread: "YES",
      },
    };
  };

  const result = useMemo(() => {
    const draft = draftToRiskPrices({ equity, riskPct, entry, stop, target });
    return evaluateRisk({
      spec: activeSpec,
      equity: draft.equity,
      accountCurrency,
      conversion: parseConversion(conversion),
      conversionUnits: "ACCOUNT_PER_PNL",
      direction,
      entry: draft.entry,
      stop: draft.stop,
      target: draft.target,
      stopType,
      structuralEvidenceIds:
        stopType === "HARD_STRUCTURAL" ? ["ev-ui-1"] : [],
      preEntry,
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
  }, [
    equity,
    riskPct,
    entry,
    stop,
    target,
    activeSpec,
    accountCurrency,
    conversion,
    direction,
    stopType,
    preEntry,
  ]);

  const persistResult = (evaluated: RiskResult, input: RiskInput) => {
    const entryRow = makeCalcHistoryEntry({
      id: `calc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      atISO: new Date().toISOString(),
      instrument: activeSpec.id,
      side: direction,
      riskPct,
      stopType,
      riskInput: input,
      result: evaluated,
    });
    const next = pushCalcHistory(calcStore.getSnapshot().entries, entryRow);
    calcStore.set({ entries: next });
    // Map calc history → sim run (no duplicate engine call)
    const sim = calcHistoryToSimRun(entryRow, { missionId });
    simRunsStore.set(pushSimRun(simRunsStore.getSnapshot(), sim));
  };

  const runEval = () => {
    const cleanInput = buildInput();
    const evaluated = evaluateRisk(cleanInput);
    persistResult(evaluated, cleanInput);
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
    setStopType("HARD_STRUCTURAL");
  };

  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  if (!open || !mounted) return null;

  // Portal to body so AcademyShell stacking (header/footer z-index) cannot paint over the drawer.
  const drawer = (
    <div
      className="pointer-events-none fixed inset-0 z-[200] isolate"
      data-testid="risk-grid-portal"
      style={{ zIndex: 200 }}
    >
      <div
        className="pointer-events-auto absolute inset-0"
        style={{ backgroundColor: "rgba(7, 9, 13, 0.92)" }}
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
        className="pointer-events-auto absolute inset-0 flex w-full max-w-lg flex-col overflow-hidden border-line bg-ink-elevated shadow-[-24px_0_60px_rgba(0,0,0,0.55)] max-[430px]:max-w-none sm:inset-y-0 sm:inset-inline-end-0 sm:inset-inline-start-auto sm:border-s"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          backgroundColor: "#10151c",
          isolation: "isolate",
        }}
      >
        <div className="relative z-10 flex shrink-0 items-start justify-between gap-4 border-b border-line bg-ink-elevated px-5 py-5">
          <div>
            <h2 id={titleId} className="mt-2 font-display text-2xl text-paper">
              {locale === "fa" ? "ماشین‌حساب ریسک" : "Risk calculator"}
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

        <div className="relative z-10 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-ink-elevated px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="text-sm text-fog">
            {locale === "fa"
              ? "این یک تمرین است. سه قاعده نتیجه را مشخص می‌کنند."
              : "This is practice. Three rules decide the result."}
          </p>

          <fieldset className="space-y-2">
            <legend className="text-xs text-fog">
              {locale === "fa" ? "ابزار تمرین" : "Practice instrument"}
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["SYNTHETIC_EURUSD", "EURUSD"],
                  ["SYNTHETIC_USDJPY", "USDJPY"],
                  ["SYNTHETIC_XAUUSD", locale === "fa" ? "طلا" : "Gold"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`min-h-11 border px-3 text-xs ${
                    preset === id
                      ? "border-gold bg-gold/10 text-gold-soft"
                      : "border-line text-fog"
                  }`}
                  onClick={() => applyPreset(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-[10px] tracking-[0.16em] text-fog uppercase">
              Stop type
            </legend>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Stop type">
              {(
                [
                  ["HARD_STRUCTURAL", locale === "fa" ? "استاپ ساختاری سخت" : "Hard structural"],
                  ["MENTAL", locale === "fa" ? "ذهنی" : "Mental"],
                  ["NONE", locale === "fa" ? "هیچ" : "None"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-11 items-center gap-3 text-sm text-paper"
                >
                  <input
                    type="radio"
                    name="stopType"
                    value={value}
                    aria-label={value === "MENTAL" ? "Mental" : value === "NONE" ? "None" : "Hard structural"}
                    checked={stopType === value}
                    onChange={() => setStopType(value)}
                    className="h-5 w-5"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-gold-soft">
              {explainStopType(stopType, locale)}
            </p>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs text-fog">
              {locale === "fa" ? "استاپ قبل از ورود گذاشته شده؟" : "Stop placed before entry?"}
            </legend>
            <div
              className="flex flex-col gap-2"
              role="radiogroup"
              aria-label="Pre-entry stop on platform"
            >
              {(
                [
                  ["YES", locale === "fa" ? "بله" : "Yes"],
                  ["NO", locale === "fa" ? "خیر" : "No"],
                  ["UNKNOWN", locale === "fa" ? "نامشخص" : "Unknown"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-11 items-center gap-3 text-sm text-paper"
                >
                  <input
                    type="radio"
                    name="preEntry"
                    value={value}
                    checked={preEntry === value}
                    onChange={() => setPreEntry(value)}
                    className="h-5 w-5"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[10px] tracking-[0.16em] text-fog uppercase">
              Side
              <select
                className="mt-2 min-h-11 w-full border border-line bg-ink px-3 text-sm text-paper"
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as "LONG" | "SHORT")
                }
              >
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </select>
            </label>
            {(
              [
                ["equity", equity, setEquity, locale === "fa" ? "سرمایه" : "Equity", "Equity"],
                ["riskPct", riskPct, setRiskPct, locale === "fa" ? "ریسک ٪" : "Risk %", "Risk %"],
                ["entry", entry, setEntry, locale === "fa" ? "ورود" : "Entry", "Entry"],
                ["stop", stop, setStop, locale === "fa" ? "استاپ" : "Stop", "Stop"],
                ["target", target, setTarget, locale === "fa" ? "هدف" : "Target", "Target"],
              ] as const
            ).map(([key, value, setter, label, accessible]) => (
              <label
                key={key}
                className="block text-[10px] tracking-[0.16em] text-fog uppercase"
              >
                {label}
                <input
                  aria-label={accessible}
                  className="mt-2 min-h-11 w-full border border-line bg-ink px-3 font-mono text-base text-paper outline-none focus:border-gold/50"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  inputMode="decimal"
                  dir="ltr"
                  disabled={key === "stop" && stopType !== "HARD_STRUCTURAL"}
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

          <div className="border border-line bg-ink/50 p-4 text-sm" aria-live="polite" data-testid="risk-plain">
            <p className={result.status === "PASS_SIMULATION" ? "text-teal-bright" : "text-gold-soft"}>
              {result.status === "PASS_SIMULATION"
                ? "PASS"
                : result.status === "HARD_BLOCK"
                  ? "BLOCKED"
                  : locale === "fa"
                    ? "ورودی را کامل کنید"
                    : "Finish the inputs"}
            </p>
            <ul className="mt-3 space-y-1 text-fog">
              <li>
                {result.issues.some((issue) => issue.code === "RISK_PCT_HARD_BLOCK")
                  ? "Risk is above 1% of equity."
                  : "Risk is at most 1% of equity."}
              </li>
              <li>
                {result.issues.some((issue) =>
                  ["MENTAL_STOP", "NO_STOP", "PRE_ENTRY_NO"].includes(issue.code),
                )
                  ? "A hard structural stop is required."
                  : "A hard structural stop is in place."}
              </li>
              <li>
                {result.issues.some((issue) => issue.code === "NET_RR_BELOW_2")
                  ? "Net reward is below 1:2."
                  : "Net reward is at least 1:2."}
              </li>
            </ul>
            <p className="mt-3 text-paper" dir="ltr">
              Position size: {result.maxLots ?? "—"}
            </p>
            <p className="text-paper" dir="ltr">
              Net R:R: {result.netRR ?? "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}
