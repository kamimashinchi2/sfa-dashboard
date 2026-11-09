import { describe, expect, it } from "vitest";
import { scoreQuiz, numericAnswersEqual } from "./grading";
import { buildDisplayedQuiz } from "./quizShuffle";
import { listQuizBanks } from "./quizHash";

describe("P0-1 quiz shuffle + scoring", () => {
  it("always-second-option cannot recover the old ≥90 exploit; mean ≤30 over 100 seeds", () => {
    const banks = listQuizBanks();
    expect(banks.length).toBe(8);
    for (const bank of banks) {
      const scores: number[] = [];
      for (let seedN = 0; seedN < 100; seedN++) {
        const seed = `S07:${bank.quizId}:seed${seedN}`;
        const displayed = buildDisplayedQuiz(bank.items, seed);
        const answers: Record<string, string | number | number[]> = {};
        const touched = new Set<string>();
        for (const d of displayed) {
          const item = d.item;
          if (item.kind === "mc" && d.optionMap) {
            // Always choose the second displayed option → canonical index
            const canonical = d.optionMap[1] ?? d.optionMap[0]!;
            answers[item.id] = canonical;
            touched.add(item.id);
          } else if (item.kind === "numeric") {
            // Leave numeric unanswered (old exploit only needed MC + untouched order)
          } else if (item.kind === "order") {
            // Do not touch order — unanswered
          }
        }
        const scored = scoreQuiz(bank.items, answers, { touchedIds: touched });
        scores.push(scored.score);
        // Old exploit was 90 — must never approach a pass
        expect(scored.score).toBeLessThan(80);
      }
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      expect(mean).toBeLessThanOrEqual(30);
    }
  });

  it("untouched order scores wrong / unanswered", () => {
    const bank = listQuizBanks().find((b) =>
      b.items.some((i) => i.kind === "order"),
    )!;
    const orderItem = bank.items.find((i) => i.kind === "order")!;
    const scored = scoreQuiz(bank.items, {}, { touchedIds: [] });
    const per = scored.perItem.find((p) => p.id === orderItem.id)!;
    expect(per.unanswered).toBe(true);
    expect(per.pass).toBe(false);
  });

  it("FA digits numeric equality", () => {
    expect(numericAnswersEqual("۱۰۰", "100")).toBe(true);
    expect(numericAnswersEqual("100.00", "100")).toBe(true);
    expect(numericAnswersEqual("۱۰۰٫۵", "100.5")).toBe(true);
  });

  it("same seed → same displayed order", () => {
    const bank = listQuizBanks()[0]!;
    const a = buildDisplayedQuiz(bank.items, "S07:M1:aaaa");
    const b = buildDisplayedQuiz(bank.items, "S07:M1:aaaa");
    expect(a.map((d) => d.optionMap)).toEqual(b.map((d) => d.optionMap));
    expect(a.map((d) => d.initialOrder)).toEqual(b.map((d) => d.initialOrder));
  });
});
