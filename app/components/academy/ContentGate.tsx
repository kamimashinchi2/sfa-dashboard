"use client";

import type { ReactNode } from "react";
import {
  useAuthorizedContent,
  type AuthorizedContent,
} from "../../lib/academy/useAuthorizedContent";
import { publicAdvancedOutline, publicMissionOutline } from "../../lib/academy/publicCatalog";
import { t } from "../../lib/academy/dictionary";
import { useProgress } from "./ProgressProvider";

export default function ContentGate({
  missionId,
  moduleId,
  children,
}: {
  missionId?: string;
  moduleId?: string;
  children: (content: AuthorizedContent, refresh: () => void) => ReactNode;
}) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const state = useAuthorizedContent({ missionId, moduleId });
  const outline = missionId
    ? publicMissionOutline(missionId)
    : moduleId
      ? publicAdvancedOutline(moduleId)
      : undefined;

  if (state.status === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-fog" data-testid="content-loading">
        {locale === "fa" ? "بارگذاری محتوای مجاز…" : "Loading authorized content…"}
      </div>
    );
  }

  if (state.status === "auth" || state.status === "locked" || state.status === "error") {
    const reason =
      state.reason ??
      (locale === "fa"
        ? { fa: "محتوا قفل است.", en: "Content locked." }
        : { fa: "محتوا قفل است.", en: "Content locked." });
    return (
      <div
        className="mx-auto max-w-3xl space-y-4 px-6 py-16"
        data-testid={state.status === "locked" ? "content-locked" : "content-auth"}
      >
        {outline ? (
          <>
            <p className="text-[10px] tracking-[0.22em] text-teal-bright uppercase">
              {outline.id} · outline only
            </p>
            <h1 className="font-display text-3xl text-paper">
              {t(outline.title, locale)}
            </h1>
            <p className="text-fog">{t(outline.summary, locale)}</p>
          </>
        ) : (
          <h1 className="font-display text-3xl text-paper">
            {locale === "fa" ? "محتوا در دسترس نیست" : "Content unavailable"}
          </h1>
        )}
        <div className="border border-gold/50 bg-ink/50 p-4 text-sm text-gold-soft">
          <p>{locale === "fa" ? reason.fa : reason.en}</p>
          {state.status === "locked" && state.unlockedStage != null ? (
            <p className="mt-2 font-mono text-xs">
              unlockedStage={state.unlockedStage}
              {state.requestedStage != null
                ? ` · requested=${state.requestedStage}`
                : ""}
            </p>
          ) : null}
          {state.status === "auth" ? (
            <p className="mt-3">
              <a className="underline" href="/login">
                {locale === "fa" ? "ورود" : "Log in"}
              </a>
            </p>
          ) : null}
          <button
            type="button"
            className="mt-4 min-h-11 border border-line px-4 text-xs"
            onClick={() => state.refresh()}
            data-testid="content-refresh"
          >
            {locale === "fa" ? "تازه‌سازی entitlement" : "Refresh entitlement"}
          </button>
        </div>
      </div>
    );
  }

  if (state.status !== "ready") {
    return null;
  }
  return <>{children(state.content, state.refresh)}</>;
}
