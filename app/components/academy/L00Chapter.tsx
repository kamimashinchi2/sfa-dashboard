"use client";

import Link from "next/link";
import MicroLesson from "./MicroLesson";
import { NextLevel } from "./L00Level";
import { packLessons } from "../../lib/academy/v3Lessons";
import { useProgress } from "./ProgressProvider";

export default function L00Chapter({ code }: { code: string }) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const lessons = packLessons("L00", "L00");
  const lesson = lessons.find((item) => item.id === code);
  const index = lessons.findIndex((item) => item.id === code);
  const next = index >= 0 ? lessons[index + 1] : undefined;
  if (!lesson) return null;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-10 sm:px-8">
      <p className="text-sm">
        <Link className="text-gold-soft hover:underline" href="/academy/l00">
          L00
        </Link>
      </p>
      <MicroLesson lesson={lesson} />
      {next ? (
        <Link className="inline-flex min-h-11 items-center text-gold-soft hover:underline" href={`/academy/l00/${next.id}`}>
          {locale === "fa" ? "فصل بعد" : "Next chapter"}
        </Link>
      ) : (
        <NextLevel />
      )}
    </div>
  );
}
