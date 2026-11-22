import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SYNTHETIC_GOLD_SPEC, type RiskInput } from "./contracts";
import { effectiveRiskRules, rulesForStage, type RiskRulesDocument } from "./academyRules";
import { practicalHardBlock } from "./grading";
import { evaluateRisk } from "./risk";

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
    costs: { status: "KNOWN", fixedFee: "0", feePerLot: "0", slippageTicks: "0", pricesIncludeSpread: "YES" },
    ...over,
  };
}

const approved = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../content/v3/rules.json"), "utf8"),
) as RiskRulesDocument;

const clean = {
  currentEquity: "10000",
  riskAmount: "100",
  netReward: "200",
  stopType: "STRUCTURAL_HARD",
  evidenceRefs: ["p"],
};

describe("approved risk rules", () => {
  it("allows 2% only on L05", () => {
    const l05 = effectiveRiskRules("L05", approved);
    const l01 = effectiveRiskRules("L01", approved);
    expect(l05.maxRiskPctPerTrade).toBe("2.00");
    expect(l01.maxRiskPctPerTrade).toBe("1.00");
    expect(evaluateRisk(goldBase({ riskPct: "2" }), l05).issues.some((issue) => issue.code === "RISK_PCT_HARD_BLOCK")).toBe(false);
    expect(evaluateRisk(goldBase({ riskPct: "2.01" }), l05).issues.some((issue) => issue.code === "RISK_PCT_HARD_BLOCK")).toBe(true);
    expect(evaluateRisk(goldBase({ riskPct: "2" }), l01).issues.some((issue) => issue.code === "RISK_PCT_HARD_BLOCK")).toBe(true);
  });

  it("blocks a missing stop, not a mental stop", () => {
    const rules = effectiveRiskRules(null, approved);
    expect(practicalHardBlock({ ...clean, stopType: "MENTAL" }, rules)).toBe(false);
    expect(practicalHardBlock({ ...clean, stopType: "NONE" }, rules)).toBe(true);
  });

  it("blocks an unplanned stop move and allows a planned break-even move", () => {
    const rules = effectiveRiskRules("L05", approved);
    expect(practicalHardBlock({ ...clean, stopMoved: "unplanned" }, rules)).toBe(true);
    expect(practicalHardBlock({ ...clean, stopMoved: "planned" }, rules)).toBe(false);
    expect(practicalHardBlock(clean, rules)).toBe(false);
  });

  it("puts L05 situations and pause notes in the mentor packet, not the approval block", () => {
    const packet = rulesForStage(5, approved);
    expect(packet.situations.length).toBeGreaterThan(0);
    expect(packet.dailyActiveRiskCap).toBe("STUDENT_PRESTATED");
    expect(packet.weeklyCompliancePause).toMatch(/75/);
    expect(JSON.stringify(packet)).not.toMatch(/Kamyar|approval/);
  });
});
