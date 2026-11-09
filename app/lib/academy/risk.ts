import type {
  Issue,
  RiskInput,
  RiskResult,
  RiskStatus,
} from "./contracts";
import { MAX_RISK_PCT, MIN_NET_RR } from "./contracts";
import {
  canonicalize,
  decAbs,
  decAdd,
  decCompare,
  decDiv,
  decFloorToStep,
  decIsPositive,
  decMin,
  decMul,
  decSub,
  parseDec,
  parseDecOrEmpty,
} from "./decimal";

function issue(code: string, field?: string, evidenceIds: string[] = []): Issue {
  return { code, field, evidenceIds };
}

/**
 * Educational risk engine. Pure: no Date.now, network, storage, or randomness.
 */
export function evaluateRisk(input: RiskInput): RiskResult {
  const issues: Issue[] = [];
  let hardBlock = false;
  let unverified = false;
  let noValidSize = false;

  const markHard = (code: string, field?: string, evidenceIds?: string[]) => {
    hardBlock = true;
    issues.push(issue(code, field, evidenceIds));
  };
  const markUnverified = (code: string, field?: string, evidenceIds?: string[]) => {
    unverified = true;
    issues.push(issue(code, field, evidenceIds));
  };

  // Spec
  if (!input.spec) {
    markUnverified("MISSING_SPEC", "spec");
  }

  // Stop type / pre-entry
  if (input.stopType === "MENTAL" || input.stopType === "NONE") {
    markHard("STOP_NOT_HARD_STRUCTURAL", "stopType");
  }
  if (input.preEntry === "NO") {
    markHard("PRE_ENTRY_NO", "preEntry");
  } else if (input.preEntry === "UNKNOWN") {
    markUnverified("PRE_ENTRY_UNKNOWN", "preEntry");
  }

  if (
    input.stopType === "HARD_STRUCTURAL" &&
    input.structuralEvidenceIds.length === 0
  ) {
    markUnverified("MISSING_STRUCTURAL_EVIDENCE", "structuralEvidenceIds");
  }

  // Costs
  if (input.costs.status === "UNKNOWN") {
    markUnverified("UNKNOWN_COSTS", "costs");
  }

  // Equity
  let equity: string | null = null;
  if (input.equity === null) {
    markUnverified("MISSING_EQUITY", "equity");
  } else {
    const p = parseDec(input.equity);
    if (!p.ok) {
      markUnverified("MALFORMED_EQUITY", "equity");
    } else if (!decIsPositive(p.value)) {
      markHard("NONPOSITIVE_EQUITY", "equity");
      equity = p.value;
    } else {
      equity = p.value;
    }
  }

  // Conversion
  let conversion: string | null = null;
  if (input.conversion === null) {
    markUnverified("MISSING_CONVERSION", "conversion");
  } else {
    const p = parseDec(input.conversion);
    if (!p.ok) {
      markUnverified("INVALID_CONVERSION", "conversion");
    } else if (!decIsPositive(p.value)) {
      markUnverified("INVALID_CONVERSION", "conversion");
    } else {
      conversion = p.value;
    }
  }

  // Risk percent — never silent clamp
  let riskPct: string | null = null;
  if (input.riskPct === null) {
    markUnverified("MISSING_RISK_PCT", "riskPct");
  } else {
    const p = parseDec(input.riskPct);
    if (!p.ok) {
      markUnverified("MALFORMED_RISK_PCT", "riskPct");
    } else if (decCompare(p.value, "0") < 0) {
      markHard("NEGATIVE_RISK_PCT", "riskPct");
      riskPct = p.value; // persist as invalid; do not clamp
    } else if (decCompare(p.value, "0") === 0) {
      markHard("NONPOSITIVE_RISK_PCT", "riskPct");
      riskPct = p.value;
    } else if (decCompare(p.value, MAX_RISK_PCT) > 0) {
      markHard("RISK_PCT_HARD_BLOCK", "riskPct");
      riskPct = p.value; // preserve attempted value (e.g. 2%)
    } else {
      riskPct = p.value;
    }
  }

  // Prices — empty ≠ zero; reject nonpositive
  const parsePrice = (raw: string | null, field: string): string | null => {
    if (raw === null) {
      markUnverified("MISSING_PRICE", field);
      return null;
    }
    const p = parseDec(raw);
    if (!p.ok) {
      if (p.reason === "EMPTY") {
        markUnverified("EMPTY_PRICE", field);
      } else {
        markUnverified(`MALFORMED_PRICE_${p.reason}`, field);
      }
      return null;
    }
    if (!decIsPositive(p.value)) {
      markHard("NONPOSITIVE_PRICE", field);
      return p.value;
    }
    return p.value;
  };

  const entry = parsePrice(input.entry, "entry");
  const stop = parsePrice(input.stop, "stop");
  const target = parsePrice(input.target, "target");

  // Directional stop/target validation when prices present and positive
  if (
    entry &&
    stop &&
    decIsPositive(entry) &&
    decIsPositive(stop)
  ) {
    if (decCompare(entry, stop) === 0) {
      markHard("EQUAL_STOP", "stop");
    } else if (input.direction === "LONG" && decCompare(stop, entry) >= 0) {
      markHard("WRONG_SIDE_STOP", "stop");
    } else if (input.direction === "SHORT" && decCompare(stop, entry) <= 0) {
      markHard("WRONG_SIDE_STOP", "stop");
    }
  }

  if (
    entry &&
    target &&
    decIsPositive(entry) &&
    decIsPositive(target)
  ) {
    if (decCompare(entry, target) === 0) {
      markHard("EQUAL_TARGET", "target");
    } else if (input.direction === "LONG" && decCompare(target, entry) <= 0) {
      markHard("WRONG_SIDE_TARGET", "target");
    } else if (input.direction === "SHORT" && decCompare(target, entry) >= 0) {
      markHard("WRONG_SIDE_TARGET", "target");
    }
  }

  // Cost components when KNOWN
  let fixedFee = "0";
  let feePerLot = "0";
  let slippageTicks = "0";
  if (input.costs.status === "KNOWN") {
    const ff = input.costs.fixedFee === null ? parseDec("0") : parseDec(input.costs.fixedFee);
    const fl = input.costs.feePerLot === null ? parseDec("0") : parseDec(input.costs.feePerLot);
    const st =
      input.costs.slippageTicks === null
        ? parseDec("0")
        : parseDec(input.costs.slippageTicks);
    if (!ff.ok || !fl.ok || !st.ok) {
      markUnverified("MALFORMED_COSTS", "costs");
    } else {
      if (decCompare(ff.value, "0") < 0 || decCompare(fl.value, "0") < 0 || decCompare(st.value, "0") < 0) {
        markHard("NEGATIVE_COSTS", "costs");
      }
      fixedFee = ff.ok ? ff.value : "0";
      feePerLot = fl.ok ? fl.value : "0";
      slippageTicks = st.ok ? st.value : "0";
    }
  }

  let budget: string | null = null;
  let maxLots: string | null = null;
  let loss: string | null = null;
  let grossRR: string | null = null;
  let netRR: string | null = null;

  const canSize =
    input.spec &&
    equity &&
    decIsPositive(equity) &&
    conversion &&
    decIsPositive(conversion) &&
    riskPct &&
    decIsPositive(riskPct) &&
    decCompare(riskPct, MAX_RISK_PCT) <= 0 &&
    entry &&
    stop &&
    target &&
    decIsPositive(entry) &&
    decIsPositive(stop) &&
    decIsPositive(target) &&
    !hardBlock;

  if (canSize && input.spec) {
    const spec = input.spec;
    const D = decAbs(decSub(entry!, stop!));
    if (!decIsPositive(D)) {
      // already HARD_BLOCK via equal stop
    } else {
      const tickSize = parseDec(spec.tickSize);
      const tickValue = parseDec(spec.tickValuePerLot);
      const minLot = parseDec(spec.minLot);
      const maxLot = parseDec(spec.maxLot);
      const lotStep = parseDec(spec.lotStep);

      if (
        !tickSize.ok ||
        !tickValue.ok ||
        !minLot.ok ||
        !maxLot.ok ||
        !lotStep.ok ||
        !decIsPositive(tickSize.value) ||
        !decIsPositive(tickValue.value) ||
        !decIsPositive(minLot.value) ||
        !decIsPositive(lotStep.value)
      ) {
        markUnverified("INVALID_SPEC_FIELDS", "spec");
      } else {
        // L = D/tickSize*tickValue*conversion + slippageTicks*tickValue*conversion + feePerLot
        const ticks = decDiv(D, tickSize.value);
        if (ticks === null) {
          markUnverified("DIV_BY_ZERO_TICK", "spec");
        } else {
          const perLotPriceRisk = decMul(
            decMul(ticks, tickValue.value),
            conversion!,
          );
          const slipCost = decMul(
            decMul(slippageTicks, tickValue.value),
            conversion!,
          );
          const L = decAdd(decAdd(perLotPriceRisk, slipCost), feePerLot);

          if (!decIsPositive(L)) {
            markUnverified("NONPOSITIVE_L", "loss");
          } else {
            budget = decMul(equity!, decDiv(riskPct!, "100")!);
            const available = decSub(budget, fixedFee);
            if (decCompare(available, "0") <= 0) {
              noValidSize = true;
              issues.push(issue("INSUFFICIENT_BUDGET_FOR_FIXED_FEE", "budget"));
            } else {
              const rawMax = decDiv(available, L);
              if (rawMax === null) {
                markUnverified("DIV_BY_ZERO_L", "maxLots");
              } else {
                const capped = decMin(rawMax, maxLot.value);
                const floored = decFloorToStep(capped, lotStep.value);
                if (floored === null || decCompare(floored, minLot.value) < 0) {
                  noValidSize = true;
                  maxLots = floored;
                  issues.push(issue("NO_FEASIBLE_LOT", "maxLots"));
                } else {
                  maxLots = floored;
                }
              }
            }

            // Submitted lots
            let lots: string | null = null;
            if (input.submittedLots === null) {
              lots = maxLots;
            } else {
              const p = parseDec(input.submittedLots);
              if (!p.ok) {
                markUnverified("MALFORMED_LOTS", "submittedLots");
              } else if (!decIsPositive(p.value)) {
                markHard("NONPOSITIVE_LOTS", "submittedLots");
              } else {
                // lattice check
                const stepped = decFloorToStep(p.value, lotStep.value);
                if (stepped === null || decCompare(stepped, p.value) !== 0) {
                  markHard("INVALID_LOT_INCREMENT", "submittedLots");
                } else if (decCompare(p.value, minLot.value) < 0) {
                  markHard("BELOW_MIN_LOT", "submittedLots");
                } else if (decCompare(p.value, maxLot.value) > 0) {
                  markHard("ABOVE_MAX_LOT", "submittedLots");
                } else if (maxLots && decCompare(p.value, maxLots) > 0) {
                  markHard("OVERSIZED_LOTS", "submittedLots");
                } else {
                  lots = p.value;
                }
              }
            }

            if (lots && decIsPositive(lots)) {
              loss = decAdd(decMul(lots, L), fixedFee);
              if (budget && decCompare(loss, budget) > 0) {
                markHard("LOSS_EXCEEDS_BUDGET", "loss");
              }
              if (equity) {
                const actualPct = decMul(
                  decDiv(loss, equity)!,
                  "100",
                );
                if (decCompare(actualPct, MAX_RISK_PCT) > 0) {
                  markHard("ACTUAL_RISK_OVER_CAP", "loss");
                }
              }

              const rewardDist = decAbs(decSub(target!, entry!));
              const rewardTicks = decDiv(rewardDist, tickSize.value);
              if (rewardTicks !== null) {
                const grossReward = decMul(
                  decMul(decMul(lots, rewardTicks), tickValue.value),
                  conversion!,
                );
                // Gross R:R uses price distances (independent of fees)
                const riskDist = D;
                grossRR = decDiv(rewardDist, riskDist);

                const netReward = decSub(
                  decSub(grossReward, decMul(lots, feePerLot)),
                  fixedFee,
                );
                // Net R:R = netReward / loss (planned)
                if (loss && decIsPositive(loss)) {
                  netRR = decDiv(netReward, loss);
                }

                if (
                  input.costs.status === "KNOWN" &&
                  netRR !== null &&
                  decCompare(netRR, MIN_NET_RR) < 0
                ) {
                  markHard("NET_RR_BELOW_2", "netRR");
                }
              }
            }
          }
        }
      }
    }
  } else if (
    // Incomplete prices must not invent R:R PASS — clear derived readiness
    target === null ||
    entry === null ||
    stop === null ||
    equity === null ||
    !decIsPositive(equity ?? "0")
  ) {
    grossRR = null;
    netRR = null;
    // ensure no phantom PASS
  }

  // Proven violations dominate missing fields
  let status: RiskStatus;
  if (hardBlock) {
    status = "HARD_BLOCK";
  } else if (noValidSize) {
    status = "NO_VALID_SIZE";
  } else if (unverified || !input.spec || input.costs.status === "UNKNOWN") {
    status = "UNVERIFIED";
  } else if (
    maxLots &&
    loss &&
    netRR &&
    decCompare(netRR, MIN_NET_RR) >= 0 &&
    riskPct &&
    decCompare(riskPct, MAX_RISK_PCT) <= 0
  ) {
    status = "PASS_SIMULATION";
  } else {
    status = "UNVERIFIED";
  }

  // Unknown costs cannot PASS
  if (input.costs.status === "UNKNOWN" && status === "PASS_SIMULATION") {
    status = "UNVERIFIED";
  }

  return {
    status,
    issues,
    budget,
    maxLots,
    loss,
    grossRR: grossRR ? canonicalize(grossRR) : null,
    netRR: netRR ? canonicalize(netRR) : null,
    educationalOnly: true,
  };
}

/** UI helper: parse draft string fields without coercing empty → 0. */
export function draftToRiskPrices(draft: {
  equity: string;
  riskPct: string;
  entry: string;
  stop: string;
  target: string;
}): {
  equity: string | null;
  riskPct: string | null;
  entry: string | null;
  stop: string | null;
  target: string | null;
  emptyFields: string[];
} {
  const emptyFields: string[] = [];
  const map = (key: string, raw: string) => {
    const r = parseDecOrEmpty(raw);
    if ("empty" in r && r.empty) {
      emptyFields.push(key);
      return null;
    }
    if (!("ok" in r) || !r.ok) return null;
    return r.value;
  };
  return {
    equity: map("equity", draft.equity),
    riskPct: map("riskPct", draft.riskPct),
    entry: map("entry", draft.entry),
    stop: map("stop", draft.stop),
    target: map("target", draft.target),
    emptyFields,
  };
}

export function explainRiskStatus(status: RiskStatus): string {
  switch (status) {
    case "PASS_SIMULATION":
      return "PASS_SIMULATION — educational size meets ≤1% risk and net R:R ≥ 2 under stated costs.";
    case "HARD_BLOCK":
      return "HARD_BLOCK — proven rule violation (risk cap, stop, R:R, lots, or prices).";
    case "UNVERIFIED":
      return "UNVERIFIED — missing or incomplete information; not proven misconduct.";
    case "NO_VALID_SIZE":
      return "NO_VALID_SIZE — budget/min lot lattice cannot produce a feasible size.";
  }
}
