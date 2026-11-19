import "server-only";
import { assertQuizHmacSecret } from "../quizHash";

/** Server-only item integrity key. Never log the return value. */
export function quizItemHmacKey(): string {
  return assertQuizHmacSecret(process.env.SFA_QUIZ_ITEM_HMAC_KEY ?? "");
}
