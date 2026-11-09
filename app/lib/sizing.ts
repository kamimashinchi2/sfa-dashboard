export type AssetType = "forex" | "gold";

export type SizingInput = {
  equity: number;
  /** Risk percent of equity; capped at 1.0 */
  riskPercent: number;
  entry: number;
  stop: number;
  target: number;
  asset: AssetType;
};

export type SizingResult = {
  riskPercentUsed: number;
  stopDistance: number;
  stopPips: number;
  lotSize: number;
  dollarRisk: number;
  rewardDistance: number;
  riskReward: number | null;
  meetsMinRr: boolean | null;
};

/** Academy hard cap — risk may not exceed 1.0%. */
export const MAX_RISK_PERCENT = 1.0;
export const MIN_RR = 2;

export function clampRiskPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, MAX_RISK_PERCENT);
}

/** Standard FX pip size for majors (non-JPY). */
export const FOREX_PIP_SIZE = 0.0001;

/**
 * Forex: Lot = (Equity * risk%) / (stopPips * 10)
 * Gold:  Lot = (Equity * risk%) / (|Entry − Stop| * 100)
 * risk% is the fractional risk (1.0 → 0.01).
 */
export function calculatePositionSize(input: SizingInput): SizingResult {
  const riskPercentUsed = clampRiskPercent(input.riskPercent);
  const riskFraction = riskPercentUsed / 100;
  const stopDistance = Math.abs(input.entry - input.stop);
  const stopPips =
    input.asset === "forex" ? stopDistance / FOREX_PIP_SIZE : stopDistance;

  let lotSize = NaN;
  if (stopDistance > 0 && input.equity > 0 && riskFraction > 0) {
    if (input.asset === "forex") {
      lotSize = (input.equity * riskFraction) / (stopPips * 10);
    } else {
      lotSize = (input.equity * riskFraction) / (stopDistance * 100);
    }
  }

  const dollarRisk = input.equity * riskFraction;
  const rewardDistance = Math.abs(input.target - input.entry);
  const riskReward =
    stopDistance > 0 && rewardDistance > 0
      ? rewardDistance / stopDistance
      : null;

  return {
    riskPercentUsed,
    stopDistance,
    stopPips,
    lotSize,
    dollarRisk,
    rewardDistance,
    riskReward,
    meetsMinRr: riskReward === null ? null : riskReward >= MIN_RR,
  };
}

export function formatLots(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return value.toFixed(2);
}

export function formatMoney(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function formatRr(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `1:${value.toFixed(2)}`;
}
