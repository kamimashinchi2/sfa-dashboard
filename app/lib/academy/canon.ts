/**
 * sfa-canon-v1 — deterministic JSON canonicalization for digests.
 * UTF-8; NFC strings; ASCII keys [A-Za-z0-9_] sorted by code point;
 * arrays keep order; no whitespace; no floats; reject NaN/Infinity,
 * lone surrogates, and __proto__/constructor/prototype keys.
 */

const KEY_RE = /^[A-Za-z0-9_]+$/;
const DANGEROUS = new Set(["__proto__", "constructor", "prototype"]);

export class CanonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonError";
  }
}

function assertNoLoneSurrogates(s: string, path: string): void {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new CanonError(`LONE_SURROGATE:${path}`);
      }
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      throw new CanonError(`LONE_SURROGATE:${path}`);
    }
  }
}

function canonValue(value: unknown, path: string): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonError(`NON_FINITE:${path}`);
    }
    if (!Number.isInteger(value)) {
      throw new CanonError(`FLOAT_FORBIDDEN:${path}`);
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    const nfc = value.normalize("NFC");
    assertNoLoneSurrogates(nfc, path);
    return JSON.stringify(nfc);
  }
  if (Array.isArray(value)) {
    const parts = value.map((v, i) => canonValue(v, `${path}[${i}]`));
    return `[${parts.join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    for (const k of keys) {
      if (DANGEROUS.has(k) || !KEY_RE.test(k)) {
        throw new CanonError(`BAD_KEY:${path}.${k}`);
      }
    }
    keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const parts = keys.map(
      (k) => `${JSON.stringify(k)}:${canonValue(obj[k], path ? `${path}.${k}` : k)}`,
    );
    return `{${parts.join(",")}}`;
  }
  throw new CanonError(`BAD_TYPE:${path}`);
}

/** Canonical JSON string per sfa-canon-v1 (no whitespace). */
export function canon(value: unknown): string {
  return canonValue(value, "");
}
