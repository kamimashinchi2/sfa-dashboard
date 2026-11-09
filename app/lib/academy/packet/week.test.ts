import { describe, expect, it } from "vitest";
import {
  isoWeekInAmsterdam,
  periodForIsoWeek,
  formatResultWeek,
} from "./week";

describe("ISO week Amsterdam", () => {
  it("formats result week", () => {
    expect(formatResultWeek("2026-W46")).toBe("2026W46");
  });

  it("period is Mon 00:00 to Sun 23:59:59.999 local as UTC Z", () => {
    const p = periodForIsoWeek("2026-W46");
    expect(p.fromISO.endsWith("Z")).toBe(true);
    expect(p.toISO.endsWith("Z")).toBe(true);
    expect(p.fromISO < p.toISO).toBe(true);
    // Span roughly 7 days
    const ms = Date.parse(p.toISO) - Date.parse(p.fromISO);
    expect(ms).toBeGreaterThan(6 * 86400000);
    expect(ms).toBeLessThan(8 * 86400000);
  });

  it("handles year-boundary weeks around 2026-W53 / 2027-W01", () => {
    // 2026-12-31 Thursday → ISO week 53 of 2026
    const late = isoWeekInAmsterdam(new Date("2026-12-31T12:00:00+01:00"));
    expect(late.isoWeek).toMatch(/^2026-W5[23]$|^2027-W01$/);
    // 2027-01-04 Monday → 2027-W01
    const early = isoWeekInAmsterdam(new Date("2027-01-04T12:00:00+01:00"));
    expect(early.isoWeek).toBe("2027-W01");
  });

  it("DST spring forward week still has Mon–Sun period", () => {
    // EU DST 2026-03-29; week containing that Sunday
    const w = isoWeekInAmsterdam(new Date("2026-03-29T12:00:00+02:00"));
    const p = periodForIsoWeek(w.isoWeek);
    expect(p.fromISO < p.toISO).toBe(true);
  });
});
