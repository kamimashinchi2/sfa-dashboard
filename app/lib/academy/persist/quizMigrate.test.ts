import { describe, expect, it } from "vitest";
import { migrateQuizV2ToV3, pushQuizAttempt } from "./quizStore";
import { defaultQuiz, type QuizAttemptRecord } from "./types";

describe("quiz domain v2→v3", () => {
  it("migrates answers-only v2 idempotently", () => {
    const v2 = {
      answers: { "M1-Q1": { itemVersion: 1, value: 1, atISO: "2024-01-01T00:00:00.000Z" } },
    };
    const once = migrateQuizV2ToV3(v2);
    expect(once.schemaVersion).toBe(3);
    expect(once.attempts).toEqual([]);
    expect(once.answers?.["M1-Q1"]?.value).toBe(1);
    const twice = migrateQuizV2ToV3(once);
    expect(twice).toEqual(once);
  });

  it("caps 20 attempts per quiz", () => {
    let store = defaultQuiz();
    for (let i = 0; i < 25; i++) {
      const attempt: QuizAttemptRecord = {
        attemptId: `M1-v2-t${i}`,
        quizId: "M1",
        mode: "ASSESSED",
        assessmentCriteriaVersion: 2,
        startedAtISO: "2026-01-01T00:00:00.000Z",
        submittedAtISO: `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`,
        shuffleSeed: "s",
        buildCommit: null,
        items: [],
        client: {
          correct: 0,
          total: 10,
          score: 0,
          numericPass: false,
          weakTopics: [],
        },
        unverifiedClaim: true,
      };
      store = pushQuizAttempt(store, attempt);
    }
    expect(store.attempts.filter((a) => a.quizId === "M1")).toHaveLength(20);
  });
});
