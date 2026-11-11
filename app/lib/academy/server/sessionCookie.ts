import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  loadBridgeConfig,
} from "./bridgeConfig";

const COOKIE_BASE = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  // __Host- cookies must not set Domain.
};

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(SESSION_COOKIE)?.value;
  return v && v.length > 0 ? v : null;
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    ...COOKIE_BASE,
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    ...COOKIE_BASE,
    maxAge: 0,
  });
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "127.0.0.1" ||
    hostname === "localhost" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

/**
 * Public HTTP origins cannot log in. Loopback HTTP is allowed for a local
 * Next process behind nothing; the cookie stays Secure. There is no pilot flag.
 */
export function httpsRequiredForLogin(): boolean {
  const cfg = loadBridgeConfig();
  if (!cfg.ok) return true;
  let site: URL;
  try {
    site = new URL(cfg.config.siteOrigin);
  } catch {
    return true;
  }
  if (site.protocol === "https:") return false;
  return !isLoopbackHost(site.hostname);
}
