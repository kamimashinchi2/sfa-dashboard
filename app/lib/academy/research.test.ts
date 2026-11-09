import { describe, expect, it } from "vitest";
import {
  evaluateResearch,
  lockHypothesis,
  RESEARCH_FIXTURE_ROWS,
  researchFixtureHypothesis,
} from "./research";

describe("research lab metrics", () => {
  it("matches TRAIN/TEST fixture expectations", () => {
    const hyp = lockHypothesis(researchFixtureHypothesis(), "2024-03-01T00:00:00.000Z");
    const r = evaluateResearch({
      hypothesis: hyp,
      rows: RESEARCH_FIXTURE_ROWS,
      parametersFrozen: true,
      tunedAfterTestReveal: false,
      clockISO: "2024-03-01T00:00:00.000Z",
    });
    expect(r.train?.n).toBe(4);
    expect(r.train?.sumNetR).toBe("1.6");
    expect(r.train?.meanNetR).toBe("0.4");
    expect(r.test?.n).toBe(4);
    expect(r.test?.sumNetR).toBe("-1.4");
    expect(r.test?.meanNetR).toBe("-0.35");
    expect(r.test?.wins).toBe(1);
    // PF = 1.9 / 3.3
    expect(Number(r.test?.profitFactor)).toBeCloseTo(1.9 / 3.3, 5);
  });

  it("marks contamination as EXPLORATORY", () => {
    const hyp = lockHypothesis(researchFixtureHypothesis(), "2024-03-01T00:00:00.000Z");
    const r = evaluateResearch({
      hypothesis: hyp,
      rows: RESEARCH_FIXTURE_ROWS,
      parametersFrozen: true,
      tunedAfterTestReveal: true,
      clockISO: "2024-03-01T00:00:00.000Z",
    });
    expect(r.contaminated).toBe(true);
    expect(r.test?.label).toBe("EXPLORATORY");
  });
});
