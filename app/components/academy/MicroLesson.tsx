"use client";

import { useState } from "react";
import type { Lesson } from "../../lib/academy/contracts";
import { t } from "../../lib/academy/dictionary";
import { SafeMarkdown } from "../../lib/academy/safeMarkdown";
import { useProgress } from "./ProgressProvider";

export default function MicroLesson({ lesson }: { lesson: Lesson }) {
  const { progress } = useProgress();
  const locale = progress.locale;

  return (
    <article className="space-y-6 border border-line bg-ink/40 p-5 sm:p-6">
      <header>
        {lesson.stub ? (
          <p className="text-[10px] tracking-[0.18em] text-gold-soft uppercase">STUB</p>
        ) : null}
        <h3 className="font-display text-2xl text-paper">{t(lesson.title, locale)}</h3>
      </header>
      {lesson.objectives?.length ? (
        <section>
          <h4 className="text-xs tracking-[0.18em] text-gold-soft uppercase">
            {locale === "fa" ? "هدف‌ها" : "Objectives"}
          </h4>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-fog">
            {lesson.objectives.map((item, index) => (
              <li key={index}>{t(item, locale)}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h4 className="text-xs tracking-[0.18em] text-gold-soft uppercase">
          {locale === "fa" ? "ایده اصلی" : "Main idea"}
        </h4>
        <div className="mt-2">
          <SafeMarkdown source={t(lesson.core, locale)} />
        </div>
      </section>
      <section>
        <h4 className="text-xs tracking-[0.18em] text-gold-soft uppercase">
          {locale === "fa" ? "اشتباه رایج" : "Common mistake"}
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-fog">{t(lesson.trap, locale)}</p>
      </section>
      <section>
        <h4 className="text-xs tracking-[0.18em] text-gold-soft uppercase">
          {locale === "fa" ? "آنچه مهم است" : "What matters"}
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-fog">{t(lesson.reality, locale)}</p>
      </section>
      {lesson.summary ? (
        <section>
          <h4 className="text-xs tracking-[0.18em] text-gold-soft uppercase">
            {locale === "fa" ? "جمع‌بندی" : "Summary"}
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-fog">{t(lesson.summary, locale)}</p>
        </section>
      ) : null}
      {lesson.exercises?.length ? (
        <section className="space-y-3">
          <h4 className="text-xs tracking-[0.18em] text-gold-soft uppercase">
            {locale === "fa" ? "تمرین بدون نمره" : "Ungraded exercise"}
          </h4>
          {lesson.exercises.map((exercise, index) => (
            <ExerciseRow key={index} prompt={t(exercise.prompt, locale)} answer={exercise.selfCheck ? t(exercise.selfCheck, locale) : null} locale={locale} />
          ))}
        </section>
      ) : null}
      {lesson.workedExample ? (
        <section className="border border-gold/40 bg-ink/60 p-4" data-testid="worked-example">
          <h4 className="text-xs tracking-[0.18em] text-gold-soft uppercase">
            {locale === "fa"
              ? "مثال حل‌شده (اعداد آموزشی، نه داده واقعی بازار)"
              : "Worked example (illustrative numbers, not real market data)"}
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-fog">{t(lesson.workedExample, locale)}</p>
          <p className="mt-2 text-xs text-fog">
            {locale === "fa"
              ? "این مثال سیگنال یا توصیه مالی نیست."
              : "This example is not a signal and not financial advice."}
          </p>
        </section>
      ) : null}
    </article>
  );
}

function ExerciseRow({
  prompt,
  answer,
  locale,
}: {
  prompt: string;
  answer: string | null;
  locale: "fa" | "en";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-line p-3 text-sm text-fog">
      <p>{prompt}</p>
      <button
        type="button"
        className="mt-2 min-h-11 text-gold-soft underline-offset-4 hover:underline"
        onClick={() => setOpen((value) => !value)}
      >
        {open
          ? locale === "fa"
            ? "پنهان کردن پاسخ"
            : "Hide answer"
          : locale === "fa"
            ? "نمایش پاسخ"
            : "Show answer"}
      </button>
      {open ? (
        <p className="mt-2">{answer ?? (locale === "fa" ? "پاسخ نمونه ندارد." : "No sample answer.")}</p>
      ) : null}
    </div>
  );
}
