/** Tolerant reads of old free-text paper plans. New entries use the selects and number inputs. */

export type StopClass = "HARD_STRUCTURAL" | "MENTAL" | "NONE";

export function classifyStop(value: unknown): StopClass {
  const raw = String(value ?? "").trim();
  if (!raw) return "NONE";
  const compact = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (compact === "HARD_STRUCTURAL" || compact === "STRUCTURAL_HARD") return "HARD_STRUCTURAL";
  if (compact === "MENTAL") return "MENTAL";
  if (compact === "NONE") return "NONE";
  const token = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (token.includes("mental")) return "MENTAL";
  if (token.includes("hard") || token.includes("structural")) return "HARD_STRUCTURAL";
  if (token === "none" || token === "nostop" || token === "missing") return "NONE";
  return "NONE";
}

/** First percent figure, otherwise the first number. '1% (100)' is 1. 'about 2.2' is 2.2. */
export function parseLenientDecimal(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/,/g, "");
  if (!text) return null;
  const percent = text.match(/(\d+(?:\.\d+)?)\s*%/);
  const match = percent ?? text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return match[1] ?? null;
}
