"use client";

import { useMemo, useState } from "react";
import type { Attempt, MissionId, RiskStatus } from "../../lib/academy/contracts";
import { getMission } from "../../lib/academy/curriculum";
import { ASSESSMENT_CRITERIA_VERSION } from "../../lib/academy/quizzes";
import { t } from "../../lib/academy/dictionary";
import { evaluateReadiness } from "../../lib/academy/grading";
import {
  latestValidAttempt,
  resolveMissionAccess,
} from "../../lib/academy/unlock";
import {
  pushSelfReport,
  responsesStore,
} from "../../lib/academy/persist";
import MicroLesson from "./MicroLesson";
import QuizGate from "./QuizGate";
import SetupValidator from "./SetupValidator";
import MacroTransmissionBuilder from "./MacroTransmissionBuilder";
import RiskGridCalculator from "./RiskGridCalculator";
import JournalBuilder from "./JournalBuilder";
import PerformanceCard from "./PerformanceCard";
import { useProgress } from "./ProgressProvider";

export default function MissionWorkspace({ missionId }: { missionId: string }) {
  const mission = getMission(missionId);
  const { progress, recordAttempt, completeLesson } = useProgress();
  const locale = progress.locale;

  const access = useMemo(
    () =>
      mission
        ? resolveMissionAccess(progress, mission.id as MissionId)
        : { mode: "READ_ONLY_PREVIEW" as const, reason: "UNKNOWN" },
    [mission, progress],
  );
  const readOnly = access.mode === "READ_ONLY_PREVIEW";

  const saved = mission
    ? latestValidAttempt(progress, mission.id as MissionId)
    : null;

  const [lessonDone, setLessonDone] = useState(
    () => Boolean(saved) || false,
  );
  const [quizScore, setQuizScore] = useState<number | null>(
    () => saved?.quizScore ?? null,
  );
  const [taskComplete, setTaskComplete] = useState(
    () => saved?.taskComplete ?? false,
  );
  const [practicalValidated, setPracticalValidated] = useState(
    () => Boolean(saved?.practicalEvidence),
  );
  const [freeTextSubmitted, setFreeTextSubmitted] = useState(
    () => Boolean(saved),
  );
  const [riskStatus, setRiskStatus] = useState<RiskStatus | null>(
    () => saved?.riskStatus ?? null,
  );
  const [sizerOpen, setSizerOpen] = useState(false);
  const [weakTopics, setWeakTopics] = useState<string[]>(
    () => saved?.weakTopics ?? [],
  );

  if (!mission) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl text-paper">Mission not found</h1>
        <p className="mt-4 text-fog">
          Valid ids: M1, M2, M3, M4, M5.{" "}
          <a className="text-gold-soft" href="/academy">
            Back to academy
          </a>
        </p>
      </div>
    );
  }

  const needsRisk = mission.id === "M1" || mission.id === "M3";
  const effectiveRisk = needsRisk ? riskStatus : null;

  const readiness =
    quizScore === null
      ? null
      : evaluateReadiness({
          quizScore,
          taskComplete: taskComplete && (mission.id !== "M2" || practicalValidated),
          riskStatus: effectiveRisk,
          freeTextSubmitted: freeTextSubmitted || lessonDone,
          missionRequiresRisk: needsRisk,
        });

  const persistAttempt = (
    score: number,
    topics: string[],
    overrides?: Partial<Attempt>,
  ) => {
    if (readOnly) return;
    const taskOk =
      overrides?.taskComplete ??
      (taskComplete && (mission.id !== "M2" || practicalValidated));
    const gate = evaluateReadiness({
      quizScore: score,
      taskComplete: taskOk,
      riskStatus: effectiveRisk,
      freeTextSubmitted: freeTextSubmitted || lessonDone,
      missionRequiresRisk: needsRisk,
    });
    // Keep a single unlock-driving attempt id per mission for progress facade.
    // Detailed per-item evidence lives in sfa.v2.quiz (QuizAttemptRecord).
    const { id: _ignoredId, ...restOverrides } = overrides ?? {};
    void _ignoredId;
    const attempt: Attempt = {
      id: `${mission.id}-v${ASSESSMENT_CRITERIA_VERSION}-latest`,
      missionId: mission.id,
      scenarioVersion: 1,
      quizScore: score,
      numericPass: gate.numericPass,
      taskComplete: taskOk,
      riskStatus: gate.riskStatus,
      readiness: gate.readiness,
      weakTopics: [...new Set(topics)],
      assessmentCriteriaVersion: ASSESSMENT_CRITERIA_VERSION,
      practicalEvidence:
        restOverrides.practicalEvidence ?? saved?.practicalEvidence ?? null,
      ...restOverrides,
    };
    recordAttempt(attempt);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10 sm:px-8">
      <header>
        <p className="text-[10px] tracking-[0.22em] text-teal-bright uppercase">
          {mission.id} · stages {mission.stages.join(", ")} ·{" "}
          {readOnly ? "READ_ONLY_PREVIEW" : "ASSESSED"} · {access.reason}
        </p>
        <h1 className="mt-2 font-display text-4xl text-paper">
          {t(mission.title, locale)}
        </h1>
        <p className="mt-3 max-w-3xl text-fog">{t(mission.summary, locale)}</p>
        {readOnly ? (
          <p className="mt-3 border border-line bg-ink/40 p-3 text-sm text-gold-soft">
            {locale === "fa"
              ? "پیش‌نمایش فقط‌خواندنی — برای تلاش assessed پیش‌نیاز را کامل کنید. Viewing preview جدا از پیشرفت کسب‌شده است."
              : "Read-only preview — complete prerequisites for assessed attempts. Viewing preview is separate from earned progress."}
          </p>
        ) : null}
        {saved ? (
          <p className="mt-2 font-mono text-xs text-teal-bright">
            Hydrated from attempt {saved.id}: score={saved.quizScore} task=
            {String(saved.taskComplete)} readiness={saved.readiness}
          </p>
        ) : null}
      </header>

      <div className="space-y-8">
        {mission.lessons.map((lesson) => (
          <MicroLesson
            key={lesson.id}
            lesson={lesson}
            onComplete={() => {
              if (readOnly) return;
              setLessonDone(true);
              setFreeTextSubmitted(true);
              completeLesson(lesson.id);
            }}
          />
        ))}
      </div>

      <section className="space-y-3 border border-line bg-ink/30 p-5">
        <h2 className="font-display text-2xl text-paper">
          {locale === "fa" ? "تمرین عملی" : "Practical task"}
        </h2>
        <p className="text-sm text-fog">{t(mission.practicalTask, locale)}</p>
        {mission.id === "M2" || mission.id === "M3" ? (
          <SetupValidator
            readOnly={readOnly}
            onPracticalResult={(pass, evidence) => {
              setPracticalValidated(pass);
              if (pass) setTaskComplete(true);
              if (quizScore !== null) {
                persistAttempt(quizScore, weakTopics, {
                  taskComplete: pass,
                  practicalEvidence: evidence,
                });
              }
            }}
          />
        ) : null}
        {mission.id === "M4" ? (
          <MacroTransmissionBuilder
            readOnly={readOnly}
            onAssessedScore={(score, credit) => {
              if (credit && score !== null && score >= 50) {
                setTaskComplete(true);
                setPracticalValidated(true);
              }
            }}
          />
        ) : null}
        {mission.id === "M5" ? <JournalBuilder readOnly={readOnly} /> : null}
        {mission.id === "M1" || mission.id === "M3" ? (
          <button
            type="button"
            className="min-h-11 border border-gold/50 px-4 text-sm text-gold-soft"
            disabled={readOnly}
            onClick={() => setSizerOpen(true)}
          >
            Open Risk Grid
          </button>
        ) : null}
        <label className="flex min-h-11 items-center gap-2 text-sm text-fog">
          <input
            type="checkbox"
            checked={taskComplete}
            disabled={readOnly || (mission.id === "M2" && !practicalValidated)}
            onChange={(e) => {
              if (mission.id === "M2" && !practicalValidated) return;
              setTaskComplete(e.target.checked);
              if (e.target.checked) {
                responsesStore.set(
                  pushSelfReport(responsesStore.getSnapshot(), {
                    kind: "PRACTICAL_COMPLETE",
                    refId: mission.id,
                    atISO: new Date().toISOString(),
                  }),
                );
              }
            }}
          />
          {locale === "fa"
            ? "خودبررسی (نمره‌دهی نشده): تمرین کامل شد"
            : "Self-check (not graded): Mark practical complete"}
          {mission.id === "M2"
            ? locale === "fa"
              ? " (پس از اعتبارسنجی حاشیه)"
              : " (after annotation validation)"
            : ""}
        </label>
      </section>

      <QuizGate
        items={mission.quiz}
        quizId={mission.id}
        readOnly={readOnly}
        mode={readOnly ? "READ_ONLY_PREVIEW" : "ASSESSED"}
        initialScore={quizScore}
        onScored={(score, topics, detailed) => {
          setQuizScore(score);
          setWeakTopics(topics);
          persistAttempt(score, topics, { id: detailed.attemptId });
        }}
      />

      {saved?.archivedLegacy ? (
        <p className="border border-line bg-ink/40 p-3 text-sm text-gold-soft">
          {locale === "fa"
            ? "تلاش بایگانی‌شدهٔ قدیمی — نیاز به ارزیابی مجدد. بدون نشان نمره."
            : "Archived legacy attempt, reassessment required. No score badge."}
        </p>
      ) : null}

      {readiness && !saved?.archivedLegacy ? (
        <div className="border border-line p-4" aria-live="polite">
          <p className="font-mono text-sm text-gold-soft">
            numericPass={String(readiness.numericPass)} · readiness=
            {readiness.readiness}
            {readiness.ownerReviewRequired ? " · OWNER_REVIEW_REQUIRED" : ""}
            {readiness.readiness === "MENTOR_PENDING" ||
            readiness.readiness === "PENDING_REVIEW"
              ? " · (local readiness — not sent)"
              : ""}
          </p>
          <p className="mt-2 text-xs text-fog">
            No certification awarded. Client scores are UNVERIFIED until mentor review.
            Assessment criteria v{ASSESSMENT_CRITERIA_VERSION}.{" "}
            <a className="text-gold-soft underline" href="/submit">
              {locale === "fa" ? "بستهٔ ارسال" : "Submission packet"}
            </a>
          </p>
        </div>
      ) : null}

      <PerformanceCard
        riskScore={quizScore}
        technicalMacroScore={quizScore}
        journalingScore={lessonDone ? 80 : null}
        riskStatus={effectiveRisk}
      />

      <RiskGridCalculator
        open={sizerOpen}
        onClose={() => setSizerOpen(false)}
        missionId={mission.id}
        onResult={(r) => {
          setRiskStatus(r.status);
          if (quizScore !== null) {
            persistAttempt(quizScore, weakTopics, {
              riskStatus: r.status,
            } as Partial<Attempt>);
          }
        }}
      />
    </div>
  );
}
