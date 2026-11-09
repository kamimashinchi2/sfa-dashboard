"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  MAX_RISK_PERCENT,
  type AssetType,
  calculatePositionSize,
  formatLots,
  formatMoney,
  formatRr,
} from "../lib/sizing";

type Props = {
  open: boolean;
  onClose: () => void;
};

const ASSET_PRESETS: Record<
  AssetType,
  { entry: string; stop: string; target: string }
> = {
  forex: { entry: "1.0850", stop: "1.0800", target: "1.0950" },
  gold: { entry: "2650", stop: "2640", target: "2670" },
};

export default function PositionSizer({ open, onClose }: Props) {
  const titleId = useId();
  const [equity, setEquity] = useState("10000");
  const [riskPercent, setRiskPercent] = useState("1.0");
  const [entry, setEntry] = useState(ASSET_PRESETS.forex.entry);
  const [stop, setStop] = useState(ASSET_PRESETS.forex.stop);
  const [target, setTarget] = useState(ASSET_PRESETS.forex.target);
  const [asset, setAsset] = useState<AssetType>("forex");

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const selectAsset = (next: AssetType) => {
    setAsset(next);
    const preset = ASSET_PRESETS[next];
    setEntry(preset.entry);
    setStop(preset.stop);
    setTarget(preset.target);
  };

  const result = useMemo(
    () =>
      calculatePositionSize({
        equity: Number(equity) || 0,
        riskPercent: Number(riskPercent) || 0,
        entry: Number(entry) || 0,
        stop: Number(stop) || 0,
        target: Number(target) || 0,
        asset,
      }),
    [equity, riskPercent, entry, stop, target, asset],
  );

  const onRiskChange = (raw: string) => {
    if (raw === "" || raw === ".") {
      setRiskPercent(raw);
      return;
    }
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    if (num > MAX_RISK_PERCENT) {
      setRiskPercent(String(MAX_RISK_PERCENT));
      return;
    }
    setRiskPercent(raw);
  };

  const rrClass =
    result.meetsMinRr === null
      ? "text-fog"
      : result.meetsMinRr
        ? "text-teal-bright"
        : "text-red-400";

  return (
    <>
      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-40 bg-ink/70 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-ink-elevated shadow-[-24px_0_60px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
          <div>
            <p className="text-[10px] font-medium tracking-[0.22em] text-teal-bright uppercase">
              Institutional math
            </p>
            <h2
              id={titleId}
              className="mt-2 font-display text-2xl tracking-tight text-paper"
            >
              Position Sizing Calculator
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close calculator"
            className="rounded-md border border-line p-2 text-fog transition-colors hover:border-gold/40 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
          <p className="text-sm leading-relaxed text-fog">
            Risk is locked at a maximum of{" "}
            <span className="font-mono text-gold-soft">1.0%</span>. Forex uses
            stop distance in pips from entry/stop; gold uses absolute price
            distance. R:R = |Target − Entry| ÷ |Entry − Stop| (green at ≥ 1:2).
          </p>

          <div className="mt-6 grid gap-4">
            <label className="block text-[10px] tracking-[0.16em] text-fog uppercase">
              Account Balance ($)
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={equity}
                onChange={(e) => setEquity(e.target.value)}
                className="mt-2 w-full border border-line bg-ink px-3 py-2.5 font-mono text-sm text-paper outline-none focus:border-gold/50"
              />
            </label>

            <label className="block text-[10px] tracking-[0.16em] text-fog uppercase">
              Risk Percentage (max {MAX_RISK_PERCENT.toFixed(1)}%)
              <input
                type="number"
                min="0"
                max={MAX_RISK_PERCENT}
                step="0.1"
                inputMode="decimal"
                value={riskPercent}
                onChange={(e) => onRiskChange(e.target.value)}
                className="mt-2 w-full border border-line bg-ink px-3 py-2.5 font-mono text-sm text-paper outline-none focus:border-gold/50"
              />
            </label>

            <fieldset>
              <legend className="text-[10px] tracking-[0.16em] text-fog uppercase">
                Asset Type
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ["forex", "Forex"],
                    ["gold", "Gold"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => selectAsset(value)}
                    aria-pressed={asset === value}
                    className={`border px-3 py-2.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                      asset === value
                        ? "border-gold/70 bg-gold/10 text-paper"
                        : "border-line text-fog hover:text-paper"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block text-[10px] tracking-[0.16em] text-fog uppercase">
                Entry Price
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  className="mt-2 w-full border border-line bg-ink px-3 py-2.5 font-mono text-sm text-paper outline-none focus:border-gold/50"
                />
              </label>
              <label className="block text-[10px] tracking-[0.16em] text-fog uppercase">
                Stop Loss Price
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={stop}
                  onChange={(e) => setStop(e.target.value)}
                  className="mt-2 w-full border border-line bg-ink px-3 py-2.5 font-mono text-sm text-paper outline-none focus:border-gold/50"
                />
              </label>
              <label className="block text-[10px] tracking-[0.16em] text-fog uppercase">
                Target / TP
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="mt-2 w-full border border-line bg-ink px-3 py-2.5 font-mono text-sm text-paper outline-none focus:border-gold/50"
                />
              </label>
            </div>
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <h3 className="font-display text-lg text-paper">Outputs</h3>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-fog">Calculated Lot Size</dt>
                <dd className="font-mono text-gold-soft">
                  {formatLots(result.lotSize)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-fog">Total Dollar Risk ($)</dt>
                <dd className="font-mono text-paper">
                  {formatMoney(result.dollarRisk)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-fog">
                  {asset === "forex" ? "Stop (pips)" : "Stop distance"}
                </dt>
                <dd className="font-mono text-paper">
                  {asset === "forex"
                    ? Number.isFinite(result.stopPips) && result.stopPips > 0
                      ? result.stopPips.toFixed(1)
                      : "—"
                    : Number.isFinite(result.stopDistance) &&
                        result.stopDistance > 0
                      ? result.stopDistance.toFixed(2)
                      : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-fog">Risk-to-Reward Ratio</dt>
                <dd className={`font-mono ${rrClass}`}>
                  {formatRr(result.riskReward)}
                  {result.meetsMinRr === false ? " · below 1:2" : null}
                  {result.meetsMinRr === true ? " · pass" : null}
                </dd>
              </div>
            </dl>

            <div className="mt-6 space-y-2 border border-line bg-ink/50 p-4 font-mono text-[11px] leading-relaxed text-fog">
              <p className="text-paper">Academy formulas</p>
              <p>Forex: (Equity × risk%) ÷ (stopPips × 10)</p>
              <p>Gold: (Equity × risk%) ÷ (|Entry − Stop| × 100)</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
