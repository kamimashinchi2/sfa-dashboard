import type { Fact, SetupState } from "./contracts";

export type TouchPolicy = "TOUCH" | "CLOSE";

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
};

export type OhlcFrame = {
  index: number;
  open: string;
  high: string;
  low: string;
  close: string;
  closed: boolean;
  facts: Record<string, Fact>;
};

export type SetupEvalInput = {
  scenario: SetupScenario | null;
  frames: OhlcFrame[];
  /** Replay cursor: only frames with index <= cursor are visible/evaluable. */
  cursor: number;
  studentHypotheses: Record<string, boolean>;
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
  // TOUCH: equality allowed for chase; invalidation equality invalidates
  if (side === "above") {
    return Number(frame.high) >= lvl;
  }
  return Number(frame.low) <= lvl;
}

function inBand(price: number, low: string, high: string): boolean {
  return price >= Number(low) && price <= Number(high);
}

/**
 * SWEEP_REVERSAL setup evaluator. Pure — no Date.now / network / storage.
 * Models 2/3 return INCOMPLETE preview until predicates are reviewed.
 */
export function evaluateSetup(input: SetupEvalInput): {
  state: SetupState;
  reasons: string[];
  visibleFrames: OhlcFrame[];
} {
  const reasons: string[] = [];
  if (!input.scenario) {
    return { state: "INCOMPLETE", reasons: ["MALFORMED_PACKET"], visibleFrames: [] };
  }

  const scenario = input.scenario;
  const visibleFrames = input.frames
    .filter((f) => f.index <= input.cursor)
    .sort((a, b) => a.index - b.index);

  if (scenario.model !== "SWEEP_REVERSAL") {
    return {
      state: "INCOMPLETE",
      reasons: ["MODEL_PREVIEW_ONLY"],
      visibleFrames,
    };
  }

  if (visibleFrames.some((f) => !isPositiveOhlc(f))) {
    return { state: "INCOMPLETE", reasons: ["MALFORMED_OHLC"], visibleFrames };
  }

  // Sticky invalidation — equality invalidates
  const invSide = scenario.direction === "LONG" ? "below" : "above";
  for (const frame of visibleFrames) {
    if (crosses(scenario.invalidationLevel, frame, scenario.policy, invSide)) {
      return {
        state: "INVALIDATED",
        reasons: ["OBSERVED_INVALIDATION"],
        visibleFrames,
      };
    }
  }

  // Chase / expiry — equality allowed for chase breach
  const chaseSide = scenario.direction === "LONG" ? "above" : "below";
  for (const frame of visibleFrames) {
    if (crosses(scenario.chaseBoundary, frame, "TOUCH", chaseSide)) {
      return {
        state: "MISSED_OR_EXPIRED",
        reasons: ["CHASE_OR_EXPIRY"],
        visibleFrames,
      };
    }
  }

  // Required facts from authored evidence on visible closed frames only
  const observed: Record<string, Fact> = {};
  for (const frame of visibleFrames) {
    if (!frame.closed) continue;
    for (const [k, v] of Object.entries(frame.facts)) {
      observed[k] = v;
    }
  }

  for (const factId of scenario.requiredFacts) {
    const v = observed[factId];
    if (v === undefined || v === "UNKNOWN") {
      reasons.push(`UNKNOWN_FACT:${factId}`);
      return { state: "INCOMPLETE", reasons, visibleFrames };
    }
  }

  const htf = observed["HTF_BIAS"];
  const sweep = observed["SWEEP"];
  const mss = observed["MSS_CLOSED"];

  if (htf !== "YES" || sweep !== "YES") {
    reasons.push("HTF_OR_SWEEP_ABSENT");
    return { state: "EARLY_WATCH", reasons, visibleFrames };
  }

  if (mss !== "YES") {
    reasons.push("MSS_UNCLOSED");
    return { state: "INCOMPLETE", reasons, visibleFrames };
  }

  const last = visibleFrames[visibleFrames.length - 1];
  if (!last) {
    return { state: "INCOMPLETE", reasons: ["NO_FRAMES"], visibleFrames };
  }

  const px = Number(last.close);
  const armed: SetupState =
    scenario.direction === "LONG" ? "ARMED_LONG" : "ARMED_SHORT";

  const displacement = observed["DISPLACEMENT"];
  if (displacement !== "YES") {
    reasons.push("CONFIRMATIONS_PENDING");
    return { state: armed, reasons, visibleFrames };
  }

  if (
    inBand(px, scenario.momentumBand.low, scenario.momentumBand.high)
  ) {
    return {
      state: "MOMENTUM_ENTRY_ACTIVE",
      reasons: ["INSIDE_MOMENTUM_BAND"],
      visibleFrames,
    };
  }

  if (
    inBand(px, scenario.retracementZone.low, scenario.retracementZone.high)
  ) {
    return {
      state: "RETRACEMENT_ENTRY_ACTIVE",
      reasons: ["INSIDE_RETRACEMENT_ZONE"],
      visibleFrames,
    };
  }

  return {
    state: "PENDING_RETRACEMENT",
    reasons: ["AWAITING_RETRACEMENT"],
    visibleFrames,
  };
}
