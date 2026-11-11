import {
  checkRateLimit,
  noStoreJson,
  proxyToBridge,
  requireJsonOrigin,
} from "@/app/lib/academy/server/bridgeProxy";
import { readSessionToken } from "@/app/lib/academy/server/sessionCookie";


const BODY_CAP = 512 * 1024;

/**
 * POST sfa-quiz-result v2 → signed bridge /api/quiz-results
 * Idempotency-Key = attemptId. Client scores are unverified claims.
 */
export async function POST(req: Request) {
  const originCheck = requireJsonOrigin(req);
  if (!originCheck.ok) {
    return noStoreJson({ error: originCheck.code }, originCheck.status);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`quiz-results:${ip}`)) {
    return noStoreJson({ error: "RATE_LIMIT" }, 429);
  }

  const token = await readSessionToken();
  if (!token) {
    return noStoreJson({ error: "UNAUTHORIZED" }, 401);
  }

  const raw = await req.text();
  if (raw.length > BODY_CAP) {
    return noStoreJson({ error: "PAYLOAD_TOO_LARGE" }, 413);
  }

  let body: { attemptId?: string; format?: string; schemaVersion?: number };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return noStoreJson({ error: "BAD_JSON" }, 400);
  }

  if (body.format !== "sfa-quiz-result" || body.schemaVersion !== 2) {
    return noStoreJson({ error: "UNSUPPORTED_FORMAT" }, 400);
  }
  if (!body.attemptId || typeof body.attemptId !== "string") {
    return noStoreJson({ error: "ATTEMPT_ID_REQUIRED" }, 400);
  }

  const frozenBodyBytes = new TextEncoder().encode(raw);
  const proxied = await proxyToBridge({
    method: "POST",
    flaskPath: "/api/quiz-results",
    frozenBodyBytes,
    bearerToken: token,
    idempotencyKey: body.attemptId,
  });

  if (!proxied.ok) {
    return noStoreJson(
      { error: proxied.code, message: proxied.message },
      proxied.status,
    );
  }

  const accepted =
    proxied.result.status === 200 || proxied.result.status === 202;
  return noStoreJson(
    {
      accepted,
      status: proxied.result.status,
      body: proxied.result.body,
    },
    proxied.result.status,
  );
}
