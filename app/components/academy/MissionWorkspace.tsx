"use client";

import { useState } from "react";
import type { Attempt, RiskStatus } from "../../lib/academy/contracts";
import { getMission } from "../../lib/academy/curriculum";
import { t } from "../../lib/academy/dictionary";
import { evaluateReadiness } from "../../lib/academy/grading";
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
  const { progress, recordAttempt } = useProgress();
  const locale = progress.locale;
  const [lessonDone, setLessonDone] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [taskComplete, setTaskComplete] = useState(false);
  const [freeTextSubmitted, setFreeTextSubmitted] = useState(false);
  const [riskStatus, setRiskStatus] = useState<RiskStatus | null>(null);
  const [sizerOpen, setSizerOpen] = useState(false);

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

  const readiness =
    quizScore === null
      ? null
      : evaluateReadiness({
          quizScore,
          taskComplete,
          riskStatus: mission.id === "M3" || mission.id === "M1" ? riskStatus : riskStatus,
          freeTextSubmitted: freeTextSubmitted || lessonDone,
        });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10 sm:px-8">
      <header>
        <p className="text-[10px] tracking-[0.22em] text-teal-bright uppercase">
          {mission.id} · stages {mission.stages.join(", ")}
        </p>
        <h1 className="mt-2 font-display text-4xl text-paper">
          {t(mission.title, locale)}
        </h1>
        <p className="mt-3 max-w-3xl text-fog">{t(mission.summary, locale)}</p>
      </header>

      <div className="space-y-8">
        {mission.lessons.map((lesson) => (
          <MicroLesson
            key={lesson.id}
            lesson={lesson}
            onComplete={() => {
              setLessonDone(true);
              setFreeTextSubmitted(true);
            }}
          />
        ))}
      </div>

      <section className="space-y-3 border border-line bg-ink/30 p-5">
        <h2 className="font-display text-2xl text-paper">
          {locale === "fa" ? "تمرین عملی" : "Practical task"}
        </h2>
        <p className="text-sm text-fog">{t(mission.practicalTask, locale)}</p>
        {mission.id === "M2" || mission.id === "M3" ? <SetupValidator /> : null}
        {mission.id === "M4" ? <MacroTransmissionBuilder /> : null}
        {mission.id === "M5" ? <JournalBuilder /> : null}
        {mission.id === "M1" || mission.id === "M3" ? (
          <button
            type="button"
            className="min-h-11 border border-gold/50 px-4 text-sm text-gold-soft"
            onClick={() => setSizerOpen(true)}
          >
            Open Risk Grid
          </button>
        ) : null}
        <label className="flex min-h-11 items-center gap-2 text-sm text-fog">
          <input
            type="checkbox"
            checked={taskComplete}
            onChange={(e) => setTaskComplete(e.target.checked)}
          />
          {locale === "fa" ? "تمرین کامل شد" : "Mark practical complete"}
        </label>
      </section>

      <QuizGate
        items={mission.quiz}
        onScored={(score) => {
          setQuizScore(score);
          const gate = evaluateReadiness({
            quizScore: score,
            taskComplete,
            riskStatus,
            freeTextSubmitted: freeTextSubmitted || lessonDone,
          });
          const attempt: Attempt = {
            id: `${mission.id}-${Date.now()}`,
            missionId: mission.id,
            scenarioVersion: 1,
            quizScore: score,
            numericPass: gate.numericPass,
            taskComplete,
            riskStatus: gate.riskStatus,
            readiness: gate.readiness,
            weakTopics: [],
          };
          recordAttempt(attempt);
        }}
      />

      {readiness ? (
        <div className="border border-line p-4" aria-live="polite">
          <p className="font-mono text-sm text-gold-soft">
            numericPass={String(readiness.numericPass)} · readiness={readiness.readiness}
            {readiness.ownerReviewRequired ? " · OWNER_REVIEW_REQUIRED" : ""}
          </p>
          <p className="mt-2 text-xs text-fog">
            No certification awarded. Mentor review remains pending for free text.
          </p>
        </div>
      ) : null}

      <PerformanceCard
        riskScore={quizScore}
        technicalMacroScore={quizScore}
        journalingScore={lessonDone ? 80 : null}
        riskStatus={riskStatus}
      />

      <RiskGridCalculator
        open={sizerOpen}
        onClose={() => setSizerOpen(false)}
        onResult={(r) => setRiskStatus(r.status)}
      />
    </div>
  );
}
