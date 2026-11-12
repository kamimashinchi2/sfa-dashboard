"use client";

import type { Lesson } from "../../lib/academy/contracts";
import { t } from "../../lib/academy/dictionary";
import { useProgress } from "./ProgressProvider";

export default function MicroLesson({ lesson }: { lesson: Lesson }) {
  const { progress } = useProgress();
  const locale = progress.locale;

  return (
    <article className="space-y-6 border border-line bg-ink/40 p-5 sm:p-6">
      <header>
        <h3 className="font-display text-2xl text-paper">{t(lesson.title, locale)}</h3>
      </header>
      <section>
        <h4 className="text-xs tracking-[0.18em] text-gold-soft uppercase">
          {locale === "fa" ? "ایده اصلی" : "Main idea"}
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-fog">{t(lesson.core, locale)}</p>
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
    </article>
  );
}
