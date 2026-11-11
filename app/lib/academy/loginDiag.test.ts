import { describe, expect, it } from "vitest";
import { loginDiagMessage } from "./loginDiag";

describe("loginDiagMessage", () => {
  it("maps config/network codes bilingually without secrets", () => {
    expect(
      loginDiagMessage("en", 503, { error: "BRIDGE_CONFIG_MISSING" }),
    ).toMatch(/misconfigured/i);
    expect(
      loginDiagMessage("fa", 503, { error: "BRIDGE_UNREACHABLE" }),
    ).toMatch(/سرویس/);
    expect(
      loginDiagMessage("en", 426, {
        error: "HTTPS_REQUIRED",
        en: "HTTPS is required for secure login.",
        fa: "برای ورود امن به HTTPS نیاز است.",
      }),
    ).toMatch(/HTTPS/);
  });
});
