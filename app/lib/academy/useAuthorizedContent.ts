"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lesson, Text } from "./contracts";
import type { QuizItem } from "./curriculum";

export type PublicQuizItem = Omit<QuizItem, "answer" | "rationale"> & {
  itemHash?: string;
  rationale?: QuizItem["rationale"];
};

export type AuthorizedContent = {
  kind: "mission" | "advanced";
  id: string;
  stages: number[];
  title: Text;
  summary: Text;
  practicalTask: Text;
  lessons: Lesson[];
  quiz: PublicQuizItem[];
  entitlement: {
    unlockedStage: number;
    currentWeek: number;
    status: string;
  };
};

export type ContentState =
  | { status: "loading" }
  | { status: "ready"; content: AuthorizedContent }
  | {
      status: "locked" | "auth" | "error";
      code: string;
      reason?: { fa: string; en: string };
      unlockedStage?: number;
      requestedStage?: number;
    };

export function useAuthorizedContent(
  opts: { missionId?: string; moduleId?: string },
): ContentState & { refresh: () => void } {
  const [state, setState] = useState<ContentState>({ status: "loading" });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setState((prev) => (prev.status === "ready" ? prev : { status: "loading" }));
      const q = opts.missionId
        ? `missionId=${encodeURIComponent(opts.missionId)}`
        : opts.moduleId
          ? `moduleId=${encodeURIComponent(opts.moduleId)}`
          : null;
      if (!q) {
        setState({ status: "error", code: "NO_ID" });
        return;
      }
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`/api/mentor/content?${q}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        window.clearTimeout(timer);
        const body = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;
        if (res.status === 401) {
          setState({
            status: "auth",
            code: "UNAUTHORIZED",
            reason: (body.reason as { fa: string; en: string }) ?? {
              fa: "برای ادامه وارد شوید.",
              en: "Please sign in to continue.",
            },
          });
          return;
        }
        if (res.status === 403 || body.locked) {
          setState({
            status: "locked",
            code: String(body.error ?? "STAGE_LOCKED"),
            reason: body.reason as { fa: string; en: string } | undefined,
            unlockedStage:
              typeof body.unlockedStage === "number"
                ? body.unlockedStage
                : undefined,
            requestedStage:
              typeof body.requestedStage === "number"
                ? body.requestedStage
                : undefined,
          });
          return;
        }
        if (!res.ok) {
          setState({
            status: "error",
            code: String(body.error ?? `HTTP_${res.status}`),
            reason: {
              fa: "بارگذاری محتوا ممکن نشد — قفل ایمن.",
              en: "Content load failed — fail closed.",
            },
          });
          return;
        }
        setState({
          status: "ready",
          content: body as unknown as AuthorizedContent,
        });
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            code: "NETWORK",
            reason: {
              fa: "پل در دسترس نیست — محتوای آینده باز نمی‌شود.",
              en: "Bridge unavailable — future content stays locked.",
            },
          });
        }
      }
    };
    void run();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [opts.missionId, opts.moduleId, tick, refresh]);

  return { ...state, refresh };
}
