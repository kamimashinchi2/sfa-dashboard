import { describe, expect, it } from "vitest";
import {
  reconcileJournalStage,
  stageFromAdvanced,
  stageFromMission,
} from "./stageRegistry";

describe("stage registry", () => {
  it("derives stage from mission — M5 is not Stage 1", () => {
    expect(stageFromMission("M1")).toBe(1);
    expect(stageFromMission("M5")).toBe(6);
    expect(stageFromMission("M5")).not.toBe(1);
  });

  it("derives stage from advanced modules", () => {
    expect(stageFromAdvanced("A6")).toBe(6);
    expect(stageFromAdvanced("A7")).toBe(7);
    expect(stageFromAdvanced("A8")).toBe(8);
  });

  it("reconciles mismatched journal stage to registry", () => {
    const r = reconcileJournalStage({
      stage: 1,
      missionId: "M5",
      advancedModule: null,
    });
    expect(r.stage).toBe(6);
    expect(r.warning).toContain("STAGE_MISMATCH");
  });
});
