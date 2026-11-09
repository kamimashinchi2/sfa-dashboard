import { describe, expect, it } from "vitest";
import { evaluateReadiness, performanceCard, scoreQuiz } from "./grading";
import { getMission } from "./curriculum";

describe("grading gates", () => {
  it("79 fails numeric gate; 80 can pass", () => {
    const mission = getMission("M1")!;
    const answers: Record<string, number | string | number[]> = {};
    // 8/10 = 80
    mission.quiz.forEach((q, i) => {
      if (q.kind === "mc") answers[q.id] = i < 8 ? (q.answer as number) : 0;
      else if (q.kind === "numeric") answers[q.id] = i < 8 ? String(q.answer) : "0";
      else answers[q.id] = i < 8 ? (q.answer as number[]) : [3, 2, 1, 0];
    });
    const scored80 = scoreQuiz(mission.quiz, answers);
    expect(scored80.score).toBeGreaterThanOrEqual(80);

    // Force 7/10-ish by wronging more
    mission.quiz.forEach((q, i) => {
      if (q.kind === "mc") answers[q.id] = i < 7 ? (q.answer as number) : 0;
      else if (q.kind === "numeric") answers[q.id] = i < 7 ? String(q.answer) : "0";
      else answers[q.id] = i < 7 ? (q.answer as number[]) : [3, 2, 1, 0];
    });
    const scoredLow = scoreQuiz(mission.quiz, answers);
    expect(scoredLow.score).toBeLessThan(80);
  });

  it("passing score + HARD_BLOCK retains score / holds readiness", () => {
    const r = evaluateReadiness({
      quizScore: 80,
      taskComplete: true,
      riskStatus: "HARD_BLOCK",
      freeTextSubmitted: true,
    });
    expect(r.numericPass).toBe(true);
    expect(r.readiness).toBe("PENDING_REVIEW");
    expect(r.ownerReviewRequired).toBe(true);
  });

  it("performance card OWNER_REVIEW_REQUIRED when total>=80 and HARD_BLOCK", () => {
    const card = performanceCard({
      riskScore: 90,
      technicalMacroScore: 90,
      journalingScore: 90,
      riskStatus: "HARD_BLOCK",
    });
    expect(card.total).toBeGreaterThanOrEqual(80);
    expect(card.advancement).toBe("OWNER_REVIEW_REQUIRED");
  });
});
