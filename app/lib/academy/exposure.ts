import type { Dec } from "./contracts";
import { canonicalize, decAdd, decDiv, decMul, parseDec } from "./decimal";

export type PositionSnapshot = {
  id: string;
  symbol: string;
  stopLossDollars: Dec;
  channelTags: string[];
  accountCurrency: string;
};

export type PortfolioExposure = {
  totalStopLossDollars: Dec;
  totalStopLossPct: Dec | null;
  concentrationBySymbol: { symbol: string; dollars: Dec; pct: Dec | null }[];
  sharedChannels: string[];
  notes: string[];
};

/**
 * Sum modeled stop-loss dollars; report concentration without inventing portfolio caps.
 */
export function evaluatePortfolioExposure(input: {
  equity: Dec;
  positions: PositionSnapshot[];
}): PortfolioExposure {
  const notes: string[] = [
    "No fabricated 2% portfolio cap, correlation offset, or diversification credit",
  ];
  const eq = parseDec(input.equity);
  let total = "0";
  const bySym = new Map<string, string>();
  const channels = new Set<string>();

  for (const p of input.positions) {
    const sl = parseDec(p.stopLossDollars);
    if (!sl.ok || sl.value === null) {
      notes.push(`UNVERIFIED_STOP:${p.id}`);
      continue;
    }
    total = canonicalize(decAdd(total, sl.value));
    bySym.set(
      p.symbol,
      canonicalize(decAdd(bySym.get(p.symbol) ?? "0", sl.value)),
    );
    for (const c of p.channelTags) channels.add(c);
  }

  const totalPct =
    eq.ok && eq.value && eq.value !== "0"
      ? canonicalize(decMul(decDiv(total, eq.value, 12) ?? "0", "100"))
      : null;

  const concentrationBySymbol = [...bySym.entries()].map(([symbol, dollars]) => ({
    symbol,
    dollars,
    pct:
      eq.ok && eq.value && eq.value !== "0"
        ? canonicalize(decMul(decDiv(dollars, eq.value, 12) ?? "0", "100"))
        : null,
  }));

  return {
    totalStopLossDollars: total,
    totalStopLossPct: totalPct,
    concentrationBySymbol,
    sharedChannels: [...channels],
    notes,
  };
}
