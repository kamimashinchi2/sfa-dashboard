import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import schema from "./sfa-submission.v1.schema.json";
import { buildPacket } from "./buildPacket";
import { defaultPrefs } from "../persist/types";

describe("JSON Schema 2020-12 (ajv)", () => {
  it("fixture packet validates", async () => {
    const packet = await buildPacket({
      domains: {
        quizAttempts: [],
        lessonResponses: [],
        simulatorRuns: [],
        journalEntries: [],
        selfReports: [],
        prefs: { ...defaultPrefs("en"), studentId: "S07", alias: "Falcon-07" },
      },
      isoWeek: "2026-W46",
      locale: "en",
      weeklyReflection: {
        text: "Weekly reflection long enough to satisfy the fifty character minimum for export.",
        emotionBefore: 3,
        emotionAfter: 5,
      },
      quizBankHash: "c".repeat(64),
      generatedAtISO: "2026-11-09T15:00:00.000Z",
      build: {
        label: "test",
        commit: "abc",
        builtAt: "2026-11-09T15:00:00.000Z",
        release: "Iteration 4",
      },
    });
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const ok = validate(packet);
    expect(ok, JSON.stringify(validate.errors)).toBe(true);
  });
});
