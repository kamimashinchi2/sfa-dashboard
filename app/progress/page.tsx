"use client";

import AcademyShell from "../components/academy/AcademyShell";
import { useProgress } from "../components/academy/ProgressProvider";

function ProgressBody() {
  const { progress, xp, hydrated, warning, storageError } = useProgress();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-6 py-10 sm:px-8">
      <h1 className="font-display text-3xl text-paper">Practice progress</h1>
      <p className="text-sm text-fog">
        localStorage practice only — not entitlement. Hydrated: {String(hydrated)}
      </p>
      {warning ? <p className="text-xs text-gold-soft">{warning}</p> : null}
      {storageError ? <p className="text-xs text-red-400">{storageError}</p> : null}
      <dl className="space-y-2 font-mono text-sm text-gold-soft">
        <div>locale: {progress.locale}</div>
        <div>selectedStage: {progress.selectedStage}</div>
        <div>xp: {xp}</div>
        <div>lessons: {progress.completedLessonIds.join(", ") || "—"}</div>
        <div>attempts: {progress.attempts.length}</div>
      </dl>
      <pre className="overflow-auto border border-line bg-ink p-4 text-[11px] text-fog">
        {JSON.stringify(progress, null, 2)}
      </pre>
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
