import { describe, expect, it } from "vitest";
import { csvCell, importJournalV2Json, validateJournalV2 } from "./journalV2";
import { createEmptyJournal } from "./journal";
import { migrateJournalV1ToV2 } from "./migrations";

describe("journal v2 / csv safety", () => {
  it("protects formula injection and quotes", () => {
    expect(csvCell('=HYPERLINK("x")')).toMatch(/'=HYPERLINK/);
    expect(csvCell("\t@SUM(A1)")).toMatch(/^'/);
    expect(csvCell("+cmd")).toMatch(/^'/);
    expect(csvCell("-1+2")).toMatch(/^'/);
    expect(csvCell('he said "hi"\nnext')).toContain('""');
    expect(csvCell("۱۲۳")).toContain("۱۲۳");
  });

  it("discards imported PASS", () => {
    const raw = {
      schemaVersion: 2,
      id: "j1",
      alias: "a",
      locale: "en",
      stage: 5,
      advancedModule: null,
      missionId: "M5",
      attemptId: "1",
      scenarioId: "s",
      scenarioVersion: 1,
      keyVersion: 1,
      mode: "SYNTHETIC",
      updatedAtISO: "2024-01-01T00:00:00.000Z",
      engineResults: { status: "PASS_SIMULATION", issues: [], educationalOnly: true },
    };
    const v = validateJournalV2(raw);
    expect(v.ok).toBe(true);
    expect(v.draft?.engineResults).toBeNull();
    expect(v.draft?.warnings.some((w) => w.includes("PASS"))).toBe(true);
  });

  it("migrates v1 idempotently without inventing dates", () => {
    const v1 = createEmptyJournal({
      id: "v1",
      alias: "a",
      stageId: 5,
      missionId: "M5",
      attemptId: "1",
      scenarioId: "s",
      scenarioVersion: 1,
      updatedAtISO: "2024-01-01T00:00:00.000Z",
    });
    v1.hypothesis = "h";
    const m = migrateJournalV1ToV2(v1, "en");
    expect(m.value?.schemaVersion).toBe(2);
    expect(m.value?.advancedModule).toBeNull();
    expect(m.value?.parentV1Id).toBe("v1");
    expect(m.value?.createdAtISO).toBeNull();
  });

  it("rejects oversized import", () => {
    const huge = "x".repeat(2 * 1024 * 1024 + 10);
    const r = importJournalV2Json(huge);
    expect(r.ok).toBe(false);
  });
});
