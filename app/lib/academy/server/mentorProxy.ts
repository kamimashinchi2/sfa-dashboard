import "server-only";
import { freshNonce } from "../hmacSign";
import { loadBridgeConfig, logBridgeFailure } from "./bridgeConfig";
import {
  checkRateLimit,
  noStoreJson,
  proxyToBridge,
  requireExactOrigin,
} from "./bridgeProxy";
import { trustedClientIp } from "./clientIp";
import { bilingual, safeErrorCode } from "./publicErrors";
import {
  clearSessionCookie,
  httpsRequiredForLogin,
  readSessionToken,
  setSessionCookie,
} from "./sessionCookie";
import {
  discardSpool,
  MAX_UPLOAD_BYTES,
  openSpoolStream,
  spoolSignedBody,
  type SpooledBody,
} from "./uploadSpool";

const JSON_CAP = 1_048_576;
const LEGACY_CAP = 500_000;
const SEGMENT = /^[A-Za-z0-9_.:-]{1,160}$/;

const PRIVATE_KEYS = new Set([
  "sessionToken",
  "echoNotes",
  "correctAnswer",
  "leaseToken",
  "password",
  "password_hash",
  "passwordHash",
]);

const HMAC_ONLY = new Set(["data-notice", "signup", "login", "reset-password"]);
const CAPTURE_SESSION = new Set(["signup", "login"]);
const RETIRED = new Set([
  "session",
  "link-code",
  "link-status",
  "quiz-score",
  "quiz-results",
]);

export function retiredEndpoint(): Response {
  return noStoreJson({ error: "GONE", ...bilingual("GONE") }, 410);
}

function hasOwnCopy(code: string): boolean {
  return bilingual(code).en !== bilingual("VALIDATION_FAILED").en || code === "VALIDATION_FAILED";
}

function errorResponse(code: string, status: number, message?: string): Response {
  const shown = safeErrorCode(message);
  const copy = bilingual(shown && hasOwnCopy(shown) ? shown : code);
  return noStoreJson(
    {
      error: code,
      ...(shown ? { message: shown } : {}),
      ...copy,
    },
    status,
  );
}

function stripPrivate(value: unknown, keepEchoNotes: boolean): unknown {
  if (Array.isArray(value)) return value.map((v) => stripPrivate(v, keepEchoNotes));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "echoNotes" && keepEchoNotes) {
      out[key] = child;
      continue;
    }
    if (PRIVATE_KEYS.has(key)) continue;
    out[key] = stripPrivate(child, keepEchoNotes);
  }
  return out;
}

function pythonPath(slug: string[]): string | null {
  if (slug.length === 0 || slug.length > 6) return null;
  if (!slug.every((part) => SEGMENT.test(part))) return null;
  return `/api/v1/${slug.join("/")}`;
}

function isAdmin(slug: string[]): boolean {
  return slug[0] === "admin";
}

function isMultipart(slug: string[], method: string): boolean {
  return method === "POST" && slug.length === 3 && slug[0] === "practicals" && slug[2] === "files";
}

export async function proxyMentor(
  req: Request,
  method: "GET" | "POST",
  slug: string[],
): Promise<Response> {
  const key = slug.join("/");
  if (RETIRED.has(key)) return retiredEndpoint();
  if (key === "logout" && method === "POST") return logoutAccount(req);

  const path = pythonPath(slug);
  if (!path) return errorResponse("VALIDATION_FAILED", 404);

  const hmacOnly = HMAC_ONLY.has(key);
  const clientIp = trustedClientIp(req);

  if (method === "POST") {
    const origin = requireExactOrigin(req);
    if (!origin.ok) return errorResponse(origin.code, origin.status);
  }

  if (method === "POST" && (key === "login" || key === "signup" || key === "reset-password")) {
    if (httpsRequiredForLogin()) {
      return errorResponse("HTTPS_REQUIRED", 426);
    }
    if (!checkRateLimit(`auth:${clientIp}`, 40)) {
      return errorResponse("RATE_LIMITED", 429);
    }
  }

  if (isMultipart(slug, method)) {
    return proxyUpload(req, path, clientIp);
  }

  if (method === "POST") {
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return errorResponse("UNSUPPORTED_MEDIA", 415);
    }
  }

  let token: string | null = null;
  if (!hmacOnly) {
    token = await readSessionToken();
    if (!token) return errorResponse("UNAUTHORIZED", 401);
  }

  let bodyBytes = new Uint8Array(0);
  if (method === "POST") {
    const cap = key === "legacy-import" ? LEGACY_CAP : JSON_CAP;
    const raw = new Uint8Array(await req.arrayBuffer());
    if (raw.byteLength > cap) return errorResponse("PAYLOAD_TOO_LARGE", 413);
    bodyBytes = raw;
  }

  const proxied = await proxyToBridge({
    method,
    flaskPath: path,
    frozenBodyBytes: bodyBytes,
    bearerToken: token,
    clientIp,
  });
  if (!proxied.ok) return errorResponse(proxied.code, proxied.status, proxied.message);

  return presentUpstream(proxied.result.status, proxied.result.body, {
    captureSession: CAPTURE_SESSION.has(key),
    keepEchoNotes: isAdmin(slug),
    clampEntitlements: key === "entitlements",
  });
}

async function presentUpstream(
  status: number,
  body: unknown,
  opts: { captureSession: boolean; keepEchoNotes: boolean; clampEntitlements: boolean },
): Promise<Response> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    if (status >= 200 && status < 300) {
      return errorResponse("UPSTREAM_INVALID", 502);
    }
    return errorResponse("UPSTREAM_INVALID", status >= 400 && status < 600 ? status : 502);
  }
  const record = body as Record<string, unknown>;
  const sessionToken =
    typeof record.sessionToken === "string" ? record.sessionToken : null;
  if (opts.captureSession && status >= 200 && status < 300) {
    if (!sessionToken) return errorResponse("NO_SESSION_TOKEN", 502);
    await setSessionCookie(sessionToken);
  }
  let publicBody = stripPrivate(record, opts.keepEchoNotes) as Record<string, unknown>;
  if (opts.clampEntitlements && typeof publicBody.unlockedStage === "number") {
    publicBody = {
      ...publicBody,
      unlockedStage: Math.min(8, Math.max(1, Math.floor(publicBody.unlockedStage))),
    };
  }
  if (status >= 400) {
    const code =
      typeof publicBody.error === "string" ? publicBody.error : "VALIDATION_FAILED";
    const message = safeErrorCode(publicBody.message);
    const copy = bilingual(message && message !== code ? message : code);
    return noStoreJson(
      {
        ...publicBody,
        error: code,
        ...(message ? { message } : {}),
        fa: copy.fa,
        en: copy.en,
      },
      status,
    );
  }
  return noStoreJson(publicBody, status);
}

export async function logoutAccount(req: Request): Promise<Response> {
  const origin = requireExactOrigin(req);
  if (!origin.ok) return errorResponse(origin.code, origin.status);
  const token = await readSessionToken();
  if (token) {
    const proxied = await proxyToBridge({
      method: "POST",
      flaskPath: "/api/v1/logout",
      frozenBodyBytes: new TextEncoder().encode("{}"),
      bearerToken: token,
      clientIp: trustedClientIp(req),
    });
    if (!proxied.ok && proxied.status !== 401) {
      await clearSessionCookie();
      return errorResponse(proxied.code, proxied.status);
    }
  }
  await clearSessionCookie();
  return noStoreJson({ ok: true }, 200);
}

async function proxyUpload(
  req: Request,
  flaskPath: string,
  clientIp: string,
): Promise<Response> {
  const origin = requireExactOrigin(req);
  if (!origin.ok) return errorResponse(origin.code, origin.status);
  const token = await readSessionToken();
  if (!token) return errorResponse("UNAUTHORIZED", 401);
  if (!checkRateLimit(`upload:${clientIp}`, 30)) {
    return errorResponse("RATE_LIMITED", 429);
  }
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("multipart/form-data") || !ct.includes("boundary=")) {
    return errorResponse("UNSUPPORTED_MEDIA", 415);
  }
  const declared = req.headers.get("content-length");
  if (declared && Number(declared) > MAX_UPLOAD_BYTES) {
    return errorResponse("PAYLOAD_TOO_LARGE", 413);
  }

  const cfg = loadBridgeConfig();
  if (!cfg.ok) return errorResponse(cfg.code, 503);

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = freshNonce();
  const prefix = `${timestamp}\n${nonce}\nPOST\n${flaskPath}\n`;
  let spool: SpooledBody | null = null;
  try {
    const spooled = await spoolSignedBody({
      body: req.body,
      maxBytes: MAX_UPLOAD_BYTES,
      secret: cfg.config.secret,
      prefix,
    });
    if (!spooled.ok) return errorResponse(spooled.code, 413);
    spool = spooled.spool;
    const headers: Record<string, string> = {
      "Content-Type": ct,
      "Content-Length": String(spool.size),
      "X-SFA-Timestamp": String(timestamp),
      "X-SFA-Nonce": nonce,
      "X-SFA-Signature": spool.signature,
      Authorization: `Bearer ${token}`,
      "X-SFA-Client-IP": clientIp,
      "Cache-Control": "no-store",
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    const streamed = openSpoolStream(spool.path);
    try {
      const res = await fetch(`${cfg.config.url}${flaskPath}`, {
        method: "POST",
        headers,
        body: streamed.body,
        duplex: "half",
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      } as RequestInit & { duplex: "half" });
      await streamed.closed;
      const rawText = await res.text();
      let body: unknown = null;
      try {
        body = rawText ? JSON.parse(rawText) : null;
      } catch {
        body = null;
      }
      return presentUpstream(res.status, body, {
        captureSession: false,
        keepEchoNotes: false,
        clampEntitlements: false,
      });
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      const code = aborted ? "BRIDGE_TIMEOUT" : "BRIDGE_UNREACHABLE";
      logBridgeFailure(code, aborted ? "UPLOAD_TIMEOUT" : "UPLOAD_FETCH_FAILED");
      return errorResponse(code, 503);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    logBridgeFailure("UPLOAD_FAILED", "SPOOL");
    return errorResponse("UPLOAD_FAILED", 500);
  } finally {
    await discardSpool(spool);
  }
}
