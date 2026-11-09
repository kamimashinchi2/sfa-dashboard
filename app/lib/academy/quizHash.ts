import { canon } from "./canon";
import { sha256Hex } from "./sha256";
import type { QuizItem } from "./curriculum";
import type { Text } from "./contracts";
import { getMission, missions } from "./curriculum";
import { getAdvanced, advancedModules } from "./advancedCurriculum";

export type CanonicalQuizItem = {
  id: string;
  kind: string;
  prompt: Text;
  options: Text[] | null;
  answer: number | string | number[];
};

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

/** itemHash = SHA-256 hex of canon({id, kind, prompt, options, answer}) */
export async function itemHash(item: QuizItem): Promise<string> {
  return sha256Hex(canon(toCanonicalQuizItem(item)));
}

/** quizBankHash = SHA-256 of the canonical sorted array of all itemHashes. */
export async function quizBankHash(items: QuizItem[]): Promise<string> {
  const hashes = await Promise.all(items.map((i) => itemHash(i)));
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

/** Memoized bank hashes — computed once per process (requires hydrated answers). */
const bankHashCache = new Map<string, string>();
let allBanksHash: string | null = null;

export async function getQuizBankHashCached(
  quizId: string,
  items?: QuizItem[],
): Promise<string> {
  const hit = bankHashCache.get(quizId);
  if (hit) return hit;
  const bank = items ?? getQuizBank(quizId);
  if (!bank) throw new Error(`UNKNOWN_QUIZ:${quizId}`);
  const h = await quizBankHash(bank);
  bankHashCache.set(quizId, h);
  return h;
}

export async function getAllQuizBanksHash(
  banks?: QuizBankRef[],
): Promise<string> {
  if (allBanksHash && !banks) return allBanksHash;
  const list = banks ?? listQuizBanksPublic();
  const pairs = await Promise.all(
    list.map(async (b) => ({
      quizId: b.quizId,
      hash: await getQuizBankHashCached(b.quizId, b.items),
    })),
  );
  pairs.sort((a, b) => (a.quizId < b.quizId ? -1 : 1));
  const hash = await sha256Hex(canon(pairs));
  if (!banks) allBanksHash = hash;
  return hash;
}

/** Export for build-time / packet versions.quizBank */
export async function QUIZ_BANK_HASH(): Promise<string> {
  return getAllQuizBanksHash();
}
