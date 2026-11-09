import {
  decAdd,
  decCompare,
  decDivFloor,
  decMul,
  decSub,
  parseDec,
} from "./decimal";

export type GridLine = {
  kind: "HTF_MAJOR" | "HTF_MID" | "LTF_MAJOR" | "LTF_MID";
  k: number;
  price: string;
};

export type GridResult =
  | { ok: true; lines: GridLine[]; anchor: string }
  | { ok: false; reason: string };

const HTF_MAJOR = "350";
const HTF_MID = "175";
const LTF_MAJOR = "50";
const LTF_MID = "25";
const MAX_K = 20;

/**
 * Descriptive geometry only — not direction, targets, or signals.
 * HTF major = anchor+k*350; midpoint +175.
 * LTF major = anchor+k*50; midpoint +25.
 * Floor for offsets below anchor; exclude nonpositive prices.
 */
export function buildDescriptiveGrid(anchorRaw: string): GridResult {
  const parsed = parseDec(anchorRaw);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason };
  }
  if (decCompare(parsed.value, "0") <= 0) {
    return { ok: false, reason: "NONPOSITIVE_ANCHOR" };
  }
  const anchor = parsed.value;
  const lines: GridLine[] = [];

  for (let k = -MAX_K; k <= MAX_K; k++) {
    const kStr = String(k);
    const htf = decAdd(anchor, decMul(kStr, HTF_MAJOR));
    if (decCompare(htf, "0") > 0) {
      lines.push({ kind: "HTF_MAJOR", k, price: htf });
      const mid = decAdd(htf, k < 0 ? `-${HTF_MID}` : HTF_MID);
      // midpoint between major k and k+1 toward +∞ from major when k>=0;
      // for k<0 use mathematical floor semantics: major is below anchor.
      const midPrice =
        k >= 0
          ? decAdd(htf, HTF_MID)
          : decAdd(htf, HTF_MID); // between k and k+1: htf(k)+175
      if (decCompare(midPrice, "0") > 0 && k < MAX_K) {
        lines.push({ kind: "HTF_MID", k, price: midPrice });
      }
      void mid;
    }

    const ltf = decAdd(anchor, decMul(kStr, LTF_MAJOR));
    if (decCompare(ltf, "0") > 0) {
      lines.push({ kind: "LTF_MAJOR", k, price: ltf });
      if (k < MAX_K) {
        const midPrice = decAdd(ltf, LTF_MID);
        if (decCompare(midPrice, "0") > 0) {
          lines.push({ kind: "LTF_MID", k, price: midPrice });
        }
      }
    }
  }

  // Deduplicate by kind+price
  const seen = new Set<string>();
  const unique = lines.filter((l) => {
    const key = `${l.kind}:${l.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { ok: true, lines: unique, anchor };
}

/** floor semantics check: offset below anchor uses mathematical floor for k. */
export function gridFloorBelowAnchor(
  anchor: string,
  step: string,
  price: string,
): number {
  const diff = decSub(price, anchor);
  const k = decDivFloor(diff, step);
  return k === null ? NaN : Number(k);
}
