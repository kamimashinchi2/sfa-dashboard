import type { Dec, ISO } from "./contracts";
import { canonicalize, decDiv, decMul, decSub, parseDec } from "./decimal";
import type { TimedObservation } from "./pointInTime";
import { assertZonedInstant } from "./pointInTime";

export type WindowId = "0-5" | "5-15" | "15-60";

export type WindowReturn = {
  window: WindowId;
  startAt: ISO | null;
  endAt: ISO | null;
  startValue: Dec | null;
  endValue: Dec | null;
  returnPct: Dec | null;
  reason: string | null;
  evidenceIds: string[];
};

function latestBefore(
  rows: TimedObservation[],
  symbol: string,
  before: ISO,
  maxAgeMs: number,
): TimedObservation | null {
  const candidates = rows
    .filter((r) => r.symbol === symbol && r.observedAt < before)
    .sort((a, b) => (a.observedAt < b.observedAt ? 1 : -1));
  const releaseMs = Date.parse(before);
  for (const c of candidates) {
    const age = releaseMs - Date.parse(c.observedAt);
    if (age >= 0 && age <= maxAgeMs) return c;
    if (age > maxAgeMs) break;
  }
  return null;
}

function endpointAt(
  rows: TimedObservation[],
  symbol: string,
  target: ISO,
  toleranceMs: number,
  asOf: ISO,
): TimedObservation | null {
  // Exact or latest earlier within tolerance; never interpolate using future samples
  const eligible = rows.filter(
    (r) =>
      r.symbol === symbol &&
      r.observedAt <= target &&
      r.availableAt <= asOf &&
      Date.parse(target) - Date.parse(r.observedAt) <= toleranceMs,
  );
  if (!eligible.length) return null;
  eligible.sort((a, b) => (a.observedAt < b.observedAt ? 1 : -1));
  return eligible[0] ?? null;
}

function pctReturn(start: string, end: string): string | null {
  const s = parseDec(start);
  const e = parseDec(end);
  if (!s.ok || !e.ok || s.value === null || e.value === null) return null;
  if (s.value === "0") return null;
  const ratio = decDiv(e.value, s.value, 12);
  if (ratio === null) return null;
  return canonicalize(decMul(decSub(ratio, "1"), "100"));
}

const WINDOWS: { id: WindowId; startMin: number; endMin: number }[] = [
  { id: "0-5", startMin: 0, endMin: 5 },
  { id: "5-15", startMin: 5, endMin: 15 },
  { id: "15-60", startMin: 15, endMin: 60 },
];

/**
 * Interval returns 0→5, 5→15, 15→60.
 * Baseline: latest observation strictly before release within maxAge (e.g. 60s).
 * Endpoints: exact or latest earlier within tolerance (e.g. 30s).
 */
export function computeWindowReturns(input: {
  symbol: string;
  releaseAt: ISO;
  observations: TimedObservation[];
  asOf: ISO;
  maxAgeMs?: number;
  toleranceMs?: number;
}): WindowReturn[] {
  const maxAge = input.maxAgeMs ?? 60_000;
  const tol = input.toleranceMs ?? 30_000;
  const issues: WindowReturn[] = [];

  for (const ts of [input.releaseAt, input.asOf]) {
    const z = assertZonedInstant(ts);
    if (!z.ok) {
      return WINDOWS.map((w) => ({
        window: w.id,
        startAt: null,
        endAt: null,
        startValue: null,
        endValue: null,
        returnPct: null,
        reason: z.reason ?? "BAD_TS",
        evidenceIds: [],
      }));
    }
  }

  const releaseMs = Date.parse(input.releaseAt);
  const asOfMs = Date.parse(input.asOf);

  for (const w of WINDOWS) {
    const startTarget = new Date(releaseMs + w.startMin * 60_000).toISOString();
    const endTarget = new Date(releaseMs + w.endMin * 60_000).toISOString();

    if (asOfMs < Date.parse(endTarget)) {
      issues.push({
        window: w.id,
        startAt: null,
        endAt: null,
        startValue: null,
        endValue: null,
        returnPct: null,
        reason: "WINDOW_NOT_ELAPSED",
        evidenceIds: [],
      });
      continue;
    }

    const startObs =
      w.startMin === 0
        ? latestBefore(input.observations, input.symbol, input.releaseAt, maxAge)
        : endpointAt(
            input.observations,
            input.symbol,
            startTarget,
            tol,
            input.asOf,
          );
    const endObs = endpointAt(
      input.observations,
      input.symbol,
      endTarget,
      tol,
      input.asOf,
    );

    if (!startObs || !endObs) {
      issues.push({
        window: w.id,
        startAt: startObs?.observedAt ?? null,
        endAt: endObs?.observedAt ?? null,
        startValue: startObs?.value ?? null,
        endValue: endObs?.value ?? null,
        returnPct: null,
        reason: !startObs ? "MISSING_START" : "MISSING_END",
        evidenceIds: [
          ...(startObs?.evidenceIds ?? []),
          ...(endObs?.evidenceIds ?? []),
        ],
      });
      continue;
    }

    const ret = pctReturn(startObs.value, endObs.value);
    issues.push({
      window: w.id,
      startAt: startObs.observedAt,
      endAt: endObs.observedAt,
      startValue: startObs.value,
      endValue: endObs.value,
      returnPct: ret,
      reason: ret === null ? "RETURN_NULL" : null,
      evidenceIds: [...startObs.evidenceIds, ...endObs.evidenceIds],
    });
  }

  return issues;
}

/** Prompt fixture helpers */
export const WINDOW_FIXTURE_EURUSD = {
  releaseAt: "2024-03-01T13:30:00.000Z",
  points: [
    { at: "2024-03-01T13:29:30.000Z", v: "1.1000" },
    { at: "2024-03-01T13:35:00.000Z", v: "1.1011" },
    { at: "2024-03-01T13:45:00.000Z", v: "1.1000" },
    { at: "2024-03-01T14:30:00.000Z", v: "1.1022" },
  ],
};
