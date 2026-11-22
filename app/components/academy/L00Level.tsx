"use client";

import Link from "next/link";
import MicroLesson from "./MicroLesson";
import { L00_CHAPTERS } from "../../lib/academy/generated/v3PublicL00";
import { packLessons } from "../../lib/academy/v3Lessons";
import { useProgress } from "./ProgressProvider";

const chapters = packLessons("L00", "L00").filter((lesson) =>
  L00_CHAPTERS.some((chapter) => chapter.code === lesson.id),
);

/** Public L00. Logged-in students see the same pages; L01 does not wait on it. */
export default function L00Level() {
  const { progress } = useProgress();
  const locale = progress.locale;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-10 sm:px-8">
      <header className="space-y-3">
        <p className="text-[10px] tracking-[0.18em] text-gold-soft uppercase">L00 · STUB</p>
        <h1 className="font-display text-4xl text-paper">
          {locale === "fa" ? "آمادگی" : "Readiness"}
        </h1>
        <p className="text-fog">
          {locale === "fa"
            ? "این سطح عمومی است. آزمون و نمره ندارد. L01 بعد از آن است و ورود یا دعوت می‌خواهد. تمام کردن L00 درِ L01 نیست."
            : "This level is public. It has no quiz and no grade. L01 is next and needs a login or an invite. Finishing L00 does not gate L01."}
        </p>
      </header>
      <ul className="space-y-2 text-sm">
        {chapters.map((lesson) => (
          <li key={lesson.id}>
            <Link className="text-gold-soft hover:underline" href={`/academy/l00/${lesson.id}`}>
              {lesson.title[locale]}
            </Link>
          </li>
        ))}
      </ul>
      {chapters.map((lesson) => (
        <MicroLesson key={lesson.id} lesson={lesson} />
      ))}
      <NextLevel />
    </div>
  );
}

export function NextLevel() {
  const { progress } = useProgress();
  const locale = progress.locale;
  return (
    <section className="space-y-3 border border-gold/50 bg-ink/50 p-4" data-testid="l00-next">
      <h2 className="font-display text-2xl text-paper">L01</h2>
      <p className="text-sm text-fog">
        {locale === "fa"
          ? "برای L01 وارد شوید یا از لینک دعوت استفاده کنید."
          : "Log in, or open your invite, to start L01."}
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="min-h-11 border border-gold/50 px-3 py-2 text-gold-soft" href="/login">
          {locale === "fa" ? "ورود" : "Log in"}
        </Link>
        <Link className="min-h-11 border border-line px-3 py-2 text-fog" href="/academy/missions/M1">
          L01
        </Link>
      </div>
    </section>
  );
}
