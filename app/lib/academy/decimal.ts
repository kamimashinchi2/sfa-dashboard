/**
 * Exact decimal helpers for academy engines.
 * No floating-point money math. Empty → null. Persian/Arabic digits normalized.
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export type ParseDecResult =
  | { ok: true; value: string }
  | { ok: false; reason: string; value: null };

function mapDigit(ch: string): string {
  const p = PERSIAN_DIGITS.indexOf(ch);
  if (p >= 0) return String(p);
  const a = ARABIC_DIGITS.indexOf(ch);
  if (a >= 0) return String(a);
  return ch;
}

/** Normalize Persian/Arabic digits, Arabic decimal separators and minus signs. */
export function normalizeNumericText(raw: string): string {
  let out = "";
  for (const ch of raw.trim()) {
    if (ch === "٫" || ch === "،") {
      out += ".";
      continue;
    }
    if (ch === "−" || ch === "－" || ch === "‒") {
      out += "-";
      continue;
    }
    out += mapDigit(ch);
  }
  return out;
}

/**
 * Parse a decimal string. Empty → null (ok with value null via empty flag).
 * Rejects grouping ambiguity, exponents, NaN/Infinity, junk, internal spaces.
 */
export function parseDec(raw: string | null | undefined): ParseDecResult {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: "NULL_INPUT", value: null };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, reason: "EMPTY", value: null };
  }
  if (/\s/.test(trimmed)) {
    return { ok: false, reason: "INTERNAL_SPACE", value: null };
  }

  const normalized = normalizeNumericText(trimmed);

  // Reject grouping ambiguity: both comma and period, or thousand separators.
  if (/[eE]/.test(normalized)) {
    return { ok: false, reason: "EXPONENT", value: null };
  }
  if (/,/.test(normalized) && /\./.test(normalized)) {
    return { ok: false, reason: "GROUPING_AMBIGUITY", value: null };
  }
  if (/,/.test(normalized)) {
    // Treat lone commas as decimal only if exactly one and not thousands pattern.
    const parts = normalized.split(",");
    if (parts.length !== 2) {
      return { ok: false, reason: "GROUPING_AMBIGUITY", value: null };
    }
    // Ambiguous thousands: 1,000
    if (parts[1].length === 3 && parts[0].replace(/^-/, "").length >= 1) {
      return { ok: false, reason: "GROUPING_AMBIGUITY", value: null };
    }
  }

  const candidate = normalized.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(candidate)) {
    return { ok: false, reason: "MALFORMED", value: null };
  }
  if (candidate === "NaN" || candidate === "Infinity" || candidate === "-Infinity") {
    return { ok: false, reason: "NON_FINITE", value: null };
  }

  return { ok: true, value: canonicalize(candidate) };
}

/** Empty string is intentionally empty (null), not zero. */
export function parseDecOrEmpty(
  raw: string | null | undefined,
): { empty: true; value: null } | ParseDecResult {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return { empty: true, value: null };
  }
  return parseDec(raw);
}

export function canonicalize(value: string): string {
  let s = value;
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  if (s.includes(".")) {
    const [i, f] = s.split(".");
    const intPart = i.replace(/^0+(?=\d)/, "") || "0";
    const frac = f.replace(/0+$/, "");
    s = frac.length ? `${intPart}.${frac}` : intPart;
  } else {
    s = s.replace(/^0+(?=\d)/, "") || "0";
  }
  if (s === "0") return "0";
  return neg ? `-${s}` : s;
}

function toParts(d: string): { neg: boolean; int: string; frac: string } {
  const c = canonicalize(d);
  const neg = c.startsWith("-");
  const body = neg ? c.slice(1) : c;
  const [int, frac = ""] = body.split(".");
  return { neg, int, frac };
}

function align(a: string, b: string): {
  aNeg: boolean;
  bNeg: boolean;
  aDigits: string;
  bDigits: string;
  scale: number;
} {
  const A = toParts(a);
  const B = toParts(b);
  const scale = Math.max(A.frac.length, B.frac.length);
  const aDigits =
    A.int + A.frac.padEnd(scale, "0") || "0";
  const bDigits =
    B.int + B.frac.padEnd(scale, "0") || "0";
  return {
    aNeg: A.neg,
    bNeg: B.neg,
    aDigits: aDigits.replace(/^0+(?=\d)/, "") || "0",
    bDigits: bDigits.replace(/^0+(?=\d)/, "") || "0",
    scale,
  };
}

function cmpAbs(aDigits: string, bDigits: string): number {
  if (aDigits.length !== bDigits.length) {
    return aDigits.length < bDigits.length ? -1 : 1;
  }
  return aDigits < bDigits ? -1 : aDigits > bDigits ? 1 : 0;
}

function addAbs(a: string, b: string): string {
  let i = a.length - 1;
  let j = b.length - 1;
  let carry = 0;
  const out: number[] = [];
  while (i >= 0 || j >= 0 || carry) {
    const da = i >= 0 ? a.charCodeAt(i--) - 48 : 0;
    const db = j >= 0 ? b.charCodeAt(j--) - 48 : 0;
    const sum = da + db + carry;
    out.push(sum % 10);
    carry = Math.floor(sum / 10);
  }
  return out.reverse().join("").replace(/^0+(?=\d)/, "") || "0";
}

function subAbs(a: string, b: string): string {
  // assume a >= b
  let i = a.length - 1;
  let j = b.length - 1;
  let borrow = 0;
  const out: number[] = [];
  while (i >= 0) {
    let da = a.charCodeAt(i--) - 48 - borrow;
    const db = j >= 0 ? b.charCodeAt(j--) - 48 : 0;
    if (da < db) {
      da += 10;
      borrow = 1;
    } else {
      borrow = 0;
    }
    out.push(da - db);
  }
  return out.reverse().join("").replace(/^0+(?=\d)/, "") || "0";
}

function fromScaled(digits: string, scale: number, neg: boolean): string {
  let d = digits.replace(/^0+(?=\d)/, "") || "0";
  if (scale === 0) return neg && d !== "0" ? `-${d}` : d;
  if (d.length <= scale) {
    d = d.padStart(scale + 1, "0");
  }
  const i = d.slice(0, d.length - scale);
  const f = d.slice(d.length - scale).replace(/0+$/, "");
  const body = f.length ? `${i}.${f}` : i.replace(/^0+(?=\d)/, "") || "0";
  return neg && body !== "0" ? `-${body}` : body;
}

export function decCompare(a: string, b: string): number {
  const { aNeg, bNeg, aDigits, bDigits } = align(a, b);
  if (aNeg !== bNeg) {
    if (aDigits === "0" && bDigits === "0") return 0;
    return aNeg ? -1 : 1;
  }
  const c = cmpAbs(aDigits, bDigits);
  return aNeg ? -c : c;
}

export function decAdd(a: string, b: string): string {
  const { aNeg, bNeg, aDigits, bDigits, scale } = align(a, b);
  if (aNeg === bNeg) {
    return fromScaled(addAbs(aDigits, bDigits), scale, aNeg);
  }
  const cmp = cmpAbs(aDigits, bDigits);
  if (cmp === 0) return "0";
  if (cmp > 0) return fromScaled(subAbs(aDigits, bDigits), scale, aNeg);
  return fromScaled(subAbs(bDigits, aDigits), scale, bNeg);
}

export function decSub(a: string, b: string): string {
  const B = canonicalize(b);
  const flipped = B.startsWith("-") ? B.slice(1) : B === "0" ? "0" : `-${B}`;
  return decAdd(a, flipped);
}

export function decAbs(a: string): string {
  const c = canonicalize(a);
  return c.startsWith("-") ? c.slice(1) : c;
}

export function decNeg(a: string): string {
  const c = canonicalize(a);
  if (c === "0") return "0";
  return c.startsWith("-") ? c.slice(1) : `-${c}`;
}

export function decMul(a: string, b: string): string {
  const A = toParts(a);
  const B = toParts(b);
  const scale = A.frac.length + B.frac.length;
  const ad = (A.int + A.frac).replace(/^0+(?=\d)/, "") || "0";
  const bd = (B.int + B.frac).replace(/^0+(?=\d)/, "") || "0";
  if (ad === "0" || bd === "0") return "0";

  const result = Array(ad.length + bd.length).fill(0);
  for (let i = ad.length - 1; i >= 0; i--) {
    for (let j = bd.length - 1; j >= 0; j--) {
      const mul =
        (ad.charCodeAt(i) - 48) * (bd.charCodeAt(j) - 48) + result[i + j + 1];
      result[i + j + 1] = mul % 10;
      result[i + j] += Math.floor(mul / 10);
    }
  }
  const digits = result.join("").replace(/^0+(?=\d)/, "") || "0";
  return fromScaled(digits, scale, A.neg !== B.neg);
}

/** Integer division of scaled integers with floor toward -∞ for lot sizing helpers. */
export function decDivFloor(a: string, b: string): string | null {
  if (canonicalize(b) === "0") return null;
  const A = toParts(a);
  const B = toParts(b);
  const scale = Math.max(A.frac.length, B.frac.length);
  const ad =
    (A.int + A.frac.padEnd(scale, "0")).replace(/^0+(?=\d)/, "") || "0";
  const bd =
    (B.int + B.frac.padEnd(scale, "0")).replace(/^0+(?=\d)/, "") || "0";

  // Long division producing integer quotient of scaled values (scale cancels).
  let rem = BigInt(0);
  let quot = "";
  const aBig = BigInt(ad);
  const bBig = BigInt(bd);
  const q = aBig / bBig; // trunc toward 0 for positives
  // We only use positive magnitudes for lot floor; signs handled below.
  quot = q.toString();
  rem = aBig % bBig;
  void rem;

  const neg = A.neg !== B.neg;
  // Floor for negatives: if truncated and remainder, step down.
  if (neg && aBig % bBig !== BigInt(0)) {
    const floored = q + BigInt(1); // more negative magnitude when we apply sign
    return fromScaled(floored.toString(), 0, true);
  }
  return fromScaled(quot, 0, neg && quot !== "0");
}

export function decDiv(a: string, b: string, precision = 12): string | null {
  if (canonicalize(b) === "0") return null;
  const A = toParts(a);
  const B = toParts(b);
  const aScale = A.frac.length;
  const bScale = B.frac.length;
  const ad = (A.int + A.frac).replace(/^0+(?=\d)/, "") || "0";
  const bd = (B.int + B.frac).replace(/^0+(?=\d)/, "") || "0";
  const aBig = BigInt(ad) * 10n ** BigInt(precision + bScale);
  const bBig = BigInt(bd) * 10n ** BigInt(aScale);
  if (bBig === 0n) return null;
  const q = aBig / bBig;
  const neg = A.neg !== B.neg;
  return fromScaled(q.toString(), precision, neg);
}

export function decIsPositive(a: string): boolean {
  return decCompare(a, "0") > 0;
}

export function decIsNonPositive(a: string): boolean {
  return decCompare(a, "0") <= 0;
}

export function decFloorToStep(value: string, step: string): string | null {
  if (!decIsPositive(step)) return null;
  const q = decDivFloor(value, step);
  if (q === null) return null;
  return decMul(q, step);
}

export function decMin(a: string, b: string): string {
  return decCompare(a, b) <= 0 ? canonicalize(a) : canonicalize(b);
}

export function isEmptyInput(raw: string | null | undefined): boolean {
  return raw === null || raw === undefined || raw.trim() === "";
}
