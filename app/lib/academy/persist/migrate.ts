import type { Progress } from "../contracts";
import { PROGRESS_STORAGE_KEY } from "../contracts";
import { archiveLegacyPlaceholderAttempts } from "../unlock";
import { computeXp, validateProgress } from "../progress";
import { migrateSetupState } from "../setup";
import {
  defaultProgressV2,
  deriveUnlockedMilestones,
  type ProgressV2,
} from "./types";
import { guardUnknown } from "./guards";

/**
 * Pure, idempotent v1 → v2 progress migration.
 * Leaves sfa.progress.v1 untouched as a backup.
 * Legacy placeholder passes stay archived; no double XP.
 */
export function migrateProgressV1ToV2(raw: unknown): {
  ok: boolean;
  value: ProgressV2;
  migratedFrom: string | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const g = guardUnknown(raw);
  if (!g.ok) {
    return {
      ok: false,
      value: defaultProgressV2(),
      migratedFrom: null,
      warnings: [g.reason],
    };
  }

  // Already v2 — idempotent passthrough (re-derive milestones)
  if (
    raw &&
    typeof raw === "object" &&
    (raw as { version?: number }).version === 2
  ) {
    const p = raw as ProgressV2;
    const unlocked = deriveUnlockedMilestones(p);
    return {
      ok: true,
      value: { ...p, version: 2, unlockedMilestoneIds: unlocked },
      migratedFrom: null,
      warnings: ["ALREADY_V2"],
    };
  }

  const validated = validateProgress(raw);
  if (!validated.ok || !validated.value) {
    return {
      ok: false,
      value: defaultProgressV2(),
      migratedFrom: null,
      warnings: [validated.warning ?? "BAD_V1"],
    };
  }

  const v1: Progress = validated.value;
  const attempts = archiveLegacyPlaceholderAttempts(v1.attempts).map((a) => {
    // Migrate any nested legacy setup state labels in practicalEvidence
    if (a.practicalEvidence && typeof a.practicalEvidence === "object") {
      const pe = { ...a.practicalEvidence } as Record<string, unknown>;
      if (typeof pe.setupState === "string") {
        pe.setupState = migrateSetupState(pe.setupState);
      }
      return { ...a, practicalEvidence: pe };
    }
    return a;
  });

  const base: ProgressV2 = {
    version: 2,
    locale: v1.locale,
    selectedStage: v1.selectedStage,
    attempts,
    completedLessonIds: [...v1.completedLessonIds],
    rewardIds: [...v1.rewardIds],
    journalDraftIds: [...v1.journalDraftIds],
    updatedAtISO: v1.updatedAtISO,
    advancedAssessedEnabled: v1.advancedAssessedEnabled ?? false,
    unlockedMilestoneIds: [],
  };

  // Recompute rewards idempotently — no double XP
  const { rewards } = computeXp(base as unknown as Progress);
  base.rewardIds = rewards;
  base.unlockedMilestoneIds = deriveUnlockedMilestones(base);
  warnings.push("MIGRATED_V1_TO_V2");

  return {
    ok: true,
    value: base,
    migratedFrom: PROGRESS_STORAGE_KEY,
    warnings,
  };
}

/** Read legacy v1 if present without deleting it. */
export function readLegacyV1Backup(
  storage: Pick<Storage, "getItem"> | null,
): unknown | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
