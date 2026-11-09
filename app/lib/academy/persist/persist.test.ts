import { describe, expect, it } from "vitest";
import { guardUnknown } from "./guards";
import { migrateProgressV1ToV2 } from "./migrate";
import {
  buildBackup,
  parseBackup,
  sanitizeImportedProgress,
} from "./backup";
import {
  mergeCalcHistory,
  pushCalcHistory,
  makeCalcHistoryEntry,
} from "./calcHistory";
import {
  SYNTHETIC_GOLD_SPEC,
  type RiskInput,
  type RiskResult,
} from "../contracts";
import { defaultProgressV2 } from "./types";

describe("persist guards", () => {
  it("rejects __proto__ keys", () => {
    const raw = JSON.parse('{"a":1,"__proto__":{"x":1}}');
    expect(guardUnknown(raw).ok).toBe(false);
  });

  it("rejects non-finite numbers", () => {
    expect(guardUnknown({ n: Number.NaN }).ok).toBe(false);
    expect(guardUnknown({ n: Infinity }).ok).toBe(false);
  });
});

describe("v1→v2 migration", () => {
  it("is idempotent and keeps rewardIds without double XP", () => {
    const v1 = {
      version: 1,
      locale: "en",
      selectedStage: 2,
      attempts: [
        {
          id: "a1",
          missionId: "M1",
          scenarioVersion: 1,
          quizScore: 80,
          numericPass: true,
          taskComplete: true,
          riskStatus: null,
          readiness: "READY",
          weakTopics: [],
        },
      ],
      completedLessonIds: ["M1-L1"],
      rewardIds: ["lesson:M1-L1", "practical:M1", "mission:M1"],
      journalDraftIds: [],
      updatedAtISO: "2024-01-01T00:00:00.000Z",
    };
    const once = migrateProgressV1ToV2(v1);
    expect(once.ok).toBe(true);
    expect(once.value.version).toBe(2);
    const twice = migrateProgressV1ToV2(once.value);
    expect(twice.value.rewardIds.sort()).toEqual(once.value.rewardIds.sort());
  });
});

describe("backup import sanitizes PASS", () => {
  it("marks imported PASS as UNVERIFIED", () => {
    const p = defaultProgressV2("en");
    p.attempts = [
      {
        id: "x",
        missionId: "M1",
        scenarioVersion: 1,
        quizScore: 100,
        numericPass: true,
        taskComplete: true,
        riskStatus: "PASS_SIMULATION",
        readiness: "READY",
        weakTopics: [],
      },
    ];
    p.advancedAssessedEnabled = true;
    const s = sanitizeImportedProgress(p);
    expect(s.attempts[0]!.riskStatus).toBe("UNVERIFIED");
    expect(s.attempts[0]!.numericPass).toBe(false);
    expect(s.advancedAssessedEnabled).toBe(false);
  });

  it("round-trips backup JSON", () => {
    const payload = buildBackup({ progress: defaultProgressV2("fa") });
    const parsed = parseBackup(JSON.stringify(payload));
    expect(parsed.error ?? null).toBeNull();
    expect(parsed.ok).toBe(true);
    expect(parsed.value?.format).toBe("sfa-backup");
  });
});

describe("calc history ring", () => {
  const fakeResult: RiskResult = {
    status: "HARD_BLOCK",
    issues: [],
    budget: null,
    maxLots: null,
    loss: null,
    grossRR: null,
    netRR: null,
    stopPips: null,
    pipValueAccount: null,
    educationalOnly: true,
  };
  const fakeInput: RiskInput = {
    spec: SYNTHETIC_GOLD_SPEC,
    equity: "10000",
    accountCurrency: "USD",
    conversion: "1",
    conversionUnits: "ACCOUNT_PER_PNL",
    direction: "LONG",
    entry: "2500",
    stop: "2492",
    target: "2516",
    stopType: "MENTAL",
    structuralEvidenceIds: [],
    preEntry: "YES",
    riskPct: "1",
    submittedLots: null,
    costs: {
      status: "KNOWN",
      fixedFee: "0",
      feePerLot: "0",
      slippageTicks: "0",
      pricesIncludeSpread: "YES",
    },
  };

  it("keeps HARD_BLOCK and caps at 50", () => {
    let entries = [] as ReturnType<typeof makeCalcHistoryEntry>[];
    for (let i = 0; i < 55; i++) {
      entries = pushCalcHistory(
        entries,
        makeCalcHistoryEntry({
          id: `id-${i}`,
          atISO: `2024-01-01T00:00:${String(i).padStart(2, "0")}.000Z`,
          instrument: "XAU",
          side: "LONG",
          riskPct: "1",
          stopType: "MENTAL",
          riskInput: fakeInput,
          result: fakeResult,
        }),
      );
    }
    expect(entries).toHaveLength(50);
    expect(entries.every((e) => e.status === "HARD_BLOCK")).toBe(true);
  });

  it("merges by id across tabs", () => {
    const a = [
      makeCalcHistoryEntry({
        id: "same",
        atISO: "2024-01-01T00:00:00.000Z",
        instrument: "XAU",
        side: "LONG",
        riskPct: "1",
        stopType: "HARD_STRUCTURAL",
        riskInput: fakeInput,
        result: fakeResult,
      }),
    ];
    const b = [
      makeCalcHistoryEntry({
        id: "same",
        atISO: "2024-01-02T00:00:00.000Z",
        instrument: "XAU",
        side: "SHORT",
        riskPct: "1",
        stopType: "HARD_STRUCTURAL",
        riskInput: fakeInput,
        result: { ...fakeResult, status: "PASS_SIMULATION" },
      }),
    ];
    const m = mergeCalcHistory(a, b);
    expect(m).toHaveLength(1);
    expect(m[0]!.side).toBe("SHORT");
  });
});
