import type { MissionId, RiskResult, StageId } from "./contracts";

export type JournalDraft = {
  version: 1;
  id: string;
  alias: string;
  stageId: StageId;
  missionId: MissionId;
  attemptId: string;
  scenarioId: string;
  scenarioVersion: number;
  hypothesis: string;
  falsification: string;
  trainTestSplit: string;
  evidenceRefs: string[];
  missingScreenshots: string[];
  engineInputs: unknown;
  engineResults: RiskResult | null;
  invalidation: string;
  emotions: string;
  counterevidence: string;
  crossAssetRows: { symbol: string; note: string }[];
  nextTask: string;
  updatedAtISO: string;
  blocked: boolean;
  warnings: string[];
};

const MAX_TEXT = 8000;
const MAX_ROWS = 40;

function escapeMd(s: string): string {
  return s.replace(/[<>]/g, "");
}

function bound(s: string): string {
  return escapeMd(s).slice(0, MAX_TEXT);
}

export function createEmptyJournal(partial: {
  id: string;
  alias: string;
  stageId: StageId;
  missionId: MissionId;
  attemptId: string;
  scenarioId: string;
  scenarioVersion: number;
  updatedAtISO: string;
}): JournalDraft {
  return {
    version: 1,
    id: partial.id,
    alias: partial.alias,
    stageId: partial.stageId,
    missionId: partial.missionId,
    attemptId: partial.attemptId,
    scenarioId: partial.scenarioId,
    scenarioVersion: partial.scenarioVersion,
    hypothesis: "",
    falsification: "",
    trainTestSplit: "",
    evidenceRefs: [],
    missingScreenshots: [],
    engineInputs: null,
    engineResults: null,
    invalidation: "",
    emotions: "",
    counterevidence: "",
    crossAssetRows: [],
    nextTask: "",
    updatedAtISO: partial.updatedAtISO,
    blocked: false,
    warnings: [],
  };
}

export function validateJournal(raw: unknown): {
  ok: boolean;
  draft: JournalDraft | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, draft: null, errors: ["NOT_OBJECT"] };
  }
  const j = raw as Partial<JournalDraft>;
  if (j.version !== 1) errors.push("BAD_VERSION");
  if (!j.id || typeof j.id !== "string") errors.push("BAD_ID");
  if (!j.missionId) errors.push("BAD_MISSION");
  if (errors.length) return { ok: false, draft: null, errors };

  const draft: JournalDraft = {
    ...createEmptyJournal({
      id: String(j.id),
      alias: bound(String(j.alias ?? "draft")),
      stageId: (j.stageId as StageId) ?? 1,
      missionId: j.missionId as MissionId,
      attemptId: String(j.attemptId ?? "unknown"),
      scenarioId: String(j.scenarioId ?? "unknown"),
      scenarioVersion: Number(j.scenarioVersion ?? 1),
      updatedAtISO: String(j.updatedAtISO ?? new Date(0).toISOString()),
    }),
    hypothesis: bound(String(j.hypothesis ?? "")),
    falsification: bound(String(j.falsification ?? "")),
    trainTestSplit: bound(String(j.trainTestSplit ?? "")),
    evidenceRefs: Array.isArray(j.evidenceRefs)
      ? j.evidenceRefs.map(String).slice(0, MAX_ROWS)
      : [],
    missingScreenshots: Array.isArray(j.missingScreenshots)
      ? j.missingScreenshots.map(String).slice(0, MAX_ROWS)
      : [],
    engineInputs: j.engineInputs ?? null,
    engineResults: (j.engineResults as RiskResult | null) ?? null,
    invalidation: bound(String(j.invalidation ?? "")),
    emotions: bound(String(j.emotions ?? "")),
    counterevidence: bound(String(j.counterevidence ?? "")),
    crossAssetRows: Array.isArray(j.crossAssetRows)
      ? j.crossAssetRows.slice(0, MAX_ROWS).map((r) => ({
          symbol: bound(String((r as { symbol?: string }).symbol ?? "")),
          note: bound(String((r as { note?: string }).note ?? "")),
        }))
      : [],
    nextTask: bound(String(j.nextTask ?? "")),
    blocked: Boolean(j.blocked),
    warnings: Array.isArray(j.warnings) ? j.warnings.map(String) : [],
  };

  // Prohibit arbitrary HTML
  const blob = JSON.stringify(draft);
  if (/<\s*script/i.test(blob) || /javascript:/i.test(blob)) {
    return { ok: false, draft: null, errors: ["HTML_PROHIBITED"] };
  }

  return { ok: true, draft, errors: [] };
}

export function exportJournalMarkdown(draft: JournalDraft): string {
  const warn = draft.blocked
    ? "\n\n> WARNING: blocked draft — educational export only.\n"
    : "";
  return `# Journal ${draft.alias}${warn}
- Mission: ${draft.missionId}
- Stage: ${draft.stageId}
- Scenario: ${draft.scenarioId} v${draft.scenarioVersion}
- Updated: ${draft.updatedAtISO} (store ISO; display Europe/Amsterdam)

## Hypothesis
${draft.hypothesis}

## Falsification
${draft.falsification}

## Train/Test split
${draft.trainTestSplit}

## Invalidation
${draft.invalidation}

## Emotions / counterevidence
${draft.emotions}

${draft.counterevidence}

## Next task
${draft.nextTask}
`;
}

export function exportJournalJson(draft: JournalDraft): string {
  return JSON.stringify(draft, null, 2);
}

export function importJournalJson(text: string): {
  ok: boolean;
  draft: JournalDraft | null;
  errors: string[];
} {
  try {
    const raw = JSON.parse(text) as unknown;
    return validateJournal(raw);
  } catch {
    return { ok: false, draft: null, errors: ["JSON_PARSE"] };
  }
}
