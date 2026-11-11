import { describe, expect, it } from "vitest";
import { trustedClientIp, UNOBSERVED_CLIENT_IP } from "./clientIp";

function req(headers: Record<string, string>) {
  return new Request("https://92-5-230-55.sslip.io/api/mentor/login", { headers });
}

describe("trustedClientIp", () => {
  it("uses only the Caddy-controlled header", () => {
    expect(
      trustedClientIp(
        req({
          "x-forwarded-for": "1.2.3.4, 10.0.0.8",
          "x-sfa-client-ip": "203.0.113.9",
        }),
      ),
    ).toBe("203.0.113.9");
  });

  it("rejects spoofed lists and falls back without trusting X-Forwarded-For", () => {
    expect(
      trustedClientIp(req({ "x-sfa-client-ip": "1.2.3.4, 10.0.0.1" })),
    ).toBe(UNOBSERVED_CLIENT_IP);
    expect(
      trustedClientIp(req({ "x-forwarded-for": "203.0.113.9" })),
    ).toBe(UNOBSERVED_CLIENT_IP);
    expect(trustedClientIp(req({ "x-sfa-client-ip": "999.1.1.1" }))).toBe(
      UNOBSERVED_CLIENT_IP,
    );
  });
});
