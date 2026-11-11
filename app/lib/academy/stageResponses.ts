"use client";

import { useEffect } from "react";
import { responsesStore } from "./persist";
import type { LessonResponseRecord, SelfReportRecord } from "./persist/types";

/**
 * Server lesson responses are canonical for this stage.
 * Simulator scratch stays local and is not uploaded here.
 */
export function useServerResponses(stage: number | undefined, scopeId: string) {
  useEffect(() => {
    if (!stage) return;
    let ready = false;
    let timer = 0;
    const post = () => {
      if (!ready) return;
      const snap = responsesStore.getSnapshot();
      const responses = {
        lessonResponses: snap.lessonResponses.filter((row) => row.missionId === scopeId),
        selfReports: snap.selfReports.filter((row) => row.refId === scopeId),
      };
      void fetch(`/api/mentor/responses/${stage}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ responses }),
      });
    };
    const unsub = responsesStore.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(post, 400);
    });
    void (async () => {
      try {
        const res = await fetch(`/api/mentor/responses/${stage}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          responses?: {
            lessonResponses?: LessonResponseRecord[];
            selfReports?: SelfReportRecord[];
          } | null;
        };
        if (body.responses) {
          const cur = responsesStore.getSnapshot();
          responsesStore.set({
            ...cur,
            lessonResponses: [
              ...cur.lessonResponses.filter((row) => row.missionId !== scopeId),
              ...(body.responses.lessonResponses ?? []).filter((row) => row.missionId === scopeId),
            ],
            selfReports: [
              ...cur.selfReports.filter((row) => row.refId !== scopeId),
              ...(body.responses.selfReports ?? []).filter((row) => row.refId === scopeId),
            ],
          });
        }
      } finally {
        ready = true;
      }
    })();
    return () => {
      ready = false;
      unsub();
      window.clearTimeout(timer);
    };
  }, [stage, scopeId]);
}
