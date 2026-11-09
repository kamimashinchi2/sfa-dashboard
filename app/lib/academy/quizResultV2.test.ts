import { describe, expect, it } from "vitest";
import {
  buildQuizResultV2,
  canonicalStudentAnswer,
  serializeQuizResultV2,
  validateQuizResultV2Shape,
} from "./quizResultV2";
import type { QuizAttemptRecord } from "./persist/types";
import { withAnswers } from "./hydrateAnswers";
import { getMission } from "./curriculum";
import { itemHash } from "./quizHash";

describe("sfa-quiz-result v2", () => {
  it("builds full-item payload matching schema constraints", async () => {
    const quiz = withAnswers(getMission("M1")!.quiz);
    const items = await Promise.all(
      quiz.map(async (q, i) => ({
        itemId: q.id,
        itemHash: await itemHash(q),
        kind: q.kind,
        displayedOrder: q.kind === "mc" ? [0, 1] : null,
        answer: {
          raw: q.kind === "mc" ? q.answer : q.kind === "order" ? q.answer : String(q.answer),
          canonical:
            q.kind === "mc" ? q.answer : q.kind === "order" ? q.answer : String(q.answer),
        },
        touched: true,
        clientCorrect: i < 8,
        reflection: null,
      })),
    );
    const attempt: QuizAttemptRecord = {
      attemptId: "M1-2-20261109T120000Z-ab12",
      quizId: "M1",
      mode: "ASSESSED",
      assessmentCriteriaVersion: 2,
      startedAtISO: "2026-11-09T12:00:00.000Z",
      submittedAtISO: "2026-11-09T12:05:00.000Z",
      shuffleSeed: "S07:M1:ab12",
      buildCommit: "2302f9e",
      items,
      client: {
        correct: 8,
        total: 10,
        score: 80,
        numericPass: true,
        weakTopics: ["risk-budget"],
      },
      unverifiedClaim: true,
    };
    const topics = Object.fromEntries(
      quiz.map((q) => [q.id, q.remediationTopic]),
    );
    const payload = buildQuizResultV2({
      attempt,
      studentId: "S07",
      alias: "Falcon-07",
      topics,
      telegramLinkStatus: "UNLINKED",
    });
    expect(validateQuizResultV2Shape(payload)).toEqual([]);
    expect(payload.items).toHaveLength(10);
    expect(payload.total).toBe(10);
    expect(payload.format).toBe("sfa-quiz-result");
    expect(payload.schemaVersion).toBe(2);
    const json = serializeQuizResultV2(payload);
    expect(json.includes("correctAnswer")).toBe(false);
    expect(json.includes("answerKey")).toBe(false);
    expect(JSON.parse(json).items[0].itemHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("canonicalStudentAnswer rejects unsupported shapes", () => {
    expect(canonicalStudentAnswer("mc", { x: 1 }, true)).toBeNull();
    expect(canonicalStudentAnswer("mc", 2, true)).toBe(2);
    expect(canonicalStudentAnswer("order", [0, 1], false)).toBeNull();
  });
});
