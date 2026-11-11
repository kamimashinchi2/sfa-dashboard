import "server-only";
import { loadBridgeConfig, logBridgeFailure } from "./bridgeConfig";
import { buildSignedHeaders } from "./hmac";

export type BridgeProxyResult = {
  status: number;
  body: unknown;
  rawText: string;
};

const TIMEOUT_MS = 8_000;

/** Bounded in-process rate limit (not distributed). */
const hits = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || cur.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (cur.count >= RATE_MAX) return false;
  cur.count += 1;
  return true;
}

/** Test-only: clear in-process rate buckets. */
export function resetRateLimitForTests(): void {
  hits.clear();
}

export async function proxyToBridge(input: {
  method: "GET" | "POST";
  flaskPath: string;
  body?: unknown;
  bearerToken?: string | null;
  idempotencyKey?: string | null;
  /** Frozen body bytes for retries — if omitted, serialize body. */
  frozenBodyBytes?: Uint8Array;
}): Promise<
  | { ok: true; result: BridgeProxyResult }
  | { ok: false; status: number; code: string; message: string }
> {
  const cfg = loadBridgeConfig();
  if (!cfg.ok) {
    return {
      ok: false,
      status: 503,
      code: cfg.code,
      message: cfg.reason,
    };
  }

  const bodyBytes =
    input.frozenBodyBytes ??
    (input.body === undefined
      ? new Uint8Array(0)
      : new TextEncoder().encode(JSON.stringify(input.body)));

  const { headers } = buildSignedHeaders({
    secret: cfg.config.secret,
    method: input.method,
    flaskPath: input.flaskPath,
    bodyBytes,
    bearerToken: input.bearerToken,
    idempotencyKey: input.idempotencyKey,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.config.url}${input.flaskPath}`, {
      method: input.method,
      headers,
      body:
        input.method === "GET" ? undefined : Buffer.from(bodyBytes),
      signal: controller.signal,
      cache: "no-store",
      redirect: "error",
    });
    const rawText = await res.text();
    let body: unknown = null;
    try {
      body = rawText ? JSON.parse(rawText) : null;
    } catch {
      body = { raw: rawText.slice(0, 200) };
    }
    return { ok: true, result: { status: res.status, body, rawText } };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    const code = aborted ? "BRIDGE_TIMEOUT" : "BRIDGE_UNREACHABLE";
    logBridgeFailure(code, aborted ? "TIMEOUT" : "FETCH_FAILED");
    return {
      ok: false,
      status: 503,
      code,
      message: aborted ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function requireJsonOrigin(
  req: Request,
): { ok: true } | { ok: false; status: number; code: string } {
  const ct = req.headers.get("content-type") ?? "";
  if (req.method !== "GET" && !ct.includes("application/json")) {
    return { ok: false, status: 415, code: "UNSUPPORTED_MEDIA" };
  }

  // Origin/config for mutations is never bypassed (SFA_ALLOW_CONTENT_BYPASS
  // remains content-entitlement only; it must not skip Exact Origin).
  const cfg = loadBridgeConfig();
  if (!cfg.ok) {
    return { ok: false, status: 503, code: cfg.code };
  }
  const origin = req.headers.get("origin");
  if (req.method !== "GET") {
    if (!origin || origin !== cfg.config.siteOrigin) {
      return { ok: false, status: 403, code: "ORIGIN_REJECTED" };
    }
  }
  return { ok: true };
}

export function noStoreJson(
  data: unknown,
  status = 200,
): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
