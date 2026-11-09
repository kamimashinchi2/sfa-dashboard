import { resolveBuildStamp } from "../buildStamp";
import { guardUnknown } from "./guards";
import {
  SFA_SCHEMA_VERSION,
  storageKey,
  type BackupPayload,
  type CalcHistoryStore,
  type JournalStore,
  type PersistMeta,
  type PrefsStore,
  type ProgressV2,
  type QuizStore,
  type ResponsesStore,
  type SimRunsStore,
} from "./types";
import { readLegacyV1Backup } from "./migrate";
import { sanitizeImportedQuiz } from "./quizStore";
import { sanitizeImportedResponses } from "./responses";
import { sanitizeImportedSimRuns } from "./simRuns";

const MAX_BACKUP_BYTES = 2 * 1024 * 1024;

export function buildBackup(sections: BackupPayload["sections"]): BackupPayload {
  return {
    format: "sfa-backup",
    schemaVersion: SFA_SCHEMA_VERSION,
    exportedAtISO: new Date().toISOString(),
    buildStamp: resolveBuildStamp().label,
    sections,
    legacyV1:
      typeof window !== "undefined"
        ? readLegacyV1Backup(window.localStorage)
        : null,
  };
}

export function parseBackup(raw: string): {
  ok: boolean;
  value: BackupPayload | null;
  error?: string;
  dryRunDiff?: string[];
} {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) {
    return { ok: false, value: null, error: "BACKUP_TOO_LARGE" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, value: null, error: "PARSE_FAIL" };
  }
  const g = guardUnknown(parsed);
  if (!g.ok) return { ok: false, value: null, error: g.reason };

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, value: null, error: "NOT_OBJECT" };
  }
  const b = parsed as Record<string, unknown>;
  if (b.format === "sfa-submission") {
    return {
      ok: false,
      value: null,
      error: "PACKET_NOT_BACKUP: This is a submission packet, not an sfa-backup. Use /submit to export packets; import only sfa-backup JSON here.",
    };
  }
  if (b.format !== "sfa-backup") {
    return { ok: false, value: null, error: "BAD_FORMAT" };
  }
  const backup = b as unknown as Partial<BackupPayload>;
  if (typeof backup.schemaVersion !== "number") {
    return { ok: false, value: null, error: "BAD_VERSION" };
  }
  if (backup.schemaVersion > SFA_SCHEMA_VERSION) {
    return { ok: false, value: null, error: "NEWER_SCHEMA_READONLY" };
  }
  if (backup.schemaVersion < 2) {
    return { ok: false, value: null, error: "LEGACY_USE_MIGRATE" };
  }

  const diff: string[] = [];
  const sections = backup.sections ?? {};
  if (sections.progress) diff.push("progress");
  if (sections.quiz) diff.push("quiz");
  if (sections.calcHistory) diff.push("calcHistory");
  if (sections.journal) diff.push("journal");
  if (sections.prefs) diff.push("prefs");
  if (sections.responses) diff.push("responses");
  if (sections.simRuns) diff.push("simRuns");

  return {
    ok: true,
    value: {
      format: "sfa-backup",
      schemaVersion: 2,
      exportedAtISO: String(backup.exportedAtISO ?? new Date(0).toISOString()),
      buildStamp: String(backup.buildStamp ?? "unknown"),
      sections: sections as BackupPayload["sections"],
      legacyV1: backup.legacyV1,
    },
    dryRunDiff: diff,
  };
}

/**
 * Imported PASS / mentor / reviewed stamps and advancedAssessedEnabled are untrusted:
 * mark UNVERIFIED and leave flag false until recomputed locally.
 */
export function sanitizeImportedProgress(p: ProgressV2): ProgressV2 {
  return {
    ...p,
    advancedAssessedEnabled: false,
    attempts: p.attempts.map((a) => ({
      ...a,
      riskStatus:
        a.riskStatus === "PASS_SIMULATION" ? "UNVERIFIED" : a.riskStatus,
      readiness:
        a.readiness === "READY" || a.readiness === "MENTOR_PENDING"
          ? "PENDING_REVIEW"
          : a.readiness,
      numericPass: false,
    })),
  };
}

export function sanitizeBackupSections(
  sections: BackupPayload["sections"],
): BackupPayload["sections"] {
  return {
    ...sections,
    progress: sections.progress
      ? sanitizeImportedProgress(sections.progress)
      : undefined,
    quiz: sections.quiz ? sanitizeImportedQuiz(sections.quiz) : undefined,
    responses: sections.responses
      ? sanitizeImportedResponses(sections.responses)
      : undefined,
    simRuns: sections.simRuns
      ? sanitizeImportedSimRuns(sections.simRuns)
      : undefined,
  };
}

export type DomainSnapshot = {
  meta: PersistMeta;
  progress: ProgressV2;
  quiz: QuizStore;
  calcHistory: CalcHistoryStore;
  journal: JournalStore;
  prefs: PrefsStore;
  responses: ResponsesStore;
  simRuns: SimRunsStore;
};

export function readAllDomains(
  storage: Pick<Storage, "getItem">,
): Partial<DomainSnapshot> {
  const out: Partial<DomainSnapshot> = {};
  const keys: (keyof DomainSnapshot)[] = [
    "meta",
    "progress",
    "quiz",
    "calcHistory",
    "journal",
    "prefs",
    "responses",
    "simRuns",
  ];
  for (const k of keys) {
    try {
      const raw = storage.getItem(storageKey(k));
      if (raw) out[k] = JSON.parse(raw);
    } catch {
      /* skip */
    }
  }
  return out;
}
