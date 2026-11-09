import { describe, expect, it } from "vitest";
import { defaultProgress } from "./progress";
import {
  archiveLegacyPlaceholderAttempts,
  resolveMissionAccess,
} from "./unlock";
import { ASSESSMENT_CRITERIA_VERSION } from "./quizzes";
import { getMission } from "./curriculum";
import { scoreQuiz } from "./grading";

describe("unlock gates & assessment version", () => {
  it("M2 is preview-only at XP0 / no M1 pass", () => {
    const p = defaultProgress("en");
    const access = resolveMissionAccess(p, "M2");
    expect(access.mode).toBe("READ_ONLY_PREVIEW");
  });

  it("M1 assessed open; M2 unlocks after M1 pass without HARD_BLOCK", () => {
    const p = defaultProgress("en");
    p.attempts.push({
      id: "M1-v2",
      missionId: "M1",
      scenarioVersion: 1,
      quizScore: 90,
      numericPass: true,
      taskComplete: true,
      riskStatus: "PASS_SIMULATION",
      readiness: "MENTOR_PENDING",
      weakTopics: [],
      assessmentCriteriaVersion: ASSESSMENT_CRITERIA_VERSION,
    });
    expect(resolveMissionAccess(p, "M2").mode).toBe("ASSESSED");
  });

  it("archives legacy placeholder passes", () => {
    const archived = archiveLegacyPlaceholderAttempts([
      {
        id: "old",
        missionId: "M2",
        scenarioVersion: 1,
        quizScore: 100,
        numericPass: true,
        taskComplete: true,
        riskStatus: null,
        readiness: "READY",
        weakTopics: [],
        assessmentCriteriaVersion: 1,
      },
    ]);
    expect(archived[0]!.archivedLegacy).toBe(true);
    expect(archived[0]!.readiness).toBe("REMEDIATION");
  });

  it("replacement quizzes have no answer-revealing labels and score 100 when correct", () => {
    for (const id of ["M2", "M3", "M4", "M5"] as const) {
      const m = getMission(id)!;
      expect(m.quiz).toHaveLength(10);
      for (const q of m.quiz) {
        const blob = JSON.stringify(q.options ?? []);
        expect(blob).not.toMatch(/Correct option|گزینه درست|Incorrect A/i);
      }
      const answers = Object.fromEntries(
        m.quiz.map((item) => [
          item.id,
          item.kind === "order"
            ? item.answer
            : item.kind === "numeric"
              ? String(item.answer)
              : item.answer,
        ]),
      );
      expect(scoreQuiz(m.quiz, answers as never).score).toBe(100);
    }
  });
});
