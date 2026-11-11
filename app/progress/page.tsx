"use client";

import { useState } from "react";
import AcademyShell from "../components/academy/AcademyShell";
import StudentDashboard from "../components/academy/StudentDashboard";
import { useProgress } from "../components/academy/ProgressProvider";

function ProgressBody() {
  const {
    progress,
    xp,
    hydrated,
    warning,
    storageError,
    quotaExceeded,
    quarantine,
    exportBackup,
    importBackup,
    resetProgress,
  } = useProgress();
  const locale = progress.locale;
  const [importRaw, setImportRaw] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6" data-testid="progress-page">
      <h1 className="font-display text-3xl text-paper">
        {locale === "fa" ? "داشبورد" : "Dashboard"}
      </h1>
      <p className="text-sm text-gold-soft">
        {locale === "fa"
          ? "نمره و باز شدن درس روی سرور است. ذخیره محلی فقط تمرین و ماشین‌حساب است و درس را باز نمی‌کند."
          : "Grades and lesson unlocks live on the server. Local storage is practice and calculators only and cannot unlock a lesson."}
      </p>

      <StudentDashboard locale={locale} />

      <p className="text-sm text-fog">
        <a href="/submit" className="text-gold-soft underline">
          {locale === "fa" ? "بسته شواهد محلی" : "Local evidence packet"}
        </a>
      </p>
      <details className="text-sm text-fog" data-testid="local-practice-debug">
        <summary className="min-h-11 cursor-pointer">
          {locale === "fa" ? "جزئیات تمرین محلی (درس را باز نمی‌کند)" : "Local practice details (does not unlock lessons)"}
        </summary>
        <p className="mt-2">localStorage practice only — not entitlement. Hydrated: {String(hydrated)}</p>
        {!hydrated ? null : (
          <dl className="mt-2 space-y-2 font-mono text-sm text-gold-soft">
            <div>locale: {progress.locale}</div>
            <div>selectedStage: {progress.selectedStage}</div>
            <div>xp: {xp}</div>
            <div>lessons: {progress.completedLessonIds.join(", ") || "—"}</div>
            <div>attempts: {progress.attempts.length}</div>
          </dl>
        )}
      </details>
      {warning ? <p className="text-xs text-gold-soft">{warning}</p> : null}
      {storageError ? <p className="text-xs text-red-400">{storageError}</p> : null}
      {quotaExceeded ? (
        <div className="border border-gold/50 bg-ink/50 p-3 text-sm text-gold-soft">
          Storage quota exceeded — memory kept. Please Export a full backup.
          <button type="button" className="ms-3 min-h-11 border border-gold/50 px-3 text-xs" onClick={exportBackup}>
            Download full backup
          </button>
        </div>
      ) : null}
      {quarantine ? (
        <div className="border border-red-400/40 p-3 text-sm text-red-300">
          Quarantine: {quarantine.key} · {quarantine.reason}.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 bg-gold px-4 text-sm font-semibold text-ink"
          onClick={exportBackup}
          data-testid="export-backup"
        >
          Download full backup
        </button>
        <button type="button" className="min-h-11 border border-line px-4 text-sm text-fog" onClick={resetProgress}>
          Reset section
        </button>
      </div>

      <label className="block text-xs text-fog">
        Import backup JSON (≤2 MB) — excludes outbox/credentials
        <textarea
          className="mt-1 min-h-28 w-full border border-line bg-ink px-3 py-2 font-mono text-xs text-paper"
          value={importRaw}
          onChange={(e) => setImportRaw(e.target.value)}
          data-testid="import-backup-raw"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 border border-gold/50 px-4 text-sm text-gold-soft"
          onClick={() => {
            const r = importBackup(importRaw, "merge");
            setImportMsg(r.ok ? `Merge OK · sections ${r.diff?.join(",") ?? "—"}` : `Merge failed: ${r.error}`);
          }}
        >
          Merge import
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-4 text-sm text-fog"
          onClick={() => {
            const r = importBackup(importRaw, "replace");
            setImportMsg(r.ok ? `Replace OK · sections ${r.diff?.join(",") ?? "—"}` : `Replace failed: ${r.error}`);
          }}
        >
          Replace import
        </button>
      </div>
      {importMsg ? (
        <p className="text-xs text-gold-soft" aria-live="polite">
          {importMsg}
        </p>
      ) : null}
    </div>
  );
}

export default function ProgressPage() {
  return (
    <AcademyShell>
      <ProgressBody />
    </AcademyShell>
  );
}
