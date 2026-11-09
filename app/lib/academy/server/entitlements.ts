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
 * Authorize via bridge entitlements. Fail closed.
 * Test-only bypass: NODE_ENV=test + SFA_CONTENT_BYPASS_STAGE=N
 */
export async function resolveEntitlement(): Promise<EntitlementResult> {
  const bypass = process.env.SFA_CONTENT_BYPASS_STAGE;
  // Operator/test only — never set SFA_ALLOW_CONTENT_BYPASS in production.
  if (
    process.env.SFA_ALLOW_CONTENT_BYPASS === "1" &&
    bypass &&
    /^\d+$/.test(bypass)
  ) {
    const unlockedStage = Math.min(8, Math.max(1, Number(bypass)));
    return {
      ok: true,
      entitlement: {
        unlockedStage,
        currentWeek: 1,
        status: "TEST_BYPASS",
      },
      token: "test-bypass",
    };
  }

  const token = await readSessionToken();
  if (!token) {
    return { ok: false, status: 401, code: "UNAUTHORIZED" };
  }

  const proxied = await proxyToBridge({
    method: "GET",
    flaskPath: "/api/entitlements",
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
  // Stage 8 never becomes 9
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
