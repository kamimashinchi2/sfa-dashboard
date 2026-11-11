import "server-only";
import { proxyToBridge } from "./bridgeProxy";
import { readSessionToken } from "./sessionCookie";

export type Entitlement = {
  unlockedStage: number;
  currentWeek: number;
  status: string;
};

export type EntitlementResult =
  | { ok: true; entitlement: Entitlement; token: string }
  | {
      ok: false;
      status: number;
      code: string;
      reason?: string;
    };

/**
 * Authorize via the account API. There is no content bypass.
 * Fail closed when the session or bridge is unavailable.
 */
export async function resolveEntitlement(): Promise<EntitlementResult> {
  const token = await readSessionToken();
  if (!token) {
    return { ok: false, status: 401, code: "UNAUTHORIZED" };
  }

  const proxied = await proxyToBridge({
    method: "GET",
    flaskPath: "/api/v1/entitlements",
    bearerToken: token,
  });
  if (!proxied.ok) {
    return {
      ok: false,
      status: proxied.status,
      code: proxied.code,
      reason: proxied.message,
    };
  }
  if (proxied.result.status === 401) {
    return { ok: false, status: 401, code: "UNAUTHORIZED" };
  }
  const body = proxied.result.body;
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { unlockedStage?: unknown }).unlockedStage !== "number"
  ) {
    return {
      ok: false,
      status: 503,
      code: "ENTITLEMENT_UNAVAILABLE",
    };
  }
  const unlockedStage = Math.min(
    8,
    Math.max(1, Math.floor((body as { unlockedStage: number }).unlockedStage)),
  );
  return {
    ok: true,
    token,
    entitlement: {
      unlockedStage,
      currentWeek:
        typeof (body as { currentWeek?: unknown }).currentWeek === "number"
          ? (body as { currentWeek: number }).currentWeek
          : 1,
      status:
        typeof (body as { status?: unknown }).status === "string"
          ? (body as { status: string }).status
          : "UNKNOWN",
    },
  };
}

export function authorizeStage(
  requestedStage: number,
  unlockedStage: number,
): boolean {
  if (requestedStage < 1 || requestedStage > 8) return false;
  return requestedStage <= unlockedStage;
}
