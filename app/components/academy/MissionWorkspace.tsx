"use client";

import { useState } from "react";
import type { Attempt, MissionId, RiskStatus } from "../../lib/academy/contracts";
import { ASSESSMENT_CRITERIA_VERSION } from "../../lib/academy/assessmentVersion";
import { t } from "../../lib/academy/dictionary";
import { evaluateReadiness } from "../../lib/academy/grading";
import {
  latestValidAttempt,
  resolveMissionAccess,
} from "../../lib/academy/unlock";
import type { AuthorizedContent } from "../../lib/academy/useAuthorizedContent";
import ContentGate from "./ContentGate";
import MicroLesson from "./MicroLesson";
import QuizGate from "./QuizGate";
import SetupValidator from "./SetupValidator";
import MacroTransmissionBuilder from "./MacroTransmissionBuilder";
import RiskGridCalculator from "./RiskGridCalculator";
import JournalBuilder from "./JournalBuilder";
import { useServerResponses } from "../../lib/academy/stageResponses";
import { useProgress } from "./ProgressProvider";

function MissionBody({
  content,
}: {
  content: AuthorizedContent;
  refresh: () => void;
}) {
  const mission = content;
  const { progress, recordAttempt } = useProgress();
  const locale = progress.locale;
  useServerResponses(content.stages[0], content.id);

  const access = resolveMissionAccess(progress, mission.id as MissionId);
  // The server already authorized this lesson body. Local XP cannot lock it
  // into a preview or unlock a stage Python did not return.
  const readOnly = false;
  void access;

  const saved = latestValidAttempt(progress, mission.id as MissionId);

  const lessonDone = Boolean(saved);
  const [quizScore, setQuizScore] = useState<number | null>(
    () => saved?.quizScore ?? null,
  );
  const [taskComplete, setTaskComplete] = useState(
    () => saved?.taskComplete ?? false,
  );
  const [practicalValidated, setPracticalValidated] = useState(
    () => Boolean(saved?.practicalEvidence),
  );
  const freeTextSubmitted = Boolean(saved);
  const [riskStatus, setRiskStatus] = useState<RiskStatus | null>(
    () => saved?.riskStatus ?? null,
  );
  const [sizerOpen, setSizerOpen] = useState(false);
  const [weakTopics, setWeakTopics] = useState<string[]>(
    () => saved?.weakTopics ?? [],
  );

  const needsRisk = mission.id === "M1" || mission.id === "M3";
  const effectiveRisk = needsRisk ? riskStatus : null;

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
    const { id: _ignoredId, ...restOverrides } = overrides ?? {};
    void _ignoredId;
    const attempt: Attempt = {
      id: `${mission.id}-v${ASSESSMENT_CRITERIA_VERSION}-latest`,
      missionId: mission.id as MissionId,
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
        <h1 className="mt-2 font-display text-4xl text-paper">
          {t(mission.title, locale)}
        </h1>
        <p className="mt-3 max-w-3xl text-fog">{t(mission.summary, locale)}</p>
      </header>

      <div className="space-y-8">
        {mission.lessons.map((lesson) => (
          <MicroLesson key={lesson.id} lesson={lesson} />
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
            ? "تلاش بایگانی‌شدهٔ قدیمی — نیاز به ارزیابی مجدد."
            : "Archived legacy attempt, reassessment required."}
        </p>
      ) : null}

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

export default function MissionWorkspace({ missionId }: { missionId: string }) {
  return (
    <ContentGate missionId={missionId}>
      {(content, refresh) => (
        <MissionBody content={content} refresh={refresh} />
      )}
    </ContentGate>
  );
}
