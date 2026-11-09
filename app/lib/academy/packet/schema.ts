/** sfa-submission schema v1 — field names match Echo's Python validator EXACTLY. */

export type PacketStudent = {
  studentId: string;
  alias: string;
};

export type PacketPeriod = {
  fromISO: string;
  toISO: string;
};

export type PacketBuild = {
  commit: string | null;
  builtAt: string | null;
  label: string;
};

export type PacketVersions = {
  assessmentCriteria: number;
  quizBank: string;
  risk: number;
  setup: number;
  macro: number;
  serializer: "sfa-submission-serializer/1";
};

export type PacketQuizItem = {
  itemId: string;
  itemHash: string;
  kind: string;
  displayedOrder: number[] | null;
  answer: { raw: unknown; canonical: unknown };
  touched: boolean;
  clientCorrect: boolean;
  reflection: string | null;
};

export type PacketQuizAttempt = {
  attemptId: string;
  quizId: string;
  mode: "ASSESSED" | "READ_ONLY_PREVIEW";
  assessmentCriteriaVersion: number;
  startedAtISO: string;
  submittedAtISO: string;
  shuffleSeed: string;
  buildCommit: string | null;
  items: PacketQuizItem[];
  client: {
    correct: number;
    total: number;
    score: number;
    numericPass: boolean;
    weakTopics: string[];
  };
};

export type PacketLessonResponse = {
  lessonId: string;
  missionId: string | null;
  text: string;
  rubricSelfChecks: boolean[];
  savedAtISO: string;
};

export type PacketSimRun = {
  runId: string;
  tool: string;
  missionId: string | null;
  atISO: string;
  engineVersion: number;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  status: string;
  issueCodes: string[];
  studentDecision: "FINAL_PLAN" | "EXPLORATION" | "REJECTED_BY_STUDENT";
  note: string | null;
};

export type PacketHardBlockEvent = {
  runId: string;
  tool: string;
  code: string;
  atISO: string;
};

export type PacketJournalEntry = {
  id: string;
  missionId: string | null;
  stage: number;
  hypothesis: string;
  invalidation: string;
  falsification: string;
  counterevidence: string;
  emotions: string;
  nextTask: string;
  riskRunId: string | null;
  updatedAtISO: string;
};

export type PacketWeeklyReflection = {
  text: string;
  emotionBefore: number;
  emotionAfter: number;
};

export type PacketSelfReport = {
  kind: "LESSON_REVIEWED" | "PRACTICAL_COMPLETE";
  refId: string;
  atISO: string;
};

export type PacketIntegrity = {
  algorithm: "SHA-256";
  canonicalization: "sfa-canon-v1";
  digest: string;
  resultCode: string;
};

export type SubmissionPacket = {
  format: "sfa-submission";
  schemaVersion: 1;
  packetId: string;
  packetSeq: number;
  supersedesDigest: string | null;
  student: PacketStudent;
  isoWeek: string;
  period: PacketPeriod;
  generatedAtISO: string;
  timezone: "Europe/Amsterdam";
  locale: "fa" | "en";
  build: PacketBuild;
  versions: PacketVersions;
  quizAttempts: PacketQuizAttempt[];
  lessonResponses: PacketLessonResponse[];
  simulatorRuns: PacketSimRun[];
  hardBlockEvents: PacketHardBlockEvent[];
  journalEntries: PacketJournalEntry[];
  weeklyReflection: PacketWeeklyReflection;
  selfReports: PacketSelfReport[];
  declarations: { syntheticDataOnly: true; aliasOnly: true };
  integrity: PacketIntegrity;
};

export const STUDENT_ID_RE = /^S\d{2,4}$/;
export const ALIAS_RE = /^[A-Za-z][A-Za-z0-9-]{2,23}$/;
export const RESULT_CODE_RE =
  /^SFA1-S\d{2,4}-\d{4}W\d{2}-[0-9a-f]{10}-Q\d+-R\d+-HB\d+$/;

export const SETUP_ENGINE_VERSION = 3;
export const MACRO_ENGINE_VERSION = 2;
export const SERIALIZER_ID = "sfa-submission-serializer/1" as const;
