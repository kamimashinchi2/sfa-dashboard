/** Canonical exact decimal as string. */
export type Dec = string;
export type ISO = string;

export type MissionId = "M1" | "M2" | "M3" | "M4" | "M5";
export type AdvancedId = "A6" | "A7" | "A8";
export type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Text = { fa: string; en: string };
export type Fact = "YES" | "NO" | "UNKNOWN";
export type Locale = "fa" | "en";
export type Mode = "SYNTHETIC" | "VERIFIED_HISTORICAL";

export type Issue = {
  code: string;
  field?: string;
  evidenceIds: string[];
};

/** Canonical setup states — never ENTRY/BUY/SELL/ACTIVE-as-permission. */
export type SetupState =
  | "EARLY_WATCH"
  | "ARMED_LONG"
  | "ARMED_SHORT"
  | "SETUP_CONFIRMED_MOMENTUM_STATE"
  | "PENDING_RETRACEMENT"
  | "SETUP_CONFIRMED_RETRACEMENT_STATE"
  | "SETUP_EXPIRED_OR_CHASE_ZONE"
  | "INCOMPLETE"
  | "INVALIDATED";

/** Legacy labels from Iteration 1–2 exports / saved attempts. */
export type LegacySetupState =
  | "MOMENTUM_ENTRY_ACTIVE"
  | "RETRACEMENT_ENTRY_ACTIVE"
  | "MISSED_OR_EXPIRED";

export const SETUP_STATE_ALIASES: Record<LegacySetupState, SetupState> = {
  MOMENTUM_ENTRY_ACTIVE: "SETUP_CONFIRMED_MOMENTUM_STATE",
  RETRACEMENT_ENTRY_ACTIVE: "SETUP_CONFIRMED_RETRACEMENT_STATE",
  MISSED_OR_EXPIRED: "SETUP_EXPIRED_OR_CHASE_ZONE",
};

export function migrateSetupState(raw: string): SetupState | string {
  if (raw in SETUP_STATE_ALIASES) {
    return SETUP_STATE_ALIASES[raw as LegacySetupState];
  }
  return raw;
}

export type RiskStatus =
  | "PASS_SIMULATION"
  | "HARD_BLOCK"
  | "UNVERIFIED"
  | "NO_VALID_SIZE";

export type StopType = "HARD_STRUCTURAL" | "MENTAL" | "NONE";

export type InstrumentPresetId =
  | "SYNTHETIC_EURUSD"
  | "SYNTHETIC_USDJPY"
  | "SYNTHETIC_XAUUSD"
  | "CUSTOM";

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
  missionId: MissionId | AdvancedId;
  scenarioVersion: number;
  quizScore: number;
  numericPass: boolean;
  taskComplete: boolean;
  riskStatus: RiskStatus | null;
  readiness: "READY" | "REMEDIATION" | "PENDING_REVIEW" | "MENTOR_PENDING";
  weakTopics: string[];
  /** Assessment bank version; legacy placeholder passes need reassessment. */
  assessmentCriteriaVersion?: number;
  archivedLegacy?: boolean;
  practicalEvidence?: Record<string, unknown> | null;
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
  /** Feature flag: advanced A6–A8 assessed completion until mentor review. */
  advancedAssessedEnabled?: boolean;
};

export type Evidence = {
  id: string;
  mode: Mode;
  observedAt: ISO;
  availableAt: ISO;
  sourceLabel: string;
  locator: string | null;
  verification: "SYNTHETIC" | "VERIFIED" | "UNVERIFIED";
};

/**
 * Contract / instrument specification.
 * pipSize + pipValueQuotePerLot drive lot sizing (preferred).
 * tickSize/tickValuePerLot remain for LINEAR_TICK compatibility (gold).
 */
export type ContractSpec = {
  id: string;
  presetId: InstrumentPresetId;
  tickSize: Dec;
  tickValuePerLot: Dec;
  /** Units per standard lot (e.g. 100000 EURUSD, 100 oz gold). */
  contractSize: Dec;
  /** Pip/tick size used for stop distance in pips. */
  pipSize: Dec;
  /** Pip value per lot in quote (PnL) currency. */
  pipValueQuotePerLot: Dec;
  pnlCurrency: string;
  minLot: Dec;
  maxLot: Dec;
  lotStep: Dec;
  sourceLabel: string;
  verifiedFor: "SYNTHETIC_ONLY";
  model: "LINEAR_TICK" | "LINEAR_PIP";
  /** Shown in UI: Synthetic spec, confirm with your broker. */
  brokerConfirmNotice: string;
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
  stopType: StopType;
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
  stopPips: Dec | null;
  pipValueAccount: Dec | null;
  educationalOnly: true;
};

export type CalcHistoryEntry = {
  id: string;
  atISO: string;
  instrument: string;
  side: "LONG" | "SHORT";
  riskPct: string;
  stopType: StopType;
  status: RiskStatus;
  lots: string | null;
  loss: string | null;
  input: RiskInput;
  result: RiskResult;
  engineVersion: number;
};

export const PROGRESS_STORAGE_KEY = "sfa.progress.v1";
export const MAX_RISK_PCT = "1";
export const MIN_NET_RR = "2";
export const RISK_ENGINE_VERSION = 3;

const BROKER_NOTICE = "Synthetic spec, confirm with your broker.";

export const SYNTHETIC_GOLD_SPEC: ContractSpec = {
  id: "SYNTHETIC_XAUUSD_100OZ",
  presetId: "SYNTHETIC_XAUUSD",
  tickSize: "0.01",
  tickValuePerLot: "1",
  contractSize: "100",
  pipSize: "0.01",
  pipValueQuotePerLot: "1",
  pnlCurrency: "USD",
  minLot: "0.01",
  maxLot: "100",
  lotStep: "0.01",
  sourceLabel: "Synthetic Academy Gold (100 oz/lot)",
  verifiedFor: "SYNTHETIC_ONLY",
  model: "LINEAR_TICK",
  brokerConfirmNotice: BROKER_NOTICE,
};

export const SYNTHETIC_FOREX_EURUSD_SPEC: ContractSpec = {
  id: "SYNTHETIC_EURUSD_STANDARD",
  presetId: "SYNTHETIC_EURUSD",
  tickSize: "0.0001",
  tickValuePerLot: "10",
  contractSize: "100000",
  pipSize: "0.0001",
  pipValueQuotePerLot: "10",
  pnlCurrency: "USD",
  minLot: "0.01",
  maxLot: "100",
  lotStep: "0.01",
  sourceLabel: "Synthetic Academy EURUSD (educational)",
  verifiedFor: "SYNTHETIC_ONLY",
  model: "LINEAR_PIP",
  brokerConfirmNotice: BROKER_NOTICE,
};

export const SYNTHETIC_FOREX_USDJPY_SPEC: ContractSpec = {
  id: "SYNTHETIC_USDJPY_STANDARD",
  presetId: "SYNTHETIC_USDJPY",
  tickSize: "0.01",
  tickValuePerLot: "1000",
  contractSize: "100000",
  pipSize: "0.01",
  pipValueQuotePerLot: "1000",
  pnlCurrency: "JPY",
  minLot: "0.01",
  maxLot: "100",
  lotStep: "0.01",
  sourceLabel: "Synthetic Academy USDJPY (educational)",
  verifiedFor: "SYNTHETIC_ONLY",
  model: "LINEAR_PIP",
  brokerConfirmNotice: BROKER_NOTICE,
};

export const INSTRUMENT_PRESETS: Record<
  Exclude<InstrumentPresetId, "CUSTOM">,
  ContractSpec
> = {
  SYNTHETIC_EURUSD: SYNTHETIC_FOREX_EURUSD_SPEC,
  SYNTHETIC_USDJPY: SYNTHETIC_FOREX_USDJPY_SPEC,
  SYNTHETIC_XAUUSD: SYNTHETIC_GOLD_SPEC,
};

export function customSpec(partial: Partial<ContractSpec> = {}): ContractSpec {
  const pipSize = partial.pipSize ?? partial.tickSize ?? "0.0001";
  const pipValue =
    partial.pipValueQuotePerLot ?? partial.tickValuePerLot ?? "10";
  return {
    id: partial.id ?? "CUSTOM",
    presetId: "CUSTOM",
    tickSize: pipSize,
    tickValuePerLot: pipValue,
    contractSize: partial.contractSize ?? "100000",
    pipSize,
    pipValueQuotePerLot: pipValue,
    pnlCurrency: partial.pnlCurrency ?? "USD",
    minLot: partial.minLot ?? "0.01",
    maxLot: partial.maxLot ?? "100",
    lotStep: partial.lotStep ?? "0.01",
    sourceLabel: partial.sourceLabel ?? "Custom synthetic (educational)",
    verifiedFor: "SYNTHETIC_ONLY",
    model: partial.model ?? "LINEAR_PIP",
    brokerConfirmNotice: partial.brokerConfirmNotice ?? BROKER_NOTICE,
  };
}
