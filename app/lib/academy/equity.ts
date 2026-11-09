import type { Dec } from "./contracts";
import {
  canonicalize,
  decAdd,
  decCompare,
  decDiv,
  decMul,
  decSub,
  parseDec,
} from "./decimal";

export type EquityStep = {
  equityBefore: Dec;
  plannedRisk: Dec;
  realizedPnl: Dec;
  equityAfter: Dec;
  peak: Dec;
  drawdownPct: Dec;
  recoveryPct: Dec | null;
  insolvent: boolean;
};

export type GapFillResult = {
  status: "FILLED" | "STOP_GAP_LOSS" | "AMBIGUOUS" | "NO_FILL";
  fillPrice: Dec | null;
  realizedLossPct: Dec | null;
  plannedRiskPct: Dec;
  note: string;
};

/**
 * nextEquity = equity*(1+r); peak/drawdown/recovery per prompt.
 * At equity<=0 stop replay, flag insolvency, recovery null.
 */
export function stepEquity(input: {
  equity: Dec;
  peak: Dec;
  returnFraction: Dec;
  riskPct?: Dec;
}): EquityStep {
  const eq = parseDec(input.equity);
  const peakIn = parseDec(input.peak);
  const r = parseDec(input.returnFraction);
  if (!eq.ok || !peakIn.ok || !r.ok || eq.value === null || peakIn.value === null || r.value === null) {
    return {
      equityBefore: input.equity,
      plannedRisk: "0",
      realizedPnl: "0",
      equityAfter: input.equity,
      peak: input.peak,
      drawdownPct: "0",
      recoveryPct: null,
      insolvent: true,
    };
  }

  if (decCompare(eq.value, "0") <= 0) {
    return {
      equityBefore: eq.value,
      plannedRisk: "0",
      realizedPnl: "0",
      equityAfter: eq.value,
      peak: peakIn.value,
      drawdownPct: "100",
      recoveryPct: null,
      insolvent: true,
    };
  }

  const riskPct = input.riskPct ?? "1";
  const planned = canonicalize(decMul(eq.value, decDiv(riskPct, "100", 12) ?? "0"));
  const growth = canonicalize(decAdd("1", r.value));
  const next = canonicalize(decMul(eq.value, growth));
  const pnl = canonicalize(decSub(next, eq.value));
  const peak =
    decCompare(next, peakIn.value) > 0 ? next : peakIn.value;
  const dd =
    decCompare(peak, "0") === 0
      ? "0"
      : canonicalize(
          decMul(
            decDiv(decSub(peak, next), peak, 12) ?? "0",
            "100",
          ),
        );
  let recovery: string | null = null;
  if (decCompare(next, "0") > 0 && decCompare(peak, next) > 0) {
    recovery = canonicalize(
      decMul(decDiv(decSub(peak, next), next, 12) ?? "0", "100"),
    );
  } else if (decCompare(next, "0") <= 0) {
    recovery = null;
  } else {
    recovery = "0";
  }

  return {
    equityBefore: eq.value,
    plannedRisk: planned,
    realizedPnl: pnl,
    equityAfter: next,
    peak,
    drawdownPct: dd,
    recoveryPct: recovery,
    insolvent: decCompare(next, "0") <= 0,
  };
}

/** Replay a sequence of return fractions. */
export function replayEquityPath(
  startEquity: Dec,
  returns: Dec[],
): EquityStep[] {
  const steps: EquityStep[] = [];
  let equity = startEquity;
  let peak = startEquity;
  for (const r of returns) {
    const step = stepEquity({ equity, peak, returnFraction: r, riskPct: "1" });
    steps.push(step);
    equity = step.equityAfter;
    peak = step.peak;
    if (step.insolvent) break;
  }
  return steps;
}

/** Gap through stop: realized loss may exceed planned 1% — STOP_GAP_LOSS. */
export function evaluateGapVersusPlan(input: {
  plannedRiskPct: Dec;
  realizedLossPct: Dec;
  bothTouchedWithoutOrder: boolean;
}): GapFillResult {
  if (input.bothTouchedWithoutOrder) {
    return {
      status: "AMBIGUOUS",
      fillPrice: null,
      realizedLossPct: input.realizedLossPct,
      plannedRiskPct: input.plannedRiskPct,
      note: "OHLC touched stop and target without order evidence — AMBIGUOUS",
    };
  }
  if (decCompare(input.realizedLossPct, input.plannedRiskPct) > 0) {
    return {
      status: "STOP_GAP_LOSS",
      fillPrice: null,
      realizedLossPct: input.realizedLossPct,
      plannedRiskPct: input.plannedRiskPct,
      note: "Gap caused larger realized loss than planned risk — not proof of excessive plan",
    };
  }
  return {
    status: "FILLED",
    fillPrice: null,
    realizedLossPct: input.realizedLossPct,
    plannedRiskPct: input.plannedRiskPct,
    note: "Realized within planned risk (educational)",
  };
}

/** Recovering a 20% drawdown requires 25% gain: peak/eq - 1. */
export function recoveryNeededFromDrawdownPct(drawdownPct: Dec): Dec | null {
  const dd = parseDec(drawdownPct);
  if (!dd.ok || dd.value === null) return null;
  // equity = peak * (1 - dd/100); recovery = peak/equity - 1
  const remaining = decSub("1", decDiv(dd.value, "100", 12) ?? "0");
  if (decCompare(remaining, "0") <= 0) return null;
  const ratio = decDiv("1", remaining, 12);
  if (ratio === null) return null;
  return canonicalize(decMul(decSub(ratio, "1"), "100"));
}
