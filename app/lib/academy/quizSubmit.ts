/**
 * Canonical quiz submission for POST /api/mentor/quizzes.
 * Callers must already restore canonical MC/order indexes (quizShuffle).
 * This module does not know answer keys.
 */

export type QuizSubmitItem = {
  itemId: string;
  itemHash: string;
  kind: "mc" | "numeric" | "order";
  studentAnswer: number | string | number[] | null;
  touched: boolean;
  reflection: string | null;
};

export type QuizSubmitBody = {
  attemptId: string;
  quizId: string;
  buildCommit: string | null;
  items: QuizSubmitItem[];
};

export function normalizeBuildCommit(raw: string | null | undefined): string | null {
  const value = raw?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]{7,40}$/.test(value) ? value : null;
}

export function buildQuizSubmission(input: {
  attemptId: string;
  quizId: string;
  buildCommit: string | null;
  items: { id: string; kind: "mc" | "numeric" | "order"; itemHash?: string }[];
  answers: Record<string, unknown>;
  touchedIds: Iterable<string>;
  skippedIds: Iterable<string>;
}): { ok: true; body: QuizSubmitBody } | { ok: false; error: string } {
  const touched = new Set(input.touchedIds);
  const skipped = new Set(input.skippedIds);
  const items: QuizSubmitItem[] = [];
  for (const item of input.items) {
    const hash = item.itemHash ?? "";
    if (!/^[0-9a-f]{64}$/.test(hash)) {
      return { ok: false, error: `ITEM_HASH_REQUIRED:${item.id}` };
    }
    const wasTouched = touched.has(item.id) && !skipped.has(item.id);
    const raw = input.answers[item.id];
    let studentAnswer: QuizSubmitItem["studentAnswer"] = null;
    if (wasTouched) {
      if (item.kind === "mc" && typeof raw === "number" && Number.isInteger(raw)) {
        studentAnswer = raw;
      } else if (
        item.kind === "order" &&
        Array.isArray(raw) &&
        raw.every((n) => typeof n === "number")
      ) {
        studentAnswer = raw as number[];
      } else if (item.kind === "numeric" && (typeof raw === "string" || typeof raw === "number")) {
        studentAnswer = String(raw);
      }
    }
    items.push({
      itemId: item.id,
      itemHash: hash,
      kind: item.kind,
      studentAnswer,
      touched: wasTouched && studentAnswer !== null,
      reflection: null,
    });
  }
  if (items.length === 0) return { ok: false, error: "FULL_QUIZ_ITEMS_REQUIRED" };
  return {
    ok: true,
    body: {
      attemptId: input.attemptId,
      quizId: input.quizId,
      buildCommit: normalizeBuildCommit(input.buildCommit),
      items,
    },
  };
}
