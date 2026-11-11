import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const jar = {
  store: new Map<string, { value: string; opts?: Record<string, unknown> }>(),
  get(name: string) {
    const v = this.store.get(name);
    return v ? { name, value: v.value } : undefined;
  },
  set(name: string, value: string, opts?: Record<string, unknown>) {
    this.store.set(name, { value, opts });
  },
};

vi.mock("next/headers", () => ({
  cookies: async () => jar,
}));

import { POST } from "./route";
import { resetRateLimitForTests } from "@/app/lib/academy/server/bridgeProxy";

const SECRET = "r".repeat(32);
const HTTPS_ORIGIN = "https://academy.example";
const HTTP_ORIGIN = "http://92.5.230.55:3000";

function clearEnv() {
  delete process.env.SFA_BRIDGE_URL;
  delete process.env.SFA_BRIDGE_SECRET;
  delete process.env.SFA_SITE_ORIGIN;
  delete process.env.SFA_ALLOW_INSECURE_PILOT;
  delete process.env.SFA_ALLOW_CONTENT_BYPASS;
  delete process.env.SFA_CONTENT_BYPASS_STAGE;
}

function setEnv(origin: string) {
  process.env.SFA_BRIDGE_URL = "http://127.0.0.1:8081";
  process.env.SFA_BRIDGE_SECRET = SECRET;
  process.env.SFA_SITE_ORIGIN = origin;
}

function sessionReq(origin: string, body: unknown, extra?: HeadersInit) {
  return new Request(`${origin}/api/mentor/session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      ...(extra ?? {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/mentor/session", () => {
  beforeEach(() => {
    clearEnv();
    jar.store.clear();
    resetRateLimitForTests();
  });
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns 503 BRIDGE_CONFIG_MISSING with no fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(sessionReq(HTTPS_ORIGIN, { enrollmentToken: "x" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "BRIDGE_CONFIG_MISSING" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 BRIDGE_URL_REJECTED for remote HTTP bridge", async () => {
    process.env.SFA_BRIDGE_URL = "http://92.5.230.55:8081";
    process.env.SFA_BRIDGE_SECRET = SECRET;
    process.env.SFA_SITE_ORIGIN = HTTPS_ORIGIN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(sessionReq(HTTPS_ORIGIN, { enrollmentToken: "x" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "BRIDGE_URL_REJECTED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 403 ORIGIN_REJECTED before upstream", async () => {
    setEnv(HTTPS_ORIGIN);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(
      sessionReq("https://evil.example", { enrollmentToken: "x" }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "ORIGIN_REJECTED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns bilingual 426 HTTPS_REQUIRED for plain HTTP siteOrigin", async () => {
    setEnv(HTTP_ORIGIN);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(sessionReq(HTTP_ORIGIN, { enrollmentToken: "x" }));
    expect(res.status).toBe(426);
    const body = await res.json();
    expect(body.error).toBe("HTTPS_REQUIRED");
    expect(body.en).toMatch(/HTTPS/i);
    expect(body.fa).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("with pilot=1, allows HTTP origin and sets non-Secure cookie", async () => {
    setEnv(HTTP_ORIGIN);
    process.env.SFA_ALLOW_INSECURE_PILOT = "1";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ sessionToken: "live-token", expiresIn: 99 }),
          { status: 200 },
        ),
      ),
    );
    const res = await POST(
      sessionReq(HTTP_ORIGIN, { enrollmentToken: "enroll-ok" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, expiresIn: 99 });
    expect(jar.store.get("sfa_mentor_session")?.opts?.secure).toBe(false);
    expect(jar.store.get("sfa_mentor_session")?.value).toBe("live-token");
  });

  it("rejects oversized token / body without calling Flask", async () => {
    setEnv(HTTPS_ORIGIN);
    process.env.SFA_ALLOW_INSECURE_PILOT = "1"; // irrelevant; origin is https
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const long = "t".repeat(201);
    const res = await POST(
      sessionReq(HTTPS_ORIGIN, { enrollmentToken: long }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_TOKEN" });
    expect(fetchMock).not.toHaveBeenCalled();

    const huge = "x".repeat(1025);
    const res2 = await POST(sessionReq(HTTPS_ORIGIN, huge));
    expect(res2.status).toBe(413);
  });

  it("maps unreachable/timeout to 503 codes; upstream 401 is not 503", async () => {
    setEnv(HTTPS_ORIGIN);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const unreachable = await POST(
      sessionReq(HTTPS_ORIGIN, { enrollmentToken: "x" }),
    );
    expect(unreachable.status).toBe(503);
    expect(await unreachable.json()).toMatchObject({
      error: "BRIDGE_UNREACHABLE",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        throw e;
      }),
    );
    const timeout = await POST(
      sessionReq(HTTPS_ORIGIN, { enrollmentToken: "x" }),
    );
    expect(timeout.status).toBe(503);
    expect(await timeout.json()).toMatchObject({ error: "BRIDGE_TIMEOUT" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "bad_token", secret: "nope" }), {
          status: 401,
        }),
      ),
    );
    const auth = await POST(
      sessionReq(HTTPS_ORIGIN, { enrollmentToken: "x" }),
    );
    expect(auth.status).toBe(401);
    const authBody = await auth.json();
    expect(authBody).toEqual({ error: "BRIDGE_REJECTED", status: 401 });
    expect(JSON.stringify(authBody)).not.toContain("nope");
    expect(JSON.stringify(authBody)).not.toContain("bad_token");
    expect(JSON.stringify(err.mock.calls)).not.toContain(SECRET);
  });

  it("successful HMAC path sets Secure cookie and omits token from JSON", async () => {
    setEnv(HTTPS_ORIGIN);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://127.0.0.1:8081/api/session");
      const h = new Headers(init?.headers);
      expect(h.get("X-SFA-Signature")).toMatch(/^sha256=/);
      return new Response(
        JSON.stringify({
          sessionToken: "sess-abc",
          expiresIn: 604800,
          extraLeak: "hide-me",
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(
      sessionReq(HTTPS_ORIGIN, { enrollmentToken: "good" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/no-store/i);
    const body = await res.json();
    expect(body).toEqual({ ok: true, expiresIn: 604800 });
    expect(JSON.stringify(body)).not.toContain("sess-abc");
    expect(JSON.stringify(body)).not.toContain("hide-me");
    expect(jar.store.get("sfa_mentor_session")?.opts).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });
  });
});
