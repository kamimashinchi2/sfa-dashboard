import { describe, expect, it } from "vitest";
import { computeWindowReturns } from "./windowReturns";
import type { TimedObservation } from "./pointInTime";
import { assertZonedInstant, snapshotRelease } from "./pointInTime";

function o(
  id: string,
  symbol: string,
  value: string,
  at: string,
): TimedObservation {
  return {
    id,
    symbol,
    value,
    unit: "px",
    observedAt: at,
    availableAt: at,
    evidenceIds: [id],
  };
}

describe("point-in-time / window returns", () => {
  it("rejects unzoned timestamps", () => {
    expect(assertZonedInstant("2024-03-01T13:30:00").ok).toBe(false);
    expect(assertZonedInstant("2024-03-01T13:30:00.000Z").ok).toBe(true);
  });

  it("hides actual before release", () => {
    const snap = snapshotRelease(
      {
        id: "p",
        symbolContext: "CPI",
        releasedAt: "2024-03-01T13:30:00.000Z",
        actual: "0.4",
        forecast: "0.2",
        priorOriginal: "0.3",
        revisions: [],
        evidenceIds: [],
      },
      "2024-03-01T13:00:00.000Z",
    );
    expect(snap.actual).toBeNull();
  });

  it("EURUSD fixture percentage windows", () => {
    const releaseAt = "2024-03-01T13:30:00.000Z";
    const rows = [
      o("a", "EURUSD", "1.1000", "2024-03-01T13:29:30.000Z"),
      o("b", "EURUSD", "1.1011", "2024-03-01T13:35:00.000Z"),
      o("c", "EURUSD", "1.1000", "2024-03-01T13:45:00.000Z"),
      o("d", "EURUSD", "1.1022", "2024-03-01T14:30:00.000Z"),
    ];
    const w = computeWindowReturns({
      symbol: "EURUSD",
      releaseAt,
      observations: rows,
      asOf: "2024-03-01T15:00:00.000Z",
    });
    expect(Number(w[0]!.returnPct)).toBeCloseTo(0.1, 5);
    expect(Number(w[1]!.returnPct)).toBeCloseTo((1.1 / 1.1011 - 1) * 100, 5);
    expect(Number(w[2]!.returnPct)).toBeCloseTo(0.2, 5);
  });

  it("missing Gold 15m incompletes adjacent windows", () => {
    const releaseAt = "2024-03-01T13:30:00.000Z";
    const rows = [
      o("a", "XAUUSD", "2000", "2024-03-01T13:29:30.000Z"),
      o("b", "XAUUSD", "2002", "2024-03-01T13:35:00.000Z"),
      o("d", "XAUUSD", "2004", "2024-03-01T14:30:00.000Z"),
    ];
    const w = computeWindowReturns({
      symbol: "XAUUSD",
      releaseAt,
      observations: rows,
      asOf: "2024-03-01T15:00:00.000Z",
    });
    expect(w[0]!.returnPct).not.toBeNull();
    expect(w[1]!.returnPct).toBeNull();
    expect(w[1]!.reason).toMatch(/MISSING/);
    expect(w[2]!.returnPct).toBeNull();
  });
});
