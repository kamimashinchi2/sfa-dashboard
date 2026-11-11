import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  loadBridgeConfig,
} from "./bridgeConfig";

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(SESSION_COOKIE)?.value;
  return v && v.length > 0 ? v : null;
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  const secure = !insecurePilotEnabled();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: !insecurePilotEnabled(),
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Explicit temporary risk acceptance, OFF by default, never a public env.
 * When enabled, Secure is dropped so plain-HTTP pilots can store the cookie.
 * Credential/session traffic is then sniffable — do not enable on production
 * servers that terminate TLS or are reachable beyond loopback.
 * Replaces legacy SFA_ALLOW_INSECURE_COOKIE (removed).
 */
function insecurePilotEnabled(): boolean {
  return process.env.SFA_ALLOW_INSECURE_PILOT === "1";
}

/**
 * Canonical public origin defines the operator's TLS-termination contract.
 * Do not infer HTTPS from a non-local Host or arbitrary forwarded headers.
 */
export function httpsRequiredForLogin(_req: Request): boolean {
  if (insecurePilotEnabled()) return false;
  const cfg = loadBridgeConfig();
  if (!cfg.ok) return true;
  return new URL(cfg.config.siteOrigin).protocol !== "https:";
}
