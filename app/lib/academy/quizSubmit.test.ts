import { describe, expect, it } from "vitest";
import { displayToCanonicalMc } from "./quizShuffle";
import { buildQuizSubmission, normalizeBuildCommit } from "./quizSubmit";

describe("quiz submission", () => {
  it("requires the full bank and canonical indexes, with no client score", () => {
    const optionMap = [2, 0, 1];
    const built = buildQuizSubmission({
      attemptId: "11111111-1111-1111-1111-111111111111",
      quizId: "M1",
      buildCommit: "ABCD123",
      items: [
        { id: "M1-Q1", kind: "mc", itemHash: "a".repeat(64) },
        { id: "M1-Q2", kind: "numeric", itemHash: "b".repeat(64) },
      ],
      answers: {
        "M1-Q1": displayToCanonicalMc(optionMap, 0),
        "M1-Q2": "100",
      },
      touchedIds: ["M1-Q1", "M1-Q2"],
      skippedIds: [],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.buildCommit).toBe("abcd123");
    expect(built.body.items).toHaveLength(2);
    expect(built.body.items[0]?.studentAnswer).toBe(2);
    expect(JSON.stringify(built.body)).not.toMatch(/correctAnswer|clientCorrect|score/);
  });

  it("drops a build commit that is not 7-40 hex so the server can stay pending", () => {
    expect(normalizeBuildCommit("main")).toBeNull();
    expect(normalizeBuildCommit("abc1234")).toBe("abc1234");
  });

  it("rejects a missing item hash instead of inventing one", () => {
    const built = buildQuizSubmission({
      attemptId: "x",
      quizId: "M1",
      buildCommit: null,
      items: [{ id: "M1-Q1", kind: "mc" }],
      answers: {},
      touchedIds: [],
      skippedIds: [],
    });
    expect(built.ok).toBe(false);
  });
});
