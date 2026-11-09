import type { Dec, ISO } from "./contracts";
import {
  canonicalize,
  decAdd,
  decCompare,
  decDiv,
  decSub,
  parseDec,
} from "./decimal";

export type Hypothesis = {
  id: string;
  version: number;
  parentVersion: number | null;
  datasetId: string;
  datasetVersion: number;
  lockedAt: ISO | null;
  canonicalDigest: string | null;
  claim: string;
  eligibility: string;
  outcome: string;
  baseline: string;
  falsification: string;
  exclusions: string;
  missingPolicy: string;
  trainEnd: ISO;
  testStart: ISO;
  parameterVersion: string;
  costRPerObservation: Dec;
};

export type ResearchRow = {
  id: string;
  eventAt: ISO;
  outcomeEnd: ISO;
  availableAt: ISO;
  grossR: Dec;
  costR: Dec | null;
  eligible: boolean;
};

export type PartitionMetrics = {
  n: number;
  sumNetR: Dec | null;
  meanNetR: Dec | null;
  wins: number;
  profitFactor: Dec | null;
  profitFactorReason: string | null;
  label: "TRAIN" | "TEST" | "EXPLORATORY";
};

export type ResearchEval = {
  ok: boolean;
  issues: { field: string; code: string; evidenceIds: string[] }[];
  train: PartitionMetrics | null;
  test: PartitionMetrics | null;
  contaminated: boolean;
};

function simpleDigest(h: Hypothesis): string {
  const payload = [
    h.claim,
    h.eligibility,
    h.outcome,
    h.baseline,
    h.falsification,
    h.exclusions,
    h.missingPolicy,
    h.trainEnd,
    h.testStart,
    h.parameterVersion,
    h.costRPerObservation,
    h.datasetId,
    String(h.datasetVersion),
  ].join("|");
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 31 + payload.charCodeAt(i)) >>> 0;
  }
  return `d${hash.toString(16)}`;
}

export function lockHypothesis(h: Hypothesis, clockISO: ISO): Hypothesis {
  return {
    ...h,
    lockedAt: clockISO,
    canonicalDigest: simpleDigest(h),
  };
}

export function reviseHypothesis(
  h: Hypothesis,
  patch: Partial<Hypothesis>,
): Hypothesis {
  return {
    ...h,
    ...patch,
    version: h.version + 1,
    parentVersion: h.version,
    lockedAt: null,
    canonicalDigest: null,
  };
}

function requirePrereg(h: Hypothesis): string[] {
  const missing: string[] = [];
  const fields: (keyof Hypothesis)[] = [
    "claim",
    "eligibility",
    "outcome",
    "baseline",
    "falsification",
    "exclusions",
    "missingPolicy",
    "trainEnd",
    "testStart",
    "parameterVersion",
    "costRPerObservation",
  ];
  for (const f of fields) {
    const v = h[f];
    if (v === null || v === undefined || String(v).trim() === "") {
      missing.push(String(f));
    }
  }
  return missing;
}

function metricsFor(
  rows: ResearchRow[],
  label: PartitionMetrics["label"],
): PartitionMetrics {
  if (!rows.length) {
    return {
      n: 0,
      sumNetR: null,
      meanNetR: null,
      wins: 0,
      profitFactor: null,
      profitFactorReason: "EMPTY",
      label,
    };
  }
  let sum = "0";
  let wins = 0;
  let pos = "0";
  let negAbs = "0";
  for (const r of rows) {
    if (r.costR === null) {
      return {
        n: rows.length,
        sumNetR: null,
        meanNetR: null,
        wins: 0,
        profitFactor: null,
        profitFactorReason: "UNKNOWN_COST",
        label,
      };
    }
    const net = canonicalize(decSub(r.grossR, r.costR));
    sum = canonicalize(decAdd(sum, net));
    if (decCompare(net, "0") > 0) {
      wins++;
      pos = canonicalize(decAdd(pos, net));
    } else if (decCompare(net, "0") < 0) {
      const abs = net.startsWith("-") ? net.slice(1) : net;
      negAbs = canonicalize(decAdd(negAbs, abs));
    }
  }
  const mean = decDiv(sum, String(rows.length), 12);
  let profitFactor: string | null = null;
  let profitFactorReason: string | null = null;
  if (decCompare(negAbs, "0") === 0) {
    profitFactor = null;
    profitFactorReason = "NO_LOSSES";
  } else {
    profitFactor = decDiv(pos, negAbs, 12);
    profitFactorReason = profitFactor === null ? "DEC_ERROR" : null;
  }
  return {
    n: rows.length,
    sumNetR: sum,
    meanNetR: mean,
    wins,
    profitFactor,
    profitFactorReason,
    label,
  };
}

/**
 * Pure research evaluator. Explicit clock only — no Date.now.
 * Purges overlapping outcome windows; unknown costs stay null.
 */
export function evaluateResearch(input: {
  hypothesis: Hypothesis;
  rows: ResearchRow[];
  parametersFrozen: boolean;
  tunedAfterTestReveal: boolean;
  clockISO: ISO;
}): ResearchEval {
  const issues: ResearchEval["issues"] = [];
  const missing = requirePrereg(input.hypothesis);
  for (const f of missing) {
    issues.push({ field: f, code: "PREREG_INCOMPLETE", evidenceIds: [] });
  }
  if (!input.hypothesis.lockedAt || !input.hypothesis.canonicalDigest) {
    issues.push({
      field: "lockedAt",
      code: "HYPOTHESIS_UNLOCKED",
      evidenceIds: [],
    });
  }
  if (input.hypothesis.trainEnd >= input.hypothesis.testStart) {
    issues.push({
      field: "trainEnd",
      code: "SPLIT_ORDER",
      evidenceIds: [],
    });
  }

  const cutoff = input.hypothesis.trainEnd;
  const trainRaw = input.rows.filter(
    (r) => r.eventAt <= cutoff && r.eligible,
  );
  const testRaw = input.rows.filter(
    (r) => r.eventAt >= input.hypothesis.testStart && r.eligible,
  );

  const train = trainRaw.filter((r) => r.outcomeEnd <= cutoff);
  const purged = trainRaw.length - train.length;
  if (purged > 0) {
    issues.push({
      field: "outcomeEnd",
      code: "TRAIN_OUTCOME_OVERLAP_PURGED",
      evidenceIds: trainRaw
        .filter((r) => r.outcomeEnd > cutoff)
        .map((r) => r.id),
    });
  }

  for (const r of [...train, ...testRaw]) {
    if (r.availableAt > input.clockISO) {
      issues.push({
        field: "availableAt",
        code: "FUTURE_AVAILABILITY",
        evidenceIds: [r.id],
      });
    }
  }

  const contaminated = input.tunedAfterTestReveal;
  const testLabel = contaminated ? "EXPLORATORY" : "TEST";
  if (contaminated) {
    issues.push({
      field: "parameterVersion",
      code: "TEST_CONTAMINATION",
      evidenceIds: [],
    });
  }
  if (!input.parametersFrozen && testRaw.length) {
    issues.push({
      field: "parametersFrozen",
      code: "PARAMS_NOT_FROZEN",
      evidenceIds: [],
    });
  }

  const withCosts = (rows: ResearchRow[]) =>
    rows.map((r) => {
      if (r.costR !== null) return r;
      const c = parseDec(input.hypothesis.costRPerObservation);
      if (!c.ok || c.value === null) return { ...r, costR: null };
      return { ...r, costR: c.value };
    });

  const trainM = metricsFor(withCosts(train), "TRAIN");
  const testM = metricsFor(withCosts(testRaw), testLabel);

  const blocking = issues.filter(
    (i) =>
      i.code !== "TRAIN_OUTCOME_OVERLAP_PURGED" &&
      i.code !== "TEST_CONTAMINATION",
  );

  return {
    ok: blocking.length === 0 && missing.length === 0,
    issues,
    train: trainM,
    test: testM,
    contaminated,
  };
}

/** Fixture: TRAIN gross [2,-1,2,-1], TEST [-1,-1,2,-1], cost 0.1R */
export const RESEARCH_FIXTURE_ROWS: ResearchRow[] = [
  {
    id: "tr1",
    eventAt: "2024-01-01T00:00:00.000Z",
    outcomeEnd: "2024-01-01T01:00:00.000Z",
    availableAt: "2024-01-01T01:00:00.000Z",
    grossR: "2",
    costR: "0.1",
    eligible: true,
  },
  {
    id: "tr2",
    eventAt: "2024-01-02T00:00:00.000Z",
    outcomeEnd: "2024-01-02T01:00:00.000Z",
    availableAt: "2024-01-02T01:00:00.000Z",
    grossR: "-1",
    costR: "0.1",
    eligible: true,
  },
  {
    id: "tr3",
    eventAt: "2024-01-03T00:00:00.000Z",
    outcomeEnd: "2024-01-03T01:00:00.000Z",
    availableAt: "2024-01-03T01:00:00.000Z",
    grossR: "2",
    costR: "0.1",
    eligible: true,
  },
  {
    id: "tr4",
    eventAt: "2024-01-04T00:00:00.000Z",
    outcomeEnd: "2024-01-04T01:00:00.000Z",
    availableAt: "2024-01-04T01:00:00.000Z",
    grossR: "-1",
    costR: "0.1",
    eligible: true,
  },
  {
    id: "te1",
    eventAt: "2024-02-01T00:00:00.000Z",
    outcomeEnd: "2024-02-01T01:00:00.000Z",
    availableAt: "2024-02-01T01:00:00.000Z",
    grossR: "-1",
    costR: "0.1",
    eligible: true,
  },
  {
    id: "te2",
    eventAt: "2024-02-02T00:00:00.000Z",
    outcomeEnd: "2024-02-02T01:00:00.000Z",
    availableAt: "2024-02-02T01:00:00.000Z",
    grossR: "-1",
    costR: "0.1",
    eligible: true,
  },
  {
    id: "te3",
    eventAt: "2024-02-03T00:00:00.000Z",
    outcomeEnd: "2024-02-03T01:00:00.000Z",
    availableAt: "2024-02-03T01:00:00.000Z",
    grossR: "2",
    costR: "0.1",
    eligible: true,
  },
  {
    id: "te4",
    eventAt: "2024-02-04T00:00:00.000Z",
    outcomeEnd: "2024-02-04T01:00:00.000Z",
    availableAt: "2024-02-04T01:00:00.000Z",
    grossR: "-1",
    costR: "0.1",
    eligible: true,
  },
];

export function researchFixtureHypothesis(): Hypothesis {
  return {
    id: "hyp-syn-1",
    version: 1,
    parentVersion: null,
    datasetId: "syn-research-1",
    datasetVersion: 1,
    lockedAt: null,
    canonicalDigest: null,
    claim: "Synthetic mean-reversion after sweep",
    eligibility: "Closed M5 sweep+MSS",
    outcome: "netR over 60m",
    baseline: "Flat 0R",
    falsification: "meanNetR TRAIN <= 0",
    exclusions: "News windows",
    missingPolicy: "Drop ineligible; never invent costs",
    trainEnd: "2024-01-31T23:59:59.000Z",
    testStart: "2024-02-01T00:00:00.000Z",
    parameterVersion: "p1",
    costRPerObservation: "0.1",
  };
}
