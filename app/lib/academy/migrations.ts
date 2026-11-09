import type { JournalDraft } from "./journal";
import { createEmptyJournalV2, type JournalV2 } from "./journalV2";
import type { Progress, Attempt } from "./contracts";
import { archiveLegacyPlaceholderAttempts } from "./unlock";
import { ASSESSMENT_CRITERIA_VERSION } from "./quizzes";

export type MigrationResult<T> = {
  ok: boolean;
  value: T | null;
  backup: unknown;
  warnings: string[];
};

/** Idempotent v1 → v2 journal migration. Intro records keep advancedModule:null. */
export function migrateJournalV1ToV2(
  v1: JournalDraft,
  locale: "fa" | "en" = "fa",
): MigrationResult<JournalV2> {
  const warnings: string[] = [];
  const v2 = createEmptyJournalV2({
    id: `${v1.id}-v2`,
    alias: v1.alias,
    locale,
    stage: v1.stageId,
    missionId: v1.missionId,
    advancedModule: null,
    attemptId: v1.attemptId,
    scenarioId: v1.scenarioId,
    scenarioVersion: v1.scenarioVersion,
    updatedAtISO: v1.updatedAtISO,
    parentV1Id: v1.id,
  });
  v2.hypothesis = v1.hypothesis;
  v2.falsification = v1.falsification;
  v2.trainTestSplit = v1.trainTestSplit;
  v2.invalidation = v1.invalidation;
  v2.emotions = v1.emotions;
  v2.counterevidence = v1.counterevidence;
  v2.nextTask = v1.nextTask;
  v2.evidence = v1.evidenceRefs;
  v2.engineResults = null; // never trust imported PASS
  v2.engineInputs = null;
  if (v1.engineResults?.status === "PASS_SIMULATION") {
    warnings.push("V1_PASS_NOT_PROMOTED_RECOMPUTE");
    v2.riskStatus = "UNVERIFIED";
  }
  v2.blocked = v1.blocked;
  v2.warnings = [...v1.warnings, ...warnings];
  v2.createdAtISO = null; // missing fields stay null — do not invent dates
  if (!v1.updatedAtISO) {
    warnings.push("MISSING_UPDATED_AT");
  }
  return { ok: true, value: v2, backup: v1, warnings };
}

/** Archive legacy placeholder quiz passes without silent promotion. */
export function migrateProgressAssessmentVersions(
  progress: Progress,
): MigrationResult<Progress> {
  const warnings: string[] = [];
  const attempts = archiveLegacyPlaceholderAttempts(progress.attempts).map(
    (a: Attempt) => {
      if ((a.assessmentCriteriaVersion ?? 1) < ASSESSMENT_CRITERIA_VERSION) {
        if (a.numericPass && !a.archivedLegacy) {
          warnings.push(`REASSESS:${a.missionId}:${a.id}`);
        }
        return {
          ...a,
          assessmentCriteriaVersion:
            a.assessmentCriteriaVersion ?? ASSESSMENT_CRITERIA_VERSION,
        };
      }
      return a;
    },
  );
  // Idempotent: no duplicate XP — rewardIds preserved; computeXp dedupes
  return {
    ok: true,
    value: { ...progress, attempts },
    backup: progress,
    warnings,
  };
}

export function recoveryExportCorrupt(raw: unknown): string {
  return JSON.stringify(
    {
      recovery: true,
      exportedAt: "1970-01-01T00:00:00.000Z",
      note: "Corrupt/unknown version — export only; reset requires confirmation",
      raw,
    },
    null,
    2,
  );
}
