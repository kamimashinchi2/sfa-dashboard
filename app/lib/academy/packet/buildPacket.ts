import { RISK_ENGINE_VERSION } from "../contracts";
import { APP_RELEASE_LABEL, resolveBuildStamp } from "../buildStamp";
import { ASSESSMENT_CRITERIA_VERSION } from "../quizzes";
import type { JournalV2 } from "../journalV2";
import type {
  LessonResponseRecord,
  PrefsStore,
  QuizAttemptRecord,
  SelfReportRecord,
  SimRunRecord,
} from "../persist/types";
import { digestPacket } from "./digest";
import { buildResultCode } from "./resultCode";
import {
  ALIAS_RE,
  MACRO_ENGINE_VERSION,
  SERIALIZER_ID,
  SETUP_ENGINE_VERSION,
  STUDENT_ID_RE,
  type PacketHardBlockEvent,
  type PacketJournalEntry,
  type PacketWeeklyReflection,
  type SubmissionPacket,
} from "./schema";
import { inPeriod, periodForIsoWeek } from "./week";

export type PacketDomains = {
  quizAttempts: QuizAttemptRecord[];
  lessonResponses: LessonResponseRecord[];
  simulatorRuns: SimRunRecord[];
  journalEntries: JournalV2[];
  selfReports: SelfReportRecord[];
  prefs: PrefsStore;
};

export type BuildPacketInput = {
  domains: PacketDomains;
  isoWeek: string;
  locale: "fa" | "en";
  weeklyReflection: PacketWeeklyReflection;
  quizBankHash: string;
  /** Include filters — excluded ids are omitted. */
  include?: {
    quizAttemptIds?: Set<string> | string[];
    lessonResponseIds?: Set<string> | string[];
    simRunIds?: Set<string> | string[];
    journalIds?: Set<string> | string[];
  };
  packetSeq?: number;
  supersedesDigest?: string | null;
  generatedAtISO?: string;
  build?: ReturnType<typeof resolveBuildStamp>;
};

function asSet(v?: Set<string> | string[]): Set<string> | null {
  if (!v) return null;
  return v instanceof Set ? v : new Set(v);
}

function deriveHardBlocks(runs: SimRunRecord[]): PacketHardBlockEvent[] {
  return runs
    .filter((r) => r.status === "HARD_BLOCK")
    .map((r) => ({
      runId: r.runId,
      tool: r.tool,
      code: r.issueCodes.find((c) => /HARD_BLOCK|MENTAL_STOP|NO_STOP|PRE_ENTRY_NO|RISK_PCT/.test(c))
        ?? r.issueCodes[0]
        ?? "HARD_BLOCK",
      atISO: r.atISO,
    }));
}

function mapJournal(j: JournalV2): PacketJournalEntry {
  return {
    id: j.id,
    missionId: j.missionId,
    stage: j.stage,
    hypothesis: j.hypothesis,
    invalidation: j.invalidation,
    falsification: j.falsification,
    counterevidence: j.counterevidence,
    emotions: j.emotions,
    nextTask: j.nextTask,
    riskRunId: null,
    updatedAtISO: j.updatedAtISO,
  };
}

export async function buildPacket(
  input: BuildPacketInput,
): Promise<SubmissionPacket> {
  const studentId = input.domains.prefs.studentId ?? "";
  const alias = input.domains.prefs.alias ?? "";
  if (!STUDENT_ID_RE.test(studentId)) {
    throw new Error("BAD_STUDENT_ID");
  }
  if (!ALIAS_RE.test(alias)) {
    throw new Error("BAD_ALIAS");
  }

  const period = periodForIsoWeek(input.isoWeek);
  const quizInclude = asSet(input.include?.quizAttemptIds);
  const lessonInclude = asSet(input.include?.lessonResponseIds);
  const simInclude = asSet(input.include?.simRunIds);
  const journalInclude = asSet(input.include?.journalIds);

  const quizAttempts = input.domains.quizAttempts
    .filter((a) => inPeriod(a.submittedAtISO, period))
    .filter((a) => !quizInclude || quizInclude.has(a.attemptId))
    .map((a) => ({
      attemptId: a.attemptId,
      quizId: a.quizId,
      mode: a.mode,
      assessmentCriteriaVersion: a.assessmentCriteriaVersion,
      startedAtISO: a.startedAtISO,
      submittedAtISO: a.submittedAtISO,
      shuffleSeed: a.shuffleSeed,
      buildCommit: a.buildCommit,
      items: a.items.map((it) => ({
        itemId: it.itemId,
        itemHash: it.itemHash,
        kind: it.kind,
        displayedOrder: it.displayedOrder,
        answer: it.answer,
        touched: it.touched,
        clientCorrect: it.clientCorrect,
        reflection: it.reflection,
      })),
      client: { ...a.client, weakTopics: [...new Set(a.client.weakTopics)] },
    }));

  const lessonResponses = input.domains.lessonResponses
    .filter((r) => inPeriod(r.savedAtISO, period))
    .filter((r) => !lessonInclude || lessonInclude.has(r.id))
    .map((r) => ({
      lessonId: r.lessonId,
      missionId: r.missionId,
      text: r.text,
      rubricSelfChecks: r.rubricSelfChecks,
      savedAtISO: r.savedAtISO,
    }));

  const simulatorRuns = input.domains.simulatorRuns
    .filter((r) => inPeriod(r.atISO, period))
    .filter((r) => !simInclude || simInclude.has(r.runId))
    .map((r) => ({
      runId: r.runId,
      tool: r.tool,
      missionId: r.missionId,
      atISO: r.atISO,
      engineVersion: r.engineVersion,
      inputs: r.inputs,
      outputs: r.outputs,
      status: r.status,
      issueCodes: r.issueCodes,
      studentDecision: r.studentDecision,
      note: r.note,
    }));

  const journalEntries = input.domains.journalEntries
    .filter((j) => inPeriod(j.updatedAtISO, period))
    .filter((j) => !journalInclude || journalInclude.has(j.id))
    .map(mapJournal);

  const selfReports = input.domains.selfReports.filter((r) =>
    inPeriod(r.atISO, period),
  );

  const hardBlockEvents = deriveHardBlocks(simulatorRuns);
  const stamp = input.build ?? resolveBuildStamp();
  const generatedAtISO = input.generatedAtISO ?? new Date().toISOString();
  const packetSeq = input.packetSeq ?? 1;
  const packetId = `pkt_${studentId}_${input.isoWeek}_${String(packetSeq).padStart(2, "0")}`;

  const withoutIntegrity: Omit<SubmissionPacket, "integrity"> = {
    format: "sfa-submission",
    schemaVersion: 1,
    packetId,
    packetSeq,
    supersedesDigest: input.supersedesDigest ?? null,
    student: { studentId, alias },
    isoWeek: input.isoWeek,
    period,
    generatedAtISO,
    timezone: "Europe/Amsterdam",
    locale: input.locale,
    build: {
      commit: stamp.commit,
      builtAt: stamp.builtAt,
      label: stamp.label || APP_RELEASE_LABEL,
    },
    versions: {
      assessmentCriteria: ASSESSMENT_CRITERIA_VERSION,
      quizBank: input.quizBankHash,
      risk: RISK_ENGINE_VERSION,
      setup: SETUP_ENGINE_VERSION,
      macro: MACRO_ENGINE_VERSION,
      serializer: SERIALIZER_ID,
    },
    quizAttempts,
    lessonResponses,
    simulatorRuns,
    hardBlockEvents,
    journalEntries,
    weeklyReflection: input.weeklyReflection,
    selfReports: selfReports.map((r) => ({
      kind: r.kind,
      refId: r.refId,
      atISO: r.atISO,
    })),
    declarations: { syntheticDataOnly: true, aliasOnly: true },
  };

  const digest = await digestPacket(withoutIntegrity);
  const resultCode = buildResultCode({
    studentId,
    isoWeek: input.isoWeek,
    digest,
    quizAttempts: quizAttempts.length,
    simulatorRuns: simulatorRuns.length,
    hardBlockEvents: hardBlockEvents.length,
  });

  return {
    ...withoutIntegrity,
    integrity: {
      algorithm: "SHA-256",
      canonicalization: "sfa-canon-v1",
      digest,
      resultCode,
    },
  };
}
