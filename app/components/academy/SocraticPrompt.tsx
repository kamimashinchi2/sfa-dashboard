"use client";

import { useState, useSyncExternalStore } from "react";
import type { Text } from "../../lib/academy/contracts";
import { t } from "../../lib/academy/dictionary";
import {
  responsesStore,
  upsertLessonResponse,
} from "../../lib/academy/persist";
import { useProgress } from "./ProgressProvider";

export default function SocraticPrompt({
  question,
  rubric,
  lessonId,
  missionId,
  onSubmitted,
}: {
  question: Text;
  rubric: Text[];
  lessonId?: string;
  missionId?: string | null;
  onSubmitted?: (text: string) => void;
}) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const store = useSyncExternalStore(
    responsesStore.subscribe,
    responsesStore.getSnapshot,
    responsesStore.getServerSnapshot,
  );

  const responseId = lessonId ? `resp-${lessonId}` : "resp-local";
  const existing = store.lessonResponses.find((r) => r.id === responseId);

  const [draftText, setDraftText] = useState<string | null>(null);
  const [draftChecks, setDraftChecks] = useState<boolean[] | null>(null);
  const [editing, setEditing] = useState(false);

  const text = draftText ?? existing?.text ?? "";
  const checks = draftChecks ?? existing?.rubricSelfChecks ?? rubric.map(() => false);
  const savedAt = existing?.savedAtISO ?? null;
  const isEditing = editing || !existing;

  const save = () => {
    const at = new Date().toISOString();
    const record = {
      id: responseId,
      lessonId: lessonId ?? "unknown",
      missionId: missionId ?? null,
      text,
      rubricSelfChecks: checks,
      savedAtISO: at,
    };
    responsesStore.set(upsertLessonResponse(responsesStore.getSnapshot(), record));
    setDraftText(null);
    setDraftChecks(null);
    setEditing(false);
    onSubmitted?.(text);
  };

  return (
    <div className="border border-line bg-ink p-4" data-testid="socratic-prompt">
      <p className="text-xs tracking-[0.18em] text-teal-bright uppercase">
        Socratic diagnostic (1)
      </p>
      <p className="mt-2 text-sm text-paper">{t(question, locale)}</p>
      <label className="mt-4 block text-xs text-fog">
        {locale === "fa"
          ? "پاسخ آزاد (بدون نمره‌دهی واژه‌ای)"
          : "Free response (never keyword-graded)"}
        <textarea
          className="mt-2 min-h-28 w-full border border-line bg-ink-elevated px-3 py-2 text-sm text-paper"
          value={text}
          disabled={!isEditing}
          data-testid="socratic-text"
          onChange={(e) => setDraftText(e.target.value)}
        />
      </label>
      <fieldset className="mt-4 space-y-2">
        <legend className="text-xs text-fog">
          {locale === "fa"
            ? "خودارزیابی بر اساس روبریک (نمره‌دهی نشده)"
            : "Rubric self-assessment (not graded)"}
        </legend>
        {rubric.map((item, idx) => (
          <label key={idx} className="flex min-h-11 items-start gap-2 text-sm text-fog">
            <input
              type="checkbox"
              className="mt-1"
              checked={checks[idx] ?? false}
              disabled={!isEditing}
              onChange={(e) => {
                const next = [...checks];
                next[idx] = e.target.checked;
                setDraftChecks(next);
              }}
            />
            <span>{t(item, locale)}</span>
          </label>
        ))}
      </fieldset>
      {isEditing ? (
        <button
          type="button"
          className="mt-4 min-h-11 border border-gold/50 px-4 text-sm text-gold-soft"
          disabled={!text.trim()}
          data-testid="add-to-packet"
          onClick={save}
        >
          {locale === "fa"
            ? "افزودن به بستهٔ ارسال این هفته"
            : "Add to this week's submission packet"}
        </button>
      ) : (
        <button
          type="button"
          className="mt-4 min-h-11 border border-line px-4 text-sm text-fog"
          data-testid="edit-response"
          onClick={() => setEditing(true)}
        >
          {locale === "fa" ? "ویرایش" : "Edit"}
        </button>
      )}
      {savedAt ? (
        <p className="mt-3 text-xs text-gold-soft" aria-live="polite" data-testid="response-saved">
          {locale === "fa"
            ? "روی این دستگاه ذخیره شد. هنوز ارسال نشده. آن را در بستهٔ هفتگی بگنجانید."
            : "Saved on this device. Not sent yet. Include it in your weekly packet."}
          {" · "}
          <bdi dir="ltr">{savedAt}</bdi>
        </p>
      ) : null}
    </div>
  );
}
