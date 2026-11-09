import type { Attempt, RiskStatus } from "./contracts";
import type { QuizItem } from "./curriculum";
import { canonicalize, decCompare, normalizeNumericText } from "./decimal";

export type QuizAnswer = string | number | number[] | null | undefined;

export type PerItemResult = {
  id: string;
  pass: boolean;
  unanswered: boolean;
  skipped: boolean;
  remediationTopic: string;
  kind: QuizItem["kind"];
};

/**
 * Normalize numeric quiz answers: FA/Arabic digits, Arabic decimal separator,
 * thousands separators and whitespace, then compare via decimal equality.
 * "۱۰۰" = "100" = "100.00"
 */
export function normalizeQuizNumeric(raw: string): string | null {
  let s = normalizeNumericText(String(raw));
  // Strip whitespace and common thousands separators after digit map
  s = s.replace(/[\s\u00a0]/g, "").replace(/,/g, "").replace(/٬/g, "");
  if (s === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return canonicalize(s);
}

export function numericAnswersEqual(
  given: string,
  expected: string | number,
): boolean {
  const a = normalizeQuizNumeric(given);
  const b = normalizeQuizNumeric(String(expected));
  if (a === null || b === null) return false;
  return decCompare(a, b) === 0;
}

export function scoreQuiz(
  items: QuizItem[],
  answers: Record<string, QuizAnswer>,
  opts?: {
    /** Item ids the student explicitly marked skipped. */
    skippedIds?: Set<string> | string[];
    /** Item ids the student interacted with (order/mc/numeric). Untouched order = unanswered. */
    touchedIds?: Set<string> | string[];
  },
): {
  score: number;
  correct: number;
  total: number;
  weakTopics: string[];
  perItem: PerItemResult[];
  allAnswered: boolean;
} {
  const skipped = new Set(
    opts?.skippedIds
      ? Array.isArray(opts.skippedIds)
        ? opts.skippedIds
        : [...opts.skippedIds]
      : [],
  );
  const touched = new Set(
    opts?.touchedIds
      ? Array.isArray(opts.touchedIds)
        ? opts.touchedIds
        : [...opts.touchedIds]
      : Object.keys(answers),
  );

  let correct = 0;
  const weakTopics: string[] = [];
  const perItem: PerItemResult[] = [];
  let allAnswered = true;

  for (const item of items) {
    const isSkipped = skipped.has(item.id);
    const given = answers[item.id];
    let pass = false;
    let unanswered = false;

    if (isSkipped) {
      unanswered = false;
      pass = false;
      allAnswered = true; // skipped counts as answered for gate
    } else if (item.kind === "order") {
      // Untouched order item is UNANSWERED (scores 0)
      if (!touched.has(item.id) || given === undefined || given === null) {
        unanswered = true;
        pass = false;
        allAnswered = false;
      } else if (Array.isArray(given) && Array.isArray(item.answer)) {
        pass =
          given.length === item.answer.length &&
          given.every((v, i) => v === (item.answer as number[])[i]);
      }
    } else if (item.kind === "mc") {
      if (typeof given !== "number") {
        unanswered = true;
        allAnswered = false;
      } else {
        pass = given === item.answer;
      }
    } else if (item.kind === "numeric") {
      if (given === undefined || given === null || String(given).trim() === "") {
        unanswered = true;
        allAnswered = false;
      } else {
        pass = numericAnswersEqual(String(given), item.answer as string | number);
      }
    }

    if (pass) correct++;
    else weakTopics.push(item.remediationTopic);

    perItem.push({
      id: item.id,
      pass,
      unanswered,
      skipped: isSkipped,
      remediationTopic: item.remediationTopic,
      kind: item.kind,
    });
  }

  const total = items.length || 1;
  const score = Math.round((correct / total) * 100);
  return {
    score,
    correct,
    total,
    weakTopics: [...new Set(weakTopics)],
    perItem,
    allAnswered,
  };
}

/**
 * Practice unlock: score >= 80, tasks complete, no unresolved practical risk hold.
 * Passing score + HARD_BLOCK retains numeric pass but holds readiness.
 * A null risk result for a non-risk task is not failure.
 * MENTOR_PENDING / PENDING_REVIEW are distinct from REMEDIATION.
 */
export function evaluateReadiness(input: {
  quizScore: number;
  taskComplete: boolean;
  riskStatus: RiskStatus | null;
  freeTextSubmitted: boolean;
  missionRequiresRisk?: boolean;
}): Pick<Attempt, "numericPass" | "readiness" | "riskStatus"> & {
  ownerReviewRequired: boolean;
} {
  const numericPass = input.quizScore >= 80;
  const requiresRisk = input.missionRequiresRisk === true;
  const riskHold =
    requiresRisk &&
    (input.riskStatus === "HARD_BLOCK" ||
      input.riskStatus === "UNVERIFIED" ||
      input.riskStatus === "NO_VALID_SIZE");

  if (!numericPass) {
    return {
      numericPass: false,
      riskStatus: input.riskStatus,
      readiness: "REMEDIATION",
      ownerReviewRequired: false,
    };
  }

  if (!input.taskComplete || !input.freeTextSubmitted) {
    return {
      numericPass,
      riskStatus: input.riskStatus,
      readiness: "REMEDIATION",
      ownerReviewRequired: false,
    };
  }

  if (requiresRisk && input.riskStatus === "HARD_BLOCK") {
    return {
      numericPass: true,
      riskStatus: input.riskStatus,
      readiness: "PENDING_REVIEW",
      ownerReviewRequired: true,
    };
  }

  if (
    requiresRisk &&
    !riskHold &&
    input.riskStatus === "PASS_SIMULATION"
  ) {
    return {
      numericPass: true,
      riskStatus: input.riskStatus,
      readiness: "MENTOR_PENDING",
      ownerReviewRequired: false,
    };
  }

  if (!requiresRisk && input.riskStatus === null) {
    return {
      numericPass: true,
      riskStatus: null,
      readiness: "MENTOR_PENDING",
      ownerReviewRequired: false,
    };
  }

  if (requiresRisk && input.riskStatus === "UNVERIFIED") {
    return {
      numericPass,
      riskStatus: input.riskStatus,
      readiness: "PENDING_REVIEW",
      ownerReviewRequired: false,
    };
  }

  if (requiresRisk && input.riskStatus === null) {
    return {
      numericPass: false,
      riskStatus: null,
      readiness: "REMEDIATION",
      ownerReviewRequired: false,
    };
  }

  return {
    numericPass,
    riskStatus: input.riskStatus,
    readiness: "MENTOR_PENDING",
    ownerReviewRequired: false,
  };
}

/** PerformanceCard pillars 40/40/20 — never auto-invent psychology. */
export function performanceCard(input: {
  riskScore: number | null;
  technicalMacroScore: number | null;
  journalingScore: number | null;
  riskStatus: RiskStatus | null;
}): {
  total: number | null;
  pillars: { risk: number | null; technicalMacro: number | null; journaling: number | null };
  advancement: "NUMERIC_OK" | "OWNER_REVIEW_REQUIRED" | "INCOMPLETE";
} {
  const { riskScore, technicalMacroScore, journalingScore, riskStatus } = input;
  if (
    riskScore === null ||
    technicalMacroScore === null ||
    journalingScore === null
  ) {
    return {
      total: null,
      pillars: {
        risk: riskScore,
        technicalMacro: technicalMacroScore,
        journaling: journalingScore,
      },
      advancement: "INCOMPLETE",
    };
  }
  const total = Math.round(
    0.4 * riskScore + 0.4 * technicalMacroScore + 0.2 * journalingScore,
  );
  if (total >= 80 && riskStatus === "HARD_BLOCK") {
    return {
      total,
      pillars: {
        risk: riskScore,
        technicalMacro: technicalMacroScore,
        journaling: journalingScore,
      },
      advancement: "OWNER_REVIEW_REQUIRED",
    };
  }
  if (total >= 80) {
    return {
      total,
      pillars: {
        risk: riskScore,
        technicalMacro: technicalMacroScore,
        journaling: journalingScore,
      },
      advancement: "NUMERIC_OK",
    };
  }
  return {
    total,
    pillars: {
      risk: riskScore,
      technicalMacro: technicalMacroScore,
      journaling: journalingScore,
    },
    advancement: "INCOMPLETE",
  };
}

/** Compact ISO for attempt ids: 20261109T134155Z → 20261109T134155Z (no ms/punct extras). */
export function compactIso(d = new Date()): string {
  return d
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "");
}

export function makeAttemptNonce4(): string {
  const n = Math.floor(Math.random() * 0x10000);
  return n.toString(16).padStart(4, "0");
}

/** `${quizId}-v${criteria}-${submittedISO compact}-${nonce4}` */
export function makeQuizAttemptId(input: {
  quizId: string;
  criteria: number;
  submittedAt?: Date;
  nonce?: string;
}): string {
  const compact = compactIso(input.submittedAt ?? new Date());
  const nonce = input.nonce ?? makeAttemptNonce4();
  return `${input.quizId}-v${input.criteria}-${compact}-${nonce}`;
}
