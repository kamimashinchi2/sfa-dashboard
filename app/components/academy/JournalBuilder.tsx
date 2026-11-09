"use client";

import { useState } from "react";
import {
  createEmptyJournal,
  exportJournalJson,
  exportJournalMarkdown,
  importJournalJson,
} from "../../lib/academy/journal";
import { t, ui } from "../../lib/academy/dictionary";
import { useProgress } from "./ProgressProvider";

export default function JournalBuilder() {
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

  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
          onClick={() =>
            download(
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
          onClick={() =>
            download(
              "sfa-journal.json",
              exportJournalJson(draft),
              "application/json;charset=utf-8",
            )
          }
        >
          Export JSON
        </button>
      </div>
      <label className="block text-xs text-fog">
        Import JSON (validated/bounded)
        <textarea
          className="mt-1 min-h-24 w-full border border-line bg-ink px-3 py-2 font-mono text-xs text-paper"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="min-h-11 border border-gold/50 px-4 text-sm text-gold-soft"
        onClick={() => {
          const result = importJournalJson(importText);
          if (!result.ok || !result.draft) {
            setMessage(`Import failed: ${result.errors.join(", ")}`);
            return;
          }
          setDraft(result.draft);
          setMessage("Import OK — cached engine outputs not trusted; recompute in Risk Grid.");
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
