import {
  checkRateLimit,
  noStoreJson,
  proxyToBridge,
  requireJsonOrigin,
} from "@/app/lib/academy/server/bridgeProxy";
import {
  httpsRequiredForLogin,
  setSessionCookie,
} from "@/app/lib/academy/server/sessionCookie";

// cacheComponents:true (Next 16.4.5) forbids export const runtime — Node.js
// is the default and required runtime for crypto/cookies on these routes.

/** Flask enrollmentToken max is 200; keep JSON envelope small. */
const BODY_CAP = 1024;
const TOKEN_MAX = 200;

/**
 * POST { enrollmentToken } → bridge /api/session
 * Session token stored only in HttpOnly Secure SameSite=Strict cookie.
 * Never returned to JS.
 */
export async function POST(req: Request) {
  const originCheck = requireJsonOrigin(req);
  if (!originCheck.ok) {
    return noStoreJson({ error: originCheck.code }, originCheck.status);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`session:${ip}`)) {
    return noStoreJson({ error: "RATE_LIMIT" }, 429);
  }

  if (httpsRequiredForLogin(req)) {
    return noStoreJson(
      {
        error: "HTTPS_REQUIRED",
        fa: "برای ورود امن به HTTPS نیاز است.",
        en: "HTTPS is required for secure login.",
      },
      426,
    );
  }

  const raw = await req.text();
  if (raw.length > BODY_CAP) {
    return noStoreJson({ error: "PAYLOAD_TOO_LARGE" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return noStoreJson({ error: "BAD_JSON" }, 400);
  }
  if (
    !body ||
    typeof body !== "object" ||
    Object.keys(body as object).length !== 1 ||
    typeof (body as { enrollmentToken?: unknown }).enrollmentToken !== "string"
  ) {
    return noStoreJson({ error: "EXACT_BODY_REQUIRED" }, 400);
  }
  const enrollmentToken = (
    body as { enrollmentToken: string }
  ).enrollmentToken.trim();
  if (!enrollmentToken || enrollmentToken.length > TOKEN_MAX) {
    return noStoreJson({ error: "INVALID_TOKEN" }, 400);
  }

  const proxied = await proxyToBridge({
    method: "POST",
    flaskPath: "/api/session",
    body: { enrollmentToken },
  });
  if (!proxied.ok) {
    return noStoreJson(
      { error: proxied.code, message: proxied.message },
      proxied.status,
    );
  }

  const { status, body: resp } = proxied.result;
  if (status !== 200 && status !== 201) {
    // Do not forward Flask response fields to the browser.
    return noStoreJson(
      { error: "BRIDGE_REJECTED", status },
      status >= 400 && status < 600 ? status : 502,
    );
  }

  const token =
    resp &&
    typeof resp === "object" &&
    typeof (resp as { sessionToken?: unknown }).sessionToken === "string"
      ? (resp as { sessionToken: string }).sessionToken
      : null;
  const expiresIn =
    resp &&
    typeof resp === "object" &&
    typeof (resp as { expiresIn?: unknown }).expiresIn === "number"
      ? (resp as { expiresIn: number }).expiresIn
      : 604800;

  if (!token) {
    return noStoreJson({ error: "NO_SESSION_TOKEN" }, 502);
  }

  await setSessionCookie(token);
  return noStoreJson({
    ok: true,
    expiresIn,
    // Token intentionally omitted from JSON body
  });
}
