"use client";

import { useMemo, useState } from "react";
import type { QuizItem } from "../../lib/academy/curriculum";
import { t } from "../../lib/academy/dictionary";
import { scoreQuiz, type QuizAnswer } from "../../lib/academy/grading";
import { useProgress } from "./ProgressProvider";

export default function QuizGate({
  items,
  onScored,
  initialAnswers,
  initialScore,
  readOnly,
}: {
  items: QuizItem[];
  onScored: (score: number, weakTopics: string[]) => void;
  initialAnswers?: Record<string, QuizAnswer>;
  initialScore?: number | null;
  readOnly?: boolean;
}) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>(
    () => initialAnswers ?? {},
  );
  const [result, setResult] = useState<ReturnType<typeof scoreQuiz> | null>(
    () =>
      initialScore != null
        ? {
            score: initialScore,
            correct: Math.round((initialScore / 100) * items.length),
            total: items.length,
            weakTopics: [],
            perItem: items.map((i) => ({
              id: i.id,
              pass: true,
              remediationTopic: i.remediationTopic,
            })),
          }
        : null,
  );

  const remediation = useMemo(() => result?.weakTopics ?? [], [result]);

  const setOrder = (item: QuizItem, next: number[]) => {
    setAnswers((a) => ({ ...a, [item.id]: next }));
  };

  const move = (item: QuizItem, index: number, dir: -1 | 1) => {
    const current =
      (answers[item.id] as number[] | undefined) ??
      (item.options?.map((_, i) => i) ?? []);
    const j = index + dir;
    if (j < 0 || j >= current.length) return;
    const next = [...current];
    const tmp = next[index]!;
    next[index] = next[j]!;
    next[j] = tmp;
    setOrder(item, next);
  };

  return (
    <section className="space-y-4" aria-labelledby="quiz-heading">
      <h3 id="quiz-heading" className="font-display text-2xl text-paper">
        {locale === "fa" ? "آزمون عینی (۱۰ مورد)" : "Objective quiz (10 items)"}
        {readOnly
          ? locale === "fa"
            ? " — پیش‌نمایش فقط‌خواندنی"
            : " — read-only preview"
          : ""}
      </h3>
      {items.map((item) => {
        const orderState =
          (answers[item.id] as number[] | undefined) ??
          (item.options?.map((_, i) => i) ?? []);
        return (
          <div key={item.id} className="border border-line bg-ink/40 p-4">
            <p className="text-sm text-paper">{t(item.prompt, locale)}</p>
            {item.kind === "mc" && item.options ? (
              <div className="mt-3 space-y-2" role="radiogroup" aria-label={item.id}>
                {item.options.map((opt, idx) => (
                  <label
                    key={idx}
                    className="flex min-h-11 items-center gap-2 text-sm text-fog"
                  >
                    <input
                      type="radio"
                      name={item.id}
                      checked={answers[item.id] === idx}
                      disabled={readOnly}
                      onChange={() =>
                        setAnswers((a) => ({ ...a, [item.id]: idx }))
                      }
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
                disabled={readOnly}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [item.id]: e.target.value }))
                }
              />
            ) : null}
            {item.kind === "order" && item.options ? (
              <div className="mt-3 space-y-2" role="list" aria-label={`${item.id}-order`}>
                <p className="text-xs text-fog">
                  {locale === "fa"
                    ? "با دکمه‌های بالا/پایین ترتیب را تنظیم کنید."
                    : "Use Up/Down controls to set the order."}
                </p>
                {orderState.map((optIdx, pos) => (
                  <div
                    key={`${item.id}-${optIdx}`}
                    role="listitem"
                    className="flex min-h-11 items-center gap-2 border border-line/60 px-2"
                  >
                    <span className="font-mono text-xs text-teal-bright w-6">
                      {pos + 1}.
                    </span>
                    <span className="flex-1 text-sm text-fog">
                      {t(item.options![optIdx]!, locale)}
                    </span>
                    <button
                      type="button"
                      className="min-h-11 border border-line px-2 text-xs text-fog"
                      disabled={readOnly || pos === 0}
                      aria-label={`Move up ${item.id} item ${pos + 1}`}
                      onClick={() => move(item, pos, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="min-h-11 border border-line px-2 text-xs text-fog"
                      disabled={readOnly || pos === orderState.length - 1}
                      aria-label={`Move down ${item.id} item ${pos + 1}`}
                      onClick={() => move(item, pos, 1)}
                    >
                      ↓
                    </button>
                    <label className="sr-only" htmlFor={`${item.id}-sel-${pos}`}>
                      Select position {pos + 1}
                    </label>
                    <select
                      id={`${item.id}-sel-${pos}`}
                      className="min-h-11 border border-line bg-ink text-xs text-paper"
                      disabled={readOnly}
                      value={optIdx}
                      aria-label={`Select option for position ${pos + 1}`}
                      onChange={(e) => {
                        const chosen = Number(e.target.value);
                        const next = [...orderState];
                        const swapAt = next.indexOf(chosen);
                        next[swapAt] = next[pos]!;
                        next[pos] = chosen;
                        setOrder(item, next);
                      }}
                    >
                      {item.options!.map((opt, idx) => (
                        <option key={idx} value={idx}>
                          {t(opt, locale)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
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
        );
      })}
      <button
        type="button"
        className="min-h-11 bg-gold px-4 text-sm font-semibold text-ink disabled:opacity-40"
        disabled={readOnly}
        onClick={() => {
          // Ensure order answers are populated before scoring
          const filled = { ...answers };
          for (const item of items) {
            if (item.kind === "order" && filled[item.id] === undefined) {
              filled[item.id] = item.options?.map((_, i) => i) ?? [];
            }
          }
          const scored = scoreQuiz(items, filled);
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
