import { describe, expect, it } from "vitest";
import { sweepReversalFrames, sweepReversalScenario } from "./fixtures";
import { evaluateSetup } from "./setup";

describe("setup engine", () => {
  it("excludes future frames beyond cursor", () => {
    const r = evaluateSetup({
      scenario: sweepReversalScenario,
      frames: sweepReversalFrames,
      cursor: 1,
      studentHypotheses: {},
    });
    expect(r.visibleFrames.every((f) => f.index <= 1)).toBe(true);
    expect(r.visibleFrames.length).toBe(2);
  });

  it("reaches momentum then chase becomes MISSED_OR_EXPIRED", () => {
    const armed = evaluateSetup({
      scenario: sweepReversalScenario,
      frames: sweepReversalFrames,
      cursor: 3,
      studentHypotheses: {},
    });
    expect(armed.state).toBe("MOMENTUM_ENTRY_ACTIVE");

    const chased = evaluateSetup({
      scenario: sweepReversalScenario,
      frames: sweepReversalFrames,
      cursor: 5,
      studentHypotheses: {},
    });
    expect(chased.state).toBe("MISSED_OR_EXPIRED");
  });

  it("malformed packet → INCOMPLETE", () => {
    const r = evaluateSetup({
      scenario: null,
      frames: [],
      cursor: 0,
      studentHypotheses: {},
    });
    expect(r.state).toBe("INCOMPLETE");
  });
});
