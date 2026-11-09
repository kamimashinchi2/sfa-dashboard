/**
 * Pure HMAC signing helpers — no server-only import (safe for unit tests).
 * Route handlers import via server/hmac.ts which re-exports these.
 */
import { createHmac, randomBytes } from "node:crypto";

export function freshNonce(): string {
  return randomBytes(18).toString("base64url");
}

export function signBridgeRequest(input: {
  secret: string;
  timestamp: number;
  nonce: string;
  method: string;
  flaskPath: string;
  bodyBytes: Uint8Array;
}): string {
  const prefix = `${input.timestamp}\n${input.nonce}\n${input.method.toUpperCase()}\n${input.flaskPath}\n`;
  const prefixBytes = new TextEncoder().encode(prefix);
  const msg = new Uint8Array(prefixBytes.length + input.bodyBytes.length);
  msg.set(prefixBytes, 0);
  msg.set(input.bodyBytes, prefixBytes.length);
  const mac = createHmac("sha256", input.secret).update(msg).digest("hex");
  return `sha256=${mac}`;
}

export function buildSignedHeaders(input: {
  secret: string;
  method: string;
  flaskPath: string;
  bodyBytes: Uint8Array;
  bearerToken?: string | null;
  idempotencyKey?: string | null;
  timestamp?: number;
  nonce?: string;
}): {
  headers: Record<string, string>;
  timestamp: number;
  nonce: string;
} {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const nonce = input.nonce ?? freshNonce();
  const signature = signBridgeRequest({
    secret: input.secret,
    timestamp,
    nonce,
    method: input.method,
    flaskPath: input.flaskPath,
    bodyBytes: input.bodyBytes,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-SFA-Timestamp": String(timestamp),
    "X-SFA-Nonce": nonce,
    "X-SFA-Signature": signature,
    "Cache-Control": "no-store",
  };
  if (input.bearerToken) {
    headers.Authorization = `Bearer ${input.bearerToken}`;
  }
  if (input.idempotencyKey) {
    headers["Idempotency-Key"] = input.idempotencyKey;
  }
  return { headers, timestamp, nonce };
}
