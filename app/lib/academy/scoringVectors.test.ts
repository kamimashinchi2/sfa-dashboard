import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { performanceCard, practicalHardBlock } from "./grading";
import { claimQuizVerdict, PRACTICAL_THRESHOLDS, QUIZ_THRESHOLDS } from "./thresholds";

type Vectors = {
  quiz: { approvedMin: number; partialMin: number };
  practical: {
    approvedMin: number;
    partialMin: number;
    caps: { risk: number; technicalMacro: number; journalPsychology: number };
  };
  quizCases: { score: number; verdict: "APPROVED" | "PARTIALLY_APPROVED" | "NOT_APPROVED" }[];
  practicalCases: {
    risk: number;
    technicalMacro: number;
    journalPsychology: number;
    hardBlock: boolean;
    total: number;
    verdict: "APPROVED" | "PARTIALLY_APPROVED" | "NOT_APPROVED";
    unlockEligible: boolean;
  }[];
  hardBlockCases: {
    currentEquity: string;
    riskAmount: string;
    netReward: string;
    stopType: string;
    blocked: boolean;
  }[];
};

const vectors = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../shared/scoring-vectors.json"), "utf8"),
) as Vectors;

describe("shared practical scoring vectors", () => {
  it("uses the same quiz and practical thresholds as the vector file", () => {
    expect(QUIZ_THRESHOLDS.approvedMin).toBe(vectors.quiz.approvedMin);
    expect(QUIZ_THRESHOLDS.partialMin).toBe(vectors.quiz.partialMin);
    expect(PRACTICAL_THRESHOLDS.approvedMin).toBe(vectors.practical.approvedMin);
    expect(PRACTICAL_THRESHOLDS.partialMin).toBe(vectors.practical.partialMin);
  });

  it("pins quiz verdicts", () => {
    for (const row of vectors.quizCases) {
      expect(claimQuizVerdict(row.score)).toBe(row.verdict);
    }
  });

  it("pins 40/40/20 totals, verdicts, and hard blocks", () => {
    expect(vectors.practical.caps).toEqual({ risk: 40, technicalMacro: 40, journalPsychology: 20 });
    for (const row of vectors.practicalCases) {
      const card = performanceCard({
        risk: row.risk,
        technicalMacro: row.technicalMacro,
        journalPsychology: row.journalPsychology,
        hardBlock: row.hardBlock,
      });
      expect(card.total).toBe(row.total);
      expect(card.verdict).toBe(row.verdict);
      expect(card.unlockEligible).toBe(row.unlockEligible);
    }
  });

  it("pins the three hard-block rules on the same evidence as Python", () => {
    for (const row of vectors.hardBlockCases) {
      expect(
        practicalHardBlock({
          currentEquity: row.currentEquity,
          riskAmount: row.riskAmount,
          netReward: row.netReward,
          stopType: row.stopType,
        }),
      ).toBe(row.blocked);
    }
  });
});
