"use client";

import { useState } from "react";
import { createEmptyJournal, exportJournalMarkdown } from "../../lib/academy/journal";
import { downloadTextFile } from "../../lib/academy/download";
import { useProgress } from "./ProgressProvider";

const FIELDS = [
  ["hypothesis", "Hypothesis", "فرضیه", "What do you think is happening?"],
  ["falsification", "What would prove this wrong?", "ابطال", "Name one observation that would change your mind."],
  ["trainTestSplit", "What did you study, and what did you check later?", "تقسیم تمرین", "Keep the practice set separate from the check."],
  ["invalidation", "When is the idea no longer valid?", "بی‌اعتباری", "Write the condition that ends the idea."],
  ["emotions", "How did you feel?", "احساس", "Name the feeling. Do not turn it into a trade."],
  ["counterevidence", "What argues against you?", "شواهد مخالف", "Write the evidence you would rather ignore."],
  ["nextTask", "What will you do next?", "کار بعدی", "One concrete study task."],
] as const;

export default function JournalBuilder({ readOnly }: { readOnly?: boolean }) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const [draft, setDraft] = useState(() =>
    createEmptyJournal({
      id: "journal-local-1",
      alias: "notes",
      stageId: 5,
      missionId: "M5",
      attemptId: "local",
      scenarioId: "notes",
      scenarioVersion: 1,
      updatedAtISO: "1970-01-01T00:00:00.000Z",
    }),
  );
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-fog">
        {locale === "fa"
          ? "این یادداشت‌ها فقط برای خودتان است. نمره از اینجا نمی‌آید."
          : "These notes are for you. They are not graded."}
      </p>
      {FIELDS.map(([key, en, fa, hint]) => (
        <label key={key} className="block text-sm text-fog">
          {en}
          {locale === "fa" ? <span className="ms-2 text-xs">{fa}</span> : null}
          <span className="mt-1 block text-xs">{hint}</span>
          <textarea
            className="mt-1 min-h-20 w-full border border-line bg-ink px-3 py-2 text-base text-paper"
            value={draft[key]}
            disabled={readOnly}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                [key]: e.target.value,
                updatedAtISO: new Date().toISOString(),
              }))
            }
          />
        </label>
      ))}
      <button
        type="button"
        className="min-h-11 bg-gold px-4 text-sm font-semibold text-ink"
        disabled={readOnly}
        data-testid="export-markdown"
        onClick={() => {
          const result = downloadTextFile({
            filename: "sfa-journal.md",
            content: exportJournalMarkdown(draft),
            mime: "text/markdown;charset=utf-8",
          });
          setMessage(result.ok ? "Notes downloaded." : "Download failed.");
        }}
      >
        {locale === "fa" ? "دانلود یادداشت‌ها" : "Download my notes"}
      </button>
      {message ? (
        <p className="text-sm text-gold-soft" data-testid="download-status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
