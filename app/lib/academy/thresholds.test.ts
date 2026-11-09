import { describe, expect, it } from "vitest";
import {
  claimPracticalVerdict,
  claimQuizVerdict,
  QUIZ_THRESHOLDS,
  PRACTICAL_THRESHOLDS,
} from "./thresholds";

describe("proposed threshold boundaries (owner confirmation required)", () => {
  it("quiz 80/60 bands", () => {
    expect(QUIZ_THRESHOLDS.approvedMin).toBe(80);
    expect(QUIZ_THRESHOLDS.partialMin).toBe(60);
    expect(claimQuizVerdict(80)).toBe("APPROVED");
    expect(claimQuizVerdict(79)).toBe("PARTIALLY_APPROVED");
    expect(claimQuizVerdict(60)).toBe("PARTIALLY_APPROVED");
    expect(claimQuizVerdict(59)).toBe("NOT_APPROVED");
  });

  it("practical 80/65 bands + hard block", () => {
    expect(PRACTICAL_THRESHOLDS.approvedMin).toBe(80);
    expect(PRACTICAL_THRESHOLDS.partialMin).toBe(65);
    expect(claimPracticalVerdict(80, false)).toBe("APPROVED");
    expect(claimPracticalVerdict(65, false)).toBe("PARTIALLY_APPROVED");
    expect(claimPracticalVerdict(64, false)).toBe("NOT_APPROVED");
    expect(claimPracticalVerdict(100, true)).toBe("NOT_APPROVED");
  });
});
