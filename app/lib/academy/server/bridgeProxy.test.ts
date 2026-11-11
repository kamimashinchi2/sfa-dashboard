import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  proxyToBridge,
  requireJsonOrigin,
  resetRateLimitForTests,
} from "./bridgeProxy";

const SECRET = "k".repeat(32);
const ORIGIN = "https://academy.example";

function setOkEnv() {
  process.env.SFA_BRIDGE_URL = "http://127.0.0.1:8081";
  process.env.SFA_BRIDGE_SECRET = SECRET;
  process.env.SFA_SITE_ORIGIN = ORIGIN;
}

function clearEnv() {
  delete process.env.SFA_BRIDGE_URL;
  delete process.env.SFA_BRIDGE_SECRET;
  delete process.env.SFA_SITE_ORIGIN;
  delete process.env.SFA_ALLOW_CONTENT_BYPASS;
  delete process.env.SFA_CONTENT_BYPASS_STAGE;
}

describe("requireJsonOrigin", () => {
  beforeEach(() => {
    clearEnv();
    resetRateLimitForTests();
  });
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns sanitized config failure codes", () => {
    const req = new Request("https://academy.example/api/mentor/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: "{}",
    });
    const r = requireJsonOrigin(req);
    expect(r).toEqual({
      ok: false,
      status: 503,
      code: "BRIDGE_CONFIG_MISSING",
    });
  });

  it("rejects mismatched Origin and does not honor content bypass", () => {
    setOkEnv();
    process.env.SFA_ALLOW_CONTENT_BYPASS = "1";
    process.env.SFA_CONTENT_BYPASS_STAGE = "3";
    const req = new Request("https://academy.example/api/mentor/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: "{}",
    });
    expect(requireJsonOrigin(req)).toEqual({
      ok: false,
      status: 403,
      code: "ORIGIN_REJECTED",
    });
  });

  it("accepts exact Origin match", () => {
    setOkEnv();
    const req = new Request("https://academy.example/api/mentor/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: "{}",
    });
    expect(requireJsonOrigin(req)).toEqual({ ok: true });
  });
});

describe("proxyToBridge", () => {
  beforeEach(() => {
    clearEnv();
    resetRateLimitForTests();
  });
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("signs HMAC and posts to root base + flask path (no double /api)", async () => {
    setOkEnv();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://127.0.0.1:8081/api/session");
      const h = new Headers(init?.headers);
      expect(h.get("X-SFA-Signature")).toMatch(/^sha256=/);
      expect(h.get("Authorization")).toBeNull();
      return new Response(JSON.stringify({ sessionToken: "tok", expiresIn: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await proxyToBridge({
      method: "POST",
      flaskPath: "/api/session",
      body: { enrollmentToken: "abc" },
    });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("error");
  });

  it("maps network failure to 503 BRIDGE_UNREACHABLE", async () => {
    setOkEnv();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    const r = await proxyToBridge({
      method: "POST",
      flaskPath: "/api/session",
      body: { enrollmentToken: "abc" },
    });
    expect(r).toEqual({
      ok: false,
      status: 503,
      code: "BRIDGE_UNREACHABLE",
      message: "network",
    });
    expect(err).toHaveBeenCalledWith(
      "[sfa-bridge]",
      "BRIDGE_UNREACHABLE",
      "FETCH_FAILED",
    );
  });

  it("maps abort to 503 BRIDGE_TIMEOUT", async () => {
    setOkEnv();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const e = new Error("aborted");
      e.name = "AbortError";
      // Consume signal if present
      void init?.signal;
      throw e;
    }));
    const r = await proxyToBridge({
      method: "GET",
      flaskPath: "/api/entitlements",
    });
    expect(r).toEqual({
      ok: false,
      status: 503,
      code: "BRIDGE_TIMEOUT",
      message: "timeout",
    });
    expect(err.mock.calls[0]?.slice(0, 3)).toEqual([
      "[sfa-bridge]",
      "BRIDGE_TIMEOUT",
      "TIMEOUT",
    ]);
  });

  it("returns upstream auth status via ok:true (not 503)", async () => {
    setOkEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
        }),
      ),
    );
    const r = await proxyToBridge({
      method: "POST",
      flaskPath: "/api/session",
      body: { enrollmentToken: "bad" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.status).toBe(401);
  });
});
