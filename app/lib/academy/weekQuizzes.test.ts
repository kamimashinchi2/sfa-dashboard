import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { A6_QUIZ, A7_QUIZ, A8_QUIZ, M1_QUIZ, M2_QUIZ, M3_QUIZ, M4_QUIZ, M5_QUIZ } from "./weekQuizzes";
import { QUIZ_ANSWER_KEY, QUIZ_PROVENANCE } from "./server/answerKeyData";
import type { QuizItem } from "./curriculum";

const banks: QuizItem[][] = [M1_QUIZ, M2_QUIZ, M3_QUIZ, M4_QUIZ, M5_QUIZ, A6_QUIZ, A7_QUIZ, A8_QUIZ];

describe("NotebookLM week banks", () => {
  it("has eight banks of ten questions, each with a private answer and a source", () => {
    expect(banks).toHaveLength(8);
    const ids = banks.flat().map((item) => item.id);
    expect(new Set(ids).size).toBe(80);
    expect(Object.keys(QUIZ_ANSWER_KEY)).toEqual(ids);
    expect(Object.keys(QUIZ_PROVENANCE)).toEqual(ids);
    for (const item of banks.flat()) {
      const answer = QUIZ_ANSWER_KEY[item.id];
      expect(QUIZ_PROVENANCE[item.id]?.length).toBeGreaterThan(8);
      expect(item.prompt.en.length).toBeGreaterThan(8);
      expect(item.prompt.fa.length).toBeGreaterThan(4);
      expect(JSON.stringify(item)).not.toContain('"answer"');
      if (item.kind === "mc" || item.kind === "order") {
        expect(item.options?.length).toBeGreaterThan(1);
      }
      if (item.kind === "mc") {
        expect(typeof answer).toBe("number");
        expect(answer as number).toBeGreaterThanOrEqual(0);
        expect(answer as number).toBeLessThan(item.options!.length);
      }
      if (item.kind === "numeric") {
        expect(typeof answer).toBe("string");
      }
      if (item.kind === "order") {
        // Author order is the answer key. The served payload permutes it per attempt.
        expect(answer).toEqual([0, 1, 2, 3]);
        expect(item.options).toHaveLength(4);
      }
      if (item.id === "M5-Q8") expect(answer).toBe(1);
      if (item.id === "A8-Q10") {
        expect(answer).toEqual([0, 1, 2, 3]);
        expect(item.options?.[3]?.en).toMatch(/Final Paper Plan/);
        expect(item.options?.[0]?.en).toMatch(/Release fields/);
      }
    }
  });

  it("keeps the server answer key byte-identical", () => {
    const bytes = readFileSync(new URL("./server/answerKeyData.ts", import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "6d01bed77273ae463ceff051a8850c1ce200aedc43a50bde01d4b3c84da38c60",
    );
  });
});
