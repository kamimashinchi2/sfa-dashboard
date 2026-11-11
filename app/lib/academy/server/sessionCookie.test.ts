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

import {
  clearSessionCookie,
  httpsRequiredForLogin,
  setSessionCookie,
} from "./sessionCookie";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "./bridgeConfig";

const SECRET = "c".repeat(32);

function clearEnv() {
  delete process.env.SFA_BRIDGE_URL;
  delete process.env.SFA_BRIDGE_SECRET;
  delete process.env.SFA_SITE_ORIGIN;
  delete process.env.SFA_ALLOW_INSECURE_PILOT;
  delete process.env.SFA_ALLOW_INSECURE_COOKIE;
}

describe("sessionCookie / httpsRequiredForLogin", () => {
  beforeEach(() => {
    clearEnv();
    jar.store.clear();
    process.env.SFA_BRIDGE_URL = "http://127.0.0.1:8081";
    process.env.SFA_BRIDGE_SECRET = SECRET;
  });
  afterEach(() => {
    clearEnv();
  });

  it("does not infer HTTPS from a public-IP Host; HTTP siteOrigin requires HTTPS", () => {
    process.env.SFA_SITE_ORIGIN = "http://92.5.230.55:3000";
    const req = new Request("http://92.5.230.55:3000/api/mentor/session", {
      method: "POST",
      headers: { host: "92.5.230.55:3000" },
    });
    expect(httpsRequiredForLogin(req)).toBe(true);
  });

  it("allows login when canonical siteOrigin is https", () => {
    process.env.SFA_SITE_ORIGIN = "https://academy.example";
    const req = new Request("https://academy.example/api/mentor/session", {
      method: "POST",
      headers: { host: "academy.example" },
    });
    expect(httpsRequiredForLogin(req)).toBe(false);
  });

  it("pilot flag bypasses HTTPS gate and drops Secure on set/delete", async () => {
    process.env.SFA_SITE_ORIGIN = "http://92.5.230.55:3000";
    process.env.SFA_ALLOW_INSECURE_PILOT = "1";
    const req = new Request("http://92.5.230.55:3000/api/mentor/session", {
      method: "POST",
      headers: { host: "92.5.230.55:3000" },
    });
    expect(httpsRequiredForLogin(req)).toBe(false);

    await setSessionCookie("sess");
    expect(jar.store.get(SESSION_COOKIE)?.opts).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    await clearSessionCookie();
    expect(jar.store.get(SESSION_COOKIE)?.opts).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
  });

  it("defaults Secure cookies and ignores legacy SFA_ALLOW_INSECURE_COOKIE", async () => {
    process.env.SFA_SITE_ORIGIN = "https://academy.example";
    process.env.SFA_ALLOW_INSECURE_COOKIE = "1";
    await setSessionCookie("sess");
    expect(jar.store.get(SESSION_COOKIE)?.opts).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    // Legacy flag must not disable the HTTPS gate on an HTTP canonical origin.
    process.env.SFA_SITE_ORIGIN = "http://92.5.230.55:3000";
    expect(
      httpsRequiredForLogin(
        new Request("http://92.5.230.55:3000/x", {
          headers: { host: "92.5.230.55:3000" },
        }),
      ),
    ).toBe(true);
  });
});
