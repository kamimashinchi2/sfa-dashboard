"use client";

import { useState } from "react";
import type { Text } from "../../lib/academy/contracts";
import { t } from "../../lib/academy/dictionary";
import { useProgress } from "./ProgressProvider";

export default function SocraticPrompt({
  question,
  rubric,
  onSubmitted,
}: {
  question: Text;
  rubric: Text[];
  onSubmitted?: (text: string) => void;
}) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const [text, setText] = useState("");
  const [checks, setChecks] = useState<boolean[]>(() => rubric.map(() => false));
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="border border-line bg-ink p-4">
      <p className="text-xs tracking-[0.18em] text-teal-bright uppercase">
        Socratic diagnostic (1)
      </p>
      <p className="mt-2 text-sm text-paper">{t(question, locale)}</p>
      <label className="mt-4 block text-xs text-fog">
        {locale === "fa" ? "پاسخ آزاد (بدون نمره‌دهی واژه‌ای)" : "Free response (never keyword-graded)"}
        <textarea
          className="mt-2 min-h-28 w-full border border-line bg-ink-elevated px-3 py-2 text-sm text-paper"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <fieldset className="mt-4 space-y-2">
        <legend className="text-xs text-fog">
          {locale === "fa" ? "خودارزیابی بر اساس روبریک" : "Rubric self-assessment"}
        </legend>
        {rubric.map((item, idx) => (
          <label key={idx} className="flex min-h-11 items-start gap-2 text-sm text-fog">
            <input
              type="checkbox"
              className="mt-1"
              checked={checks[idx] ?? false}
              onChange={(e) => {
                const next = [...checks];
                next[idx] = e.target.checked;
                setChecks(next);
              }}
            />
            <span>{t(item, locale)}</span>
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        className="mt-4 min-h-11 border border-gold/50 px-4 text-sm text-gold-soft"
        disabled={!text.trim()}
        onClick={() => {
          setSubmitted(true);
          onSubmitted?.(text);
        }}
      >
        {locale === "fa" ? "ثبت برای مرور منتور" : "Submit for mentor review"}
      </button>
      {submitted ? (
        <p className="mt-3 text-xs text-gold-soft" aria-live="polite">
          PENDING_REVIEW — {locale === "fa" ? "بدون ادعای فهم AI" : "no AI comprehension claim"}
        </p>
      ) : null}
    </div>
  );
}
