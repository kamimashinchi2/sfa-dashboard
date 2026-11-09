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
 *
 * Lot formula (exact decimal, never round up):
 *   riskAmount = equity × risk%
 *   stopPips = |entry − SL| / pipSize
 *   pipValueAccount = pipValueQuote × conversion
 *   lots = floor_to_step(riskAmount / (stopPips × pipValueAccount))
 * Report actual loss at the floored lots.
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

  // Stop type — HARD_BLOCK reasons always surface, even when other fields missing
  if (input.stopType === "MENTAL") {
    markHard("MENTAL_STOP", "stopType");
  } else if (input.stopType === "NONE") {
    markHard("NO_STOP", "stopType");
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

  // Conversion — required when quote ≠ account; never guess
  let conversion: string | null = null;
  const quoteCcy = input.spec?.pnlCurrency ?? null;
  const accountCcy = input.accountCurrency;
  const needsConversion =
    Boolean(quoteCcy) && quoteCcy !== accountCcy;

  if (needsConversion) {
    if (input.conversion === null) {
      markUnverified("MISSING_CONVERSION", "conversion");
    } else {
      const p = parseDec(input.conversion);
      if (!p.ok || !decIsPositive(p.value)) {
        markUnverified("INVALID_CONVERSION", "conversion");
      } else {
        conversion = p.value;
      }
    }
  } else if (input.conversion === null || input.conversion === "") {
    conversion = "1";
  } else {
    const p = parseDec(input.conversion);
    if (!p.ok || !decIsPositive(p.value)) {
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
      riskPct = p.value;
    } else if (decCompare(p.value, "0") === 0) {
      markHard("NONPOSITIVE_RISK_PCT", "riskPct");
      riskPct = p.value;
    } else if (decCompare(p.value, MAX_RISK_PCT) > 0) {
      markHard("RISK_PCT_HARD_BLOCK", "riskPct");
      riskPct = p.value;
    } else {
      riskPct = p.value;
    }
  }

  // Prices — empty ≠ zero; reject nonpositive
  // Hard structural requires numeric SL; mental/none already HARD_BLOCK above
  const parsePrice = (raw: string | null, field: string): string | null => {
    if (raw === null) {
      if (field === "stop" && input.stopType === "HARD_STRUCTURAL") {
        markUnverified("MISSING_PRICE", field);
      } else if (field !== "stop") {
        markUnverified("MISSING_PRICE", field);
      } else {
        // Mental/None: stop price optional; HARD_BLOCK already recorded
        markUnverified("MISSING_PRICE", field);
      }
      return null;
    }
    const p = parseDec(raw);
    if (!p.ok) {
      if (p.reason === "EMPTY") {
        markUnverified("EMPTY_PRICE", field);
      } else {
        // Typing "mental" into SL → not a silent PASS; still unverified price
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
  const stop =
    input.stopType === "HARD_STRUCTURAL"
      ? parsePrice(input.stop, "stop")
      : input.stop === null
        ? null
        : parsePrice(input.stop, "stop");
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
  let stopPips: string | null = null;
  let pipValueAccount: string | null = null;

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
    if (decIsPositive(D)) {
      const pipSize = parseDec(spec.pipSize);
      const pipValueQuote = parseDec(spec.pipValueQuotePerLot);
      const minLot = parseDec(spec.minLot);
      const maxLot = parseDec(spec.maxLot);
      const lotStep = parseDec(spec.lotStep);

      if (
        !pipSize.ok ||
        !pipValueQuote.ok ||
        !minLot.ok ||
        !maxLot.ok ||
        !lotStep.ok ||
        !decIsPositive(pipSize.value) ||
        !decIsPositive(pipValueQuote.value) ||
        !decIsPositive(minLot.value) ||
        !decIsPositive(lotStep.value)
      ) {
        markUnverified("INVALID_SPEC_FIELDS", "spec");
      } else {
        // stopPips = |entry − SL| / pipSize
        const pips = decDiv(D, pipSize.value);
        if (pips === null) {
          markUnverified("DIV_BY_ZERO_PIP", "spec");
        } else {
          stopPips = canonicalize(pips);
          // pipValueAccount = pipValueQuote × conversion
          pipValueAccount = canonicalize(
            decMul(pipValueQuote.value, conversion!),
          );

          // Per-lot loss L = stopPips × pipValueAccount + slippage + feePerLot
          // slippageTicks interpreted as pip-equivalent ticks for educational model
          const priceRiskPerLot = decMul(stopPips, pipValueAccount);
          const slipCost = decMul(
            decMul(slippageTicks, pipValueQuote.value),
            conversion!,
          );
          const L = decAdd(decAdd(priceRiskPerLot, slipCost), feePerLot);

          if (!decIsPositive(L)) {
            markUnverified("NONPOSITIVE_L", "loss");
          } else {
            budget = decMul(equity!, decDiv(riskPct!, "100")!);
            const available = decSub(budget, fixedFee);
            if (decCompare(available, "0") <= 0) {
              noValidSize = true;
              issues.push(issue("INSUFFICIENT_BUDGET_FOR_FIXED_FEE", "budget"));
            } else {
              // lots = floor_to_step(riskAmount / (stopPips × pipValueAccount))
              // Never round up
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
              // Actual loss at floored lots
              loss = decAdd(decMul(lots, L), fixedFee);
              if (budget && decCompare(loss, budget) > 0) {
                markHard("LOSS_EXCEEDS_BUDGET", "loss");
              }
              if (equity) {
                const actualPct = decMul(decDiv(loss, equity)!, "100");
                if (decCompare(actualPct, MAX_RISK_PCT) > 0) {
                  markHard("ACTUAL_RISK_OVER_CAP", "loss");
                }
              }

              const rewardDist = decAbs(decSub(target!, entry!));
              const rewardPips = decDiv(rewardDist, pipSize.value);
              if (rewardPips !== null) {
                const grossReward = decMul(
                  decMul(lots, rewardPips),
                  pipValueAccount,
                );
                grossRR = decDiv(rewardDist, D);

                const netReward = decSub(
                  decSub(grossReward, decMul(lots, feePerLot)),
                  fixedFee,
                );
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
    target === null ||
    entry === null ||
    stop === null ||
    equity === null ||
    !decIsPositive(equity ?? "0")
  ) {
    grossRR = null;
    netRR = null;
  }

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
    stopPips: stopPips ? canonicalize(stopPips) : null,
    pipValueAccount: pipValueAccount ? canonicalize(pipValueAccount) : null,
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

export function explainStopType(stopType: RiskInput["stopType"], locale: "fa" | "en"): string {
  if (stopType === "MENTAL") {
    return locale === "fa"
      ? "حد ذهنی مجاز نیست. چه قیمتی ایده را باطل می‌کند؟ آن را قبل از ورود روی پلتفرم بگذارید."
      : "What price proves your idea wrong? Place it on the platform before entry.";
  }
  if (stopType === "NONE") {
    return locale === "fa"
      ? "بدون حد ضرر ساختاری ورود شبیه‌سازی نمی‌شود."
      : "No structural stop — simulation entry is blocked.";
  }
  return locale === "fa"
    ? "حد ساختاری سخت روی پلتفرم الزامی است."
    : "Hard structural stop on the platform is required.";
}
