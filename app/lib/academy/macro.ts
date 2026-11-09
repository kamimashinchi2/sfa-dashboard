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
};

export type MacroAnswer = {
  edges: MacroEdge[];
  assumptions: string[];
  conclusions: string[];
};

export type MacroScore = {
  status: "SCORED" | "PENDING_REVIEW";
  score: number | null;
  bestAlternativeId: string | null;
  notes: string[];
};

export type MacroAlternative = {
  id: string;
  edges: MacroEdge[];
  assumptions: string[];
  conclusions: string[];
};

function edgeKey(e: MacroEdge): string {
  return `${e.from}>${e.to}:${e.condition}`;
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

/**
 * Score student macro graph against independent alternatives.
 * 50% edges/conditions, 25% assumptions, 25% conclusions.
 * Never combine incompatible alternatives. Invalid keys → PENDING_REVIEW.
 */
export function scoreMacroGraph(
  student: MacroAnswer,
  alternatives: MacroAlternative[],
): MacroScore {
  if (!alternatives.length) {
    return {
      status: "PENDING_REVIEW",
      score: null,
      bestAlternativeId: null,
      notes: ["EMPTY_ANSWER_KEY"],
    };
  }

  for (const alt of alternatives) {
    if (!alt.id || !Array.isArray(alt.edges)) {
      return {
        status: "PENDING_REVIEW",
        score: null,
        bestAlternativeId: null,
        notes: ["INVALID_ANSWER_KEY"],
      };
    }
  }

  const studentEdges = new Set(dedupeEdges(student.edges).map(edgeKey));
  const studentAssumptions = normalizeSet(student.assumptions);
  const studentConclusions = normalizeSet(student.conclusions);

  let best = -1;
  let bestId: string | null = null;
  const notes: string[] = [];

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
    }
  }

  return {
    status: "SCORED",
    score: Math.round(best * 100),
    bestAlternativeId: bestId,
    notes,
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
