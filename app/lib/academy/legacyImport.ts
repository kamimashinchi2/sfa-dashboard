"use client";

import { prefsStore, quizStore, responsesStore } from "./persist";

const doneKey = (studentId: string) => `sfa.v6.legacyImport.${studentId}`;

export type LegacyImportResult =
  | { status: "imported" }
  | { status: "already" }
  | { status: "quarantine"; localId: string }
  | { status: "failed" };

/**
 * One-time import of this browser's quiz/response history.
 * History bound to a different student id is quarantined and not uploaded.
 * Local prefs, XP, and stage are never sent.
 */
export async function maybeLegacyImport(studentId: string): Promise<LegacyImportResult> {
  if (typeof window === "undefined") return { status: "failed" };
  if (window.localStorage.getItem(doneKey(studentId)) === "1") return { status: "already" };
  const localId = prefsStore.getSnapshot().studentId?.trim() ?? "";
  if (localId && localId !== studentId) {
    window.localStorage.setItem(
      "sfa.v6.legacyQuarantine",
      JSON.stringify({ localId, serverId: studentId }),
    );
    return { status: "quarantine", localId };
  }
  const quiz = quizStore.getSnapshot();
  const responses = responsesStore.getSnapshot();
  const records = {
    quizAttempts: quiz.attempts,
    lessonResponses: responses.lessonResponses,
  };
  try {
    const res = await fetch("/api/mentor/legacy-import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ records }),
    });
    if (!res.ok) return { status: "failed" };
    const body = (await res.json()) as { unlocksChanged?: boolean };
    if (body.unlocksChanged) return { status: "failed" };
    window.localStorage.setItem(doneKey(studentId), "1");
    return { status: "imported" };
  } catch {
    return { status: "failed" };
  }
}
