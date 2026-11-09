"use client";

import { useMemo, useState } from "react";
import type { AdvancedId, Attempt, RiskStatus } from "../../lib/academy/contracts";
import { getAdvanced } from "../../lib/academy/advancedCurriculum";
import { ASSESSMENT_CRITERIA_VERSION } from "../../lib/academy/quizzes";
import { t } from "../../lib/academy/dictionary";
import { evaluateReadiness } from "../../lib/academy/grading";
import { latestValidAttempt, missionPassedForUnlock } from "../../lib/academy/unlock";
import MicroLesson from "./MicroLesson";
import QuizGate from "./QuizGate";
import ResearchLab from "./ResearchLab";
import EquityDrawdownLab from "./EquityDrawdownLab";
import CrossAssetCapstone from "./CrossAssetCapstone";
import PerformanceCard from "./PerformanceCard";
import { useProgress } from "./ProgressProvider";

export default function AdvancedTrack({ moduleId }: { moduleId: string }) {
  const mod = getAdvanced(moduleId);
  const { progress, recordAttempt, completeLesson } = useProgress();
  const locale = progress.locale;

  const assessedEnabled = Boolean(progress.advancedAssessedEnabled);
  // Transparent practice gate: need M5 pass for assessed advanced; else preview
  const prereqOk = missionPassedForUnlock(progress, "M5");
  const readOnly = !assessedEnabled || !prereqOk;

  const saved = mod
    ? latestValidAttempt(progress, mod.id as AdvancedId)
    : null;

  const [lessonDone, setLessonDone] = useState(Boolean(saved));
  const [quizScore, setQuizScore] = useState<number | null>(saved?.quizScore ?? null);
  const [taskComplete, setTaskComplete] = useState(saved?.taskComplete ?? false);
  const [riskStatus] = useState<RiskStatus | null>(null);

  const readiness = useMemo(() => {
    if (quizScore === null) return null;
    return evaluateReadiness({
      quizScore,
      taskComplete,
      riskStatus: null,
      freeTextSubmitted: lessonDone,
      missionRequiresRisk: false,
    });
  }, [quizScore, taskComplete, lessonDone]);

  if (!mod) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl text-paper">Advanced module not found</h1>
        <p className="mt-4 text-fog">Valid: A6, A7, A8</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10 sm:px-8">
      <header>
        <p className="text-[10px] tracking-[0.22em] text-teal-bright uppercase">
          {mod.id} · stages {mod.stages.join(", ")} ·{" "}
          {readOnly ? "READ_ONLY_PREVIEW / feature-flagged" : "ASSESSED"}
        </p>
        <h1 className="mt-2 font-display text-4xl text-paper">
          {t(mod.title, locale)}
        </h1>
        <p className="mt-3 max-w-3xl text-fog">{t(mod.summary, locale)}</p>
        <p className="mt-2 text-xs text-gold-soft">
          Advanced completion is feature-flagged until tests and mentor content review
          pass. Five intro missions never imply graduation.
          {!prereqOk
            ? " Complete M5 assessed practice before advanced assessed attempts."
            : ""}
          {!assessedEnabled ? " Flag advancedAssessedEnabled is off." : ""}
        </p>
        {progress.selectedStage >= 6 ? (
          <p className="mt-1 text-xs text-fog">
            Viewing Stage {progress.selectedStage} (preview) — separate from earned
            stage progress.
          </p>
        ) : null}
      </header>

      <div className="space-y-8">
        {mod.lessons.map((lesson) => (
          <MicroLesson
            key={lesson.id}
            lesson={lesson}
            onComplete={() => {
              if (readOnly) return;
              setLessonDone(true);
              completeLesson(lesson.id);
            }}
          />
        ))}
      </div>

      <section className="space-y-3 border border-line bg-ink/30 p-5">
        <h2 className="font-display text-2xl text-paper">
          {locale === "fa" ? "تمرین عملی پیشرفته" : "Advanced practical"}
        </h2>
        <p className="text-sm text-fog">{t(mod.practicalTask, locale)}</p>
        {mod.id === "A6" ? <ResearchLab readOnly={readOnly} /> : null}
        {mod.id === "A7" ? <EquityDrawdownLab readOnly={readOnly} /> : null}
        {mod.id === "A8" ? <CrossAssetCapstone readOnly={readOnly} /> : null}
        <label className="flex min-h-11 items-center gap-2 text-sm text-fog">
          <input
            type="checkbox"
            checked={taskComplete}
            disabled={readOnly}
            onChange={(e) => setTaskComplete(e.target.checked)}
          />
          {locale === "fa" ? "تمرین کامل شد" : "Mark practical complete"}
        </label>
      </section>

      <QuizGate
        items={mod.quiz}
        readOnly={readOnly}
        initialScore={quizScore}
        onScored={(score, topics) => {
          setQuizScore(score);
          if (readOnly) return;
          const gate = evaluateReadiness({
            quizScore: score,
            taskComplete,
            riskStatus: null,
            freeTextSubmitted: lessonDone,
            missionRequiresRisk: false,
          });
          const attempt: Attempt = {
            id: `${mod.id}-v${ASSESSMENT_CRITERIA_VERSION}`,
            missionId: mod.id,
            scenarioVersion: 1,
            quizScore: score,
            numericPass: gate.numericPass,
            taskComplete,
            riskStatus: gate.riskStatus,
            readiness: gate.readiness,
            weakTopics: topics,
            assessmentCriteriaVersion: ASSESSMENT_CRITERIA_VERSION,
          };
          recordAttempt(attempt);
        }}
      />

      {readiness ? (
        <div className="border border-line p-4" aria-live="polite">
          <p className="font-mono text-sm text-gold-soft">
            numericPass={String(readiness.numericPass)} · readiness=
            {readiness.readiness}
          </p>
        </div>
      ) : null}

      <PerformanceCard
        riskScore={quizScore}
        technicalMacroScore={quizScore}
        journalingScore={lessonDone ? 80 : null}
        riskStatus={riskStatus}
      />
    </div>
  );
}
