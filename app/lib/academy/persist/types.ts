import type {
  Attempt,
  CalcHistoryEntry,
  Locale,
  Progress,
  StageId,
} from "../contracts";
import type { JournalV2 } from "../journalV2";

export const SFA_V2_PREFIX = "sfa.v2.";
export const SFA_SCHEMA_VERSION = 2 as const;
/** Quiz domain schema (independent of backup envelope). */
export const QUIZ_DOMAIN_VERSION = 3 as const;

export type PersistMeta = {
  schemaVersion: typeof SFA_SCHEMA_VERSION;
  migratedFrom: string | null;
  deviceId: string;
  rev: number;
  lastWriteISO: string;
};

export type ProgressV2 = Omit<Progress, "version"> & {
  version: 2;
  unlockedMilestoneIds: string[];
};

/** Legacy v2 quiz answers map (pre–Iteration 4). */
export type QuizAnswersV2 = Record<
  string,
  { itemVersion: number; value: unknown; atISO: string }
>;

export type QuizItemAnswerRecord = {
  itemId: string;
  itemHash: string;
  kind: "mc" | "numeric" | "order";
  displayedOrder: number[] | null;
  answer: { raw: unknown; canonical: unknown };
  touched: boolean;
  clientCorrect: boolean;
  reflection: string | null;
};

export type QuizAttemptRecord = {
  attemptId: string;
  quizId: string;
  mode: "ASSESSED" | "READ_ONLY_PREVIEW";
  assessmentCriteriaVersion: number;
  startedAtISO: string;
  submittedAtISO: string;
  shuffleSeed: string;
  buildCommit: string | null;
  items: QuizItemAnswerRecord[];
  client: {
    correct: number;
    total: number;
    score: number;
    numericPass: boolean;
    weakTopics: string[];
  };
  /** Client claim — always UNVERIFIED until mentor review. */
  unverifiedClaim: true;
};

export type QuizStore = {
  schemaVersion: typeof QUIZ_DOMAIN_VERSION;
  attempts: QuizAttemptRecord[];
  /** Retained for backup readability of older exports. */
  answers?: QuizAnswersV2;
};

export type CalcHistoryStore = {
  entries: CalcHistoryEntry[];
};

export type JournalStore = {
  entries: JournalV2[];
};

export type LessonResponseRecord = {
  id: string;
  lessonId: string;
  missionId: string | null;
  text: string;
  rubricSelfChecks: boolean[];
  savedAtISO: string;
};

export type SelfReportRecord = {
  kind: "LESSON_REVIEWED" | "PRACTICAL_COMPLETE";
  refId: string;
  atISO: string;
};

export type ResponsesStore = {
  schemaVersion: 1;
  lessonResponses: LessonResponseRecord[];
  selfReports: SelfReportRecord[];
};

export type StudentDecision =
  | "FINAL_PLAN"
  | "EXPLORATION"
  | "REJECTED_BY_STUDENT";

export type SimRunRecord = {
  runId: string;
  tool:
    | "risk-grid"
    | "setup-validator"
    | "macro-chain"
    | "research-lab"
    | "drawdown-lab"
    | "cross-asset";
  missionId: string | null;
  atISO: string;
  engineVersion: number;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  status: string;
  issueCodes: string[];
  studentDecision: StudentDecision;
  note: string | null;
};

export type SimRunsStore = {
  schemaVersion: 1;
  entries: SimRunRecord[];
};

export type PacketExportLogEntry = {
  week: string;
  seq: number;
  digest: string;
  atISO: string;
};

export type PrefsStore = {
  locale: Locale;
  studentId?: string;
  alias?: string;
  exportLog?: PacketExportLogEntry[];
};

export type QuarantineStore = {
  key: string;
  raw: string;
  reason: string;
  atISO: string;
} | null;

export type BackupPayload = {
  format: "sfa-backup";
  schemaVersion: 2;
  exportedAtISO: string;
  buildStamp: string;
  sections: {
    meta?: PersistMeta;
    progress?: ProgressV2;
    quiz?: QuizStore;
    calcHistory?: CalcHistoryStore;
    journal?: JournalStore;
    prefs?: PrefsStore;
    responses?: ResponsesStore;
    simRuns?: SimRunsStore;
  };
  legacyV1?: unknown;
};

export type DomainKey =
  | "meta"
  | "progress"
  | "quiz"
  | "calcHistory"
  | "journal"
  | "prefs"
  | "quarantine"
  | "responses"
  | "simRuns";

export function storageKey(domain: DomainKey): string {
  return `${SFA_V2_PREFIX}${domain}`;
}

export function defaultProgressV2(locale: Locale = "fa"): ProgressV2 {
  return {
    version: 2,
    locale,
    selectedStage: 1 as StageId,
    attempts: [],
    completedLessonIds: [],
    rewardIds: [],
    journalDraftIds: [],
    updatedAtISO: new Date(0).toISOString(),
    advancedAssessedEnabled: false,
    unlockedMilestoneIds: [],
  };
}

export function defaultQuiz(): QuizStore {
  return { schemaVersion: QUIZ_DOMAIN_VERSION, attempts: [] };
}

export function defaultCalcHistory(): CalcHistoryStore {
  return { entries: [] };
}

export function defaultJournalStore(): JournalStore {
  return { entries: [] };
}

export function defaultResponses(): ResponsesStore {
  return { schemaVersion: 1, lessonResponses: [], selfReports: [] };
}

export function defaultSimRuns(): SimRunsStore {
  return { schemaVersion: 1, entries: [] };
}

export function defaultPrefs(locale: Locale = "fa"): PrefsStore {
  return { locale };
}

export function defaultMeta(deviceId = "server"): PersistMeta {
  return {
    schemaVersion: SFA_SCHEMA_VERSION,
    migratedFrom: null,
    deviceId,
    rev: 0,
    lastWriteISO: new Date(0).toISOString(),
  };
}

/** Derive unlocked milestones idempotently from attempts/rewards. */
export function deriveUnlockedMilestones(progress: {
  attempts: Attempt[];
  rewardIds: string[];
  completedLessonIds: string[];
}): string[] {
  const ids = new Set<string>();
  for (const r of progress.rewardIds) ids.add(r);
  for (const a of progress.attempts) {
    if (a.numericPass && !a.archivedLegacy) {
      ids.add(`milestone:${a.missionId}`);
    }
  }
  for (const id of progress.completedLessonIds) {
    ids.add(`lesson:${id}`);
  }
  return [...ids].sort();
}
