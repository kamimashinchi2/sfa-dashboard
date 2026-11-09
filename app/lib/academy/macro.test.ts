import { describe, expect, it } from "vitest";
import { cpiMacroAlternatives } from "./fixtures";
import { scoreMacroGraph } from "./macro";

describe("macro scoring", () => {
  it("dedupes edges and scores best independent alternative", () => {
    const student = {
      edges: [
        ...cpiMacroAlternatives[0].edges,
        cpiMacroAlternatives[0].edges[0], // duplicate
      ],
      assumptions: cpiMacroAlternatives[0].assumptions,
      conclusions: cpiMacroAlternatives[0].conclusions,
    };
    const scored = scoreMacroGraph(student, cpiMacroAlternatives);
    expect(scored.status).toBe("SCORED");
    expect(scored.bestAlternativeId).toBe("ALT_SURPRISE_HOT_USD");
    expect(scored.score).toBe(100);
  });

  it("invalid answer key → PENDING_REVIEW", () => {
    const scored = scoreMacroGraph(
      { edges: [], assumptions: [], conclusions: [] },
      [{ id: "", edges: [], assumptions: [], conclusions: [] }],
    );
    expect(scored.status).toBe("PENDING_REVIEW");
  });
});
