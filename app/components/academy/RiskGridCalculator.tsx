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
import { X } from "lucide-react";
import {
  INSTRUMENT_PRESETS,
  RISK_ENGINE_VERSION,
  customSpec,
  type CalcHistoryEntry,
  type ContractSpec,
  type InstrumentPresetId,
  type RiskInput,
  type RiskResult,
  type StopType,
} from "../../lib/academy/contracts";
import {
  draftToRiskPrices,
  evaluateRisk,
  explainRiskStatus,
  explainStopType,
} from "../../lib/academy/risk";
import { buildDescriptiveGrid } from "../../lib/academy/grid";
import { unsafeRiskExample } from "../../lib/academy/fixtures";
import {
  createPersistedStore,
  defaultCalcHistory,
  deleteCalcHistory,
  makeCalcHistoryEntry,
  pushCalcHistory,
  storageKey,
  type CalcHistoryStore,
} from "../../lib/academy/persist";
import { useProgress } from "./ProgressProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  onResult?: (result: RiskResult) => void;
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

export default function RiskGridCalculator({ open, onClose, onResult }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);
  const { progress } = useProgress();
  const locale = progress.locale;

  const [preset, setPreset] = useState<InstrumentPresetId>("SYNTHETIC_XAUUSD");
  const [accountCurrency, setAccountCurrency] = useState("USD");
  const [conversion, setConversion] = useState("1");
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [stopType, setStopType] = useState<StopType>("HARD_STRUCTURAL");
  const [equity, setEquity] = useState("10000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("2500");
  const [stop, setStop] = useState("2492");
  const [target, setTarget] = useState("2516");
  const [anchor, setAnchor] = useState("2500");
  const [contractSize, setContractSize] = useState("100");
  const [pipSize, setPipSize] = useState("0.01");
  const [pipValue, setPipValue] = useState("1");
  const [lotStep, setLotStep] = useState("0.01");
  const [minLot, setMinLot] = useState("0.01");
  const [maxLot, setMaxLot] = useState("100");
  const [pnlCurrency, setPnlCurrency] = useState("USD");
  const historyStore = useSyncExternalStore(
    calcStore.subscribe,
    calcStore.getSnapshot,
    calcStore.getServerSnapshot,
  );
  const history = historyStore.entries;
  const historyReady = true;

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
    setAnchor(prices.entry);
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

  const reloadEntry = (h: CalcHistoryEntry) => {
    const s = h.input.spec;
    if (s) {
      setPreset(s.presetId);
      setContractSize(s.contractSize);
      setPipSize(s.pipSize);
      setPipValue(s.pipValueQuotePerLot);
      setLotStep(s.lotStep);
      setMinLot(s.minLot);
      setMaxLot(s.maxLot);
      setPnlCurrency(s.pnlCurrency);
    }
    setDirection(h.side);
    setStopType(h.stopType);
    setRiskPct(h.riskPct);
    setEquity(h.input.equity ?? "");
    setEntry(h.input.entry ?? "");
    setStop(h.input.stop ?? "");
    setTarget(h.input.target ?? "");
    setConversion(h.input.conversion ?? "");
    setAccountCurrency(h.input.accountCurrency);
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
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-line bg-ink-elevated shadow-[-24px_0_60px_rgba(0,0,0,0.45)] max-[430px]:max-w-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5">
          <div>
            <p className="text-[10px] tracking-[0.22em] text-teal-bright uppercase">
              SYNTHETIC ONLY · engine v{RISK_ENGINE_VERSION}
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
              ? "ورودی خالی صفر نیست. ۲٪ = HARD_BLOCK بدون clamp خاموش. مشخصات synthetic — با بروکر خود تأیید کنید."
              : "Empty input ≠ zero. 2% requests HARD_BLOCK — never silent clamp. Synthetic spec, confirm with your broker."}
          </p>

          <fieldset className="space-y-2">
            <legend className="text-[10px] tracking-[0.16em] text-fog uppercase">
              Instrument preset
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  "SYNTHETIC_EURUSD",
                  "SYNTHETIC_USDJPY",
                  "SYNTHETIC_XAUUSD",
                  "CUSTOM",
                ] as InstrumentPresetId[]
              ).map((id) => (
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
                  {id}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-fog">{activeSpec.brokerConfirmNotice}</p>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-[10px] tracking-[0.16em] text-fog uppercase">
              Stop type
            </legend>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Stop type">
              {(
                [
                  ["HARD_STRUCTURAL", "Hard structural (on platform)"],
                  ["MENTAL", "Mental"],
                  ["NONE", "None"],
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
            <label className="block text-[10px] tracking-[0.16em] text-fog uppercase">
              Account currency
              <input
                className="mt-2 min-h-11 w-full border border-line bg-ink px-3 font-mono text-base text-paper outline-none focus:border-gold/50"
                value={accountCurrency}
                onChange={(e) => setAccountCurrency(e.target.value.toUpperCase())}
              />
            </label>
            {(
              [
                ["equity", equity, setEquity, "Equity"],
                ["riskPct", riskPct, setRiskPct, "Risk %"],
                ["entry", entry, setEntry, "Entry"],
                ["stop", stop, setStop, "Stop"],
                ["target", target, setTarget, "Target"],
                ["conversion", conversion, setConversion, "Quote→account rate"],
              ] as const
            ).map(([key, value, setter, label]) => (
              <label
                key={key}
                className="block text-[10px] tracking-[0.16em] text-fog uppercase"
              >
                {label}
                <input
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

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["contractSize", contractSize, setContractSize, "Contract size"],
                ["pipSize", pipSize, setPipSize, "Pip/tick size"],
                ["pipValue", pipValue, setPipValue, "Pip value / lot (quote)"],
                ["pnlCurrency", pnlCurrency, setPnlCurrency, "Quote currency"],
                ["lotStep", lotStep, setLotStep, "Lot step"],
                ["minLot", minLot, setMinLot, "Min lot"],
                ["maxLot", maxLot, setMaxLot, "Max lot"],
              ] as const
            ).map(([key, value, setter, label]) => (
              <label
                key={key}
                className="block text-[10px] tracking-[0.16em] text-fog uppercase"
              >
                {label}
                <input
                  className="mt-2 min-h-11 w-full border border-line bg-ink px-3 font-mono text-base text-paper outline-none focus:border-gold/50"
                  value={value}
                  onChange={(e) => {
                    setPreset("CUSTOM");
                    setter(e.target.value);
                  }}
                  inputMode="decimal"
                  dir="ltr"
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
              {locale === "fa" ? "ارزیابی و ذخیره" : "Evaluate & save"}
            </button>
            <button
              type="button"
              onClick={loadUnsafe}
              className="min-h-11 border border-line px-4 text-sm text-fog"
            >
              {locale === "fa" ? "مثال ناامن ۲٪" : "Load unsafe 2% example"}
            </button>
          </div>

          <div
            className="border border-line bg-ink/50 p-4 text-sm"
            aria-live="polite"
          >
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
            <dl className="mt-3 space-y-1 font-mono text-xs text-paper" dir="ltr">
              <div>stopPips: {result.stopPips ?? "—"}</div>
              <div>pipValueAccount: {result.pipValueAccount ?? "—"}</div>
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
              Stops do not guarantee loss caps through gaps; margin sufficiency is
              separate.
            </p>
          </div>

          <section className="space-y-3 border border-line p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm text-paper">
                {locale === "fa" ? "تاریخچه محاسبات (۵۰)" : "Calc history (50)"}
              </h3>
              <button
                type="button"
                className="min-h-11 border border-line px-3 text-xs text-fog"
                onClick={() => {
                  if (
                    !window.confirm(
                      locale === "fa"
                        ? "همه تاریخچه پاک شود؟"
                        : "Clear all calc history?",
                    )
                  )
                    return;
                  calcStore.set({ entries: [] });
                }}
              >
                Clear all
              </button>
            </div>
            {!historyReady ? (
              <p className="text-xs text-fog">…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-fog">No saved runs yet.</p>
            ) : (
              <ul className="max-h-56 space-y-2 overflow-auto">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="border border-line/60 bg-ink/40 p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2 font-mono" dir="ltr">
                      <span>{h.atISO.slice(11, 19)}</span>
                      <span>{h.instrument}</span>
                      <span>{h.side}</span>
                      <span>{h.riskPct}%</span>
                      <span>{h.stopType}</span>
                      <span
                        className={
                          h.status === "HARD_BLOCK"
                            ? "text-red-400"
                            : h.status === "PASS_SIMULATION"
                              ? "text-teal-bright"
                              : "text-gold-soft"
                        }
                      >
                        {h.status}
                      </span>
                      <span>lots={h.lots ?? "—"}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="min-h-11 border border-gold/40 px-3 text-gold-soft"
                        onClick={() => reloadEntry(h)}
                      >
                        Reload
                      </button>
                      <button
                        type="button"
                        className="min-h-11 border border-line px-3 text-fog"
                        onClick={() => {
                          if (
                            !window.confirm(
                              locale === "fa" ? "حذف شود؟" : "Delete this run?",
                            )
                          )
                            return;
                          const next = deleteCalcHistory(history, h.id);
                          calcStore.set({ entries: next });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div>
            <label className="block text-[10px] tracking-[0.16em] text-fog uppercase">
              Grid anchor (visible scenario)
              <input
                className="mt-2 min-h-11 w-full border border-line bg-ink px-3 font-mono text-base text-paper"
                value={anchor}
                onChange={(e) => setAnchor(e.target.value)}
                inputMode="decimal"
                dir="ltr"
              />
            </label>
            <p className="mt-2 text-xs text-fog">
              Descriptive geometry only — not direction, targets, or signals.
            </p>
            {grid.ok ? (
              <div className="mt-3 max-h-40 overflow-x-auto overflow-y-auto">
                <ul className="min-w-max font-mono text-[11px] text-fog">
                  {grid.lines.slice(0, 24).map((l) => (
                    <li key={`${l.kind}-${l.k}-${l.price}`}>
                      {l.kind} k={l.k} → {l.price}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-xs text-red-400">{grid.reason}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
