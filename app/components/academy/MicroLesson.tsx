"use client";

import type { Lesson } from "../../lib/academy/contracts";
import { t } from "../../lib/academy/dictionary";
import {
  pushSelfReport,
  responsesStore,
} from "../../lib/academy/persist";
import { useProgress } from "./ProgressProvider";
import SocraticPrompt from "./SocraticPrompt";

export default function MicroLesson({
  lesson,
  onComplete,
}: {
  lesson: Lesson;
  onComplete: () => void;
}) {
  const { progress, completeLesson } = useProgress();
  const locale = progress.locale;

  return (
    <article className="space-y-6 border border-line bg-ink/40 p-5 sm:p-6">
      <header>
        <p className="font-mono text-[10px] tracking-[0.2em] text-teal-bright uppercase">
          {lesson.id}
        </p>
        <h3 className="mt-2 font-display text-2xl text-paper">
          {t(lesson.title, locale)}
        </h3>
      </header>

      <section>
        <h4 className="text-xs tracking-[0.18em] text-gold-soft uppercase">
          Core Mechanism
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-fog">{t(lesson.core, locale)}</p>
      </section>
      <section>
        <h4 className="text-xs tracking-[0.18em] text-gold-soft uppercase">
          Retail Trap
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-fog">{t(lesson.trap, locale)}</p>
      </section>
      <section>
        <h4 className="text-xs tracking-[0.18em] text-gold-soft uppercase">
          Institutional Reality
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-fog">
          {t(lesson.reality, locale)}
        </p>
      </section>

      <SocraticPrompt
        question={lesson.question}
        rubric={lesson.selfReviewRubric}
        lessonId={lesson.id}
        missionId={lesson.missionId}
      />

      <button
        type="button"
        className="min-h-11 bg-gold px-4 text-sm font-semibold text-ink"
        data-testid={`self-check-lesson-${lesson.id}`}
        onClick={() => {
          completeLesson(lesson.id);
          responsesStore.set(
            pushSelfReport(responsesStore.getSnapshot(), {
              kind: "LESSON_REVIEWED",
              refId: lesson.id,
              atISO: new Date().toISOString(),
            }),
          );
          onComplete();
        }}
      >
        {locale === "fa"
          ? "خودبررسی: درس مرور شد (نمره‌دهی نشده)"
          : "Self-check (not graded): Mark lesson reviewed"}
      </button>
    </article>
  );
}
