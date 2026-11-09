import type { QuizAttemptRecord } from "./persist/types";
import { stageNumberForId } from "./publicCatalog";
import { claimReadiness } from "./thresholds";

export type TelegramLinkStatus = "UNKNOWN" | "UNLINKED" | "LINKED";

export type QuizResultV2Item = {
  itemId: string;
  itemHash: string;
  kind: "mc" | "numeric" | "order";
  studentAnswer: null | number | string | number[];
  touched: boolean;
  clientCorrect: boolean;
  topic: string;
  reflection: string | null;
};

export type QuizResultV2 = {
  format: "sfa-quiz-result";
  schemaVersion: 2;
  studentId: string;
  alias: string;
  attemptId: string;
  quizId: string;
  missionId: string;
  stage: number;
  submittedAtISO: string;
  buildCommit: string | null;
  score: number;
  correct: number;
  total: number;
  readiness: "READY" | "REMEDIATION";
  weakTopics: string[];
  items: QuizResultV2Item[];
  telegramLinkStatus: TelegramLinkStatus;
};

const ID_RE = /^[A-Za-z0-9_.:-]{1,160}$/;
const SID_RE = /^S\d{2,4}$/;
const ALIAS_RE = /^[A-Za-z][A-Za-z0-9-]{2,23}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const COMMIT_RE = /^[0-9a-f]{7,40}$/;

/** Canonical studentAnswer for transport — no raw objects. */
export function canonicalStudentAnswer(
  kind: "mc" | "numeric" | "order",
  canonical: unknown,
  touched: boolean,
): null | number | string | number[] {
  if (!touched) return null;
  if (canonical === null || canonical === undefined) return null;
  if (kind === "mc" && typeof canonical === "number") {
    if (canonical < 0 || canonical > 1000 || !Number.isInteger(canonical))
      return null;
    return canonical;
  }
  if (kind === "numeric") {
    const s = String(canonical).trim();
    if (!s) return null;
    return s.slice(0, 1000);
  }
  if (kind === "order" && Array.isArray(canonical)) {
    if (!canonical.every((n) => Number.isInteger(n) && n >= 0 && n <= 1000))
      return null;
    return canonical.map((n) => Number(n)).slice(0, 100);
  }
  return null;
}

export function buildQuizResultV2(input: {
  attempt: QuizAttemptRecord;
  studentId: string;
  alias: string;
  telegramLinkStatus?: TelegramLinkStatus;
  /** topic per itemId from public quiz metadata */
  topics: Record<string, string>;
}): QuizResultV2 {
  const { attempt } = input;
  const stage = stageNumberForId(attempt.quizId);
  if (stage == null) throw new Error(`UNKNOWN_STAGE:${attempt.quizId}`);
  if (attempt.mode !== "ASSESSED") {
    throw new Error("PREVIEW_NOT_ENQUEUED");
  }

  const buildCommit =
    attempt.buildCommit && COMMIT_RE.test(attempt.buildCommit)
      ? attempt.buildCommit.toLowerCase()
      : attempt.buildCommit
        ? null
        : null;

  const items: QuizResultV2Item[] = attempt.items.map((it) => ({
    itemId: it.itemId,
    itemHash: it.itemHash,
    kind: it.kind,
    studentAnswer: canonicalStudentAnswer(
      it.kind,
      it.answer.canonical,
      it.touched,
    ),
    touched: it.touched,
    clientCorrect: it.clientCorrect,
    topic: (input.topics[it.itemId] ?? it.itemId).slice(0, 100),
    reflection:
      it.reflection && it.reflection.trim().length > 0
        ? it.reflection.slice(0, 4000)
        : null,
  }));

  return {
    format: "sfa-quiz-result",
    schemaVersion: 2,
    studentId: input.studentId,
    alias: input.alias,
    attemptId: attempt.attemptId,
    quizId: attempt.quizId,
    missionId: attempt.quizId,
    stage,
    submittedAtISO: attempt.submittedAtISO,
    buildCommit,
    score: attempt.client.score,
    correct: attempt.client.correct,
    total: attempt.client.total,
    readiness: claimReadiness(attempt.client.score),
    weakTopics: attempt.client.weakTopics.slice(0, 100),
    items,
    telegramLinkStatus: input.telegramLinkStatus ?? "UNKNOWN",
  };
}

export function validateQuizResultV2Shape(o: QuizResultV2): string[] {
  const errors: string[] = [];
  if (o.format !== "sfa-quiz-result") errors.push("format");
  if (o.schemaVersion !== 2) errors.push("schemaVersion");
  if (!SID_RE.test(o.studentId)) errors.push("studentId");
  if (!ALIAS_RE.test(o.alias)) errors.push("alias");
  if (!ID_RE.test(o.attemptId)) errors.push("attemptId");
  if (o.quizId !== o.missionId) errors.push("quizId!=missionId");
  if (o.items.length !== o.total) errors.push("items!=total");
  for (const it of o.items) {
    if (!HASH_RE.test(it.itemHash)) errors.push(`hash:${it.itemId}`);
    if (!ID_RE.test(it.itemId)) errors.push(`itemId:${it.itemId}`);
  }
  return errors;
}

/** Freeze exact JSON bytes for outbox (sorted keys not required by schema; stable serialize). */
export function serializeQuizResultV2(o: QuizResultV2): string {
  return JSON.stringify(o);
}
