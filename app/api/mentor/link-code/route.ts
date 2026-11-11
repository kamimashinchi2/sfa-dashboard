import {
  checkRateLimit,
  noStoreJson,
  proxyToBridge,
  requireJsonOrigin,
} from "@/app/lib/academy/server/bridgeProxy";
import { readSessionToken } from "@/app/lib/academy/server/sessionCookie";


/** POST {} → bridge POST /api/link-code. Code is secret — UI only, never outbox/telemetry. */
export async function POST(req: Request) {
  const originCheck = requireJsonOrigin(req);
  if (!originCheck.ok) {
    return noStoreJson({ error: originCheck.code }, originCheck.status);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`link-code:${ip}`)) {
    return noStoreJson({ error: "RATE_LIMIT" }, 429);
  }

  const token = await readSessionToken();
  if (!token) {
    return noStoreJson({ error: "UNAUTHORIZED" }, 401);
  }

  let body: unknown = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return noStoreJson({ error: "BAD_JSON" }, 400);
  }
  if (
    !body ||
    typeof body !== "object" ||
    Object.keys(body as object).length !== 0
  ) {
    return noStoreJson({ error: "EXACT_EMPTY_BODY" }, 400);
  }

  const proxied = await proxyToBridge({
    method: "POST",
    flaskPath: "/api/link-code",
    body: {},
    bearerToken: token,
  });
  if (!proxied.ok) {
    return noStoreJson(
      { error: proxied.code, message: proxied.message },
      proxied.status,
    );
  }
  return noStoreJson(proxied.result.body, proxied.result.status);
}
