import "server-only";

export type BridgeConfig = {
  url: string;
  secret: string;
  siteOrigin: string;
};

export type BridgeConfigResult =
  | { ok: true; config: BridgeConfig }
  | { ok: false; code: "BRIDGE_UNAVAILABLE"; reason: string };

/**
 * Server-only bridge env. Never expose via NEXT_PUBLIC_*.
 * Loopback HTTP allowed only for same-server; remote must be HTTPS.
 */
export function loadBridgeConfig(): BridgeConfigResult {
  const url = process.env.SFA_BRIDGE_URL?.trim() ?? "";
  const secret = process.env.SFA_BRIDGE_SECRET?.trim() ?? "";
  const siteOrigin = process.env.SFA_SITE_ORIGIN?.trim() ?? "";

  if (!url || !secret || !siteOrigin) {
    return {
      ok: false,
      code: "BRIDGE_UNAVAILABLE",
      reason: "MISSING_ENV",
    };
  }
  if (secret.length < 32) {
    return {
      ok: false,
      code: "BRIDGE_UNAVAILABLE",
      reason: "SECRET_TOO_SHORT",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ok: false,
      code: "BRIDGE_UNAVAILABLE",
      reason: "BAD_URL",
    };
  }

  const host = parsed.hostname;
  const isLoopback =
    host === "127.0.0.1" || host === "localhost" || host === "::1";
  if (!isLoopback && parsed.protocol !== "https:") {
    return {
      ok: false,
      code: "BRIDGE_UNAVAILABLE",
      reason: "REMOTE_REQUIRES_HTTPS",
    };
  }

  return {
    ok: true,
    config: { url: url.replace(/\/$/, ""), secret, siteOrigin },
  };
}

export const SESSION_COOKIE = "sfa_mentor_session";
export const SESSION_MAX_AGE = 604_800; // 7 days
