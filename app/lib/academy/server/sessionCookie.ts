import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "./bridgeConfig";

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(SESSION_COOKIE)?.value;
  return v && v.length > 0 ? v : null;
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  const secure =
    process.env.NODE_ENV === "production" &&
    !(process.env.SFA_ALLOW_INSECURE_COOKIE === "1");
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
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

/** Production over HTTP/IP must not set Secure cookies insecurely. */
export function httpsRequiredForLogin(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.SFA_ALLOW_INSECURE_COOKIE === "1") return false;
  const host = req.headers.get("host") ?? "";
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  const isLocal =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]");
  if (isLocal) return false;
  return proto !== "https";
}
