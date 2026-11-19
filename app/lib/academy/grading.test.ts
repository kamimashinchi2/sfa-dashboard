import { describe, expect, it } from "vitest";
import { evaluateReadiness, performanceCard, scoreQuiz } from "./grading";
import { getMission } from "./curriculum";
import { withAnswers } from "./hydrateAnswers";

describe("grading gates", () => {
  it("79 fails numeric gate; 80 can pass", () => {
    const mission = getMission("M1")!;
    const quiz = withAnswers(mission.quiz);
    const answers: Record<string, number | string | number[]> = {};
    // 8/10 = 80
    quiz.forEach((q, i) => {
      if (q.kind === "mc") answers[q.id] = i < 8 ? (q.answer as number) : 0;
      else if (q.kind === "numeric") answers[q.id] = i < 8 ? String(q.answer) : "0";
      else answers[q.id] = i < 8 ? (q.answer as number[]) : [3, 2, 1, 0];
    });
    const scored80 = scoreQuiz(quiz, answers);
    expect(scored80.score).toBeGreaterThanOrEqual(80);

    // Force 7/10-ish by wronging more
    quiz.forEach((q, i) => {
      if (q.kind === "mc") answers[q.id] = i < 7 ? (q.answer as number) : 0;
      else if (q.kind === "numeric") answers[q.id] = i < 7 ? String(q.answer) : "0";
      else answers[q.id] = i < 7 ? (q.answer as number[]) : [3, 2, 1, 0];
    });
    const scoredLow = scoreQuiz(quiz, answers);
    expect(scoredLow.score).toBeLessThan(80);
  });

  it("passing quiz score + HARD_BLOCK stays a remediation, not an approval", () => {
    const r = evaluateReadiness({
      quizScore: 80,
      taskComplete: true,
      riskStatus: "HARD_BLOCK",
      freeTextSubmitted: true,
      missionRequiresRisk: true,
    });
    expect(r.numericPass).toBe(true);
    expect(r.readiness).toBe("REMEDIATION");
    expect(r.ownerReviewRequired).toBe(false);
  });

  it("null risk on non-risk mission is MENTOR_PENDING not remediation", () => {
    const r = evaluateReadiness({
      quizScore: 90,
      taskComplete: true,
      riskStatus: null,
      freeTextSubmitted: true,
      missionRequiresRisk: false,
    });
    expect(r.numericPass).toBe(true);
    expect(r.readiness).toBe("MENTOR_PENDING");
  });

  it("performance card is NOT_APPROVED when the point total passes and HARD_BLOCK is set", () => {
    const card = performanceCard({
      risk: 36,
      technicalMacro: 36,
      journalPsychology: 18,
      hardBlock: true,
    });
    expect(card.total).toBe(90);
    expect(card.verdict).toBe("NOT_APPROVED");
    expect(card.unlockEligible).toBe(false);
  });
});
