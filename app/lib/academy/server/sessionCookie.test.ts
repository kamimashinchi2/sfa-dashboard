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
  delete process.env.SFA_ALLOW_CONTENT_BYPASS;
}

describe("session cookie", () => {
  beforeEach(() => {
    clearEnv();
    jar.store.clear();
    process.env.SFA_BRIDGE_URL = "http://127.0.0.1:8081";
    process.env.SFA_BRIDGE_SECRET = SECRET;
  });
  afterEach(() => {
    clearEnv();
  });

  it("refuses a public HTTP origin and allows the HTTPS site and loopback", () => {
    process.env.SFA_SITE_ORIGIN = "http://92.5.230.55:3000";
    expect(httpsRequiredForLogin()).toBe(true);
    process.env.SFA_SITE_ORIGIN = "https://92-5-230-55.sslip.io";
    expect(httpsRequiredForLogin()).toBe(false);
    process.env.SFA_SITE_ORIGIN = "http://127.0.0.1:3000";
    expect(httpsRequiredForLogin()).toBe(false);
  });

  it("sets a Secure __Host cookie with no Domain, and the insecure flags do nothing", async () => {
    process.env.SFA_SITE_ORIGIN = "https://92-5-230-55.sslip.io";
    process.env.SFA_ALLOW_INSECURE_PILOT = "1";
    process.env.SFA_ALLOW_INSECURE_COOKIE = "1";
    await setSessionCookie("sess");
    expect(SESSION_COOKIE).toBe("__Host-sfa_session");
    expect(jar.store.get(SESSION_COOKIE)?.opts).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    expect(jar.store.get(SESSION_COOKIE)?.opts?.domain).toBeUndefined();
    await clearSessionCookie();
    expect(jar.store.get(SESSION_COOKIE)?.opts).toMatchObject({
      secure: true,
      path: "/",
      maxAge: 0,
    });
  });
});
