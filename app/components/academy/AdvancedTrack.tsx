"use client";

import { useMemo, useState } from "react";
import type { AdvancedId, Attempt, RiskStatus } from "../../lib/academy/contracts";
import { ASSESSMENT_CRITERIA_VERSION } from "../../lib/academy/assessmentVersion";
import { t } from "../../lib/academy/dictionary";
import { evaluateReadiness } from "../../lib/academy/grading";
import { latestValidAttempt, missionPassedForUnlock } from "../../lib/academy/unlock";
import type { AuthorizedContent } from "../../lib/academy/useAuthorizedContent";
import ContentGate from "./ContentGate";
import MicroLesson from "./MicroLesson";
import QuizGate from "./QuizGate";
import ResearchLab from "./ResearchLab";
import EquityDrawdownLab from "./EquityDrawdownLab";
import CrossAssetCapstone from "./CrossAssetCapstone";
import PerformanceCard from "./PerformanceCard";
import { useServerResponses } from "../../lib/academy/stageResponses";
import { useProgress } from "./ProgressProvider";

function AdvancedBody({ content }: { content: AuthorizedContent }) {
  const mod = content;
  const { progress, recordAttempt, completeLesson } = useProgress();
  const locale = progress.locale;
  useServerResponses(content.stages[0], content.id);

  const assessedEnabled = Boolean(progress.advancedAssessedEnabled);
  const prereqOk = missionPassedForUnlock(progress, "M5");
  // Delivered advanced content is server-authorized. Local flags are not the lock.
  const readOnly = false;
  void assessedEnabled;
  void prereqOk;

  const saved = latestValidAttempt(progress, mod.id as AdvancedId);

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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10 sm:px-8">
      <header>
        <p className="text-[10px] tracking-[0.22em] text-teal-bright uppercase">
          {mod.id} · stages {mod.stages.join(", ")} ·{" "}
          {readOnly ? "READ_ONLY_PREVIEW / feature-flagged" : "ASSESSED"}
          {" · entitlement "}
          {content.entitlement.unlockedStage}
        </p>
        {readOnly ? (
          <p
            className="mt-2 border border-gold/40 bg-ink/50 px-3 py-2 text-sm text-gold-soft"
            data-testid="advanced-preview-banner"
          >
            {locale === "fa"
              ? "پیش‌نمایش خواندنی — آزمایشگاه تعاملی برای اعتبارسنجی assessed هنوز قفل است."
              : "Reading preview, interactive lab coming — assessed credit remains feature-flagged."}
          </p>
        ) : null}
        <h1 className="mt-2 font-display text-4xl text-paper">
          {t(mod.title, locale)}
        </h1>
        <p className="mt-3 max-w-3xl text-fog">{t(mod.summary, locale)}</p>
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
          {locale === "fa"
            ? "خودبررسی (نمره‌دهی نشده): تمرین کامل شد"
            : "Self-check (not graded): Mark practical complete"}
        </label>
      </section>

      <QuizGate
        items={mod.quiz}
        quizId={mod.id}
        readOnly={readOnly}
        mode={readOnly ? "READ_ONLY_PREVIEW" : "ASSESSED"}
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
            id: `${mod.id}-v${ASSESSMENT_CRITERIA_VERSION}-latest`,
            missionId: mod.id as AdvancedId,
            scenarioVersion: 1,
            quizScore: score,
            numericPass: gate.numericPass,
            taskComplete,
            riskStatus: gate.riskStatus,
            readiness: gate.readiness,
            weakTopics: [...new Set(topics)],
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

export default function AdvancedTrack({ moduleId }: { moduleId: string }) {
  return (
    <ContentGate moduleId={moduleId}>
      {(content) => <AdvancedBody content={content} />}
    </ContentGate>
  );
}
