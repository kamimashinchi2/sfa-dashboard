import type { CalcHistoryEntry, RiskInput, RiskResult, StopType } from "../contracts";
import { RISK_ENGINE_VERSION } from "../contracts";

export const CALC_HISTORY_CAP = 50;

export function makeCalcHistoryEntry(input: {
  id: string;
  atISO: string;
  instrument: string;
  side: "LONG" | "SHORT";
  riskPct: string;
  stopType: StopType;
  riskInput: RiskInput;
  result: RiskResult;
}): CalcHistoryEntry {
  return {
    id: input.id,
    atISO: input.atISO,
    instrument: input.instrument,
    side: input.side,
    riskPct: input.riskPct,
    stopType: input.stopType,
    status: input.result.status,
    lots: input.result.maxLots,
    loss: input.result.loss,
    input: input.riskInput,
    result: input.result,
    engineVersion: RISK_ENGINE_VERSION,
  };
}

/** Ring buffer — newest first, cap 50. HARD_BLOCK runs are kept. */
export function pushCalcHistory(
  entries: CalcHistoryEntry[],
  next: CalcHistoryEntry,
  cap = CALC_HISTORY_CAP,
): CalcHistoryEntry[] {
  const without = entries.filter((e) => e.id !== next.id);
  return [next, ...without].slice(0, cap);
}

export function deleteCalcHistory(
  entries: CalcHistoryEntry[],
  id: string,
): CalcHistoryEntry[] {
  return entries.filter((e) => e.id !== id);
}

/** Merge by id (union) for cross-tab — prefer higher atISO. */
export function mergeCalcHistory(
  a: CalcHistoryEntry[],
  b: CalcHistoryEntry[],
  cap = CALC_HISTORY_CAP,
): CalcHistoryEntry[] {
  const map = new Map<string, CalcHistoryEntry>();
  for (const e of [...a, ...b]) {
    const prev = map.get(e.id);
    if (!prev || prev.atISO < e.atISO) map.set(e.id, e);
  }
  return [...map.values()]
    .sort((x, y) => (x.atISO < y.atISO ? 1 : -1))
    .slice(0, cap);
}
