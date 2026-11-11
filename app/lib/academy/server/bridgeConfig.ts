import "server-only";

export type BridgeConfig = { url: string; secret: string; siteOrigin: string };
export type BridgeFailureCode = "BRIDGE_CONFIG_MISSING" | "BRIDGE_URL_REJECTED";
export type BridgeConfigResult =
  | { ok: true; config: BridgeConfig }
  | { ok: false; code: BridgeFailureCode; reason: string };

export function logBridgeFailure(code: string, reason: string): void {
  // Only internal constant codes. Never log env values, headers, bodies or errors.
  console.error("[sfa-bridge]", code, reason);
}

/** Runtime server-only env; base URL must not contain an /api prefix. */
export function loadBridgeConfig(): BridgeConfigResult {
  const url = process.env.SFA_BRIDGE_URL?.trim() ?? "";
  // Preserve exact shared HMAC bytes (Flask does not trim its secret).
  const secret = process.env.SFA_BRIDGE_SECRET ?? "";
  const siteOrigin = process.env.SFA_SITE_ORIGIN?.trim() ?? "";
  const fail = (code: BridgeFailureCode, reason: string): BridgeConfigResult => {
    logBridgeFailure(code, reason);
    return { ok: false, code, reason };
  };
  if (!url || !secret || !siteOrigin)
    return fail("BRIDGE_CONFIG_MISSING", "MISSING_ENV");
  if (secret.trim().length < 32 || secret.startsWith("replace-"))
    return fail("BRIDGE_CONFIG_MISSING", "INVALID_SECRET");

  let parsed: URL;
  let site: URL;
  try {
    parsed = new URL(url);
  } catch {
    return fail("BRIDGE_URL_REJECTED", "BAD_URL");
  }
  try {
    site = new URL(siteOrigin);
  } catch {
    return fail("BRIDGE_CONFIG_MISSING", "INVALID_SITE_ORIGIN");
  }
  if (!["http:", "https:"].includes(site.protocol) || site.origin !== siteOrigin)
    return fail("BRIDGE_CONFIG_MISSING", "INVALID_SITE_ORIGIN");

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  )
    return fail("BRIDGE_URL_REJECTED", "BASE_ORIGIN_REQUIRED");
  // URL.hostname for IPv6 loopback is "[::1]", not "::1".
  const isLoopback = ["127.0.0.1", "localhost", "[::1]"].includes(
    parsed.hostname,
  );
  if (parsed.protocol === "http:" && !isLoopback)
    return fail("BRIDGE_URL_REJECTED", "REMOTE_REQUIRES_HTTPS");
  // Flask's supplied deployment binds IPv4 loopback. Avoid localhost -> ::1.
  if (parsed.hostname === "localhost") parsed.hostname = "127.0.0.1";
  return { ok: true, config: { url: parsed.origin, secret, siteOrigin } };
}

/** __Host- prefix: Secure, Path=/, no Domain. sslip.io is not a public suffix. */
export const SESSION_COOKIE = "__Host-sfa_session";
export const SESSION_MAX_AGE = 604_800;
