import type { Fact, SetupState } from "./contracts";
import { migrateSetupState } from "./contracts";
import { decCompare, parseDec } from "./decimal";

export { migrateSetupState };

export type TouchPolicy = "TOUCH" | "CLOSE";

export type AuthoredZone = {
  id: string;
  kind: "FVG" | "OB" | "PDH" | "PDL" | "SWING";
  low: string;
  high: string;
  knownAtFrame: number;
  evidenceIds: string[];
  direction?: "BULLISH" | "BEARISH";
};

export type SetupScenario = {
  id: string;
  version: number;
  model: "SWEEP_REVERSAL" | "MODEL_2_PREVIEW" | "MODEL_3_PREVIEW";
  direction: "LONG" | "SHORT";
  path: string;
  requiredFacts: string[];
  inclusiveWindow: { start: number; end: number };
  momentumBand: { low: string; high: string };
  retracementZone: { low: string; high: string };
  chaseBoundary: string;
  invalidationLevel: string;
  policy: TouchPolicy;
  assumptions: string[];
  evidenceIds: string[];
  /** Authored zones — not invented detectors. */
  zones?: AuthoredZone[];
  /** Body-size / body-to-range thresholds (authored assumptions). */
  displacementThresholds?: {
    minBody: string;
    minBodyToRange: string;
  };
};

export type OhlcFrame = {
  index: number;
  open: string;
  high: string;
  low: string;
  close: string;
  closed: boolean;
  timeframe?: string;
  openAt?: string;
  closeAt?: string;
  availableAt?: string;
  facts: Record<string, Fact>;
};

export type SetupEvalInput = {
  scenario: SetupScenario | null;
  frames: OhlcFrame[];
  /** Replay cursor: only frames with index <= cursor are visible/evaluable. */
  cursor: number;
  studentHypotheses: Record<string, boolean>;
  clockISO?: string;
};

export type SetupEvidenceView = {
  zones: AuthoredZone[];
  momentumBand: { low: string; high: string } | null;
  retracementZone: { low: string; high: string } | null;
  chaseBoundary: string | null;
  invalidationLevel: string | null;
  observedFacts: Record<string, Fact>;
  assumptions: string[];
};

function isPositiveOhlc(f: OhlcFrame): boolean {
  const nums = [f.open, f.high, f.low, f.close].map(Number);
  return nums.every((n) => Number.isFinite(n) && n > 0) && f.high >= f.low;
}

function crosses(
  level: string,
  frame: OhlcFrame,
  policy: TouchPolicy,
  side: "above" | "below",
): boolean {
  const lvl = Number(level);
  if (policy === "CLOSE") {
    return side === "above" ? Number(frame.close) >= lvl : Number(frame.close) <= lvl;
  }
  if (side === "above") {
    return Number(frame.high) >= lvl;
  }
  return Number(frame.low) <= lvl;
}

function inBand(price: number, low: string, high: string): boolean {
  return price >= Number(low) && price <= Number(high);
}

/** Three-bar FVG: bullish first.high < third.low; bearish mirrors. Equality = no gap. */
export function detectAuthoredFvg(
  frames: OhlcFrame[],
  direction: "BULLISH" | "BEARISH",
): { ok: boolean; low: string | null; high: string | null; reason: string } {
  if (frames.length < 3) {
    return { ok: false, low: null, high: null, reason: "NEED_THREE_BARS" };
  }
  const first = frames[frames.length - 3]!;
  const third = frames[frames.length - 1]!;
  if (!third.closed) {
    return { ok: false, low: null, high: null, reason: "THIRD_NOT_CLOSED" };
  }
  if (direction === "BULLISH") {
    if (!(Number(first.high) < Number(third.low))) {
      return { ok: false, low: null, high: null, reason: "NO_BULLISH_GAP" };
    }
    return {
      ok: true,
      low: first.high,
      high: third.low,
      reason: "BULLISH_FVG",
    };
  }
  if (!(Number(first.low) > Number(third.high))) {
    return { ok: false, low: null, high: null, reason: "NO_BEARISH_GAP" };
  }
  return {
    ok: true,
    low: third.high,
    high: first.low,
    reason: "BEARISH_FVG",
  };
}

function displacementOk(
  frame: OhlcFrame,
  thresholds?: SetupScenario["displacementThresholds"],
): boolean {
  if (!thresholds) return true;
  const body = Math.abs(Number(frame.close) - Number(frame.open));
  const range = Number(frame.high) - Number(frame.low);
  if (range <= 0) return false;
  const minBody = parseDec(thresholds.minBody);
  const minRatio = parseDec(thresholds.minBodyToRange);
  if (!minBody.ok || !minRatio.ok || minBody.value === null || minRatio.value === null) {
    return false;
  }
  if (decCompare(String(body), minBody.value) < 0) return false;
  const ratio = body / range;
  return ratio >= Number(minRatio.value);
}

/**
 * SWEEP_REVERSAL setup evaluator. Pure — no Date.now / network / storage.
 * Models 2/3 return INCOMPLETE preview until predicates are reviewed.
 */
export function evaluateSetup(input: SetupEvalInput): {
  state: SetupState;
  reasons: string[];
  visibleFrames: OhlcFrame[];
  evidence: SetupEvidenceView;
} {
  const reasons: string[] = [];
  const emptyEvidence: SetupEvidenceView = {
    zones: [],
    momentumBand: null,
    retracementZone: null,
    chaseBoundary: null,
    invalidationLevel: null,
    observedFacts: {},
    assumptions: [],
  };

  if (!input.scenario) {
    return {
      state: "INCOMPLETE",
      reasons: ["MALFORMED_PACKET"],
      visibleFrames: [],
      evidence: emptyEvidence,
    };
  }

  const scenario = input.scenario;
  const visibleFrames = input.frames
    .filter((f) => f.index <= input.cursor)
    .sort((a, b) => a.index - b.index);

  const knownZones = (scenario.zones ?? []).filter(
    (z) => z.knownAtFrame <= input.cursor,
  );

  const baseEvidence: SetupEvidenceView = {
    zones: knownZones,
    momentumBand: scenario.momentumBand,
    retracementZone: scenario.retracementZone,
    chaseBoundary: scenario.chaseBoundary,
    invalidationLevel: scenario.invalidationLevel,
    observedFacts: {},
    assumptions: scenario.assumptions,
  };

  if (scenario.model !== "SWEEP_REVERSAL") {
    return {
      state: "INCOMPLETE",
      reasons: ["MODEL_PREVIEW_ONLY"],
      visibleFrames,
      evidence: baseEvidence,
    };
  }

  if (visibleFrames.some((f) => !isPositiveOhlc(f))) {
    return {
      state: "INCOMPLETE",
      reasons: ["MALFORMED_OHLC"],
      visibleFrames,
      evidence: baseEvidence,
    };
  }

  // Sticky invalidation — equality invalidates
  const invSide = scenario.direction === "LONG" ? "below" : "above";
  for (const frame of visibleFrames) {
    if (crosses(scenario.invalidationLevel, frame, scenario.policy, invSide)) {
      return {
        state: "INVALIDATED",
        reasons: ["OBSERVED_INVALIDATION"],
        visibleFrames,
        evidence: baseEvidence,
      };
    }
  }

  // Chase / expiry — LONG chase breach is > boundary; SHORT < boundary; equality allowed (TOUCH)
  const chaseSide = scenario.direction === "LONG" ? "above" : "below";
  for (const frame of visibleFrames) {
    if (crosses(scenario.chaseBoundary, frame, "TOUCH", chaseSide)) {
      return {
        state: "SETUP_EXPIRED_OR_CHASE_ZONE",
        reasons: ["CHASE_OR_EXPIRY"],
        visibleFrames,
        evidence: baseEvidence,
      };
    }
  }

  const observed: Record<string, Fact> = {};
  for (const frame of visibleFrames) {
    if (!frame.closed) continue;
    for (const [k, v] of Object.entries(frame.facts)) {
      observed[k] = v;
    }
  }
  baseEvidence.observedFacts = { ...observed };

  for (const factId of scenario.requiredFacts) {
    const v = observed[factId];
    if (v === undefined || v === "UNKNOWN") {
      reasons.push(`UNKNOWN_FACT:${factId}`);
      return {
        state: "INCOMPLETE",
        reasons,
        visibleFrames,
        evidence: baseEvidence,
      };
    }
  }

  const htf = observed["HTF_BIAS"];
  const sweep = observed["SWEEP"];
  const mss = observed["MSS_CLOSED"];

  if (htf !== "YES" || sweep !== "YES") {
    reasons.push("HTF_OR_SWEEP_ABSENT");
    return {
      state: "EARLY_WATCH",
      reasons,
      visibleFrames,
      evidence: baseEvidence,
    };
  }

  if (mss !== "YES") {
    reasons.push("MSS_UNCLOSED");
    return {
      state: "INCOMPLETE",
      reasons,
      visibleFrames,
      evidence: baseEvidence,
    };
  }

  const last = visibleFrames[visibleFrames.length - 1];
  if (!last) {
    return {
      state: "INCOMPLETE",
      reasons: ["NO_FRAMES"],
      visibleFrames,
      evidence: baseEvidence,
    };
  }

  const armed: SetupState =
    scenario.direction === "LONG" ? "ARMED_LONG" : "ARMED_SHORT";

  const displacement = observed["DISPLACEMENT"];
  if (displacement !== "YES" || !displacementOk(last, scenario.displacementThresholds)) {
    reasons.push(
      displacement !== "YES"
        ? "CONFIRMATIONS_PENDING"
        : "DISPLACEMENT_THRESHOLD_FAIL",
    );
    return { state: armed, reasons, visibleFrames, evidence: baseEvidence };
  }

  // Evidence-derived upgrade: momentum/retracement require visible FVG or OB zone
  const fvgOrOb = knownZones.filter((z) => z.kind === "FVG" || z.kind === "OB");
  if (fvgOrOb.length === 0) {
    reasons.push("MISSING_FVG_OB_EVIDENCE");
    return {
      state: armed,
      reasons,
      visibleFrames,
      evidence: baseEvidence,
    };
  }

  const px = Number(last.close);

  if (inBand(px, scenario.momentumBand.low, scenario.momentumBand.high)) {
    return {
      state: "SETUP_CONFIRMED_MOMENTUM_STATE",
      reasons: ["INSIDE_MOMENTUM_BAND", ...fvgOrOb.map((z) => `ZONE:${z.id}`)],
      visibleFrames,
      evidence: baseEvidence,
    };
  }

  if (inBand(px, scenario.retracementZone.low, scenario.retracementZone.high)) {
    return {
      state: "SETUP_CONFIRMED_RETRACEMENT_STATE",
      reasons: ["INSIDE_RETRACEMENT_ZONE", ...fvgOrOb.map((z) => `ZONE:${z.id}`)],
      visibleFrames,
      evidence: baseEvidence,
    };
  }

  return {
    state: "PENDING_RETRACEMENT",
    reasons: ["AWAITING_RETRACEMENT"],
    visibleFrames,
    evidence: baseEvidence,
  };
}

/** Validate student PDH/sweep annotations + order choice against authored evidence. */
export function validateAnnotations(input: {
  scenario: SetupScenario;
  frames: OhlcFrame[];
  cursor: number;
  markedPdh: boolean;
  markedSweep: boolean;
  orderType: "LIMIT" | "STOP" | "MARKET" | null;
}): {
  pass: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const evald = evaluateSetup({
    scenario: input.scenario,
    frames: input.frames,
    cursor: input.cursor,
    studentHypotheses: {},
  });

  const hasPdh = evald.evidence.zones.some((z) => z.kind === "PDH");
  const sweepFact = evald.evidence.observedFacts["SWEEP"] === "YES";

  if (input.markedPdh !== hasPdh) {
    reasons.push(hasPdh ? "PDH_PRESENT_UNMARKED" : "PDH_MARKED_WITHOUT_EVIDENCE");
  }
  if (input.markedSweep !== sweepFact) {
    reasons.push(
      sweepFact ? "SWEEP_PRESENT_UNMARKED" : "SWEEP_MARKED_WITHOUT_EVIDENCE",
    );
  }

  // Teaching: after closed MSS + displacement, prefer LIMIT into zone — not chase MARKET
  const preferLimit =
    evald.state === "SETUP_CONFIRMED_MOMENTUM_STATE" ||
    evald.state === "SETUP_CONFIRMED_RETRACEMENT_STATE" ||
    evald.state === "PENDING_RETRACEMENT" ||
    evald.state === "ARMED_LONG" ||
    evald.state === "ARMED_SHORT";

  if (!input.orderType) {
    reasons.push("ORDER_TYPE_REQUIRED");
  } else if (preferLimit && input.orderType === "MARKET") {
    reasons.push("MARKET_CHASE_DISCOURAGED");
  } else if (preferLimit && input.orderType === "LIMIT") {
    // ok
  } else if (input.orderType === "STOP" && evald.state === "EARLY_WATCH") {
    reasons.push("STOP_TOO_EARLY");
  }

  // Checkbox alone cannot pass — need marks matching evidence + order
  const pass =
    reasons.length === 0 &&
    input.markedPdh &&
    input.markedSweep &&
    input.orderType === "LIMIT";

  if (!pass && reasons.length === 0) {
    reasons.push("INCOMPLETE_ANNOTATION");
  }

  return { pass, reasons };
}
