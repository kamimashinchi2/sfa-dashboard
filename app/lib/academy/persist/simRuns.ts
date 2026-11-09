import type { CalcHistoryEntry } from "../contracts";
import { guardUnknown } from "./guards";
import {
  defaultSimRuns,
  type SimRunRecord,
  type SimRunsStore,
  type StudentDecision,
} from "./types";

export const SIM_RUNS_CAP = 100;

export function guardSimRuns(raw: unknown): {
  ok: boolean;
  value: SimRunsStore | null;
  reason?: string;
} {
  const g = guardUnknown(raw);
  if (!g.ok) return { ok: false, value: null, reason: g.reason };
  if (!raw || typeof raw !== "object") {
    return { ok: false, value: null, reason: "NOT_OBJECT" };
  }
  const o = raw as Partial<SimRunsStore>;
  const entries = Array.isArray(o.entries) ? o.entries : [];
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      entries: entries.slice(0, SIM_RUNS_CAP) as SimRunRecord[],
    },
  };
}

export function pushSimRun(
  store: SimRunsStore,
  next: SimRunRecord,
  cap = SIM_RUNS_CAP,
): SimRunsStore {
  const without = store.entries.filter((e) => e.runId !== next.runId);
  return {
    schemaVersion: 1,
    entries: [next, ...without].slice(0, cap),
  };
}

export function mergeSimRuns(
  a: SimRunRecord[],
  b: SimRunRecord[],
  cap = SIM_RUNS_CAP,
): SimRunRecord[] {
  const map = new Map<string, SimRunRecord>();
  for (const e of [...a, ...b]) {
    const prev = map.get(e.runId);
    if (!prev || prev.atISO < e.atISO) map.set(e.runId, e);
  }
  return [...map.values()]
    .sort((x, y) => (x.atISO < y.atISO ? 1 : -1))
    .slice(0, cap);
}

export function updateSimRunDecision(
  store: SimRunsStore,
  runId: string,
  decision: StudentDecision,
  note?: string | null,
): SimRunsStore {
  return {
    schemaVersion: 1,
    entries: store.entries.map((e) =>
      e.runId === runId
        ? { ...e, studentDecision: decision, note: note ?? e.note }
        : e,
    ),
  };
}

/** Map a calc-history entry into a SimRunRecord (no duplicate engine call). */
export function calcHistoryToSimRun(
  entry: CalcHistoryEntry,
  opts?: { missionId?: string | null; studentDecision?: StudentDecision },
): SimRunRecord {
  const inp = entry.input;
  const spec = inp.spec;
  return {
    runId: entry.id,
    tool: "risk-grid",
    missionId: opts?.missionId ?? null,
    atISO: entry.atISO,
    engineVersion: entry.engineVersion,
    inputs: {
      instrument: entry.instrument,
      specId: spec?.id ?? null,
      model: spec?.model ?? null,
      contractSize: spec?.contractSize ?? null,
      pipSize: spec?.pipSize ?? null,
      pipValueQuotePerLot: spec?.pipValueQuotePerLot ?? null,
      tickSize: spec?.tickSize ?? null,
      tickValuePerLot: spec?.tickValuePerLot ?? null,
      pnlCurrency: spec?.pnlCurrency ?? null,
      accountCurrency: inp.accountCurrency,
      conversion: inp.conversion,
      lotStep: spec?.lotStep ?? null,
      minLot: spec?.minLot ?? null,
      maxLot: spec?.maxLot ?? null,
      equity: inp.equity,
      riskPct: inp.riskPct,
      direction: inp.direction,
      entry: inp.entry,
      stop: inp.stop,
      target: inp.target,
      stopType: entry.stopType,
      preEntry: inp.preEntry,
    },
    outputs: {
      budget: entry.result.budget,
      lots: entry.result.maxLots,
      loss: entry.result.loss,
      grossRR: entry.result.grossRR,
    },
    status: entry.status,
    issueCodes: entry.result.issues.map((i) => i.code),
    studentDecision: opts?.studentDecision ?? "EXPLORATION",
    note: null,
  };
}

export function sanitizeImportedSimRuns(store: SimRunsStore): SimRunsStore {
  return guardSimRuns(store).value ?? defaultSimRuns();
}
