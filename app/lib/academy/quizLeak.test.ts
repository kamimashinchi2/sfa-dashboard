import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canon } from "./canon";
import { withAnswers } from "./hydrateAnswers";
import { listQuizBanksPublic, itemHash, legacyItemHash } from "./quizHash";
import { scoreQuiz } from "./grading";
import {
  canonicalizeQuizSubmission,
  optionPermutation,
  serveQuizAttempt,
} from "./server/quizAttempt";

const SECRET = "s".repeat(48);

function banks() {
  return listQuizBanksPublic().map((bank) => ({
    quizId: bank.quizId,
    items: withAnswers(bank.items),
  }));
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("served quiz payloads do not reveal answers", () => {
  it("item hashes cannot be matched by hashing options or answers", () => {
    for (const bank of banks()) {
      const served = serveQuizAttempt(bank.items, SECRET, "a".repeat(32));
      expect(served.quiz).toHaveLength(bank.items.length);
      for (const item of served.quiz) {
        const author = bank.items.find((row) => row.id === item.id)!;
        expect(item.itemHash).toBe(itemHash(author, SECRET));
        expect(item.itemHash).not.toBe(legacyItemHash(author));
        expect(JSON.stringify(item)).not.toMatch(/"answer"|"rationale"/);
        const texts = [
          item.prompt.en,
          item.prompt.fa,
          ...(item.options ?? []).flatMap((option) => [option.en, option.fa, JSON.stringify(option)]),
        ];
        for (const text of texts) {
          expect(item.itemHash).not.toBe(sha256(text));
          expect(item.itemHash).not.toBe(sha256(canon(text)));
        }
        const optionSets = [author.options ?? null, item.options ?? null];
        for (const options of optionSets) {
          if (author.kind === "mc") {
            for (let guess = 0; guess < (options?.length ?? 0); guess++) {
              const leaked = sha256(
                canon({
                  id: author.id,
                  kind: author.kind,
                  prompt: author.prompt,
                  options,
                  answer: guess,
                }),
              );
              expect(item.itemHash).not.toBe(leaked);
            }
          }
          if (author.kind === "order" && options) {
            const leaked = sha256(
              canon({
                id: author.id,
                kind: author.kind,
                prompt: author.prompt,
                options,
                answer: [0, 1, 2, 3],
              }),
            );
            expect(item.itemHash).not.toBe(leaked);
          }
          if (author.kind === "numeric") {
            const leaked = sha256(
              canon({
                id: author.id,
                kind: author.kind,
                prompt: author.prompt,
                options,
                answer: author.answer,
              }),
            );
            expect(item.itemHash).not.toBe(leaked);
          }
        }
      }
    }
  });

  it("shuffles question order, MC positions, and order items across attempts", () => {
    const nonces = Array.from({ length: 24 }, (_, i) => i.toString(16).padStart(32, "0"));
    for (const bank of banks()) {
      const servings = nonces.map((nonce) => serveQuizAttempt(bank.items, SECRET, nonce));
      const idOrders = servings.map((served) => served.quiz.map((item) => item.id).join(","));
      expect(new Set(idOrders).size).toBeGreaterThan(1);
      expect(idOrders.every((order) => order === bank.items.map((item) => item.id).join(","))).toBe(false);

      for (const author of bank.items) {
        if (author.kind === "mc" && author.options) {
          const correct = JSON.stringify(author.options[author.answer as number]);
          const indexes = servings.map((served) => {
            const item = served.quiz.find((row) => row.id === author.id)!;
            return item.options!.findIndex((option) => JSON.stringify(option) === correct);
          });
          expect(new Set(indexes).size).toBeGreaterThan(1);
          expect(indexes.every((index) => index === 1)).toBe(false);
          expect(indexes.every((index) => index === author.answer)).toBe(false);
        }
        if (author.kind === "order" && author.options) {
          const authored = author.options.map((option) => option.en).join("|");
          const orders = servings.map((served) => {
            const item = served.quiz.find((row) => row.id === author.id)!;
            return item.options!.map((option) => option.en).join("|");
          });
          expect(orders.every((order) => order === authored)).toBe(false);
          expect(new Set(orders).size).toBeGreaterThan(1);
        }
      }
    }
  });

  it("grades a shuffled attempt against the author key", () => {
    const bank = banks()[0]!;
    let nonce = "0".repeat(32);
    let served = serveQuizAttempt(bank.items, SECRET, nonce);
    for (let i = 0; i < 30; i++) {
      nonce = i.toString(16).padStart(32, "0");
      served = serveQuizAttempt(bank.items, SECRET, nonce);
      const moved = served.quiz.some((item) => {
        if (item.kind !== "mc") return false;
        const author = bank.items.find((row) => row.id === item.id)!;
        const correct = JSON.stringify(author.options![author.answer as number]);
        return item.options!.findIndex((option) => JSON.stringify(option) === correct) !== 1;
      });
      if (moved) break;
    }
    const answers: Record<string, number | string | number[]> = {};
    const items = served.quiz.map((item) => {
      const author = bank.items.find((row) => row.id === item.id)!;
      let studentAnswer: number | string | number[] | null = null;
      if (item.kind === "mc") {
        const correct = JSON.stringify(author.options![author.answer as number]);
        studentAnswer = item.options!.findIndex((option) => JSON.stringify(option) === correct);
        expect(studentAnswer).toBeGreaterThanOrEqual(0);
      } else if (item.kind === "order") {
        const perm = optionPermutation(item.id, item.options!.length, SECRET, nonce);
        studentAnswer = (author.answer as number[]).map((authorIndex) => perm.indexOf(authorIndex));
      } else {
        studentAnswer = String(author.answer);
      }
      answers[item.id] = studentAnswer!;
      return {
        itemId: item.id,
        itemHash: item.itemHash,
        kind: item.kind,
        studentAnswer,
        touched: true,
        reflection: null,
      };
    });
    const mapped = canonicalizeQuizSubmission(
      {
        attemptId: "attempt-1",
        quizId: bank.quizId,
        buildCommit: "abc1234",
        shuffleNonce: nonce,
        items,
      },
      bank.items,
      SECRET,
    );
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(JSON.stringify(mapped.body)).not.toContain("shuffleNonce");
    const canonical: Record<string, number | string | number[]> = {};
    for (const item of mapped.body.items) {
      expect(item.studentAnswer).not.toBeNull();
      canonical[item.itemId] = item.studentAnswer as number | string | number[];
      if (item.kind === "mc") expect(item.studentAnswer).toBe(1);
      if (item.kind === "order") expect(item.studentAnswer).toEqual([0, 1, 2, 3]);
    }
    expect(scoreQuiz(bank.items, canonical, { touchedIds: Object.keys(canonical) }).score).toBe(100);
    expect(scoreQuiz(bank.items, answers, { touchedIds: Object.keys(answers) }).score).toBeLessThan(100);
  });
});
