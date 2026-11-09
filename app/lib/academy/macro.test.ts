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
    expect(scored.assessedCredit).toBe(true);
  });

  it("explains unsupported GOLD→DATA edges", () => {
    const scored = scoreMacroGraph(
      {
        edges: [{ from: "GOLD", to: "DATA", condition: "ANY" }],
        assumptions: [],
        conclusions: [],
      },
      cpiMacroAlternatives,
    );
    expect(scored.edgeFeedback.some((f) => f.reason.includes("GOLD→DATA"))).toBe(
      true,
    );
    expect(scored.score).toBeLessThan(100);
  });

  it("answer-key presets earn no assessed credit", () => {
    const scored = scoreMacroGraph(
      {
        edges: cpiMacroAlternatives[0].edges,
        assumptions: cpiMacroAlternatives[0].assumptions,
        conclusions: cpiMacroAlternatives[0].conclusions,
        fromAnswerKeyPreset: true,
      },
      cpiMacroAlternatives,
    );
    expect(scored.status).toBe("DEMO_ONLY");
    expect(scored.assessedCredit).toBe(false);
    expect(scored.score).toBeNull();
  });

  it("invalid answer key → PENDING_REVIEW", () => {
    const scored = scoreMacroGraph(
      { edges: [], assumptions: [], conclusions: [] },
      [{ id: "", edges: [], assumptions: [], conclusions: [] }],
    );
    expect(scored.status).toBe("PENDING_REVIEW");
  });
});
