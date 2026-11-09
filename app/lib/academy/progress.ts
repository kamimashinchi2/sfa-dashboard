import type { Attempt, Locale, Progress, StageId } from "./contracts";
import { PROGRESS_STORAGE_KEY } from "./contracts";

export function defaultProgress(locale: Locale = "fa"): Progress {
  return {
    version: 1,
    locale,
    selectedStage: 1,
    attempts: [],
    completedLessonIds: [],
    rewardIds: [],
    journalDraftIds: [],
    updatedAtISO: new Date(0).toISOString(),
  };
}

export function validateProgress(raw: unknown): {
  ok: boolean;
  value: Progress | null;
  warning?: string;
} {
  if (!raw || typeof raw !== "object") {
    return { ok: false, value: null, warning: "CORRUPT_EMPTY" };
  }
  const p = raw as Partial<Progress>;
  if (p.version !== 1) {
    return { ok: false, value: null, warning: "BAD_VERSION" };
  }
  const stage = Number(p.selectedStage);
  if (![1, 2, 3, 4, 5, 6, 7, 8].includes(stage)) {
    return { ok: false, value: null, warning: "BAD_STAGE" };
  }
  return {
    ok: true,
    value: {
      version: 1,
      locale: p.locale === "en" ? "en" : "fa",
      selectedStage: stage as StageId,
      attempts: Array.isArray(p.attempts) ? (p.attempts as Attempt[]) : [],
      completedLessonIds: Array.isArray(p.completedLessonIds)
        ? p.completedLessonIds.map(String)
        : [],
      rewardIds: Array.isArray(p.rewardIds) ? p.rewardIds.map(String) : [],
      journalDraftIds: Array.isArray(p.journalDraftIds)
        ? p.journalDraftIds.map(String)
        : [],
      updatedAtISO: String(p.updatedAtISO ?? new Date(0).toISOString()),
    },
  };
}

/** Idempotent XP: 10/lesson, 20/practical, 50/mission pass once. */
export function computeXp(progress: Progress): {
  xp: number;
  rewards: string[];
} {
  const rewards = new Set(progress.rewardIds);
  let xp = 0;
  for (const id of progress.completedLessonIds) {
    const key = `lesson:${id}`;
    if (!rewards.has(key)) {
      rewards.add(key);
    }
    xp += 10;
  }
  for (const attempt of progress.attempts) {
    if (attempt.taskComplete) {
      const key = `practical:${attempt.missionId}`;
      if (!rewards.has(key)) rewards.add(key);
      // count once per mission practical
    }
    if (attempt.numericPass && attempt.readiness !== "REMEDIATION") {
      const key = `mission:${attempt.missionId}`;
      if (!rewards.has(key)) rewards.add(key);
    }
  }
  // Recompute xp from unique reward kinds
  xp = 0;
  for (const r of rewards) {
    if (r.startsWith("lesson:")) xp += 10;
    else if (r.startsWith("practical:")) xp += 20;
    else if (r.startsWith("mission:")) xp += 50;
  }
  return { xp, rewards: [...rewards] };
}

export function readProgressFromStorage(
  storage: Pick<Storage, "getItem"> | null,
): { progress: Progress; warning?: string } {
  if (!storage) return { progress: defaultProgress() };
  try {
    const raw = storage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return { progress: defaultProgress() };
    const parsed = validateProgress(JSON.parse(raw) as unknown);
    if (!parsed.ok || !parsed.value) {
      return { progress: defaultProgress(), warning: parsed.warning };
    }
    return { progress: parsed.value };
  } catch {
    return { progress: defaultProgress(), warning: "PARSE_FAIL" };
  }
}

export function writeProgressToStorage(
  storage: Pick<Storage, "setItem"> | null,
  progress: Progress,
): { ok: boolean; error?: string } {
  if (!storage) return { ok: false, error: "NO_STORAGE" };
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "QUOTA_OR_DENIED";
    return { ok: false, error: msg };
  }
}

export { PROGRESS_STORAGE_KEY };
