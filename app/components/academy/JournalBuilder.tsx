"use client";

import { useMemo, useState } from "react";
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
import { copyTextToClipboard } from "../../lib/academy/copyClipboard";
import {
  reconcileJournalStage,
  stageFromMission,
} from "../../lib/academy/stageRegistry";
import type { MissionId, StageId } from "../../lib/academy/contracts";
import { t, ui } from "../../lib/academy/dictionary";
import { prefsStore } from "../../lib/academy/persist";
import { useProgress } from "./ProgressProvider";

export default function JournalBuilder({ readOnly }: { readOnly?: boolean }) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const registryStage = stageFromMission("M5") ?? (5 as StageId);
  const prefsAlias = prefsStore.getSnapshot().alias?.trim() || "practice-draft";
  const prefsAttempt =
    progress.attempts.find((a) => a.missionId === "M5")?.id ?? "local";

  const [draft, setDraft] = useState(() =>
    createEmptyJournal({
      id: "journal-local-1",
      alias: prefsAlias,
      stageId: registryStage,
      missionId: "M5",
      attemptId: prefsAttempt,
      scenarioId: "SYN-SWEEP-REV-LONG-1",
      scenarioVersion: 1,
      updatedAtISO: "1970-01-01T00:00:00.000Z",
    }),
  );
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [lastDownload, setLastDownload] = useState<string | null>(null);

  const stageCheck = useMemo(
    () =>
      reconcileJournalStage({
        stage: draft.stageId,
        missionId: draft.missionId,
        advancedModule: null,
      }),
    [draft.stageId, draft.missionId],
  );

  const syncedDraft = useMemo(() => {
    if (stageCheck.warning?.startsWith("STAGE_MISMATCH")) {
      return { ...draft, stageId: stageCheck.stage };
    }
    return draft;
  }, [draft, stageCheck]);

  const runDownload = (filename: string, content: string, mime: string) => {
    const result = downloadTextFile({
      filename,
      content,
      mime,
      revokeDelayMs: 45_000,
    });
    setLastDownload(
      result.ok
        ? `DOWNLOAD_OK ${result.filename} (${result.bytes} bytes UTF-8)`
        : `DOWNLOAD_FAIL ${result.error}`,
    );
    setMessage(
      result.ok ? `Exported ${filename}` : `Export failed: ${result.error}`,
    );
  };

  const setMission = (missionId: MissionId) => {
    const stage = stageFromMission(missionId) ?? draft.stageId;
    setDraft((d) => ({
      ...d,
      missionId,
      stageId: stage,
      updatedAtISO: new Date().toISOString(),
    }));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-fog">
        {t(ui.journalExport, locale)} —{" "}
        {locale === "fa"
          ? "در بستهٔ ارسال هفتگی بگنجانید"
          : "Include in your weekly packet"}
        .
      </p>
      <div className="flex flex-wrap gap-3 text-xs text-fog">
        <label>
          Mission
          <select
            className="mt-1 min-h-11 border border-line bg-ink px-2 text-paper"
            value={syncedDraft.missionId}
            disabled={readOnly}
            onChange={(e) => setMission(e.target.value as MissionId)}
          >
            {(["M1", "M2", "M3", "M4", "M5"] as MissionId[]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <p className="self-end font-mono text-gold-soft" data-testid="journal-stage">
          Stage {syncedDraft.stageId} · mission {syncedDraft.missionId}
          {stageCheck.warning ? ` · ${stageCheck.warning}` : " · registry OK"}
        </p>
      </div>
      {(
        [
          ["hypothesis", syncedDraft.hypothesis],
          ["falsification", syncedDraft.falsification],
          ["trainTestSplit", syncedDraft.trainTestSplit],
          ["invalidation", syncedDraft.invalidation],
          ["emotions", syncedDraft.emotions],
          ["counterevidence", syncedDraft.counterevidence],
          ["nextTask", syncedDraft.nextTask],
        ] as const
      ).map(([key, value]) => (
        <label key={key} className="block text-xs text-fog">
          {key}
          <textarea
            className="mt-1 min-h-20 w-full border border-line bg-ink px-3 py-2 text-base text-paper"
            value={value}
            disabled={readOnly}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                [key]: e.target.value,
                stageId: syncedDraft.stageId,
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
              exportJournalMarkdown(syncedDraft),
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
          data-testid="copy-markdown"
          onClick={async () => {
            const md = exportJournalMarkdown(syncedDraft);
            const r = await copyTextToClipboard(md);
            setMessage(
              r.ok ? "Copied Markdown to clipboard" : `Copy failed: ${r.error}`,
            );
          }}
        >
          Copy Markdown
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-4 text-sm text-fog"
          disabled={readOnly}
          data-testid="export-json"
          onClick={() =>
            runDownload(
              "sfa-journal.json",
              exportJournalJson(syncedDraft),
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
            const migrated = migrateJournalV1ToV2(syncedDraft, locale);
            if (!migrated.value) {
              setMessage("V2 migrate failed");
              return;
            }
            const reconciled = {
              ...migrated.value,
              stage: stageFromMission(migrated.value.missionId) ?? migrated.value.stage,
            };
            runDownload(
              "sfa-journal-v2.md",
              exportJournalV2Markdown(reconciled),
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
              alias: syncedDraft.alias,
              locale,
              stage: syncedDraft.stageId,
              missionId: syncedDraft.missionId,
              advancedModule: null,
              attemptId: syncedDraft.attemptId,
              scenarioId: syncedDraft.scenarioId,
              scenarioVersion: syncedDraft.scenarioVersion,
              updatedAtISO: syncedDraft.updatedAtISO,
              parentV1Id: syncedDraft.id,
            });
            empty.hypothesis = syncedDraft.hypothesis;
            empty.falsification = syncedDraft.falsification;
            empty.trainTestSplit = syncedDraft.trainTestSplit;
            empty.invalidation = syncedDraft.invalidation;
            empty.emotions = syncedDraft.emotions;
            empty.counterevidence = syncedDraft.counterevidence;
            empty.nextTask = syncedDraft.nextTask;
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
            const migrated = migrateJournalV1ToV2(syncedDraft, locale);
            if (!migrated.value) return;
            runDownload(
              "sfa-journal-v2.csv",
              exportJournalV2Csv({
                ...migrated.value,
                stage:
                  stageFromMission(migrated.value.missionId) ??
                  migrated.value.stage,
              }),
              "text/csv;charset=utf-8",
            );
          }}
        >
          Export CSV (flat)
        </button>
      </div>
      {lastDownload ? (
        <p
          className="font-mono text-xs text-teal-bright"
          data-testid="download-status"
        >
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
            const stage =
              stageFromMission(v2.draft.missionId) ?? v2.draft.stage;
            setDraft({
              ...createEmptyJournal({
                id: v2.draft.parentV1Id ?? v2.draft.id,
                alias: v2.draft.alias,
                stageId: stage,
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
            setMessage(
              `Import failed: ${[...v2.errors, ...result.errors].join(", ")}`,
            );
            return;
          }
          const stage =
            stageFromMission(result.draft.missionId) ?? result.draft.stageId;
          setDraft({ ...result.draft, stageId: stage });
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
