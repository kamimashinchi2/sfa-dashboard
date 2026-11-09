/**
 * Proposed pedagogical thresholds — CONFIGURABLE DEFAULTS.
 * Require owner confirmation before production use.
 * Client claims never authorize unlocks; bridge recomputation is authority.
 */

export const THRESHOLDS_REQUIRE_OWNER_CONFIRMATION = true as const;

/** Quiz verdict bands (proposed defaults). */
export const QUIZ_THRESHOLDS = {
  approvedMin: 80,
  partialMin: 60,
  /** < partialMin → NOT_APPROVED */
} as const;

/** Practical verdict bands (proposed defaults). */
export const PRACTICAL_THRESHOLDS = {
  approvedMin: 80,
  partialMin: 65,
  /** < partialMin OR any finalHardBlock → NOT_APPROVED */
} as const;

export type ClaimVerdict =
  | "APPROVED"
  | "PARTIALLY_APPROVED"
  | "NOT_APPROVED";

/** Client-side claim helper only — NEVER authorizes unlock. */
export function claimQuizVerdict(score: number): ClaimVerdict {
  if (score >= QUIZ_THRESHOLDS.approvedMin) return "APPROVED";
  if (score >= QUIZ_THRESHOLDS.partialMin) return "PARTIALLY_APPROVED";
  return "NOT_APPROVED";
}

export function claimPracticalVerdict(
  total0to100: number,
  finalHardBlock: boolean,
): ClaimVerdict {
  if (finalHardBlock) return "NOT_APPROVED";
  if (total0to100 >= PRACTICAL_THRESHOLDS.approvedMin) return "APPROVED";
  if (total0to100 >= PRACTICAL_THRESHOLDS.partialMin)
    return "PARTIALLY_APPROVED";
  return "NOT_APPROVED";
}

export function claimReadiness(
  score: number,
): "READY" | "REMEDIATION" {
  return score >= QUIZ_THRESHOLDS.approvedMin ? "READY" : "REMEDIATION";
}
