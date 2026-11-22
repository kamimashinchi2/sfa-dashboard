/**
 * Per-level risk bounds. The client module carries numbers only.
 * Situations stay in content/v3/rules.json for the Echo packet.
 */
import type { Text } from "./contracts";
import { V3_RISK_RULES } from "./generated/v3RiskRules";

export type RiskSituation = {
  id: string;
  condition: Text;
  riskPct: string;
  stopRule: Text;
  rrRule: Text;
  citation: string;
};

export type LevelRiskFields = {
  maxRiskPctPerTrade?: string;
  minRiskPctPerTrade?: string;
  stopRequirement?: string;
  mentalStopIsHardBlock?: boolean;
  minNetRR?: string;
  stopBlockMode?: "MENTAL_OR_NONE" | "NO_STOP_ONLY";
  unplannedStopMoveIsHardBlock?: boolean;
  plannedStopMoveAllowed?: boolean;
  dailyLossCapPct?: string | null;
  situations?: RiskSituation[];
  dailyActiveRiskCap?: string;
  weeklyCompliancePause?: string;
};

export type RiskRulesDocument = {
  defaults: {
    maxRiskPctPerTrade: string;
    stopRequirement: string;
    mentalStopIsHardBlock: boolean;
    minNetRR: string;
    stopBlockMode?: "MENTAL_OR_NONE" | "NO_STOP_ONLY";
    unplannedStopMoveIsHardBlock?: boolean;
    plannedStopMoveAllowed?: boolean;
    dailyLossCapPct?: string | null;
  };
  levels: Record<string, LevelRiskFields>;
};

export type EffectiveRiskRules = {
  level: string | null;
  maxRiskPctPerTrade: string;
  minRiskPctPerTrade: string | null;
  stopRequirement: string;
  mentalStopIsHardBlock: boolean;
  minNetRR: string;
  stopBlockMode: "MENTAL_OR_NONE" | "NO_STOP_ONLY";
  unplannedStopMoveIsHardBlock: boolean;
  plannedStopMoveAllowed: boolean;
  dailyLossCapPct: string | null;
  situations: RiskSituation[];
  dailyActiveRiskCap: string | null;
  weeklyCompliancePause: string | null;
};

export const LEVEL_BY_STAGE: Record<number, string> = {
  0: "L00",
  1: "L01",
  2: "L02",
  3: "L03",
  4: "L04",
  5: "L05",
  6: "L06",
  7: "L07",
  8: "L08",
};

const SHIPPED = V3_RISK_RULES as RiskRulesDocument;

/** Defaults overridden by the level object. Missing fields stay on the default. */
export function effectiveRiskRules(
  level?: string | null,
  document: RiskRulesDocument = SHIPPED,
): EffectiveRiskRules {
  const defaults = document.defaults;
  const row = (level && document.levels[level]) || {};
  return {
    level: level ?? null,
    maxRiskPctPerTrade: row.maxRiskPctPerTrade ?? defaults.maxRiskPctPerTrade,
    minRiskPctPerTrade: row.minRiskPctPerTrade ?? null,
    stopRequirement: row.stopRequirement ?? defaults.stopRequirement,
    mentalStopIsHardBlock:
      row.mentalStopIsHardBlock ?? defaults.mentalStopIsHardBlock,
    minNetRR: row.minNetRR ?? defaults.minNetRR,
    stopBlockMode: row.stopBlockMode ?? defaults.stopBlockMode ?? "MENTAL_OR_NONE",
    unplannedStopMoveIsHardBlock:
      row.unplannedStopMoveIsHardBlock ?? defaults.unplannedStopMoveIsHardBlock ?? false,
    plannedStopMoveAllowed: row.plannedStopMoveAllowed ?? defaults.plannedStopMoveAllowed ?? true,
    dailyLossCapPct:
      "dailyLossCapPct" in row
        ? (row.dailyLossCapPct ?? null)
        : (defaults.dailyLossCapPct ?? null),
    situations: row.situations ?? [],
    dailyActiveRiskCap: row.dailyActiveRiskCap ?? null,
    weeklyCompliancePause: row.weeklyCompliancePause ?? null,
  };
}

export function rulesForStage(
  stage: number,
  document?: RiskRulesDocument,
): {
  level: string | null;
  effective: Omit<EffectiveRiskRules, "level" | "situations" | "dailyActiveRiskCap" | "weeklyCompliancePause">;
  situations: RiskSituation[];
  dailyActiveRiskCap?: string;
  weeklyCompliancePause?: string;
} {
  const level = LEVEL_BY_STAGE[stage] ?? null;
  const rules = effectiveRiskRules(level, document);
  return {
    level,
    effective: {
      maxRiskPctPerTrade: rules.maxRiskPctPerTrade,
      minRiskPctPerTrade: rules.minRiskPctPerTrade,
      stopRequirement: rules.stopRequirement,
      mentalStopIsHardBlock: rules.mentalStopIsHardBlock,
      minNetRR: rules.minNetRR,
      stopBlockMode: rules.stopBlockMode,
      unplannedStopMoveIsHardBlock: rules.unplannedStopMoveIsHardBlock,
      plannedStopMoveAllowed: rules.plannedStopMoveAllowed,
      dailyLossCapPct: rules.dailyLossCapPct,
    },
    situations: rules.situations,
    ...(rules.dailyActiveRiskCap ? { dailyActiveRiskCap: rules.dailyActiveRiskCap } : {}),
    ...(rules.weeklyCompliancePause ? { weeklyCompliancePause: rules.weeklyCompliancePause } : {}),
  };
}
