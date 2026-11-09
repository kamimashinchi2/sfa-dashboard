import { guardUnknown } from "./guards";
import {
  QUIZ_DOMAIN_VERSION,
  defaultQuiz,
  type QuizAttemptRecord,
  type QuizStore,
} from "./types";

export const QUIZ_ATTEMPTS_CAP_PER_BANK = 20;

/** Pure + idempotent quiz domain v2 → v3 migration. */
export function migrateQuizV2ToV3(raw: unknown): QuizStore {
  if (!raw || typeof raw !== "object") return defaultQuiz();
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion === QUIZ_DOMAIN_VERSION && Array.isArray(o.attempts)) {
    return {
      schemaVersion: QUIZ_DOMAIN_VERSION,
      attempts: o.attempts as QuizAttemptRecord[],
      answers: o.answers as QuizStore["answers"],
    };
  }
  // Legacy v2: { answers: {...} } — keep answers for backup readability
  const answers =
    o.answers && typeof o.answers === "object"
      ? (o.answers as QuizStore["answers"])
      : undefined;
  return {
    schemaVersion: QUIZ_DOMAIN_VERSION,
    attempts: Array.isArray(o.attempts)
      ? (o.attempts as QuizAttemptRecord[])
      : [],
    answers,
  };
}

export function guardQuizStore(raw: unknown): {
  ok: boolean;
  value: QuizStore | null;
  reason?: string;
} {
  const g = guardUnknown(raw);
  if (!g.ok) return { ok: false, value: null, reason: g.reason };
  if (!raw || typeof raw !== "object") {
    return { ok: false, value: null, reason: "NOT_OBJECT" };
  }
  const migrated = migrateQuizV2ToV3(raw);
  return { ok: true, value: migrated };
}

/** Cap 20 per quizId; newest first. */
export function pushQuizAttempt(
  store: QuizStore,
  attempt: QuizAttemptRecord,
): QuizStore {
  const others = store.attempts.filter((a) => a.attemptId !== attempt.attemptId);
  const sameQuiz = others.filter((a) => a.quizId === attempt.quizId);
  const otherQuiz = others.filter((a) => a.quizId !== attempt.quizId);
  const capped = [attempt, ...sameQuiz].slice(0, QUIZ_ATTEMPTS_CAP_PER_BANK);
  return {
    schemaVersion: QUIZ_DOMAIN_VERSION,
    attempts: [...capped, ...otherQuiz],
    answers: store.answers,
  };
}

export function latestAssessedAttempt(
  store: QuizStore,
  quizId: string,
): QuizAttemptRecord | null {
  const list = store.attempts.filter(
    (a) => a.quizId === quizId && a.mode === "ASSESSED",
  );
  return list[0] ?? null;
}

/** Imported clientCorrect/score/PASS stay UNVERIFIED claims. */
export function sanitizeImportedQuiz(store: QuizStore): QuizStore {
  return {
    schemaVersion: QUIZ_DOMAIN_VERSION,
    answers: store.answers,
    attempts: store.attempts.map((a) => ({
      ...a,
      unverifiedClaim: true as const,
      items: a.items.map((it) => ({
        ...it,
        // Keep values but mark claim path via parent flag
        clientCorrect: it.clientCorrect,
      })),
      client: { ...a.client },
    })),
  };
}
