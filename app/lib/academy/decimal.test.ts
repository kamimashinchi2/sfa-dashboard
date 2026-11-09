import { describe, expect, it } from "vitest";
import {
  decAdd,
  decCompare,
  decDivFloor,
  normalizeNumericText,
  parseDec,
  parseDecOrEmpty,
} from "./decimal";

describe("decimal parsing", () => {
  it("empty is not zero", () => {
    const r = parseDecOrEmpty("");
    expect("empty" in r && r.empty).toBe(true);
    expect(r.value).toBeNull();
  });

  it("normalizes Persian digits", () => {
    expect(normalizeNumericText("۱۲۳۴.۵")).toBe("1234.5");
    expect(parseDec("۲").ok && parseDec("۲").ok && (parseDec("۲") as { value: string }).value).toBe(
      "2",
    );
  });

  it("rejects exponents and grouping ambiguity", () => {
    expect(parseDec("1e3").ok).toBe(false);
    expect(parseDec("1,000").ok).toBe(false);
    expect(parseDec("1.0.0").ok).toBe(false);
  });

  it("floor division works below zero boundary", () => {
    expect(decDivFloor("-3", "2")).toBe("-2");
    expect(decCompare(decAdd("1", "2"), "3")).toBe(0);
  });
});
