import type {
  AdvancedId,
  Dec,
  Locale,
  MissionId,
  RiskInput,
  RiskResult,
  RiskStatus,
  StageId,
} from "./contracts";

export type JournalV2 = {
  schemaVersion: 2;
  parentV1Id: string | null;
  id: string;
  alias: string;
  locale: Locale;
  stage: StageId;
  advancedModule: AdvancedId | null;
  missionId: MissionId | null;
  attemptId: string;
  scenarioId: string;
  scenarioVersion: number;
  keyVersion: number;
  mode: "SYNTHETIC" | "VERIFIED_HISTORICAL";
  createdAtISO: string | null;
  updatedAtISO: string;
  hypothesis: string;
  release: string;
  prices: Record<string, Dec | null>;
  evidence: string[];
  attachments: { name: string; note: string }[];
  engineInputs: RiskInput | null;
  engineResults: RiskResult | null;
  engineVersions: { risk: number; setup: number; macro: number };
  reflections: string;
  reviewerAnnotations: string;
  readiness:
    | "INCOMPLETE"
    | "READY_FOR_REVIEW"
    | "OWNER_REVIEW_REQUIRED"
    | "PENDING";
  riskStatus: RiskStatus | null;
  warnings: string[];
  blocked: boolean;
  falsification: string;
  trainTestSplit: string;
  invalidation: string;
  emotions: string;
  counterevidence: string;
  nextTask: string;
};

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_STRING = 10_000;
const MAX_ATTACHMENTS = 20;

function bound(s: string): string {
  return escapeMd(String(s)).slice(0, MAX_STRING);
}

function escapeMd(s: string): string {
  return s
    .replace(/[<>]/g, "")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1 ($2)");
}

/** CSV RFC4180 + formula-injection protection. */
export function csvCell(raw: string, numeric?: boolean): string {
  if (numeric) {
    const n = String(raw).trim();
    if (/^-?\d+(\.\d+)?$/.test(n)) return n;
  }
  let s = String(raw);
  // Protect formula injection: whitespace/control then = + - @
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function createEmptyJournalV2(partial: {
  id: string;
  alias: string;
  locale: Locale;
  stage: StageId;
  missionId: MissionId | null;
  advancedModule: AdvancedId | null;
  attemptId: string;
  scenarioId: string;
  scenarioVersion: number;
  updatedAtISO: string;
  parentV1Id?: string | null;
}): JournalV2 {
  return {
    schemaVersion: 2,
    parentV1Id: partial.parentV1Id ?? null,
    id: partial.id,
    alias: partial.alias,
    locale: partial.locale,
    stage: partial.stage,
    advancedModule: partial.advancedModule,
    missionId: partial.missionId,
    attemptId: partial.attemptId,
    scenarioId: partial.scenarioId,
    scenarioVersion: partial.scenarioVersion,
    keyVersion: 1,
    mode: "SYNTHETIC",
    createdAtISO: null,
    updatedAtISO: partial.updatedAtISO,
    hypothesis: "",
    release: "",
    prices: {},
    evidence: [],
    attachments: [],
    engineInputs: null,
    engineResults: null,
    engineVersions: { risk: 1, setup: 1, macro: 1 },
    reflections: "",
    reviewerAnnotations: "",
    readiness: "INCOMPLETE",
    riskStatus: null,
    warnings: [],
    blocked: false,
    falsification: "",
    trainTestSplit: "",
    invalidation: "",
    emotions: "",
    counterevidence: "",
    nextTask: "",
  };
}

export function validateJournalV2(raw: unknown): {
  ok: boolean;
  draft: JournalV2 | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, draft: null, errors: ["NOT_OBJECT"] };
  }
  const size = JSON.stringify(raw).length;
  if (size > MAX_JSON_BYTES) {
    return { ok: false, draft: null, errors: ["TOO_LARGE"] };
  }
  const j = raw as Partial<JournalV2>;
  if (j.schemaVersion !== 2) errors.push("BAD_VERSION");
  if (!j.id || typeof j.id !== "string") errors.push("BAD_ID");
  if ("__proto__" in (raw as object) || "constructor" in (raw as object)) {
    // poison key check — still validate fields carefully
    if (Object.prototype.hasOwnProperty.call(raw, "__proto__")) {
      errors.push("POISON_KEY");
    }
  }
  if (errors.length) return { ok: false, draft: null, errors };

  const draft = createEmptyJournalV2({
    id: String(j.id),
    alias: bound(String(j.alias ?? "draft")),
    locale: j.locale === "en" ? "en" : "fa",
    stage: (j.stage as StageId) ?? 1,
    missionId: (j.missionId as MissionId | null) ?? null,
    advancedModule: (j.advancedModule as AdvancedId | null) ?? null,
    attemptId: String(j.attemptId ?? "unknown"),
    scenarioId: String(j.scenarioId ?? "unknown"),
    scenarioVersion: Number(j.scenarioVersion ?? 1),
    updatedAtISO: String(j.updatedAtISO ?? "1970-01-01T00:00:00.000Z"),
    parentV1Id: j.parentV1Id ?? null,
  });

  draft.keyVersion = Number(j.keyVersion ?? 1);
  draft.mode = j.mode === "VERIFIED_HISTORICAL" ? "VERIFIED_HISTORICAL" : "SYNTHETIC";
  draft.createdAtISO = j.createdAtISO ? String(j.createdAtISO) : null;
  draft.hypothesis = bound(String(j.hypothesis ?? ""));
  draft.release = bound(String(j.release ?? ""));
  draft.falsification = bound(String(j.falsification ?? ""));
  draft.trainTestSplit = bound(String(j.trainTestSplit ?? ""));
  draft.invalidation = bound(String(j.invalidation ?? ""));
  draft.emotions = bound(String(j.emotions ?? ""));
  draft.counterevidence = bound(String(j.counterevidence ?? ""));
  draft.nextTask = bound(String(j.nextTask ?? ""));
  draft.reflections = bound(String(j.reflections ?? ""));
  draft.reviewerAnnotations = bound(String(j.reviewerAnnotations ?? ""));
  draft.evidence = Array.isArray(j.evidence)
    ? j.evidence.map(String).slice(0, 100)
    : [];
  draft.attachments = Array.isArray(j.attachments)
    ? j.attachments.slice(0, MAX_ATTACHMENTS).map((a) => ({
        name: bound(String((a as { name?: string }).name ?? "")),
        note: bound(String((a as { note?: string }).note ?? "")),
      }))
    : [];
  draft.engineInputs = (j.engineInputs as RiskInput | null) ?? null;
  // Never trust imported PASS
  if (j.engineResults && (j.engineResults as RiskResult).status === "PASS_SIMULATION") {
    draft.engineResults = null;
    draft.warnings.push("IMPORTED_PASS_DISCARDED_RECOMPUTE_REQUIRED");
    draft.riskStatus = "UNVERIFIED";
  } else {
    draft.engineResults = (j.engineResults as RiskResult | null) ?? null;
    draft.riskStatus = (j.riskStatus as RiskStatus | null) ?? null;
  }
  draft.readiness =
    (j.readiness as JournalV2["readiness"]) ?? "INCOMPLETE";
  draft.blocked = Boolean(j.blocked);
  draft.warnings = [
    ...draft.warnings,
    ...(Array.isArray(j.warnings) ? j.warnings.map(String) : []),
  ];
  if (draft.blocked) {
    draft.warnings.push("BLOCKED_DRAFT_EXPORTABLE");
  }

  const blob = JSON.stringify(draft);
  if (/<\s*script/i.test(blob) || /javascript:/i.test(blob)) {
    return { ok: false, draft: null, errors: ["HTML_PROHIBITED"] };
  }

  return { ok: true, draft, errors: [] };
}

export function exportJournalV2Json(draft: JournalV2): string {
  return JSON.stringify(draft, null, 2);
}

export function exportJournalV2Markdown(draft: JournalV2): string {
  const warn = [
    draft.blocked ? "> WARNING: blocked draft — educational export only." : "",
    ...draft.warnings.map((w) => `> ${w}`),
  ]
    .filter(Boolean)
    .join("\n");
  return `# Journal ${bound(draft.alias)}
${warn}

- schemaVersion: 2
- Mission: ${draft.missionId ?? "—"}
- Advanced: ${draft.advancedModule ?? "null"}
- Stage: ${draft.stage}
- Scenario: ${draft.scenarioId} v${draft.scenarioVersion}
- Mode: ${draft.mode}
- Updated: ${draft.updatedAtISO} (store ISO; display Europe/Amsterdam)
- Readiness: ${draft.readiness}
- Risk: ${draft.riskStatus ?? "null"}

## Hypothesis
${draft.hypothesis}

## Falsification
${draft.falsification}

## Train/Test split
${draft.trainTestSplit}

## Release / prices
${draft.release}

${Object.entries(draft.prices)
  .map(([k, v]) => `- ${k}: ${v ?? "null"}`)
  .join("\n")}

## Invalidation
${draft.invalidation}

## Reflections / emotions / counterevidence
${draft.reflections}

${draft.emotions}

${draft.counterevidence}

## Reviewer annotations
${draft.reviewerAnnotations || "_none_"}

## Next task
${draft.nextTask}
`;
}

export function exportJournalV2Csv(draft: JournalV2): string {
  const header = ["field", "value", "unit", "status"].map((h) => csvCell(h)).join(",");
  const rows: string[][] = [
    ["id", draft.id, "", "ok"],
    ["hypothesis", draft.hypothesis, "text", draft.blocked ? "blocked" : "ok"],
    ["riskStatus", String(draft.riskStatus), "enum", "ok"],
  ];
  for (const [k, v] of Object.entries(draft.prices)) {
    rows.push([`price.${k}`, v ?? "", "Dec", v === null ? "null" : "ok"]);
  }
  for (const e of draft.evidence) {
    rows.push(["evidence", e, "id", "ok"]);
  }
  return [header, ...rows.map((r) => r.map((c, i) => csvCell(c, i === 1 && r[2] === "Dec")).join(","))].join(
    "\n",
  );
}

export function importJournalV2Json(text: string): {
  ok: boolean;
  draft: JournalV2 | null;
  errors: string[];
} {
  try {
    if (text.length > MAX_JSON_BYTES) {
      return { ok: false, draft: null, errors: ["TOO_LARGE"] };
    }
    return validateJournalV2(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, draft: null, errors: ["JSON_PARSE"] };
  }
}
