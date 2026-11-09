import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signBridgeRequest } from "./hmacSign";

describe("HMAC bridge golden vector", () => {
  it("matches Node crypto HMAC construction", () => {
    const secret = "a".repeat(32);
    const timestamp = 1731177600;
    const nonce = "testnonceABCDEF123456";
    const method = "POST";
    const flaskPath = "/api/quiz-results";
    const body = '{"format":"sfa-quiz-result","schemaVersion":2}';
    const bodyBytes = new TextEncoder().encode(body);
    const prefix = `${timestamp}\n${nonce}\n${method}\n${flaskPath}\n`;
    const prefixBytes = new TextEncoder().encode(prefix);
    const msg = Buffer.concat([Buffer.from(prefixBytes), Buffer.from(bodyBytes)]);
    const expected =
      "sha256=" + createHmac("sha256", secret).update(msg).digest("hex");
    const got = signBridgeRequest({
      secret,
      timestamp,
      nonce,
      method,
      flaskPath,
      bodyBytes,
    });
    expect(got).toBe(expected);
  });
});
