import { describe, expect, it } from "vitest";
import {
  evaluateGapVersusPlan,
  recoveryNeededFromDrawdownPct,
  replayEquityPath,
} from "./equity";
import { evaluatePortfolioExposure } from "./exposure";

describe("equity drawdown lab", () => {
  it("replays three -1% from 10000", () => {
    const steps = replayEquityPath("10000", ["-0.01", "-0.01", "-0.01"]);
    expect(steps.map((s) => s.equityAfter)).toEqual([
      "9900",
      "9801",
      "9702.99",
    ]);
    expect(steps.map((s) => s.plannedRisk)).toEqual(["100", "99", "98.01"]);
    expect(Number(steps[2]!.drawdownPct)).toBeCloseTo(2.9701, 3);
  });

  it("20% drawdown needs 25% recovery", () => {
    expect(recoveryNeededFromDrawdownPct("20")).toBe("25");
  });

  it("10% DD needs 11.11…% and 50% DD needs 100%", () => {
    const r10 = recoveryNeededFromDrawdownPct("10");
    expect(r10).not.toBeNull();
    expect(Number(r10)).toBeCloseTo(11.1111, 3);
    expect(recoveryNeededFromDrawdownPct("50")).toBe("100");
  });

  it("gap vs plan → STOP_GAP_LOSS", () => {
    const g = evaluateGapVersusPlan({
      plannedRiskPct: "1",
      realizedLossPct: "2",
      bothTouchedWithoutOrder: false,
    });
    expect(g.status).toBe("STOP_GAP_LOSS");
  });

  it("portfolio concentration 3%", () => {
    const p = evaluatePortfolioExposure({
      equity: "10000",
      positions: [
        {
          id: "a",
          symbol: "XAU",
          stopLossDollars: "100",
          channelTags: ["USD"],
          accountCurrency: "USD",
        },
        {
          id: "b",
          symbol: "EUR",
          stopLossDollars: "100",
          channelTags: ["USD"],
          accountCurrency: "USD",
        },
        {
          id: "c",
          symbol: "JPY",
          stopLossDollars: "100",
          channelTags: ["USD"],
          accountCurrency: "USD",
        },
      ],
    });
    expect(p.totalStopLossDollars).toBe("300");
    expect(p.totalStopLossPct).toBe("3");
  });
});
