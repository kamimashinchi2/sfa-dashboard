"use client";

import { useMemo, useState } from "react";
import {
  evaluateGapVersusPlan,
  recoveryNeededFromDrawdownPct,
  replayEquityPath,
} from "../../lib/academy/equity";
import { evaluatePortfolioExposure } from "../../lib/academy/exposure";
import { syntheticTradeReturns } from "../../lib/academy/seededRng";
import { decCompare, parseDec } from "../../lib/academy/decimal";
import { useProgress } from "./ProgressProvider";

export default function EquityDrawdownLab({ readOnly }: { readOnly?: boolean }) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const [startEquity, setStartEquity] = useState("10000");
  const [riskPct, setRiskPct] = useState("1");
  const [winRate, setWinRate] = useState("0.4");
  const [rMultiple, setRMultiple] = useState("2");
  const [seed, setSeed] = useState("42");
  const [ran, setRan] = useState(false);

  const riskHardBlock = useMemo(() => {
    const p = parseDec(riskPct);
    return p.ok && decCompare(p.value, "1") > 0;
  }, [riskPct]);

  const recovery10 = recoveryNeededFromDrawdownPct("10");
  const recovery20 = recoveryNeededFromDrawdownPct("20");
  const recovery50 = recoveryNeededFromDrawdownPct("50");

  const streakReturns = useMemo(() => {
    if (!ran) return [];
    return syntheticTradeReturns({
      seed: Number(seed) || 0,
      n: 40,
      winRate: Number(winRate) || 0,
      rMultiple: Number(rMultiple) || 0,
      riskPct: Math.min(Number(riskPct) || 0, 1),
    });
  }, [ran, seed, winRate, rMultiple, riskPct]);

  const steps = useMemo(
    () => (ran ? replayEquityPath(startEquity || "10000", streakReturns) : []),
    [ran, startEquity, streakReturns],
  );

  const maxDd = useMemo(() => {
    let max = 0;
    for (const s of steps) {
      const n = Number(s.drawdownPct);
      if (n > max) max = n;
    }
    return max;
  }, [steps]);

  const gap = evaluateGapVersusPlan({
    plannedRiskPct: "1",
    realizedLossPct: "2",
    bothTouchedWithoutOrder: false,
  });
  const portfolio = evaluatePortfolioExposure({
    equity: startEquity || "10000",
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

  const lastEquity = steps.length
    ? steps[steps.length - 1]!.equityAfter
    : startEquity;
  const resizeTable = [0.25, 0.5, 1].map((pct) => {
    const eq = Number(lastEquity) || 0;
    return {
      riskPct: pct,
      dollars: ((eq * pct) / 100).toFixed(2),
    };
  });

  return (
    <div className="space-y-4 border border-line bg-ink/30 p-4">
      <h3 className="font-display text-xl text-paper">
        {locale === "fa"
          ? "آزمایشگاه equity / drawdown"
          : "Equity & Drawdown Lab"}
      </h3>
      <p className="text-xs text-fog">
        {locale === "fa"
          ? "شبیه‌سازی آموزشی با RNG بذر‌دار — نه سیگنال."
          : "Educational seeded simulation — not a signal."}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["startEquity", startEquity, setStartEquity, "Starting equity"],
            ["riskPct", riskPct, setRiskPct, "Risk % (≤1)"],
            ["winRate", winRate, setWinRate, "Win rate (0–1)"],
            ["rMultiple", rMultiple, setRMultiple, "R multiple"],
            ["seed", seed, setSeed, "RNG seed"],
          ] as const
        ).map(([key, value, setter, label]) => (
          <label
            key={key}
            className="block text-[10px] tracking-[0.16em] text-fog uppercase"
          >
            {label}
            <input
              className="mt-2 min-h-11 w-full border border-line bg-ink px-3 font-mono text-base text-paper"
              value={value}
              disabled={readOnly}
              onChange={(e) => {
                setter(e.target.value);
                setRan(false);
              }}
              inputMode="decimal"
              dir="ltr"
            />
          </label>
        ))}
      </div>

      {riskHardBlock ? (
        <div
          className="border border-red-400/50 bg-ink/60 p-3 font-mono text-sm text-red-300"
          data-testid="a7-risk-hard-block"
        >
          HARD_BLOCK demo row — risk% &gt; 1.0 is not allowed (shown, not
          clamped). Simulation uses ≤1% for the curve.
        </div>
      ) : null}

      <button
        type="button"
        className="min-h-11 border border-gold/50 px-3 text-sm text-gold-soft"
        disabled={readOnly}
        onClick={() => setRan(true)}
      >
        {locale === "fa" ? "اجرای مسیر synthetic" : "Run synthetic path"}
      </button>

      {steps.length ? (
        <div className="max-h-48 overflow-x-auto overflow-y-auto">
          <ol className="min-w-max font-mono text-xs text-fog">
            {steps.map((s, i) => (
              <li key={i}>
                #{i + 1} before={s.equityBefore} after={s.equityAfter} budget=
                {s.plannedRisk} dd%={s.drawdownPct} recovery=
                {s.recoveryPct ?? "null"} {s.insolvent ? "INSOLVENT" : ""}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <dl className="grid gap-2 font-mono text-xs text-gold-soft sm:grid-cols-2">
        <div>maxDrawdown% ≈ {ran ? maxDd.toFixed(4) : "—"}</div>
        <div>recovery 10% DD → {recovery10}% (expect 11.11…)</div>
        <div>recovery 20% DD → {recovery20}%</div>
        <div>recovery 50% DD → {recovery50}% (expect 100)</div>
      </dl>

      <div className="text-xs text-fog">
        <p className="text-teal-bright">
          Risk-of-ruin illustration (educational)
        </p>
        <p>
          With risk {riskPct}% and win rate {winRate}, long loss streaks shrink
          equity; recovery % = DD/(1−DD). Not a broker forecast.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left font-mono text-xs text-fog">
          <caption className="mb-2 text-teal-bright">
            Current-equity re-sizing (≤1%)
          </caption>
          <thead>
            <tr>
              <th className="p-2">Risk %</th>
              <th className="p-2">$ at equity {lastEquity}</th>
            </tr>
          </thead>
          <tbody>
            {resizeTable.map((r) => (
              <tr key={r.riskPct} className="border-t border-line">
                <td className="p-2" dir="ltr">
                  {r.riskPct}
                </td>
                <td className="p-2" dir="ltr">
                  {r.dollars}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
