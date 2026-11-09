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

export type QuizStore = {
  answers: Record<string, { itemVersion: number; value: unknown; atISO: string }>;
};

export type CalcHistoryStore = {
  entries: CalcHistoryEntry[];
};

export type JournalStore = {
  entries: JournalV2[];
};

export type PrefsStore = {
  locale: Locale;
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
  | "quarantine";

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
  return { answers: {} };
}

export function defaultCalcHistory(): CalcHistoryStore {
  return { entries: [] };
}

export function defaultJournalStore(): JournalStore {
  return { entries: [] };
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
