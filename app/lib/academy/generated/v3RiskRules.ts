/** Numeric risk bounds for the client grader. Situations are omitted on purpose. */
export const V3_RISK_RULES = {
  "defaults": {
    "maxRiskPctPerTrade": "1.00",
    "stopRequirement": "REGISTERED_STOP",
    "mentalStopIsHardBlock": false,
    "minNetRR": "2.00",
    "stopBlockMode": "NO_STOP_ONLY",
    "unplannedStopMoveIsHardBlock": true,
    "plannedStopMoveAllowed": true,
    "dailyLossCapPct": null
  },
  "levels": {
    "L00": {},
    "L01": {},
    "L02": {},
    "L03": {},
    "L05": {
      "maxRiskPctPerTrade": "2.00"
    },
    "L06": {},
    "L07": {}
  }
} as const;
