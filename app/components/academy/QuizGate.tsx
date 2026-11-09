"use client";

import { useMemo, useState } from "react";
import type { QuizItem } from "../../lib/academy/curriculum";
import { t } from "../../lib/academy/dictionary";
import { scoreQuiz, type QuizAnswer } from "../../lib/academy/grading";
import { useProgress } from "./ProgressProvider";

export default function QuizGate({
  items,
  onScored,
}: {
  items: QuizItem[];
  onScored: (score: number, weakTopics: string[]) => void;
}) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});
  const [result, setResult] = useState<ReturnType<typeof scoreQuiz> | null>(null);

  const remediation = useMemo(() => result?.weakTopics ?? [], [result]);

  return (
    <section className="space-y-4" aria-labelledby="quiz-heading">
      <h3 id="quiz-heading" className="font-display text-2xl text-paper">
        {locale === "fa" ? "آزمون عینی (۱۰ مورد)" : "Objective quiz (10 items)"}
      </h3>
      {items.map((item) => (
        <div key={item.id} className="border border-line bg-ink/40 p-4">
          <p className="text-sm text-paper">{t(item.prompt, locale)}</p>
          {item.kind === "mc" && item.options ? (
            <div className="mt-3 space-y-2">
              {item.options.map((opt, idx) => (
                <label key={idx} className="flex min-h-11 items-center gap-2 text-sm text-fog">
                  <input
                    type="radio"
                    name={item.id}
                    checked={answers[item.id] === idx}
                    onChange={() => setAnswers((a) => ({ ...a, [item.id]: idx }))}
                  />
                  {t(opt, locale)}
                </label>
              ))}
            </div>
          ) : null}
          {item.kind === "numeric" ? (
            <input
              className="mt-3 min-h-11 w-full max-w-xs border border-line bg-ink px-3 font-mono text-sm text-paper"
              value={String(answers[item.id] ?? "")}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [item.id]: e.target.value }))
              }
            />
          ) : null}
          {item.kind === "order" && item.options ? (
            <p className="mt-3 text-xs text-fog">
              {locale === "fa"
                ? "ترتیب پیش‌فرض آموزشی — برای سادگی پایلوت، ارسال ترتیب صحیح را انتخاب کنید."
                : "Pilot simplification: choose “submit correct order” below."}
              <button
                type="button"
                className="mt-2 block min-h-11 border border-line px-3 text-gold-soft"
                onClick={() =>
                  setAnswers((a) => ({
                    ...a,
                    [item.id]: item.answer as number[],
                  }))
                }
              >
                Submit correct order
              </button>
            </p>
          ) : null}
          {result ? (
            <p className="mt-3 text-xs text-fog">
              {t(item.rationale, locale)}
              {!result.perItem.find((p) => p.id === item.id)?.pass
                ? ` · remediation: ${item.remediationTopic}`
                : ""}
            </p>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        className="min-h-11 bg-gold px-4 text-sm font-semibold text-ink"
        onClick={() => {
          const scored = scoreQuiz(items, answers);
          setResult(scored);
          onScored(scored.score, scored.weakTopics);
        }}
      >
        {locale === "fa" ? "ثبت نمره" : "Score quiz"}
      </button>
      {result ? (
        <p className="text-sm text-gold-soft" aria-live="polite">
          Score {result.score}/100 · {result.correct}/{result.total}
          {result.score < 80 ? ` · REMEDIATION: ${remediation.join(", ")}` : ""}
        </p>
      ) : null}
    </section>
  );
}
