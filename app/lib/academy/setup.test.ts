import { describe, expect, it } from "vitest";
import {
  sweepReversalFrames,
  sweepReversalScenario,
} from "./fixtures";
import { evaluateSetup, migrateSetupState, validateAnnotations } from "./setup";

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

  it("exposes FVG/OB evidence before momentum", () => {
    const early = evaluateSetup({
      scenario: sweepReversalScenario,
      frames: sweepReversalFrames,
      cursor: 2,
      studentHypotheses: {},
    });
    // Displacement fact not yet → incomplete on required facts
    expect(early.state === "INCOMPLETE" || early.state === "ARMED_LONG").toBe(true);
    expect(early.evidence.zones.every((z) => z.knownAtFrame <= 2)).toBe(true);

    const armed = evaluateSetup({
      scenario: sweepReversalScenario,
      frames: sweepReversalFrames,
      cursor: 3,
      studentHypotheses: {},
    });
    expect(armed.state).toBe("SETUP_CONFIRMED_MOMENTUM_STATE");
    expect(armed.evidence.zones.some((z) => z.kind === "FVG")).toBe(true);
    expect(armed.reasons.some((r) => r.startsWith("ZONE:"))).toBe(true);

    const noZoneScenario = {
      ...sweepReversalScenario,
      zones: sweepReversalScenario.zones?.filter((z) => z.kind === "PDH"),
    };
    const withoutFvg = evaluateSetup({
      scenario: noZoneScenario,
      frames: sweepReversalFrames,
      cursor: 3,
      studentHypotheses: {},
    });
    expect(withoutFvg.state).toBe("ARMED_LONG");
    expect(withoutFvg.reasons).toContain("MISSING_FVG_OB_EVIDENCE");
  });

  it("reaches momentum then chase becomes SETUP_EXPIRED_OR_CHASE_ZONE", () => {
    const armed = evaluateSetup({
      scenario: sweepReversalScenario,
      frames: sweepReversalFrames,
      cursor: 3,
      studentHypotheses: {},
    });
    expect(armed.state).toBe("SETUP_CONFIRMED_MOMENTUM_STATE");

    const chased = evaluateSetup({
      scenario: sweepReversalScenario,
      frames: sweepReversalFrames,
      cursor: 5,
      studentHypotheses: {},
    });
    expect(chased.state).toBe("SETUP_EXPIRED_OR_CHASE_ZONE");
  });

  it("migrates legacy *_ENTRY_ACTIVE labels", () => {
    expect(migrateSetupState("MOMENTUM_ENTRY_ACTIVE")).toBe(
      "SETUP_CONFIRMED_MOMENTUM_STATE",
    );
    expect(migrateSetupState("RETRACEMENT_ENTRY_ACTIVE")).toBe(
      "SETUP_CONFIRMED_RETRACEMENT_STATE",
    );
    expect(migrateSetupState("MISSED_OR_EXPIRED")).toBe(
      "SETUP_EXPIRED_OR_CHASE_ZONE",
    );
  });

  it("validates PDH/sweep annotations against evidence", () => {
    const fail = validateAnnotations({
      scenario: sweepReversalScenario,
      frames: sweepReversalFrames,
      cursor: 3,
      markedPdh: false,
      markedSweep: false,
      orderType: null,
    });
    expect(fail.pass).toBe(false);

    const pass = validateAnnotations({
      scenario: sweepReversalScenario,
      frames: sweepReversalFrames,
      cursor: 3,
      markedPdh: true,
      markedSweep: true,
      orderType: "LIMIT",
    });
    expect(pass.pass).toBe(true);
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
