import { createHmac } from "node:crypto";
import { canon } from "./canon";
import { sha256Hex, sha256HexSync } from "./sha256";
import type { QuizItem } from "./curriculum";
import type { Text } from "./contracts";
import { getMission, missions } from "./curriculum";
import { getAdvanced, advancedModules } from "./advancedCurriculum";

/**
 * v2 item integrity: HMAC-SHA256 over the question the student sees, without the answer.
 * v1 (legacyItemHash) was unsalted SHA-256 of the item including the answer.
 * Stored attempts keep the hash they were submitted with. New keys use v2 only.
 * Grading compares the submitted hash to the key for that build commit; it does not
 * accept a v1 hash on a v2 key (that would let a student probe the answer).
 */
export const ITEM_HASH_VERSION = 2 as const;

const HMAC_PREFIX = "sfa-quiz-item-v2";

export type CanonicalQuizItem = {
  id: string;
  kind: string;
  prompt: Text;
  options: Text[] | null;
  answer: number | string | number[];
};

export type PublicQuizDigest = {
  id: string;
  kind: string;
  prompt: Text;
  options: Text[] | null;
};

export function assertQuizHmacSecret(secret: string): string {
  const key = secret.trim();
  if (key.length < 32) throw new Error("QUIZ_HMAC_SECRET_REQUIRED");
  return key;
}

export function toCanonicalQuizItem(item: QuizItem): CanonicalQuizItem {
  if (item.answer === undefined) {
    throw new Error(`ITEM_ANSWER_REQUIRED:${item.id}`);
  }
  return {
    id: item.id,
    kind: item.kind,
    prompt: item.prompt,
    options: item.options ?? null,
    answer: item.answer,
  };
}

export function toPublicQuizDigest(item: QuizItem): PublicQuizDigest {
  return {
    id: item.id,
    kind: item.kind,
    prompt: item.prompt,
    options: item.options ?? null,
  };
}

/** v2 itemHash. The answer is not an input. The secret never leaves the server. */
export function itemHash(item: QuizItem, secret: string): string {
  const key = assertQuizHmacSecret(secret);
  return createHmac("sha256", key)
    .update(`${HMAC_PREFIX}\n${canon(toPublicQuizDigest(item))}`, "utf8")
    .digest("hex");
}

/**
 * v1 unsalted digest, including the answer. For verifying historical attempts
 * and proving the served hash is not this value. Do not send it to the browser
 * and do not accept it as the current submission hash.
 */
export function legacyItemHash(item: QuizItem): string {
  return sha256HexSync(canon(toCanonicalQuizItem(item)));
}

export function classifyStoredItemHash(
  item: QuizItem,
  hash: string,
  secret: string,
): "v2" | "v1" | "mismatch" {
  if (hash === itemHash(item, secret)) return "v2";
  if (item.answer !== undefined && hash === legacyItemHash(item)) return "v1";
  return "mismatch";
}

/** quizBankHash = SHA-256 of the canonical sorted array of all v2 itemHashes. */
export async function quizBankHash(items: QuizItem[], secret: string): Promise<string> {
  const hashes = items.map((i) => itemHash(i, secret));
  const sorted = [...hashes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sha256Hex(canon(sorted));
}

export type QuizBankRef = {
  quizId: string;
  items: QuizItem[];
};

/** Public bank listing WITHOUT answers (client-safe). */
export function listQuizBanksPublic(): QuizBankRef[] {
  const out: QuizBankRef[] = [];
  for (const m of missions) {
    out.push({ quizId: m.id, items: m.quiz });
  }
  for (const a of advancedModules) {
    out.push({ quizId: a.id, items: a.quiz });
  }
  return out;
}

/** @deprecated Use listQuizBanksPublic or server listPrivateQuizBanks */
export function listQuizBanks(): QuizBankRef[] {
  return listQuizBanksPublic();
}

export function getQuizBank(quizId: string): QuizItem[] | null {
  const m = getMission(quizId);
  if (m) return m.quiz;
  const a = getAdvanced(quizId);
  if (a) return a.quiz;
  return null;
}

/** Memoized bank hashes — keyed by quiz id and a non-reversible secret tag. */
const bankHashCache = new Map<string, string>();
const allBanksHash = new Map<string, string>();

function secretTag(secret: string): string {
  return createHmac("sha256", assertQuizHmacSecret(secret))
    .update("sfa-quiz-hash-cache")
    .digest("hex")
    .slice(0, 16);
}

export async function getQuizBankHashCached(
  quizId: string,
  secret: string,
  items?: QuizItem[],
): Promise<string> {
  const cacheKey = `${secretTag(secret)}:${quizId}`;
  const hit = bankHashCache.get(cacheKey);
  if (hit) return hit;
  const bank = items ?? getQuizBank(quizId);
  if (!bank) throw new Error(`UNKNOWN_QUIZ:${quizId}`);
  const h = await quizBankHash(bank, secret);
  bankHashCache.set(cacheKey, h);
  return h;
}

export async function getAllQuizBanksHash(
  secret: string,
  banks?: QuizBankRef[],
): Promise<string> {
  const tag = secretTag(secret);
  if (!banks) {
    const hit = allBanksHash.get(tag);
    if (hit) return hit;
  }
  const list = banks ?? listQuizBanksPublic();
  const pairs = await Promise.all(
    list.map(async (b) => ({
      quizId: b.quizId,
      hash: await getQuizBankHashCached(b.quizId, secret, b.items),
    })),
  );
  pairs.sort((a, b) => (a.quizId < b.quizId ? -1 : 1));
  const hash = await sha256Hex(canon(pairs));
  if (!banks) allBanksHash.set(tag, hash);
  return hash;
}

/** Export for build-time / packet versions.quizBank */
export async function QUIZ_BANK_HASH(secret: string): Promise<string> {
  return getAllQuizBanksHash(secret);
}
