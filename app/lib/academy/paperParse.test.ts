import { describe, expect, it } from "vitest";
import { classifyStop, parseLenientDecimal } from "./paperParse";

describe("old paper-plan text", () => {
  it("reads a prose stop and loose numbers", () => {
    expect(classifyStop("Hard structural stop (below the swept low)")).toBe("HARD_STRUCTURAL");
    expect(classifyStop("mental")).toBe("MENTAL");
    expect(classifyStop("")).toBe("NONE");
    expect(parseLenientDecimal("1% (100)")).toBe("1");
    expect(parseLenientDecimal("about 2.2")).toBe("2.2");
  });
});
