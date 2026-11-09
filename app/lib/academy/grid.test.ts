import { describe, expect, it } from "vitest";
import { buildDescriptiveGrid, gridFloorBelowAnchor } from "./grid";

describe("descriptive grid", () => {
  it("requires explicit anchor and floors below", () => {
    expect(buildDescriptiveGrid("").ok).toBe(false);
    const g = buildDescriptiveGrid("2500");
    expect(g.ok).toBe(true);
    if (g.ok) {
      expect(g.lines.some((l) => l.price === "2150")).toBe(true); // 2500-350
      expect(g.lines.every((l) => Number(l.price) > 0)).toBe(true);
    }
    expect(gridFloorBelowAnchor("2500", "350", "2150")).toBe(-1);
  });
});
