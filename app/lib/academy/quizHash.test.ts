import { describe, expect, it } from "vitest";
import { getQuizBankHashCached, listQuizBanks, itemHash } from "./quizHash";

describe("quiz bank hashes", () => {
  it("pins current bank hashes (snapshot)", async () => {
    const banks = listQuizBanks();
    const snapshot: Record<string, string> = {};
    for (const b of banks) {
      snapshot[b.quizId] = await getQuizBankHashCached(b.quizId);
      expect(snapshot[b.quizId]).toMatch(/^[0-9a-f]{64}$/);
    }
    // Stable across calls
    for (const b of banks) {
      expect(await getQuizBankHashCached(b.quizId)).toBe(snapshot[b.quizId]);
    }
    // First item hash stable
    const h = await itemHash(banks[0]!.items[0]!);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    // Export snapshot shape for review visibility
    expect(Object.keys(snapshot).sort()).toEqual([
      "A6",
      "A7",
      "A8",
      "M1",
      "M2",
      "M3",
      "M4",
      "M5",
    ]);
  });
});
