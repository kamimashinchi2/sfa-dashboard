import { createPersistedStore } from "./createPersistedStore";
import {
  defaultPrefs,
  defaultQuiz,
  defaultResponses,
  defaultSimRuns,
  storageKey,
  type PrefsStore,
  type QuizStore,
  type ResponsesStore,
  type SimRunsStore,
} from "./types";
import { guardQuizStore, migrateQuizV2ToV3 } from "./quizStore";
import { guardResponses } from "./responses";
import { guardSimRuns } from "./simRuns";
import { guardUnknown } from "./guards";

export const quizStore = createPersistedStore<QuizStore>({
  key: storageKey("quiz"),
  version: 3,
  defaults: defaultQuiz,
  guard: guardQuizStore,
  migrate: (raw) => migrateQuizV2ToV3(raw),
});

export const responsesStore = createPersistedStore<ResponsesStore>({
  key: storageKey("responses"),
  version: 1,
  defaults: defaultResponses,
  guard: guardResponses,
});

export const simRunsStore = createPersistedStore<SimRunsStore>({
  key: storageKey("simRuns"),
  version: 1,
  defaults: defaultSimRuns,
  guard: guardSimRuns,
});

export const prefsStore = createPersistedStore<PrefsStore>({
  key: storageKey("prefs"),
  version: 1,
  defaults: () => defaultPrefs("fa"),
  guard: (raw) => {
    const g = guardUnknown(raw);
    if (!g.ok) return { ok: false, value: null, reason: g.reason };
    if (!raw || typeof raw !== "object") {
      return { ok: false, value: null, reason: "NOT_OBJECT" };
    }
    const o = raw as PrefsStore;
    return {
      ok: true,
      value: {
        locale: o.locale === "en" ? "en" : "fa",
        studentId: typeof o.studentId === "string" ? o.studentId : undefined,
        alias: typeof o.alias === "string" ? o.alias : undefined,
        exportLog: Array.isArray(o.exportLog) ? o.exportLog : [],
      },
    };
  },
});
