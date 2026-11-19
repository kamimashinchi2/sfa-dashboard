import { noStoreJson } from "../../../lib/academy/server/bridgeProxy";
import { listPrivateQuizBanks } from "../../../lib/academy/server/privateQuizBanks";
import { canon } from "../../../lib/academy/canon";
import { itemHash } from "../../../lib/academy/quizHash";
import { quizItemHmacKey } from "../../../lib/academy/server/quizHmacKey";
import { sha256Hex } from "../../../lib/academy/sha256";


/**
 * Aggregate quiz-bank hash for packet versioning.
 * Does not expose answers — only the hash of itemHashes.
 */
export async function GET() {
  let secret: string;
  try {
    secret = quizItemHmacKey();
  } catch {
    return noStoreJson({ error: "QUIZ_UNAVAILABLE" }, 503);
  }
  const banks = listPrivateQuizBanks();
  const pairs = await Promise.all(
    banks.map(async (b) => {
      const hashes = b.items.map((i) => itemHash(i, secret));
      const sorted = [...hashes].sort((a, c) => (a < c ? -1 : a > c ? 1 : 0));
      return { quizId: b.quizId, hash: await sha256Hex(canon(sorted)) };
    }),
  );
  pairs.sort((a, b) => (a.quizId < b.quizId ? -1 : 1));
  const all = await sha256Hex(canon(pairs));
  return noStoreJson({ quizBankHash: all, banks: pairs.map((p) => p.quizId) });
}
