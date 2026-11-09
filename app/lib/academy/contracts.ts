/** Canonical exact decimal as string. */
export type Dec = string;

export type MissionId = "M1" | "M2" | "M3" | "M4" | "M5";
export type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Text = { fa: string; en: string };
export type Fact = "YES" | "NO" | "UNKNOWN";
export type Locale = "fa" | "en";

export type Issue = {
  code: string;
  field?: string;
  evidenceIds: string[];
};

export type SetupState =
  | "EARLY_WATCH"
  | "ARMED_LONG"
  | "ARMED_SHORT"
  | "MOMENTUM_ENTRY_ACTIVE"
  | "PENDING_RETRACEMENT"
  | "RETRACEMENT_ENTRY_ACTIVE"
  | "MISSED_OR_EXPIRED"
  | "INCOMPLETE"
  | "INVALIDATED";

export type RiskStatus =
  | "PASS_SIMULATION"
  | "HARD_BLOCK"
  | "UNVERIFIED"
  | "NO_VALID_SIZE";

export type Lesson = {
  id: string;
  missionId: MissionId;
  stages: StageId[];
  title: Text;
  core: Text;
  trap: Text;
  reality: Text;
  question: Text;
  selfReviewRubric: Text[];
};

export type Attempt = {
  id: string;
  missionId: MissionId;
  scenarioVersion: number;
  quizScore: number;
  numericPass: boolean;
  taskComplete: boolean;
  riskStatus: RiskStatus | null;
  readiness: "READY" | "REMEDIATION" | "PENDING_REVIEW";
  weakTopics: string[];
};

export type Progress = {
  version: 1;
  locale: Locale;
  selectedStage: StageId;
  attempts: Attempt[];
  completedLessonIds: string[];
  rewardIds: string[];
  journalDraftIds: string[];
  updatedAtISO: string;
};

export type ContractSpec = {
  id: string;
  tickSize: Dec;
  tickValuePerLot: Dec;
  pnlCurrency: string;
  minLot: Dec;
  maxLot: Dec;
  lotStep: Dec;
  sourceLabel: string;
  verifiedFor: "SYNTHETIC_ONLY";
  model: "LINEAR_TICK";
};

export type RiskInput = {
  spec: ContractSpec | null;
  equity: Dec | null;
  accountCurrency: string;
  conversion: Dec | null;
  conversionUnits: "ACCOUNT_PER_PNL";
  direction: "LONG" | "SHORT";
  entry: Dec | null;
  stop: Dec | null;
  target: Dec | null;
  stopType: "HARD_STRUCTURAL" | "MENTAL" | "NONE";
  structuralEvidenceIds: string[];
  preEntry: Fact;
  riskPct: Dec | null;
  submittedLots: Dec | null;
  costs: {
    status: "KNOWN" | "UNKNOWN";
    fixedFee: Dec | null;
    feePerLot: Dec | null;
    slippageTicks: Dec | null;
    pricesIncludeSpread: Fact;
  };
};

export type RiskResult = {
  status: RiskStatus;
  issues: Issue[];
  budget: Dec | null;
  maxLots: Dec | null;
  loss: Dec | null;
  grossRR: Dec | null;
  netRR: Dec | null;
  educationalOnly: true;
};

export const PROGRESS_STORAGE_KEY = "sfa.progress.v1";
export const MAX_RISK_PCT = "1";
export const MIN_NET_RR = "2";

export const SYNTHETIC_GOLD_SPEC: ContractSpec = {
  id: "SYNTHETIC_XAUUSD_100OZ",
  tickSize: "0.01",
  tickValuePerLot: "1",
  pnlCurrency: "USD",
  minLot: "0.01",
  maxLot: "100",
  lotStep: "0.01",
  sourceLabel: "Synthetic Academy Gold (100 oz/lot)",
  verifiedFor: "SYNTHETIC_ONLY",
  model: "LINEAR_TICK",
};

export const SYNTHETIC_FOREX_EURUSD_SPEC: ContractSpec = {
  id: "SYNTHETIC_EURUSD_STANDARD",
  tickSize: "0.00001",
  tickValuePerLot: "1",
  pnlCurrency: "USD",
  minLot: "0.01",
  maxLot: "100",
  lotStep: "0.01",
  sourceLabel: "Synthetic Academy EURUSD (educational)",
  verifiedFor: "SYNTHETIC_ONLY",
  model: "LINEAR_TICK",
};
