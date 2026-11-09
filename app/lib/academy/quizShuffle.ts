import { mulberry32 } from "./seededRng";
import { hashSeedToUint32 } from "./sha256";
import type { QuizItem } from "./curriculum";

/** Fisher–Yates permutation of [0..n) using seeded RNG. */
export function seededPermutation(n: number, seed: string): number[] {
  const rnd = mulberry32(hashSeedToUint32(seed));
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export type DisplayedItem = {
  item: QuizItem;
  /** Display position → canonical option index (MC). Identity if unshuffled. */
  optionMap: number[] | null;
  /** Initial order-item state as canonical option indices (shuffled). */
  initialOrder: number[] | null;
};

/**
 * Build per-attempt display state.
 * seed = `${studentId}:${quizId}:${attemptNonce}`
 * MC options and order-item initial state are shuffled; answers stay canonical.
 */
export function buildDisplayedQuiz(
  items: QuizItem[],
  seed: string,
): DisplayedItem[] {
  return items.map((item, idx) => {
    if (item.kind === "mc" && item.options) {
      const optionMap = seededPermutation(
        item.options.length,
        `${seed}:mc:${item.id}:${idx}`,
      );
      return { item, optionMap, initialOrder: null };
    }
    if (item.kind === "order" && item.options) {
      const initialOrder = seededPermutation(
        item.options.length,
        `${seed}:order:${item.id}:${idx}`,
      );
      return { item, optionMap: null, initialOrder };
    }
    return { item, optionMap: null, initialOrder: null };
  });
}

/** Map a display-position MC selection back to the canonical bank index. */
export function displayToCanonicalMc(
  optionMap: number[],
  displayIndex: number,
): number {
  return optionMap[displayIndex]!;
}
