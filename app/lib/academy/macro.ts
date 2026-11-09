export type MacroNodeId =
  | "DATA"
  | "SURPRISE_PRICED_IN"
  | "FED_REPRICING"
  | "US2Y"
  | "US10Y"
  | "TIPS_REAL_YIELDS"
  | "DXY"
  | "VIX"
  | "GOLD"
  | "US30";

export type MacroEdge = {
  from: MacroNodeId;
  to: MacroNodeId;
  condition: string;
  evidenceIds?: string[];
};

export type MacroAnswer = {
  edges: MacroEdge[];
  assumptions: string[];
  conclusions: string[];
  /** When true (answer-key preset load), scoring is demo-only — no assessed credit. */
  fromAnswerKeyPreset?: boolean;
  /**
   * Student performed at least one authored edge or condition action.
   * Unmodified default state must not earn assessed credit.
   */
  studentAuthored?: boolean;
};

export type EdgeFeedback = {
  edge: string;
  status: "MATCHED" | "REJECTED" | "MISSING";
  reason: string;
};

export type MacroScore = {
  status: "SCORED" | "PENDING_REVIEW" | "DEMO_ONLY";
  score: number | null;
  bestAlternativeId: string | null;
  notes: string[];
  edgeFeedback: EdgeFeedback[];
  assessedCredit: boolean;
  macroAsEntry: boolean;
  rewritePrompt: string | null;
};

export type MacroAlternative = {
  id: string;
  edges: MacroEdge[];
  assumptions: string[];
  conclusions: string[];
};

/** Unsupported teaching edges that always get explicit rejection reasons. */
const UNSUPPORTED_DIRECT: Record<string, string> = {
  "GOLD>DATA": "UNSUPPORTED_EDGE:GOLD→DATA — gold bias cannot skip transmission nodes",
  "DATA>GOLD": "UNSUPPORTED_EDGE:DATA→GOLD — missing Surprise/Fed/Yields/DXY conditions",
  "GOLD>US2Y": "UNSUPPORTED_EDGE:GOLD→US2Y — reverse causality not in teaching graph",
  "US30>DATA": "UNSUPPORTED_EDGE:US30→DATA — equity bias is an endpoint, not a data source",
};

const MACRO_AS_ENTRY_ISSUE =
  "MACRO_AS_ENTRY: Macro is CONTEXT_ONLY, it describes pressure and environment, never entry/SL/TP";

const REWRITE_PROMPT_EN =
  "Rewrite as context only: describe pressure, transmission, and uncertainty — never entry, SL, TP, or lot size.";
const REWRITE_PROMPT_FA =
  "فقط زمینه را بازنویسی کنید: فشار، انتقال و عدم‌قطعیت — هرگز ورود، حد ضرر، حد سود یا حجم.";

/**
 * Deterministic MACRO_AS_ENTRY detector for EN and FA conclusions.
 * Triggers on buy/sell/long now/short now/entry/SL/TP/lot/price-level next to those words
 * plus Persian: بخر، بفروش، ورود، حد ضرر، حد سود، تارگت.
 */
export function detectMacroAsEntry(texts: string[]): boolean {
  const joined = texts.join("\n");
  if (!joined.trim()) return false;

  const en =
    /\b(buy|sell|long\s+now|short\s+now|entry|stop[\s-]?loss|\bSL\b|\bTP\b|take[\s-]?profit|target|lot\s*size|\blots?\b)\b/i.test(
      joined,
    );
  // Price-level numbers next to entry/SL/TP words
  const priceNear =
    /\b(entry|sl|tp|stop|target|limit)\b[^.\n]{0,24}\d+(\.\d+)?/i.test(joined) ||
    /\d+(\.\d+)?[^.\n]{0,24}\b(entry|sl|tp|stop|target)\b/i.test(joined);
  const fa =
    /بخر|بفروش|ورود|حد\s*ضرر|حد\s*سود|تارگت|لات/.test(joined);

  return en || priceNear || fa;
}

function edgeKey(e: MacroEdge): string {
  return `${e.from}>${e.to}:${e.condition}`;
}

function pairKey(e: MacroEdge): string {
  return `${e.from}>${e.to}`;
}

function dedupeEdges(edges: MacroEdge[]): MacroEdge[] {
  const seen = new Set<string>();
  const out: MacroEdge[] = [];
  for (const e of edges) {
    const k = edgeKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

function normalizeSet(items: string[]): Set<string> {
  return new Set(items.map((s) => s.trim()).filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function explainEdges(
  student: MacroEdge[],
  best: MacroAlternative | null,
): EdgeFeedback[] {
  const feedback: EdgeFeedback[] = [];
  const bestKeys = new Set((best?.edges ?? []).map(edgeKey));
  const bestPairs = new Set((best?.edges ?? []).map(pairKey));

  for (const e of dedupeEdges(student)) {
    const k = edgeKey(e);
    const p = pairKey(e);
    if (UNSUPPORTED_DIRECT[p]) {
      feedback.push({
        edge: k,
        status: "REJECTED",
        reason: UNSUPPORTED_DIRECT[p],
      });
      continue;
    }
    if (bestKeys.has(k)) {
      feedback.push({
        edge: k,
        status: "MATCHED",
        reason: "EDGE_AND_CONDITION_MATCH",
      });
      continue;
    }
    if (bestPairs.has(p)) {
      feedback.push({
        edge: k,
        status: "REJECTED",
        reason: `CONDITION_MISMATCH: expected a teaching condition on ${p}`,
      });
      continue;
    }
    feedback.push({
      edge: k,
      status: "REJECTED",
      reason: `UNMATCHED_EDGE:${p} — not in best alternative ${best?.id ?? "none"}`,
    });
  }

  if (best) {
    for (const e of best.edges) {
      const k = edgeKey(e);
      if (![...feedback].some((f) => f.edge === k && f.status === "MATCHED")) {
        const studentHas = student.some((s) => edgeKey(s) === k);
        if (!studentHas) {
          feedback.push({
            edge: k,
            status: "MISSING",
            reason: `MISSING_CONDITION:${e.from}→${e.to} requires [${e.condition}]`,
          });
        }
      }
    }
  }

  return feedback;
}

/**
 * Score student macro graph against independent alternatives.
 * 50% edges/conditions, 25% assumptions, 25% conclusions.
 * Never combine incompatible alternatives. Invalid keys → PENDING_REVIEW.
 * Answer-key presets never earn assessed credit.
 * Default/unauthored state: assessedCredit false.
 * MACRO_AS_ENTRY conclusions get zero conclusion credit + explicit issue.
 */
export function scoreMacroGraph(
  student: MacroAnswer,
  alternatives: MacroAlternative[],
): MacroScore {
  const macroAsEntry = detectMacroAsEntry(student.conclusions);
  // Authored = explicit student action (edge/condition), not prefilled text alone
  const authored =
    Boolean(student.studentAuthored) || student.edges.length > 0;

  // Unmodified default / no student action → pending, no credit
  if (!authored && !student.fromAnswerKeyPreset) {
    return {
      status: "PENDING_REVIEW",
      score: null,
      bestAlternativeId: null,
      notes: ["AWAITING_STUDENT_AUTHORED_EDGE_OR_CONDITION"],
      edgeFeedback: [],
      assessedCredit: false,
      macroAsEntry: false,
      rewritePrompt: null,
    };
  }

  if (student.fromAnswerKeyPreset) {
    return {
      status: "DEMO_ONLY",
      score: null,
      bestAlternativeId: null,
      notes: ["ANSWER_KEY_PRESET_NO_ASSESSED_CREDIT"],
      edgeFeedback: [],
      assessedCredit: false,
      macroAsEntry: false,
      rewritePrompt: null,
    };
  }

  if (!alternatives.length) {
    return {
      status: "PENDING_REVIEW",
      score: null,
      bestAlternativeId: null,
      notes: ["EMPTY_ANSWER_KEY"],
      edgeFeedback: [],
      assessedCredit: false,
      macroAsEntry,
      rewritePrompt: macroAsEntry ? REWRITE_PROMPT_EN : null,
    };
  }

  for (const alt of alternatives) {
    if (!alt.id || !Array.isArray(alt.edges)) {
      return {
        status: "PENDING_REVIEW",
        score: null,
        bestAlternativeId: null,
        notes: ["INVALID_ANSWER_KEY"],
        edgeFeedback: [],
        assessedCredit: false,
        macroAsEntry,
        rewritePrompt: macroAsEntry ? REWRITE_PROMPT_EN : null,
      };
    }
  }

  const studentEdgesList = dedupeEdges(student.edges);
  const studentEdges = new Set(studentEdgesList.map(edgeKey));
  const studentAssumptions = normalizeSet(student.assumptions);
  // MACRO_AS_ENTRY → zero credit for conclusions
  const studentConclusions = macroAsEntry
    ? new Set<string>()
    : normalizeSet(student.conclusions);

  let best = -1;
  let bestId: string | null = null;
  let bestAlt: MacroAlternative | null = null;
  const notes: string[] = [];

  if (macroAsEntry) {
    notes.push(MACRO_AS_ENTRY_ISSUE);
  }

  for (const alt of alternatives) {
    const altEdges = new Set(dedupeEdges(alt.edges).map(edgeKey));
    const edgeScore = jaccard(studentEdges, altEdges);
    const assumptionScore = jaccard(
      studentAssumptions,
      normalizeSet(alt.assumptions),
    );
    const conclusionScore = jaccard(
      studentConclusions,
      normalizeSet(alt.conclusions),
    );
    const total =
      0.5 * edgeScore + 0.25 * assumptionScore + 0.25 * conclusionScore;
    notes.push(`${alt.id}:${total.toFixed(4)}`);
    if (total > best) {
      best = total;
      bestId = alt.id;
      bestAlt = alt;
    }
  }

  const edgeFeedback = explainEdges(studentEdgesList, bestAlt);
  for (const fb of edgeFeedback) {
    if (fb.status === "REJECTED" || fb.status === "MISSING") {
      notes.push(fb.reason);
    }
  }

  const hasFa = student.conclusions.some((c) => /[\u0600-\u06FF]/.test(c));

  return {
    status: "SCORED",
    score: Math.round(best * 100),
    bestAlternativeId: bestId,
    notes,
    edgeFeedback,
    assessedCredit: true,
    macroAsEntry,
    rewritePrompt: macroAsEntry
      ? hasFa
        ? REWRITE_PROMPT_FA
        : REWRITE_PROMPT_EN
      : null,
  };
}

/** Synthetic CPI seed — teaching fixture only. */
export const SYNTHETIC_CPI_SEED = {
  label: "SYNTHETIC",
  actualPct: "0.4",
  forecastPct: "0.2",
  previousPct: "0.3",
  revisedPreviousPct: "0.2",
  surprisePp: "0.2",
  windows: {
    "0-5m": { gold: "UP", dxy: "UP", tips: "UNKNOWN" },
    "5-15m": { gold: "MIXED", dxy: "UP", tips: "DOWN" },
    "15-60m": { gold: "DOWN", dxy: "MIXED", tips: "DOWN" },
  },
  notice:
    "Missing Real Yields/DXY evidence cannot prove a gold bias. Macro is CONTEXT_ONLY — never entry/SL/TP.",
} as const;
