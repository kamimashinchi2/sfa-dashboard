"use client";

import { useState } from "react";
import {
  createEmptyJournal,
  exportJournalJson,
  exportJournalMarkdown,
  importJournalJson,
} from "../../lib/academy/journal";
import {
  createEmptyJournalV2,
  exportJournalV2Csv,
  exportJournalV2Json,
  exportJournalV2Markdown,
  importJournalV2Json,
} from "../../lib/academy/journalV2";
import { migrateJournalV1ToV2 } from "../../lib/academy/migrations";
import { downloadTextFile } from "../../lib/academy/download";
import { t, ui } from "../../lib/academy/dictionary";
import { useProgress } from "./ProgressProvider";

export default function JournalBuilder({ readOnly }: { readOnly?: boolean }) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const [draft, setDraft] = useState(() =>
    createEmptyJournal({
      id: "journal-local-1",
      alias: "practice-draft",
      stageId: progress.selectedStage,
      missionId: "M5",
      attemptId: "local",
      scenarioId: "SYN-SWEEP-REV-LONG-1",
      scenarioVersion: 1,
      updatedAtISO: "1970-01-01T00:00:00.000Z",
    }),
  );
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [lastDownload, setLastDownload] = useState<string | null>(null);

  const runDownload = (filename: string, content: string, mime: string) => {
    const result = downloadTextFile({
      filename,
      content,
      mime,
      revokeDelayMs: 4000,
    });
    setLastDownload(
      result.ok
        ? `DOWNLOAD_OK ${result.filename} (${result.bytes} bytes UTF-8)`
        : `DOWNLOAD_FAIL ${result.error}`,
    );
    setMessage(result.ok ? `Exported ${filename}` : `Export failed: ${result.error}`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-fog">{t(ui.journalExport, locale)} — no Drive upload.</p>
      {(
        [
          ["hypothesis", draft.hypothesis],
          ["falsification", draft.falsification],
          ["trainTestSplit", draft.trainTestSplit],
          ["invalidation", draft.invalidation],
          ["emotions", draft.emotions],
          ["counterevidence", draft.counterevidence],
          ["nextTask", draft.nextTask],
        ] as const
      ).map(([key, value]) => (
        <label key={key} className="block text-xs text-fog">
          {key}
          <textarea
            className="mt-1 min-h-20 w-full border border-line bg-ink px-3 py-2 text-sm text-paper"
            value={value}
            disabled={readOnly}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                [key]: e.target.value,
                updatedAtISO: new Date().toISOString(),
              }))
            }
          />
        </label>
      ))}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 bg-gold px-4 text-sm font-semibold text-ink"
          disabled={readOnly}
          data-testid="export-markdown"
          onClick={() =>
            runDownload(
              "sfa-journal.md",
              exportJournalMarkdown(draft),
              "text/markdown;charset=utf-8",
            )
          }
        >
          Export Markdown
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-4 text-sm text-fog"
          disabled={readOnly}
          data-testid="export-json"
          onClick={() =>
            runDownload(
              "sfa-journal.json",
              exportJournalJson(draft),
              "application/json;charset=utf-8",
            )
          }
        >
          Export JSON
        </button>
        <button
          type="button"
          className="min-h-11 border border-gold/50 px-4 text-sm text-gold-soft"
          disabled={readOnly}
          data-testid="export-v2-markdown"
          onClick={() => {
            const migrated = migrateJournalV1ToV2(draft, locale);
            if (!migrated.value) {
              setMessage("V2 migrate failed");
              return;
            }
            runDownload(
              "sfa-journal-v2.md",
              exportJournalV2Markdown(migrated.value),
              "text/markdown;charset=utf-8",
            );
          }}
        >
          Export JournalV2 Markdown
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-4 text-sm text-fog"
          disabled={readOnly}
          data-testid="export-v2-json"
          onClick={() => {
            const empty = createEmptyJournalV2({
              id: "jv2-local",
              alias: draft.alias,
              locale,
              stage: draft.stageId,
              missionId: draft.missionId,
              advancedModule: null,
              attemptId: draft.attemptId,
              scenarioId: draft.scenarioId,
              scenarioVersion: draft.scenarioVersion,
              updatedAtISO: draft.updatedAtISO,
              parentV1Id: draft.id,
            });
            empty.hypothesis = draft.hypothesis;
            empty.falsification = draft.falsification;
            empty.trainTestSplit = draft.trainTestSplit;
            empty.invalidation = draft.invalidation;
            empty.emotions = draft.emotions;
            empty.counterevidence = draft.counterevidence;
            empty.nextTask = draft.nextTask;
            runDownload(
              "sfa-journal-v2.json",
              exportJournalV2Json(empty),
              "application/json;charset=utf-8",
            );
          }}
        >
          Export JournalV2 JSON
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-4 text-sm text-fog"
          disabled={readOnly}
          data-testid="export-v2-csv"
          onClick={() => {
            const migrated = migrateJournalV1ToV2(draft, locale);
            if (!migrated.value) return;
            runDownload(
              "sfa-journal-v2.csv",
              exportJournalV2Csv(migrated.value),
              "text/csv;charset=utf-8",
            );
          }}
        >
          Export CSV (flat)
        </button>
      </div>
      {lastDownload ? (
        <p className="font-mono text-xs text-teal-bright" data-testid="download-status">
          {lastDownload}
        </p>
      ) : null}
      <label className="block text-xs text-fog">
        Import JSON (validated/bounded — v1 or v2)
        <textarea
          className="mt-1 min-h-24 w-full border border-line bg-ink px-3 py-2 font-mono text-xs text-paper"
          value={importText}
          disabled={readOnly}
          onChange={(e) => setImportText(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="min-h-11 border border-gold/50 px-4 text-sm text-gold-soft"
        disabled={readOnly}
        onClick={() => {
          const v2 = importJournalV2Json(importText);
          if (v2.ok && v2.draft) {
            setDraft({
              ...createEmptyJournal({
                id: v2.draft.parentV1Id ?? v2.draft.id,
                alias: v2.draft.alias,
                stageId: v2.draft.stage,
                missionId: v2.draft.missionId ?? "M5",
                attemptId: v2.draft.attemptId,
                scenarioId: v2.draft.scenarioId,
                scenarioVersion: v2.draft.scenarioVersion,
                updatedAtISO: v2.draft.updatedAtISO,
              }),
              hypothesis: v2.draft.hypothesis,
              falsification: v2.draft.falsification,
              trainTestSplit: v2.draft.trainTestSplit,
              invalidation: v2.draft.invalidation,
              emotions: v2.draft.emotions,
              counterevidence: v2.draft.counterevidence,
              nextTask: v2.draft.nextTask,
              warnings: v2.draft.warnings,
              blocked: v2.draft.blocked,
              engineResults: null,
            });
            setMessage(
              "Import V2 OK — cached PASS discarded; recompute in Risk Grid.",
            );
            return;
          }
          const result = importJournalJson(importText);
          if (!result.ok || !result.draft) {
            setMessage(`Import failed: ${[...v2.errors, ...result.errors].join(", ")}`);
            return;
          }
          setDraft(result.draft);
          setMessage(
            "Import OK — cached engine outputs not trusted; recompute in Risk Grid.",
          );
        }}
      >
        Import
      </button>
      {message ? (
        <p className="text-xs text-gold-soft" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
