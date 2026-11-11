import {
  checkRateLimit,
  noStoreJson,
  proxyToBridge,
} from "@/app/lib/academy/server/bridgeProxy";
import { readSessionToken } from "@/app/lib/academy/server/sessionCookie";


/**
 * GET → bridge GET /api/entitlements
 * Returns exactly {unlockedStage,currentWeek,status} when bridge cooperates.
 * Fail closed for future content when unavailable.
 */
export async function GET(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`entitlements:${ip}`)) {
    return noStoreJson({ error: "RATE_LIMIT" }, 429);
  }

  const token = await readSessionToken();
  if (!token) {
    return noStoreJson({ error: "UNAUTHORIZED" }, 401);
  }

  const proxied = await proxyToBridge({
    method: "GET",
    flaskPath: "/api/entitlements",
    bearerToken: token,
  });
  if (!proxied.ok) {
    return noStoreJson(
      { error: proxied.code, message: proxied.message },
      proxied.status,
    );
  }

  const body = proxied.result.body;
  if (
    body &&
    typeof body === "object" &&
    typeof (body as { unlockedStage?: unknown }).unlockedStage === "number" &&
    typeof (body as { currentWeek?: unknown }).currentWeek === "number" &&
    typeof (body as { status?: unknown }).status === "string"
  ) {
    const unlockedStage = Math.min(
      8,
      Math.max(1, Math.floor((body as { unlockedStage: number }).unlockedStage)),
    );
    return noStoreJson(
      {
        unlockedStage,
        currentWeek: (body as { currentWeek: number }).currentWeek,
        status: (body as { status: string }).status,
      },
      proxied.result.status,
    );
  }

  return noStoreJson(body, proxied.result.status);
}
