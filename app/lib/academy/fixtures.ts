import type { OhlcFrame, SetupScenario } from "./setup";
import type { MacroAlternative } from "./macro";

export const sweepReversalScenario: SetupScenario = {
  id: "SYN-SWEEP-REV-LONG-1",
  version: 1,
  model: "SWEEP_REVERSAL",
  direction: "LONG",
  path: "HTF_BULL → SWEEP_LOWS → CLOSED_MSS → DISPLACEMENT",
  requiredFacts: ["HTF_BIAS", "SWEEP", "MSS_CLOSED", "DISPLACEMENT"],
  inclusiveWindow: { start: 0, end: 12 },
  momentumBand: { low: "2502", high: "2508" },
  retracementZone: { low: "2494", high: "2500" },
  chaseBoundary: "2515",
  invalidationLevel: "2488",
  policy: "CLOSE",
  assumptions: [
    "Authored scenario thresholds — not verified Academy doctrine",
    "TOUCH/CLOSE policy per packet",
  ],
  evidenceIds: ["ev-htf-1", "ev-sweep-1", "ev-mss-1", "ev-disp-1"],
};

/** Synthetic OHLC — inspectable educational fixture. */
export const sweepReversalFrames: OhlcFrame[] = [
  {
    index: 0,
    open: "2495",
    high: "2498",
    low: "2492",
    close: "2496",
    closed: true,
    facts: { HTF_BIAS: "YES" },
  },
  {
    index: 1,
    open: "2496",
    high: "2497",
    low: "2489",
    close: "2490",
    closed: true,
    facts: { SWEEP: "YES" },
  },
  {
    index: 2,
    open: "2490",
    high: "2501",
    low: "2489",
    close: "2500",
    closed: true,
    facts: { MSS_CLOSED: "YES" },
  },
  {
    index: 3,
    open: "2500",
    high: "2507",
    low: "2499",
    close: "2505",
    closed: true,
    facts: { DISPLACEMENT: "YES" },
  },
  {
    index: 4,
    open: "2505",
    high: "2506",
    low: "2496",
    close: "2497",
    closed: true,
    facts: {},
  },
  {
    index: 5,
    open: "2497",
    high: "2520",
    low: "2496",
    close: "2518",
    closed: true,
    facts: {},
  },
];

export const cpiMacroAlternatives: MacroAlternative[] = [
  {
    id: "ALT_SURPRISE_HOT_USD",
    edges: [
      { from: "DATA", to: "SURPRISE_PRICED_IN", condition: "NOT_PRICED" },
      { from: "SURPRISE_PRICED_IN", to: "FED_REPRICING", condition: "HAWKISH_SHIFT" },
      { from: "FED_REPRICING", to: "US2Y", condition: "YIELDS_UP" },
      { from: "US2Y", to: "DXY", condition: "USD_BID" },
      { from: "DXY", to: "GOLD", condition: "GOLD_PRESSURED" },
    ],
    assumptions: [
      "Surprise not priced in",
      "TIPS observed separately from nominal-minus-CPI arithmetic",
    ],
    conclusions: [
      "Conditional USD bid window",
      "Gold bias unproven without TIPS/DXY evidence completeness",
    ],
  },
  {
    id: "ALT_ALREADY_PRICED",
    edges: [
      { from: "DATA", to: "SURPRISE_PRICED_IN", condition: "ALREADY_PRICED" },
      { from: "SURPRISE_PRICED_IN", to: "VIX", condition: "VOL_FADE" },
    ],
    assumptions: ["Print largely anticipated"],
    conclusions: ["Muted transmission", "No automatic gold entry"],
  },
];

export const unsafeRiskExample = {
  label: "PROVIDED_UNSAFE_EXAMPLE",
  equity: "10000",
  riskPct: "2",
  entry: "2500",
  stop: "2492",
  target: "2516",
  note: "Correct rejection/correction is successful learning.",
};
