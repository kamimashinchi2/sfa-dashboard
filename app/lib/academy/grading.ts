import type { Attempt, RiskStatus } from "./contracts";
import type { QuizItem } from "./curriculum";
import { canonicalize, decCompare, decMul, normalizeNumericText, parseDec } from "./decimal";
import {
  claimPracticalVerdict,
  QUIZ_THRESHOLDS,
  type ClaimVerdict,
} from "./thresholds";
import { effectiveRiskRules, type EffectiveRiskRules } from "./academyRules";
import { classifyStop } from "./paperParse";

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
 * Practice unlock: quiz score at the shared approved minimum, tasks complete,
 * no unresolved practical risk hold.
 * A HARD_BLOCK is not an approval path. The quiz number can still be a pass,
 * but readiness stays remediation and nothing unlocks. The only human exception
 * is the server's time-boxed mentor override.
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
  const numericPass = input.quizScore >= QUIZ_THRESHOLDS.approvedMin;
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
      numericPass,
      riskStatus: input.riskStatus,
      readiness: "REMEDIATION",
      ownerReviewRequired: false,
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

/**
 * Practical pillars are already points: risk 0–40, technicalMacro 0–40,
 * journalPsychology 0–20. The total is their sum (0–100), the same rule the
 * Python grader uses. A hard block is NOT_APPROVED and does not unlock,
 * whatever the total is.
 */
export function performanceCard(input: {
  risk: number | null;
  technicalMacro: number | null;
  journalPsychology: number | null;
  hardBlock: boolean;
  routineGatePassed?: boolean | null;
}): {
  total: number | null;
  pillars: {
    risk: number | null;
    technicalMacro: number | null;
    journalPsychology: number | null;
  };
  verdict: ClaimVerdict | null;
  unlockEligible: boolean;
} {
  const risk = pillarPoints(input.risk, 40);
  const technicalMacro = pillarPoints(input.technicalMacro, 40);
  const journalPsychology = pillarPoints(input.journalPsychology, 20);
  const pillars = { risk, technicalMacro, journalPsychology };
  if (risk === null || technicalMacro === null || journalPsychology === null) {
    return { total: null, pillars, verdict: null, unlockEligible: false };
  }
  const total = risk + technicalMacro + journalPsychology;
  const verdict = claimPracticalVerdict(total, input.hardBlock, input.routineGatePassed);
  return {
    total,
    pillars,
    verdict,
    unlockEligible: verdict !== "NOT_APPROVED",
  };
}

function pillarPoints(value: number | null, cap: number): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 0 || value > cap) return null;
  return value;
}

/**
 * Final-plan hard block. Same three rules as Python `risk.hard_block`:
 * mental or missing structural stop, risk above 1% of equity, or net reward
 * below twice the risk. Exact 1% and exact 1:2 are not blocks.
 */
export function practicalHardBlock(
  evidence: {
    currentEquity: string;
    riskAmount: string;
    netReward: string;
    stopType: string;
    /** Absent means the stop-move question was not asked. It is not a violation. */
    stopMoved?: string | null;
  },
  rules: EffectiveRiskRules = effectiveRiskRules(null),
): boolean {
  const stopClass = classifyStop(evidence.stopType);
  if (stopClass === "MENTAL") {
    if (rules.stopBlockMode === "MENTAL_OR_NONE" && rules.mentalStopIsHardBlock) return true;
  } else if (stopClass !== "HARD_STRUCTURAL") {
    if (rules.stopRequirement === "HARD_STRUCTURAL" || rules.stopRequirement === "REGISTERED_STOP") return true;
  }
  if (evidence.stopMoved === "unplanned" && rules.unplannedStopMoveIsHardBlock) return true;
  if (evidence.stopMoved === "planned" && rules.plannedStopMoveAllowed === false) return true;
  const equity = parseDec(evidence.currentEquity);
  const risk = parseDec(evidence.riskAmount);
  const reward = parseDec(evidence.netReward);
  if (!equity.ok || !risk.ok || !reward.ok) {
    throw new Error("RISK_INPUT_UNVERIFIED");
  }
  const maxPct = rules.maxRiskPctPerTrade;
  if (decCompare(decMul(risk.value, "100"), decMul(equity.value, maxPct)) > 0) return true;
  if (
    rules.minRiskPctPerTrade &&
    decCompare(decMul(risk.value, "100"), decMul(equity.value, rules.minRiskPctPerTrade)) < 0
  ) {
    return true;
  }
  if (decCompare(reward.value, decMul(risk.value, rules.minNetRR)) < 0) return true;
  return false;
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
