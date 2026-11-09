"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Attempt, Locale, Progress, StageId } from "../../lib/academy/contracts";
import { PROGRESS_STORAGE_KEY } from "../../lib/academy/contracts";
import {
  computeXp,
  defaultProgress,
  writeProgressToStorage,
} from "../../lib/academy/progress";
import { archiveLegacyPlaceholderAttempts } from "../../lib/academy/unlock";
import {
  buildBackup,
  createPersistedStore,
  defaultMeta,
  defaultProgressV2,
  deriveUnlockedMilestones,
  migrateProgressV1ToV2,
  parseBackup,
  readLegacyV1Backup,
  sanitizeImportedProgress,
  storageKey,
  SFA_V2_PREFIX,
  type ProgressV2,
  type PersistMeta,
} from "../../lib/academy/persist";
import { downloadTextFile } from "../../lib/academy/download";

type Ctx = {
  progress: Progress;
  hydrated: boolean;
  warning: string | null;
  storageError: string | null;
  quotaExceeded: boolean;
  quarantine: { key: string; reason: string } | null;
  xp: number;
  setLocale: (locale: Locale) => void;
  setSelectedStage: (stage: StageId) => void;
  completeLesson: (lessonId: string) => void;
  recordAttempt: (attempt: Attempt) => void;
  resetProgress: () => void;
  exportBackup: () => void;
  importBackup: (raw: string, mode: "merge" | "replace") => { ok: boolean; error?: string; diff?: string[] };
};

const ProgressContext = createContext<Ctx | null>(null);

const FROZEN_DEFAULT = Object.freeze(defaultProgress("fa"));

let memoryProgress: Progress = defaultProgress("fa");
let memoryWarning: string | null = null;
let memoryStorageError: string | null = null;
let memoryQuota = false;
let memoryQuarantine: { key: string; reason: string } | null = null;
let memoryMeta: PersistMeta = defaultMeta("boot");
let memoryHydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function toFacade(p: ProgressV2 | Progress): Progress {
  return {
    version: 1,
    locale: p.locale,
    selectedStage: p.selectedStage,
    attempts: p.attempts,
    completedLessonIds: p.completedLessonIds,
    rewardIds: p.rewardIds,
    journalDraftIds: p.journalDraftIds,
    updatedAtISO: p.updatedAtISO,
    advancedAssessedEnabled: p.advancedAssessedEnabled,
  };
}

function toV2(p: Progress): ProgressV2 {
  return {
    version: 2,
    locale: p.locale,
    selectedStage: p.selectedStage,
    attempts: p.attempts,
    completedLessonIds: p.completedLessonIds,
    rewardIds: p.rewardIds,
    journalDraftIds: p.journalDraftIds,
    updatedAtISO: p.updatedAtISO,
    advancedAssessedEnabled: p.advancedAssessedEnabled ?? false,
    unlockedMilestoneIds: deriveUnlockedMilestones(p),
  };
}

function guardProgress(raw: unknown): {
  ok: boolean;
  value: ProgressV2 | null;
  reason?: string;
} {
  if (!raw || typeof raw !== "object") {
    return { ok: false, value: null, reason: "CORRUPT_EMPTY" };
  }
  const p = raw as Record<string, unknown>;
  const ver = Number(p.version);
  if (ver !== 2 && ver !== 1) {
    return { ok: false, value: null, reason: "BAD_VERSION" };
  }
  if (ver === 1) {
    const migrated = migrateProgressV1ToV2(raw);
    return {
      ok: migrated.ok,
      value: migrated.value,
      reason: migrated.warnings[0],
    };
  }
  const stage = Number(p.selectedStage);
  if (![1, 2, 3, 4, 5, 6, 7, 8].includes(stage)) {
    return { ok: false, value: null, reason: "BAD_STAGE" };
  }
  const attempts = Array.isArray(p.attempts) ? (p.attempts as Attempt[]) : [];
  const completedLessonIds = Array.isArray(p.completedLessonIds)
    ? p.completedLessonIds.map(String)
    : [];
  const rewardIds = Array.isArray(p.rewardIds) ? p.rewardIds.map(String) : [];
  const value: ProgressV2 = {
    version: 2,
    locale: p.locale === "en" ? "en" : "fa",
    selectedStage: stage as StageId,
    attempts,
    completedLessonIds,
    rewardIds,
    journalDraftIds: Array.isArray(p.journalDraftIds)
      ? p.journalDraftIds.map(String)
      : [],
    updatedAtISO: String(p.updatedAtISO ?? new Date(0).toISOString()),
    advancedAssessedEnabled: Boolean(p.advancedAssessedEnabled),
    unlockedMilestoneIds: Array.isArray(p.unlockedMilestoneIds)
      ? p.unlockedMilestoneIds.map(String)
      : deriveUnlockedMilestones({
          attempts,
          rewardIds,
          completedLessonIds,
        }),
  };
  return { ok: true, value };
}

const progressStore = createPersistedStore<ProgressV2>({
  key: storageKey("progress"),
  version: 2,
  defaults: () => defaultProgressV2("fa"),
  guard: guardProgress,
  migrate: (raw) => migrateProgressV1ToV2(raw).value,
  onQuotaExceeded: () => {
    memoryQuota = true;
    emit();
  },
  onQuarantine: (raw, reason) => {
    memoryQuarantine = { key: storageKey("progress"), reason };
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          storageKey("quarantine"),
          JSON.stringify({
            key: storageKey("progress"),
            raw,
            reason,
            atISO: new Date().toISOString(),
          }),
        );
      }
    } catch {
      /* ignore */
    }
    emit();
  },
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  const unsubStore = progressStore.subscribe(() => {
    memoryProgress = toFacade(progressStore.getSnapshot());
    emit();
  });
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || (e.key && e.key.startsWith(SFA_V2_PREFIX))) {
      // Cross-tab: re-read progress; merge attempts by id (union)
      const remote = progressStore.getSnapshot();
      const local = toV2(memoryProgress);
      const byId = new Map<string, Attempt>();
      for (const a of [...local.attempts, ...remote.attempts]) {
        byId.set(a.id, a);
      }
      const merged: ProgressV2 = {
        ...remote,
        attempts: [...byId.values()],
        completedLessonIds: [
          ...new Set([
            ...local.completedLessonIds,
            ...remote.completedLessonIds,
          ]),
        ],
        rewardIds: [],
      };
      const { rewards } = computeXp(toFacade(merged));
      merged.rewardIds = rewards;
      merged.unlockedMilestoneIds = deriveUnlockedMilestones(merged);
      // Prefer higher rev / lastWrite — last writer wins for scalar fields via remote
      memoryProgress = toFacade(merged);
      memoryMeta = {
        ...memoryMeta,
        rev: memoryMeta.rev + 1,
        lastWriteISO: new Date().toISOString(),
      };
      emit();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    unsubStore();
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getSnapshot(): Progress {
  return memoryProgress;
}

function getServerSnapshot(): Progress {
  return FROZEN_DEFAULT;
}

function ensureDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const raw = window.localStorage.getItem(storageKey("meta"));
    if (raw) {
      const m = JSON.parse(raw) as PersistMeta;
      if (m.deviceId) return m.deviceId;
    }
  } catch {
    /* ignore */
  }
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dev-${Math.random().toString(36).slice(2)}`;
  return id;
}

function hydrateOnce() {
  if (memoryHydrated || typeof window === "undefined") return;
  memoryHydrated = true;

  // Prefer v2; if missing, migrate v1 once and leave v1 as backup
  const v2raw = window.localStorage.getItem(storageKey("progress"));
  if (!v2raw) {
    const legacy = readLegacyV1Backup(window.localStorage);
    if (legacy) {
      const migrated = migrateProgressV1ToV2(legacy);
      memoryProgress = toFacade(migrated.value);
      memoryWarning = migrated.warnings.join("; ") || null;
      memoryMeta = {
        ...defaultMeta(ensureDeviceId()),
        migratedFrom: PROGRESS_STORAGE_KEY,
        rev: 1,
        lastWriteISO: new Date().toISOString(),
      };
      progressStore.replaceMemory(migrated.value, true);
      try {
        window.localStorage.setItem(
          storageKey("meta"),
          JSON.stringify(memoryMeta),
        );
      } catch {
        /* ignore */
      }
      emit();
      return;
    }
  }

  progressStore._forceHydrate();
  const snap = progressStore.getSnapshot();
  memoryProgress = {
    ...toFacade(snap),
    attempts: archiveLegacyPlaceholderAttempts(snap.attempts),
    advancedAssessedEnabled: snap.advancedAssessedEnabled ?? false,
  };
  memoryMeta = {
    ...defaultMeta(ensureDeviceId()),
    rev: 1,
    lastWriteISO: new Date().toISOString(),
  };
  emit();
}

function subscribeHydrated(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined" && !memoryHydrated) {
    // Lazy hydrate on first client subscribe (not during render body)
    queueMicrotask(() => {
      hydrateOnce();
      emit();
    });
  }
  return () => listeners.delete(listener);
}

function getHydratedSnapshot() {
  return memoryHydrated;
}

function getHydratedServerSnapshot() {
  return false;
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(
    subscribeHydrated,
    getHydratedSnapshot,
    getHydratedServerSnapshot,
  );

  const progress = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [storageError, setStorageError] = useState<string | null>(
    memoryStorageError,
  );
  const [quotaExceeded, setQuotaExceeded] = useState(memoryQuota);

  const commit = useCallback((next: Progress) => {
    const v2 = toV2({
      ...next,
      updatedAtISO: new Date().toISOString(),
    });
    v2.unlockedMilestoneIds = deriveUnlockedMilestones(v2);
    memoryProgress = toFacade(v2);
    memoryMeta = {
      ...memoryMeta,
      deviceId: memoryMeta.deviceId || ensureDeviceId(),
      rev: memoryMeta.rev + 1,
      lastWriteISO: new Date().toISOString(),
    };
    const result = progressStore.set(v2);
    // Keep v1 mirror for rollback safety (backup), without replacing migration source of truth
    writeProgressToStorage(
      typeof window !== "undefined" ? window.localStorage : null,
      memoryProgress,
    );
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          storageKey("meta"),
          JSON.stringify(memoryMeta),
        );
      }
    } catch {
      /* ignore */
    }
    memoryStorageError = result.ok ? null : result.error ?? "STORAGE_FAIL";
    memoryQuota = !result.ok && /quota/i.test(memoryStorageError ?? "");
    setStorageError(memoryStorageError);
    setQuotaExceeded(memoryQuota);
    emit();
  }, []);

  const setLocale = useCallback(
    (locale: Locale) => {
      commit({ ...memoryProgress, locale });
    },
    [commit],
  );

  const setSelectedStage = useCallback(
    (stage: StageId) => {
      commit({ ...memoryProgress, selectedStage: stage });
    },
    [commit],
  );

  const completeLesson = useCallback(
    (lessonId: string) => {
      if (memoryProgress.completedLessonIds.includes(lessonId)) return;
      const completedLessonIds = [
        ...memoryProgress.completedLessonIds,
        lessonId,
      ];
      const { rewards } = computeXp({ ...memoryProgress, completedLessonIds });
      commit({ ...memoryProgress, completedLessonIds, rewardIds: rewards });
    },
    [commit],
  );

  const recordAttempt = useCallback(
    (attempt: Attempt) => {
      const attempts = [
        ...memoryProgress.attempts.filter((a) => a.id !== attempt.id),
        attempt,
      ];
      const { rewards } = computeXp({ ...memoryProgress, attempts });
      commit({ ...memoryProgress, attempts, rewardIds: rewards });
    },
    [commit],
  );

  const resetProgress = useCallback(() => {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        memoryProgress.locale === "fa"
          ? "پیشرفت تمرین محلی پاک شود؟"
          : "Reset local practice progress?",
      );
      if (!ok) return;
    }
    commit(defaultProgress(memoryProgress.locale));
  }, [commit]);

  const exportBackup = useCallback(() => {
    const payload = buildBackup({
      meta: memoryMeta,
      progress: toV2(memoryProgress),
      prefs: { locale: memoryProgress.locale },
    });
    downloadTextFile({
      filename: `sfa-academy-backup-${new Date()
        .toISOString()
        .slice(0, 16)
        .replace(/[-:T]/g, "")}.json`,
      content: JSON.stringify(payload, null, 2),
      mime: "application/json;charset=utf-8",
      revokeDelayMs: 45_000,
    });
  }, []);

  const importBackup = useCallback(
    (raw: string, mode: "merge" | "replace") => {
      const parsed = parseBackup(raw);
      if (!parsed.ok || !parsed.value) {
        return { ok: false, error: parsed.error };
      }
      const incoming = parsed.value.sections.progress;
      if (!incoming) return { ok: false, error: "NO_PROGRESS_SECTION" };

      if (mode === "replace") {
        if (typeof window !== "undefined") {
          const ok = window.confirm(
            memoryProgress.locale === "fa"
              ? "جایگزینی کامل؟ ابتدا نسخه پشتیبان خودکار گرفته می‌شود."
              : "Replace all local progress? An automatic backup will download first.",
          );
          if (!ok) return { ok: false, error: "CANCELLED" };
        }
        exportBackup();
        commit(toFacade(sanitizeImportedProgress(incoming)));
        return { ok: true, diff: parsed.dryRunDiff };
      }

      // Merge: union attempts by id, recompute rewards (no double XP)
      const sanitized = sanitizeImportedProgress(incoming);
      const byId = new Map<string, Attempt>();
      for (const a of [...memoryProgress.attempts, ...sanitized.attempts]) {
        byId.set(a.id, a);
      }
      const merged: Progress = {
        ...memoryProgress,
        attempts: [...byId.values()],
        completedLessonIds: [
          ...new Set([
            ...memoryProgress.completedLessonIds,
            ...sanitized.completedLessonIds,
          ]),
        ],
        rewardIds: [],
      };
      const { rewards } = computeXp(merged);
      commit({ ...merged, rewardIds: rewards });
      return { ok: true, diff: parsed.dryRunDiff };
    },
    [commit, exportBackup],
  );

  const xp = useMemo(() => computeXp(progress).xp, [progress]);

  const value = useMemo(
    () => ({
      progress,
      hydrated,
      warning: memoryWarning,
      storageError,
      quotaExceeded,
      quarantine: memoryQuarantine,
      xp,
      setLocale,
      setSelectedStage,
      completeLesson,
      recordAttempt,
      resetProgress,
      exportBackup,
      importBackup,
    }),
    [
      progress,
      hydrated,
      storageError,
      quotaExceeded,
      xp,
      setLocale,
      setSelectedStage,
      completeLesson,
      recordAttempt,
      resetProgress,
      exportBackup,
      importBackup,
    ],
  );

  return (
    <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
  );
}

export function useProgress(): Ctx {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress requires ProgressProvider");
  return ctx;
}
