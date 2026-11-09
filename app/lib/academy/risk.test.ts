import { describe, expect, it } from "vitest";
import {
  SYNTHETIC_FOREX_EURUSD_SPEC,
  SYNTHETIC_GOLD_SPEC,
  type RiskInput,
} from "./contracts";
import { draftToRiskPrices, evaluateRisk } from "./risk";

function goldBase(over: Partial<RiskInput> = {}): RiskInput {
  return {
    spec: SYNTHETIC_GOLD_SPEC,
    equity: "10000",
    accountCurrency: "USD",
    conversion: "1",
    conversionUnits: "ACCOUNT_PER_PNL",
    direction: "LONG",
    entry: "2500",
    stop: "2492",
    target: "2516",
    stopType: "HARD_STRUCTURAL",
    structuralEvidenceIds: ["ev-structure-1"],
    preEntry: "YES",
    riskPct: "1",
    submittedLots: null,
    costs: {
      status: "KNOWN",
      fixedFee: "0",
      feePerLot: "0",
      slippageTicks: "0",
      pricesIncludeSpread: "YES",
    },
    ...over,
  };
}

describe("P0 risk regressions", () => {
  it("Gold 2350/2340 blank TP must NOT return 235R PASS", () => {
    const prices = draftToRiskPrices({
      equity: "10000",
      riskPct: "1",
      entry: "2350",
      stop: "2340",
      target: "", // blank
    });
    expect(prices.target).toBeNull();
    expect(prices.emptyFields).toContain("target");

    const result = evaluateRisk(
      goldBase({
        entry: prices.entry,
        stop: prices.stop,
        target: prices.target,
      }),
    );

    expect(result.status).not.toBe("PASS_SIMULATION");
    expect(result.grossRR).toBeNull();
    expect(result.netRR).toBeNull();
    // Must not invent ~235R from treating blank TP as 0
    if (result.grossRR) {
      expect(Number(result.grossRR)).toBeLessThan(10);
    }
    expect(result.status).toBe("UNVERIFIED");
  });

  it("blank FX entry must not become zero; reject nonpositive Forex prices", () => {
    const blank = draftToRiskPrices({
      equity: "10000",
      riskPct: "1",
      entry: "",
      stop: "1.0800",
      target: "1.0950",
    });
    expect(blank.entry).toBeNull();
    expect(blank.emptyFields).toContain("entry");

    const blankResult = evaluateRisk(
      goldBase({
        spec: SYNTHETIC_FOREX_EURUSD_SPEC,
        entry: blank.entry,
        stop: blank.stop,
        target: blank.target,
      }),
    );
    expect(blankResult.status).toBe("UNVERIFIED");
    expect(blankResult.grossRR).toBeNull();

    const negative = evaluateRisk(
      goldBase({
        spec: SYNTHETIC_FOREX_EURUSD_SPEC,
        entry: "-1.0850",
        stop: "1.0800",
        target: "1.0950",
      }),
    );
    expect(negative.status).toBe("HARD_BLOCK");
    expect(negative.issues.some((i) => i.code === "NONPOSITIVE_PRICE")).toBe(
      true,
    );
  });

  it("zero/negative balance must not keep passing R:R", () => {
    const zero = evaluateRisk(goldBase({ equity: "0" }));
    expect(zero.status).toBe("HARD_BLOCK");
    expect(zero.grossRR === null || zero.status !== "PASS_SIMULATION").toBe(
      true,
    );
    expect(zero.status).not.toBe("PASS_SIMULATION");

    const neg = evaluateRisk(goldBase({ equity: "-5000" }));
    expect(neg.status).toBe("HARD_BLOCK");
    expect(neg.status).not.toBe("PASS_SIMULATION");
  });

  it("requested 2% must HARD_BLOCK with explanation; never silent clamp", () => {
    const result = evaluateRisk(goldBase({ riskPct: "2" }));
    expect(result.status).toBe("HARD_BLOCK");
    expect(result.issues.some((i) => i.code === "RISK_PCT_HARD_BLOCK")).toBe(
      true,
    );
    // Must not behave as if risk were clamped to 1%
    expect(result.status).not.toBe("PASS_SIMULATION");
  });

  it("negative risk persists as invalid HARD_BLOCK", () => {
    const result = evaluateRisk(goldBase({ riskPct: "-1" }));
    expect(result.status).toBe("HARD_BLOCK");
    expect(result.issues.some((i) => i.code === "NEGATIVE_RISK_PCT")).toBe(
      true,
    );
  });
});

describe("Gold baseline expectations", () => {
  it("equity 10000 entry 2500 SL 2492 TP 2516 → max 0.12 lot, loss 96, R:R 2", () => {
    const result = evaluateRisk(goldBase());
    expect(result.status).toBe("PASS_SIMULATION");
    expect(result.maxLots).toBe("0.12");
    expect(result.loss).toBe("96");
    expect(result.grossRR).toBe("2");
    expect(result.netRR).toBe("2");
  });

  it("exactly 1% and 2R passes; 1.0001% HARD_BLOCK", () => {
    expect(evaluateRisk(goldBase({ riskPct: "1" })).status).toBe(
      "PASS_SIMULATION",
    );
    expect(evaluateRisk(goldBase({ riskPct: "1.0001" })).status).toBe(
      "HARD_BLOCK",
    );
  });

  it("mental stop HARD_BLOCK dominates missing fields", () => {
    const result = evaluateRisk(
      goldBase({
        stopType: "MENTAL",
        structuralEvidenceIds: [],
        conversion: null,
      }),
    );
    expect(result.status).toBe("HARD_BLOCK");
    expect(
      result.issues.some((i) => i.code === "STOP_NOT_HARD_STRUCTURAL"),
    ).toBe(true);
  });

  it("unknown costs cannot PASS", () => {
    const result = evaluateRisk(
      goldBase({
        costs: {
          status: "UNKNOWN",
          fixedFee: null,
          feePerLot: null,
          slippageTicks: null,
          pricesIncludeSpread: "UNKNOWN",
        },
      }),
    );
    expect(result.status).toBe("UNVERIFIED");
  });

  it("fees may reduce net R:R below 2 → HARD_BLOCK", () => {
    const result = evaluateRisk(
      goldBase({
        costs: {
          status: "KNOWN",
          fixedFee: "10",
          feePerLot: "50",
          slippageTicks: "0",
          pricesIncludeSpread: "YES",
        },
        submittedLots: "0.1",
      }),
    );
    expect(result.status).toBe("HARD_BLOCK");
    expect(
      result.issues.some(
        (i) => i.code === "NET_RR_BELOW_2" || i.code === "OVERSIZED_LOTS",
      ),
    ).toBe(true);
    if (result.netRR !== null) {
      expect(Number(result.netRR)).toBeLessThan(2);
    }
  });
});
