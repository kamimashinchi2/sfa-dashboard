import {
  checkRateLimit,
  noStoreJson,
  proxyToBridge,
} from "@/app/lib/academy/server/bridgeProxy";
import { readSessionToken } from "@/app/lib/academy/server/sessionCookie";


/** GET → bridge GET /api/link-status with Bearer cookie. */
export async function GET(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`link-status:${ip}`)) {
    return noStoreJson({ error: "RATE_LIMIT" }, 429);
  }

  const token = await readSessionToken();
  if (!token) {
    return noStoreJson({ error: "UNAUTHORIZED" }, 401);
  }

  const proxied = await proxyToBridge({
    method: "GET",
    flaskPath: "/api/link-status",
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
