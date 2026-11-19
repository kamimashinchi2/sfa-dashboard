import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import type { QuizItem } from "../curriculum";
import { assertQuizHmacSecret, itemHash } from "../quizHash";
import { toPublicQuizItem, type PublicQuizItem } from "./hydrateQuiz";

const NONCE_RE = /^[0-9a-f]{32}$/;

export type ServedQuiz = {
  shuffleNonce: string;
  quiz: PublicQuizItem[];
};

export function newShuffleNonce(): string {
  return randomBytes(16).toString("hex");
}

/** Fisher–Yates driven by HMAC(secret, nonce, scope). The map is not sent to the client. */
export function optionPermutation(
  itemId: string,
  count: number,
  secret: string,
  nonce: string,
): number[] {
  return permutation(count, secret, nonce, `options:${itemId}`);
}

function permutation(n: number, secret: string, nonce: string, scope: string): number[] {
  const key = assertQuizHmacSecret(secret);
  if (!NONCE_RE.test(nonce)) throw new Error("SHUFFLE_NONCE_INVALID");
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const mac = createHmac("sha256", key)
      .update(`sfa-quiz-shuffle-v1\n${nonce}\n${scope}\n${i}`, "utf8")
      .digest();
    const j = mac.readUInt32BE(0) % (i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Per-attempt student payload. Question order and option order are permuted.
 * itemHash is the v2 HMAC of the author-order item and does not include the answer.
 */
export function serveQuizAttempt(
  items: QuizItem[],
  secret: string,
  nonce = newShuffleNonce(),
): ServedQuiz {
  const order = permutation(items.length, secret, nonce, "questions");
  const quiz = order.map((index) => {
    const item = items[index]!;
    const hash = itemHash(item, secret);
    let options = item.options;
    if ((item.kind === "mc" || item.kind === "order") && options && options.length > 1) {
      const perm = optionPermutation(item.id, options.length, secret, nonce);
      options = perm.map((i) => options![i]!);
    }
    return toPublicQuizItem({ ...item, options }, hash);
  });
  return { shuffleNonce: nonce, quiz };
}

type SubmitItem = {
  itemId: string;
  itemHash: string;
  kind: "mc" | "numeric" | "order";
  studentAnswer: number | string | number[] | null;
  touched: boolean;
  reflection: string | null;
};

export type CanonicalQuizSubmit = {
  attemptId: string;
  quizId: string;
  buildCommit: string | null;
  items: SubmitItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mapServedAnswer(
  item: QuizItem,
  raw: unknown,
  secret: string,
  nonce: string,
): number | string | number[] | null {
  if (raw === null || raw === undefined) return null;
  if (item.kind === "numeric") {
    if (typeof raw === "string" || typeof raw === "number") return String(raw);
    return null;
  }
  const options = item.options;
  if (!options || options.length === 0) return null;
  const perm = optionPermutation(item.id, options.length, secret, nonce);
  if (item.kind === "mc") {
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw >= perm.length) {
      throw new Error("ANSWER_INDEX_INVALID");
    }
    return perm[raw]!;
  }
  if (!Array.isArray(raw) || raw.length > 100) throw new Error("ANSWER_INDEX_INVALID");
  return raw.map((entry) => {
    if (typeof entry !== "number" || !Number.isInteger(entry) || entry < 0 || entry >= perm.length) {
      throw new Error("ANSWER_INDEX_INVALID");
    }
    return perm[entry]!;
  });
}

/**
 * Map display indexes (positions in the served option list) back to author indexes.
 * shuffleNonce is removed so the Python grader still sees the canonical field set.
 */
export function canonicalizeQuizSubmission(
  body: unknown,
  bank: QuizItem[],
  secret: string,
): { ok: true; body: CanonicalQuizSubmit } | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: "VALIDATION_FAILED" };
  const nonce = body.shuffleNonce;
  if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) {
    return { ok: false, error: "SHUFFLE_NONCE_REQUIRED" };
  }
  if (typeof body.attemptId !== "string" || typeof body.quizId !== "string") {
    return { ok: false, error: "VALIDATION_FAILED" };
  }
  if (!(body.buildCommit === null || typeof body.buildCommit === "string")) {
    return { ok: false, error: "VALIDATION_FAILED" };
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { ok: false, error: "VALIDATION_FAILED" };
  }
  const byId = new Map(bank.map((item) => [item.id, item]));
  const items: SubmitItem[] = [];
  try {
    assertQuizHmacSecret(secret);
    for (const rawItem of body.items) {
      if (!isRecord(rawItem)) return { ok: false, error: "VALIDATION_FAILED" };
      const itemId = rawItem.itemId;
      const kind = rawItem.kind;
      const itemHashValue = rawItem.itemHash;
      if (typeof itemId !== "string" || typeof itemHashValue !== "string") {
        return { ok: false, error: "VALIDATION_FAILED" };
      }
      if (kind !== "mc" && kind !== "numeric" && kind !== "order") {
        return { ok: false, error: "VALIDATION_FAILED" };
      }
      if (typeof rawItem.touched !== "boolean") return { ok: false, error: "VALIDATION_FAILED" };
      if (!(rawItem.reflection === null || typeof rawItem.reflection === "string")) {
        return { ok: false, error: "VALIDATION_FAILED" };
      }
      const author = byId.get(itemId);
      let studentAnswer: SubmitItem["studentAnswer"] = null;
      if (!rawItem.touched || rawItem.studentAnswer === null || rawItem.studentAnswer === undefined) {
        studentAnswer = null;
      } else if (!author || author.kind !== kind) {
        studentAnswer = mapUntyped(rawItem.studentAnswer);
      } else {
        studentAnswer = mapServedAnswer(author, rawItem.studentAnswer, secret, nonce);
      }
      items.push({
        itemId,
        itemHash: itemHashValue,
        kind,
        studentAnswer,
        touched: rawItem.touched && studentAnswer !== null,
        reflection: rawItem.reflection,
      });
    }
  } catch {
    return { ok: false, error: "VALIDATION_FAILED" };
  }
  return {
    ok: true,
    body: {
      attemptId: body.attemptId,
      quizId: body.quizId,
      buildCommit: body.buildCommit,
      items,
    },
  };
}

function mapUntyped(raw: unknown): number | string | number[] | null {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.every((n) => typeof n === "number" && Number.isInteger(n))) {
    return raw as number[];
  }
  return null;
}
