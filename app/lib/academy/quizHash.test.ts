import { describe, expect, it } from "vitest";
import {
  classifyStoredItemHash,
  getQuizBankHashCached,
  legacyItemHash,
  listQuizBanksPublic,
  itemHash,
} from "./quizHash";
import { withAnswers } from "./hydrateAnswers";

const SECRET = "t".repeat(48);

describe("quiz bank hashes", () => {
  it("pins current bank hashes (snapshot)", async () => {
    const banks = listQuizBanksPublic().map((b) => ({
      ...b,
      items: withAnswers(b.items),
    }));
    const snapshot: Record<string, string> = {};
    for (const b of banks) {
      snapshot[b.quizId] = await getQuizBankHashCached(b.quizId, SECRET, b.items);
      expect(snapshot[b.quizId]).toMatch(/^[0-9a-f]{64}$/);
    }
    for (const b of banks) {
      expect(await getQuizBankHashCached(b.quizId, SECRET, b.items)).toBe(
        snapshot[b.quizId],
      );
    }
    const item = banks[0]!.items[0]!;
    const h = itemHash(item, SECRET);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(legacyItemHash(item));
    expect(classifyStoredItemHash(item, h, SECRET)).toBe("v2");
    expect(classifyStoredItemHash(item, legacyItemHash(item), SECRET)).toBe("v1");
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
