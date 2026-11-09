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
import {
  computeXp,
  defaultProgress,
  readProgressFromStorage,
  writeProgressToStorage,
} from "../../lib/academy/progress";

type Ctx = {
  progress: Progress;
  hydrated: boolean;
  warning: string | null;
  storageError: string | null;
  xp: number;
  setLocale: (locale: Locale) => void;
  setSelectedStage: (stage: StageId) => void;
  completeLesson: (lessonId: string) => void;
  recordAttempt: (attempt: Attempt) => void;
  resetProgress: () => void;
};

const ProgressContext = createContext<Ctx | null>(null);

let memoryProgress: Progress = defaultProgress("fa");
let memoryWarning: string | null = null;
let memoryStorageError: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Progress {
  return memoryProgress;
}

function getServerSnapshot(): Progress {
  return defaultProgress("fa");
}

function emptySubscribe() {
  return () => undefined;
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const [bootWarning] = useState(() => {
    if (typeof window === "undefined") return null;
    const loaded = readProgressFromStorage(window.localStorage);
    memoryProgress = loaded.progress;
    memoryWarning = loaded.warning ?? null;
    return memoryWarning;
  });

  const progress = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [storageError, setStorageError] = useState<string | null>(memoryStorageError);

  const commit = useCallback((next: Progress) => {
    memoryProgress = {
      ...next,
      updatedAtISO: new Date().toISOString(),
    };
    const result = writeProgressToStorage(
      typeof window !== "undefined" ? window.localStorage : null,
      memoryProgress,
    );
    memoryStorageError = result.ok ? null : result.error ?? "STORAGE_FAIL";
    setStorageError(memoryStorageError);
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
      const completedLessonIds = [...memoryProgress.completedLessonIds, lessonId];
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

  const xp = useMemo(() => computeXp(progress).xp, [progress]);

  const value = useMemo(
    () => ({
      progress,
      hydrated,
      warning: bootWarning,
      storageError,
      xp,
      setLocale,
      setSelectedStage,
      completeLesson,
      recordAttempt,
      resetProgress,
    }),
    [
      progress,
      hydrated,
      bootWarning,
      storageError,
      xp,
      setLocale,
      setSelectedStage,
      completeLesson,
      recordAttempt,
      resetProgress,
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
