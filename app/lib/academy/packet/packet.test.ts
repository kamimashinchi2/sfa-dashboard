import { describe, expect, it } from "vitest";
import { buildPacket } from "./buildPacket";
import { digestPacket, verifyPacketDigest } from "./digest";
import { renderMarkdown, extractPacketJson } from "./renderMarkdown";
import { validatePacket } from "./validatePacket";
import { RESULT_CODE_RE } from "./schema";
import { defaultPrefs } from "../persist/types";
import type { QuizAttemptRecord, SimRunRecord } from "../persist/types";

const baseAttempt = (overrides?: Partial<QuizAttemptRecord>): QuizAttemptRecord => ({
  attemptId: "M1-v2-20261109T120000Z-abcd",
  quizId: "M1",
  mode: "ASSESSED",
  assessmentCriteriaVersion: 2,
  startedAtISO: "2026-11-09T11:00:00.000Z",
  submittedAtISO: "2026-11-09T12:00:00.000Z",
  shuffleSeed: "S07:M1:abcd",
  buildCommit: "c918847",
  items: [
    {
      itemId: "M1-Q1",
      itemHash: "a".repeat(64),
      kind: "mc",
      displayedOrder: [1, 0, 2],
      answer: { raw: 1, canonical: 1 },
      touched: true,
      clientCorrect: true,
      reflection: null,
    },
  ],
  client: {
    correct: 1,
    total: 1,
    score: 100,
    numericPass: true,
    weakTopics: [],
  },
  unverifiedClaim: true,
  ...overrides,
});

const mentalRun: SimRunRecord = {
  runId: "calc-mental-1",
  tool: "risk-grid",
  missionId: "M1",
  atISO: "2026-11-09T12:30:00.000Z",
  engineVersion: 3,
  inputs: { stopType: "MENTAL", riskPct: "1" },
  outputs: { lots: null, loss: null, budget: null, grossRR: null },
  status: "HARD_BLOCK",
  issueCodes: ["MENTAL_STOP"],
  studentDecision: "EXPLORATION",
  note: null,
};

const pct2Run: SimRunRecord = {
  runId: "calc-2pct-1",
  tool: "risk-grid",
  missionId: "M1",
  atISO: "2026-11-09T12:45:00.000Z",
  engineVersion: 3,
  inputs: { stopType: "HARD_STRUCTURAL", riskPct: "2" },
  outputs: { lots: null, loss: null, budget: null, grossRR: null },
  status: "HARD_BLOCK",
  issueCodes: ["RISK_PCT_HARD_BLOCK"],
  studentDecision: "EXPLORATION",
  note: null,
};

describe("buildPacket + validate", () => {
  it("builds a valid packet with derived hard blocks and matching digest", async () => {
    const packet = await buildPacket({
      domains: {
        quizAttempts: [baseAttempt()],
        lessonResponses: [],
        simulatorRuns: [mentalRun, pct2Run],
        journalEntries: [],
        selfReports: [],
        prefs: {
          ...defaultPrefs("en"),
          studentId: "S07",
          alias: "Falcon-07",
        },
      },
      isoWeek: "2026-W46",
      locale: "en",
      weeklyReflection: {
        text: "This week I assumed sweep equals entry and will check structure confirmation next time carefully.",
        emotionBefore: 4,
        emotionAfter: 6,
      },
      quizBankHash: "b".repeat(64),
      generatedAtISO: "2026-11-09T15:00:00.000Z",
      build: {
        label: "c918847 · Iteration 4",
        commit: "c918847",
        builtAt: "2026-11-09T15:00:00.000Z",
        release: "Iteration 4",
      },
    });

    const v = validatePacket(packet);
    expect(v.ok).toBe(true);
    expect(await verifyPacketDigest(packet)).toBe(true);
    expect(packet.hardBlockEvents).toHaveLength(2);
    expect(packet.hardBlockEvents.map((e) => e.code).sort()).toEqual([
      "MENTAL_STOP",
      "RISK_PCT_HARD_BLOCK",
    ].sort());
    expect(packet.integrity.resultCode).toMatch(RESULT_CODE_RE);

    const md = renderMarkdown(packet);
    expect(md).toContain("<!-- sfa-submission:begin -->");
    expect(md).toContain("<!-- sfa-submission:end -->");
    expect(md.match(/<!-- sfa-submission:begin -->/g)?.length).toBe(1);
    const json = extractPacketJson(md);
    expect(json).toBeTruthy();
    const reparsed = JSON.parse(json!);
    expect(await digestPacket(reparsed)).toBe(packet.integrity.digest);

    // One-character edit fails digest
    reparsed.weeklyReflection.text = reparsed.weeklyReflection.text + "x";
    expect(await digestPacket(reparsed)).not.toBe(packet.integrity.digest);

    // Deterministic markdown
    expect(renderMarkdown(packet)).toBe(md);
  });

  it("validatePacket negatives", () => {
    expect(validatePacket({ format: "sfa-submission", schemaVersion: 1, x: 1.5 }).ok).toBe(
      false,
    );
    expect(
      validatePacket({
        format: "sfa-submission",
        schemaVersion: 1,
        student: { studentId: "S07", alias: "Bad Alias" },
      }).ok,
    ).toBe(false);
    const bad = validatePacket({
      format: "sfa-submission",
      schemaVersion: 1,
      packetId: "p",
      packetSeq: 1,
      supersedesDigest: null,
      student: { studentId: "S07", alias: "Falcon-07", email: "x@y.com" },
      isoWeek: "2026-W46",
      period: { fromISO: "a", toISO: "b" },
      generatedAtISO: "2026-11-09T15:00:00.000Z",
      timezone: "Europe/Amsterdam",
      locale: "en",
      build: { commit: null, builtAt: null, label: "x" },
      versions: {
        assessmentCriteria: 2,
        quizBank: "h",
        risk: 3,
        setup: 3,
        macro: 2,
        serializer: "sfa-submission-serializer/1",
      },
      quizAttempts: [],
      lessonResponses: [],
      simulatorRuns: [],
      hardBlockEvents: [],
      journalEntries: [],
      weeklyReflection: { text: "short", emotionBefore: 1, emotionAfter: 1 },
      selfReports: [],
      declarations: { syntheticDataOnly: true, aliasOnly: true },
      integrity: {
        algorithm: "SHA-256",
        canonicalization: "sfa-canon-v1",
        digest: "a".repeat(64),
        resultCode: "SFA1-S07-2026W46-aaaaaaaaaa-Q0-R0-HB0",
      },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      const joined = bad.errors.join("|");
      expect(joined).toMatch(/EXTRA_STUDENT|MISSING_REFLECTION/);
    }
  });
});
