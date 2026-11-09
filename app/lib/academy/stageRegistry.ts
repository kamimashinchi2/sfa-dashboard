import type { AdvancedId, MissionId, StageId } from "./contracts";
import { curriculumPrimaryStage } from "./publicCatalog";

/**
 * Derive stage from mission/module registry — never from separate UI state.
 * Uses curriculum primary stage (stages[0]) without importing lesson/quiz bodies.
 */
export function stageFromMission(missionId: MissionId | null): StageId | null {
  if (!missionId) return null;
  const n = curriculumPrimaryStage(missionId);
  return n == null ? null : (n as StageId);
}

export function stageFromAdvanced(moduleId: AdvancedId | null): StageId | null {
  if (!moduleId) return null;
  const n = curriculumPrimaryStage(moduleId);
  return n == null ? null : (n as StageId);
}

export function stageFromRegistry(input: {
  missionId?: MissionId | null;
  advancedModule?: AdvancedId | null;
}): StageId | null {
  if (input.advancedModule) return stageFromAdvanced(input.advancedModule);
  if (input.missionId) return stageFromMission(input.missionId);
  return null;
}

/** Assert journal stage matches registry; returns corrected stage + warning. */
export function reconcileJournalStage(input: {
  stage: StageId;
  missionId: MissionId | null;
  advancedModule: AdvancedId | null;
}): { stage: StageId; warning: string | null } {
  const derived = stageFromRegistry({
    missionId: input.missionId,
    advancedModule: input.advancedModule,
  });
  if (derived == null) {
    return { stage: input.stage, warning: "NO_REGISTRY_STAGE" };
  }
  if (derived !== input.stage) {
    return {
      stage: derived,
      warning: `STAGE_MISMATCH:stored=${input.stage};registry=${derived}`,
    };
  }
  return { stage: input.stage, warning: null };
}
