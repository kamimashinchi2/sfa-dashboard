import type { AdvancedId, Attempt, MissionId, Progress } from "./contracts";
import { ASSESSMENT_CRITERIA_VERSION } from "./assessmentVersion";

const MISSION_ORDER: MissionId[] = ["M1", "M2", "M3", "M4", "M5"];

export type AccessMode = "ASSESSED" | "READ_ONLY_PREVIEW";

export function latestValidAttempt(
  progress: Progress,
  missionId: MissionId | AdvancedId,
): Attempt | null {
  const list = progress.attempts
    .filter(
      (a) =>
        a.missionId === missionId &&
        !a.archivedLegacy &&
        (a.assessmentCriteriaVersion ?? 1) >= ASSESSMENT_CRITERIA_VERSION,
    )
    .reverse();
  return list[0] ?? null;
}

/** Practice unlock for assessed attempts — transparent client gate, not entitlement. */
export function missionPassedForUnlock(
  progress: Progress,
  missionId: MissionId,
): boolean {
  const attempt = latestValidAttempt(progress, missionId);
  if (!attempt) return false;
  if (attempt.archivedLegacy) return false;
  if (!attempt.numericPass || !attempt.taskComplete) return false;
  // HARD_BLOCK hold still retains numeric pass but does not unlock next assessed practice
  if (attempt.readiness === "REMEDIATION") return false;
  if (attempt.riskStatus === "HARD_BLOCK") return false;
  return true;
}

export function prerequisiteFor(missionId: MissionId): MissionId | null {
  const idx = MISSION_ORDER.indexOf(missionId);
  if (idx <= 0) return null;
  return MISSION_ORDER[idx - 1] ?? null;
}

export function resolveMissionAccess(
  progress: Progress,
  missionId: MissionId,
  opts?: { forcePreview?: boolean },
): { mode: AccessMode; reason: string } {
  if (opts?.forcePreview) {
    return { mode: "READ_ONLY_PREVIEW", reason: "FORCED_PREVIEW" };
  }
  const prereq = prerequisiteFor(missionId);
  if (!prereq) {
    return { mode: "ASSESSED", reason: "INTRO_OPEN" };
  }
  if (missionPassedForUnlock(progress, prereq)) {
    return { mode: "ASSESSED", reason: `PREREQ_MET:${prereq}` };
  }
  return {
    mode: "READ_ONLY_PREVIEW",
    reason: `PREREQ_MISSING:${prereq}`,
  };
}

export function archiveLegacyPlaceholderAttempts(
  attempts: Attempt[],
): Attempt[] {
  return attempts.map((a) => {
    const ver = a.assessmentCriteriaVersion ?? 1;
    if (ver < ASSESSMENT_CRITERIA_VERSION && a.numericPass) {
      return {
        ...a,
        archivedLegacy: true,
        readiness: "REMEDIATION",
        weakTopics: [
          ...new Set([
            ...a.weakTopics,
            "legacy-placeholder-reassessment-required",
          ]),
        ],
      };
    }
    return a;
  });
}

export function earnedStageProgress(progress: Progress): number {
  let earned = 0;
  for (const id of MISSION_ORDER) {
    if (missionPassedForUnlock(progress, id)) earned += 1;
    else break;
  }
  return earned;
}
