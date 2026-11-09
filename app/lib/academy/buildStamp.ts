/**
 * Build stamp from supplied metadata when available.
 * Falls back to "version unavailable" — never invents a version.
 * APP_RELEASE_LABEL is the single release name used across pages.
 */

export const APP_RELEASE_LABEL = "Iteration 5";

export type BuildStamp = {
  label: string;
  commit: string | null;
  builtAt: string | null;
  release: string;
};

export function resolveBuildStamp(env?: {
  NEXT_PUBLIC_BUILD_ID?: string;
  NEXT_PUBLIC_GIT_SHA?: string;
  NEXT_PUBLIC_BUILT_AT?: string;
}): BuildStamp {
  const e = env ?? {
    NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID,
    NEXT_PUBLIC_GIT_SHA: process.env.NEXT_PUBLIC_GIT_SHA,
    NEXT_PUBLIC_BUILT_AT: process.env.NEXT_PUBLIC_BUILT_AT,
  };
  const commit =
    e.NEXT_PUBLIC_GIT_SHA?.trim() || e.NEXT_PUBLIC_BUILD_ID?.trim() || null;
  const builtAt = e.NEXT_PUBLIC_BUILT_AT?.trim() || null;
  if (!commit && !builtAt) {
    return {
      label: "version unavailable",
      commit: null,
      builtAt: null,
      release: APP_RELEASE_LABEL,
    };
  }
  return {
    label: [commit, builtAt, APP_RELEASE_LABEL].filter(Boolean).join(" · "),
    commit,
    builtAt,
    release: APP_RELEASE_LABEL,
  };
}
