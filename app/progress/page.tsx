"use client";

import AcademyShell from "../components/academy/AcademyShell";
import StudentDashboard from "../components/academy/StudentDashboard";
import { useProgress } from "../components/academy/ProgressProvider";

function ProgressBody() {
  const { progress } = useProgress();
  const locale = progress.locale;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6" data-testid="progress-page">
      <h1 className="font-display text-3xl text-paper">
        {locale === "fa" ? "داشبورد" : "Dashboard"}
      </h1>
      <p className="text-sm text-gold-soft">
        {locale === "fa"
          ? "نمره و باز شدن درس روی سرور آکادمی است."
          : "Grades and lesson unlocks are stored on the academy server."}
      </p>
      <StudentDashboard locale={locale} />
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
