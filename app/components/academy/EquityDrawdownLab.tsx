"use client";

import { useMemo, useState } from "react";
import {
  evaluateGapVersusPlan,
  recoveryNeededFromDrawdownPct,
  replayEquityPath,
} from "../../lib/academy/equity";
import { evaluatePortfolioExposure } from "../../lib/academy/exposure";
import { useProgress } from "./ProgressProvider";

export default function EquityDrawdownLab({ readOnly }: { readOnly?: boolean }) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const [ran, setRan] = useState(false);

  const steps = useMemo(
    () => (ran ? replayEquityPath("10000", ["-0.01", "-0.01", "-0.01"]) : []),
    [ran],
  );
  const recovery20 = recoveryNeededFromDrawdownPct("20");
  const gap = evaluateGapVersusPlan({
    plannedRiskPct: "1",
    realizedLossPct: "2",
    bothTouchedWithoutOrder: false,
  });
  const portfolio = evaluatePortfolioExposure({
    equity: "10000",
    positions: [
      {
        id: "p1",
        symbol: "XAUUSD",
        stopLossDollars: "100",
        channelTags: ["USD", "risk-on"],
        accountCurrency: "USD",
      },
      {
        id: "p2",
        symbol: "EURUSD",
        stopLossDollars: "100",
        channelTags: ["USD"],
        accountCurrency: "USD",
      },
      {
        id: "p3",
        symbol: "USDJPY",
        stopLossDollars: "100",
        channelTags: ["USD", "risk-on"],
        accountCurrency: "USD",
      },
    ],
  });

  return (
    <div className="space-y-4 border border-line bg-ink/30 p-4">
      <h3 className="font-display text-xl text-paper">
        {locale === "fa"
          ? "آزمایشگاه equity / drawdown"
          : "Equity & Drawdown Lab"}
      </h3>
      <button
        type="button"
        className="min-h-11 border border-gold/50 px-3 text-sm text-gold-soft"
        disabled={readOnly}
        onClick={() => setRan(true)}
      >
        Replay 3× −1% from 10000
      </button>
      {steps.length ? (
        <ol className="font-mono text-xs text-fog">
          {steps.map((s, i) => (
            <li key={i}>
              #{i + 1} before={s.equityBefore} after={s.equityAfter} budget=
              {s.plannedRisk} dd%={s.drawdownPct} recovery=
              {s.recoveryPct ?? "null"}{" "}
              {s.insolvent ? "INSOLVENT" : ""}
            </li>
          ))}
        </ol>
      ) : null}
      <p className="font-mono text-xs text-gold-soft">
        recovery from 20% DD → {recovery20}% gain required
      </p>
      <p className="font-mono text-xs text-fog">
        gap example: {gap.status} — {gap.note}
      </p>
      <div className="text-xs text-fog">
        <p className="text-teal-bright">Portfolio transparency</p>
        <p className="font-mono">
          total SL ${portfolio.totalStopLossDollars} ({portfolio.totalStopLossPct}
          %) · channels {portfolio.sharedChannels.join(",")}
        </p>
        <ul>
          {portfolio.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
