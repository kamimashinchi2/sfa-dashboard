import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadBridgeConfig, logBridgeFailure } from "./bridgeConfig";

const SECRET = "s".repeat(32);

function clearEnv() {
  delete process.env.SFA_BRIDGE_URL;
  delete process.env.SFA_BRIDGE_SECRET;
  delete process.env.SFA_SITE_ORIGIN;
  delete process.env.SFA_ALLOW_INSECURE_PILOT;
  delete process.env.SFA_ALLOW_INSECURE_COOKIE;
}

describe("loadBridgeConfig", () => {
  beforeEach(() => {
    clearEnv();
  });
  afterEach(() => {
    clearEnv();
    vi.restoreAllMocks();
  });

  it("fails BRIDGE_CONFIG_MISSING when env absent", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = loadBridgeConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("BRIDGE_CONFIG_MISSING");
      expect(r.reason).toBe("MISSING_ENV");
    }
    expect(err).toHaveBeenCalledWith(
      "[sfa-bridge]",
      "BRIDGE_CONFIG_MISSING",
      "MISSING_ENV",
    );
    const joined = err.mock.calls.flat().join(" ");
    expect(joined).not.toMatch(/secret|password|token/i);
  });

  it("rejects short / placeholder secrets without logging values", () => {
    process.env.SFA_BRIDGE_URL = "http://127.0.0.1:8081";
    process.env.SFA_BRIDGE_SECRET = "short";
    process.env.SFA_SITE_ORIGIN = "https://academy.example";
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(loadBridgeConfig().ok).toBe(false);
    process.env.SFA_BRIDGE_SECRET = "replace-me-with-a-long-secret-value!!";
    const r = loadBridgeConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("BRIDGE_CONFIG_MISSING");
    for (const call of err.mock.calls) {
      expect(call.join(" ")).not.toContain("replace-me");
      expect(call.join(" ")).not.toContain("short");
    }
  });

  it("rejects remote HTTP, path/query/fragment/credentials, and /api prefix", () => {
    process.env.SFA_BRIDGE_SECRET = SECRET;
    process.env.SFA_SITE_ORIGIN = "https://academy.example";
    const bad = [
      "http://92.5.230.55:8081",
      "http://127.0.0.1:8081/api",
      "http://127.0.0.1:8081?x=1",
      "http://127.0.0.1:8081#h",
      "http://user:pass@127.0.0.1:8081",
      "ftp://127.0.0.1:8081",
    ];
    for (const url of bad) {
      process.env.SFA_BRIDGE_URL = url;
      const r = loadBridgeConfig();
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("BRIDGE_URL_REJECTED");
    }
  });

  it("accepts loopback HTTP, normalizes localhost, and fixes [::1] check", () => {
    process.env.SFA_BRIDGE_SECRET = SECRET;
    process.env.SFA_SITE_ORIGIN = "https://academy.example";
    process.env.SFA_BRIDGE_URL = "http://localhost:8081";
    const a = loadBridgeConfig();
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.config.url).toBe("http://127.0.0.1:8081");

    process.env.SFA_BRIDGE_URL = "http://[::1]:8081";
    const b = loadBridgeConfig();
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.config.url).toBe("http://[::1]:8081");
  });

  it("requires exact site origin (no trailing slash) and preserves secret bytes", () => {
    process.env.SFA_BRIDGE_URL = "http://127.0.0.1:8081";
    process.env.SFA_BRIDGE_SECRET = `  ${SECRET}`;
    process.env.SFA_SITE_ORIGIN = "https://academy.example/";
    const bad = loadBridgeConfig();
    expect(bad.ok).toBe(false);

    process.env.SFA_SITE_ORIGIN = "https://academy.example";
    const ok = loadBridgeConfig();
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.config.secret).toBe(`  ${SECRET}`);
      expect(ok.config.siteOrigin).toBe("https://academy.example");
    }
  });

  it("logBridgeFailure never receives secret material in this module's call sites", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    logBridgeFailure("BRIDGE_UNREACHABLE", "FETCH_FAILED");
    expect(err).toHaveBeenCalledWith(
      "[sfa-bridge]",
      "BRIDGE_UNREACHABLE",
      "FETCH_FAILED",
    );
  });
});
