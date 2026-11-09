import { describe, expect, it } from "vitest";
import { cpiMacroAlternatives } from "./fixtures";
import { detectMacroAsEntry, scoreMacroGraph } from "./macro";

describe("macro scoring", () => {
  it("dedupes edges and scores best independent alternative", () => {
    const student = {
      edges: [
        ...cpiMacroAlternatives[0].edges,
        cpiMacroAlternatives[0].edges[0], // duplicate
      ],
      assumptions: cpiMacroAlternatives[0].assumptions,
      conclusions: cpiMacroAlternatives[0].conclusions,
      studentAuthored: true,
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

  it("default unmodified state → assessedCredit false", () => {
    const scored = scoreMacroGraph(
      {
        edges: [],
        assumptions: ["Surprise not priced in"],
        conclusions: [
          "Conditional USD bid window",
          "Gold bias unproven without TIPS/DXY evidence completeness",
        ],
        studentAuthored: false,
      },
      cpiMacroAlternatives,
    );
    expect(scored.assessedCredit).toBe(false);
    expect(scored.status).toBe("PENDING_REVIEW");
  });

  it("invalid answer key → PENDING_REVIEW", () => {
    const scored = scoreMacroGraph(
      {
        edges: [{ from: "DATA", to: "SURPRISE_PRICED_IN", condition: "X" }],
        assumptions: [],
        conclusions: [],
      },
      [{ id: "", edges: [], assumptions: [], conclusions: [] }],
    );
    expect(scored.status).toBe("PENDING_REVIEW");
  });
});

describe("P0-4 MACRO_AS_ENTRY", () => {
  it("detects EN entry language", () => {
    expect(
      detectMacroAsEntry(["Buy gold now, entry 2500 SL 2490"]),
    ).toBe(true);
  });

  it("detects FA entry language", () => {
    expect(detectMacroAsEntry(["الان طلا بخر، ورود ۲۵۰۰ حد ضرر ۲۴۹۰"])).toBe(
      true,
    );
  });

  it("allows legitimate context text", () => {
    expect(
      detectMacroAsEntry(["real yields rising pressure on gold."]),
    ).toBe(false);
  });

  it("entry-text EN zeros conclusion credit and flags issue", () => {
    const scored = scoreMacroGraph(
      {
        edges: cpiMacroAlternatives[0].edges,
        assumptions: cpiMacroAlternatives[0].assumptions,
        conclusions: ["Buy gold now, entry 2500 SL 2490"],
        studentAuthored: true,
      },
      cpiMacroAlternatives,
    );
    expect(scored.macroAsEntry).toBe(true);
    expect(scored.notes.some((n) => n.startsWith("MACRO_AS_ENTRY:"))).toBe(
      true,
    );
    expect(scored.rewritePrompt).toBeTruthy();
    // Conclusion credit wiped — score below perfect match
    expect(scored.score).toBeLessThan(100);
    expect(scored.score).toBeLessThanOrEqual(75);
  });

  it("entry-text FA zeros conclusion credit", () => {
    const scored = scoreMacroGraph(
      {
        edges: cpiMacroAlternatives[0].edges,
        assumptions: cpiMacroAlternatives[0].assumptions,
        conclusions: ["الان طلا بخر ورود ۲۵۰۰ حد ضرر ۲۴۹۰"],
        studentAuthored: true,
      },
      cpiMacroAlternatives,
    );
    expect(scored.macroAsEntry).toBe(true);
    expect(scored.score).toBeLessThan(100);
  });
});
