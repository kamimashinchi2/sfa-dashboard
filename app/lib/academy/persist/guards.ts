/** Hand-rolled guards — reject prototype pollution, non-finite numbers, bad ISO, oversized payloads. */

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_STRING = 50_000;
const MAX_ARRAY = 500;
const MAX_DEPTH = 12;

export type GuardResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function walk(value: unknown, depth: number, path: string): string | null {
  if (depth > MAX_DEPTH) return `DEPTH:${path}`;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return `NON_FINITE:${path}`;
    return null;
  }
    if (typeof value === "string") {
    if (value.length > MAX_STRING) return `OVERSIZE_STRING:${path}`;
    // ISO-ish date fields only (avoid matching "format", "status", …)
    const leaf = path.split(".").pop() ?? "";
    if (/(AtISO|updatedAt|createdAt|lockedAt|exportedAtISO|lastWriteISO)$/.test(leaf) && value) {
      if (Number.isNaN(Date.parse(value))) return `BAD_ISO:${path}`;
    }
    return null;
  }
  if (value === null || typeof value === "boolean" || typeof value === "undefined") {
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) return `OVERSIZE_ARRAY:${path}`;
    for (let i = 0; i < value.length; i++) {
      const err = walk(value[i], depth + 1, `${path}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      if (DANGEROUS_KEYS.has(key)) return `DANGEROUS_KEY:${path}.${key}`;
      const err = walk(value[key], depth + 1, path ? `${path}.${key}` : key);
      if (err) return err;
    }
    return null;
  }
  return `BAD_TYPE:${path}`;
}

export function guardUnknown<T = unknown>(raw: unknown): GuardResult<T> {
  const err = walk(raw, 0, "");
  if (err) return { ok: false, reason: err };
  return { ok: true, value: raw as T };
}

export function isIsoLike(s: string): boolean {
  return !Number.isNaN(Date.parse(s));
}
