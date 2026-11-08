"use client";

import { useEffect, useId, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

function roundLots(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return value.toFixed(2);
}

export default function RulebookDrawer({ open, onClose }: Props) {
  const titleId = useId();
  const [equity, setEquity] = useState("10000");
  const [stopPips, setStopPips] = useState("20");
  const [entry, setEntry] = useState("2650");
  const [stop, setStop] = useState("2640");

  const equityNum = Number(equity) || 0;
  const stopPipsNum = Number(stopPips) || 0;
  const entryNum = Number(entry) || 0;
  const stopNum = Number(stop) || 0;

  const forexLots =
    stopPipsNum > 0 ? (equityNum * 0.01) / (stopPipsNum * 10) : NaN;
  const goldDistance = Math.abs(entryNum - stopNum);
  const goldLots =
    goldDistance > 0 ? (equityNum * 0.01) / (goldDistance * 100) : NaN;

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
            <p className="text-xs font-medium tracking-[0.22em] text-teal-bright uppercase">
              Master Curriculum &amp; Rulebook v1.0
            </p>
            <h2
              id={titleId}
              className="mt-2 font-display text-2xl tracking-tight text-paper"
            >
              Universal rulebook
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-fog transition-colors hover:border-gold/40 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
          <section>
            <h3 className="font-display text-lg text-paper">Non-negotiables</h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-fog">
              <li className="border-l border-gold/40 pl-4">
                Maximum risk{" "}
                <span className="font-mono text-gold-soft">1.0%</span> of equity
                per trade.
              </li>
              <li className="border-l border-gold/40 pl-4">
                Mandatory hard stop-loss — no mental stops.
              </li>
              <li className="border-l border-gold/40 pl-4">
                Minimum R:R{" "}
                <span className="font-mono text-gold-soft">1:2</span>. Anything
                below is rejected.
              </li>
              <li className="border-l border-gold/40 pl-4">
                Entries from price action; indicators stay contextual.
              </li>
            </ul>
          </section>

          <section className="mt-8">
            <h3 className="font-display text-lg text-paper">
              Position sizing formulas
            </h3>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-fog">
              <p>
                General: Lot Size = (Account Capital × Risk %) ÷ (Stop Distance
                in Points/Pips × Point Value)
              </p>
              <div>
                <p className="font-medium text-paper">Forex (EUR/USD)</p>
                <p className="mt-1 font-mono text-xs text-gold-soft">
                  Lot = (Equity × 0.01) ÷ (Stop Pips × 10)
                </p>
              </div>
              <div>
                <p className="font-medium text-paper">Spot Gold (XAU/USD)</p>
                <p className="mt-1 font-mono text-xs text-gold-soft">
                  Lot = (Equity × 0.01) ÷ (|Entry − Stop| × 100)
                </p>
              </div>
            </div>
          </section>

          <section className="mt-8 border-t border-line pt-8">
            <h3 className="font-display text-lg text-paper">
              Risk calculator
            </h3>
            <p className="mt-2 text-sm text-fog">
              Sized at 1.0% risk. Formulas above remain the source of truth.
            </p>

            <label className="mt-5 block text-xs tracking-[0.16em] text-fog uppercase">
              Account equity ($)
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={equity}
                onChange={(e) => setEquity(e.target.value)}
                className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-2.5 font-mono text-sm text-paper outline-none focus:border-gold/50"
              />
            </label>

            <div className="mt-5 grid gap-5">
              <div>
                <p className="text-sm font-medium text-paper">EUR/USD</p>
                <label className="mt-2 block text-xs tracking-[0.16em] text-fog uppercase">
                  Stop distance (pips)
                  <input
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={stopPips}
                    onChange={(e) => setStopPips(e.target.value)}
                    className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-2.5 font-mono text-sm text-paper outline-none focus:border-gold/50"
                  />
                </label>
                <p className="mt-3 text-sm text-fog">
                  Lot size{" "}
                  <span className="font-mono text-gold-soft">
                    {roundLots(forexLots)}
                  </span>
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-paper">XAU/USD</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <label className="block text-xs tracking-[0.16em] text-fog uppercase">
                    Entry
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={entry}
                      onChange={(e) => setEntry(e.target.value)}
                      className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-2.5 font-mono text-sm text-paper outline-none focus:border-gold/50"
                    />
                  </label>
                  <label className="block text-xs tracking-[0.16em] text-fog uppercase">
                    Stop
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={stop}
                      onChange={(e) => setStop(e.target.value)}
                      className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-2.5 font-mono text-sm text-paper outline-none focus:border-gold/50"
                    />
                  </label>
                </div>
                <p className="mt-3 text-sm text-fog">
                  Lot size{" "}
                  <span className="font-mono text-gold-soft">
                    {roundLots(goldLots)}
                  </span>
                </p>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
