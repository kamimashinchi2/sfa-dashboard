import type { Attempt, RiskStatus } from "./contracts";
import type { QuizItem } from "./curriculum";

export type QuizAnswer = string | number | number[];

export function scoreQuiz(
  items: QuizItem[],
  answers: Record<string, QuizAnswer>,
): {
  score: number;
  correct: number;
  total: number;
  weakTopics: string[];
  perItem: { id: string; pass: boolean; remediationTopic: string }[];
} {
  let correct = 0;
  const weakTopics: string[] = [];
  const perItem: { id: string; pass: boolean; remediationTopic: string }[] = [];

  for (const item of items) {
    const given = answers[item.id];
    let pass = false;
    if (item.kind === "mc" && typeof given === "number") {
      pass = given === item.answer;
    } else if (item.kind === "numeric") {
      pass = String(given).trim() === String(item.answer).trim();
    } else if (item.kind === "order" && Array.isArray(given) && Array.isArray(item.answer)) {
      pass =
        given.length === item.answer.length &&
        given.every((v, i) => v === (item.answer as number[])[i]);
    }
    if (pass) correct++;
    else weakTopics.push(item.remediationTopic);
    perItem.push({
      id: item.id,
      pass,
      remediationTopic: item.remediationTopic,
    });
  }

  const total = items.length || 1;
  const score = Math.round((correct / total) * 100);
  return { score, correct, total, weakTopics: [...new Set(weakTopics)], perItem };
}

/**
 * Practice unlock: score >= 80, tasks complete, no unresolved practical risk hold.
 * Passing score + HARD_BLOCK retains numeric pass but holds readiness.
 */
export function evaluateReadiness(input: {
  quizScore: number;
  taskComplete: boolean;
  riskStatus: RiskStatus | null;
  freeTextSubmitted: boolean;
}): Pick<Attempt, "numericPass" | "readiness" | "riskStatus"> & {
  ownerReviewRequired: boolean;
} {
  const numericPass = input.quizScore >= 80;
  const riskHold =
    input.riskStatus === "HARD_BLOCK" ||
    input.riskStatus === "UNVERIFIED" ||
    input.riskStatus === "NO_VALID_SIZE";

  if (!input.taskComplete || !input.freeTextSubmitted) {
    return {
      numericPass,
      riskStatus: input.riskStatus,
      readiness: "REMEDIATION",
      ownerReviewRequired: false,
    };
  }

  if (numericPass && input.riskStatus === "HARD_BLOCK") {
    return {
      numericPass: true,
      riskStatus: input.riskStatus,
      readiness: "PENDING_REVIEW",
      ownerReviewRequired: true,
    };
  }

  if (numericPass && !riskHold && input.riskStatus === "PASS_SIMULATION") {
    return {
      numericPass: true,
      riskStatus: input.riskStatus,
      readiness: "READY",
      ownerReviewRequired: false,
    };
  }

  if (numericPass && input.riskStatus === null) {
    // Missions without practical risk still need pending mentor for free text
    return {
      numericPass: true,
      riskStatus: null,
      readiness: "PENDING_REVIEW",
      ownerReviewRequired: false,
    };
  }

  if (input.riskStatus === "UNVERIFIED") {
    return {
      numericPass,
      riskStatus: input.riskStatus,
      readiness: "PENDING_REVIEW",
      ownerReviewRequired: false,
    };
  }

  return {
    numericPass,
    riskStatus: input.riskStatus,
    readiness: numericPass ? "PENDING_REVIEW" : "REMEDIATION",
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
