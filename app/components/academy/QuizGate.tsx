"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { QuizItem } from "../../lib/academy/curriculum";
import { t } from "../../lib/academy/dictionary";
import {
  makeAttemptNonce4,
  makeQuizAttemptId,
  scoreQuiz,
  type QuizAnswer,
} from "../../lib/academy/grading";
import { buildDisplayedQuiz, displayToCanonicalMc } from "../../lib/academy/quizShuffle";
import { itemHash } from "../../lib/academy/quizHash";
import { ASSESSMENT_CRITERIA_VERSION } from "../../lib/academy/quizzes";
import { resolveBuildStamp } from "../../lib/academy/buildStamp";
import {
  prefsStore,
  pushQuizAttempt,
  quizStore,
  type QuizAttemptRecord,
} from "../../lib/academy/persist";
import { useProgress } from "./ProgressProvider";

export type QuizScoredPayload = {
  score: number;
  weakTopics: string[];
  attempt: QuizAttemptRecord;
};

function formatAmsterdam(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function QuizGate({
  items,
  quizId,
  onScored,
  initialAnswers,
  initialScore: _initialScore,
  readOnly,
  mode,
}: {
  items: QuizItem[];
  quizId: string;
  onScored: (score: number, weakTopics: string[], attempt: QuizAttemptRecord) => void;
  initialAnswers?: Record<string, QuizAnswer>;
  initialScore?: number | null;
  readOnly?: boolean;
  mode?: "ASSESSED" | "READ_ONLY_PREVIEW";
}) {
  void _initialScore;
  const { progress } = useProgress();
  const locale = progress.locale;
  const assessmentMode =
    mode ?? (readOnly ? "READ_ONLY_PREVIEW" : "ASSESSED");

  const prefs = useSyncExternalStore(
    prefsStore.subscribe,
    prefsStore.getSnapshot,
    prefsStore.getServerSnapshot,
  );
  const quizSnap = useSyncExternalStore(
    quizStore.subscribe,
    quizStore.getSnapshot,
    quizStore.getServerSnapshot,
  );

  const [attemptNonce] = useState(() => makeAttemptNonce4());
  const [startedAtISO] = useState(() => new Date().toISOString());
  const studentId = prefs.studentId?.trim() || "S00";
  const shuffleSeed = `${studentId}:${quizId}:${attemptNonce}`;

  const displayed = useMemo(
    () => buildDisplayedQuiz(items, shuffleSeed),
    [items, shuffleSeed],
  );

  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>(
    () => initialAnswers ?? {},
  );
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [result, setResult] = useState<ReturnType<typeof scoreQuiz> | null>(
    null,
  );
  const [lastAttempt, setLastAttempt] = useState<QuizAttemptRecord | null>(null);
  const [scoring, setScoring] = useState(false);

  // Latest persisted attempt for this quiz (read from store snapshot — no effect sync)
  const priorAttempt =
    lastAttempt ??
    quizSnap.attempts.find((a) => a.quizId === quizId) ??
    null;

  const markTouched = (id: string) => {
    setTouched((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const setOrder = (item: QuizItem, next: number[]) => {
    markTouched(item.id);
    setAnswers((a) => ({ ...a, [item.id]: next }));
  };

  const move = (item: QuizItem, index: number, dir: -1 | 1, orderState: number[]) => {
    const j = index + dir;
    if (j < 0 || j >= orderState.length) return;
    const next = [...orderState];
    const tmp = next[index]!;
    next[index] = next[j]!;
    next[j] = tmp;
    setOrder(item, next);
  };

  const scoreAndPersist = async () => {
    setScoring(true);
    try {
      const scored = scoreQuiz(items, answers, {
        touchedIds: touched,
        skippedIds: skipped,
      });
      setResult(scored);

      const submittedAt = new Date();
      const attemptId = makeQuizAttemptId({
        quizId,
        criteria: ASSESSMENT_CRITERIA_VERSION,
        submittedAt,
        nonce: attemptNonce,
      });
      const stamp = resolveBuildStamp();

      const itemRecords = await Promise.all(
        displayed.map(async (d) => {
          const item = d.item;
          const per = scored.perItem.find((p) => p.id === item.id)!;
          const raw = answers[item.id] ?? null;
          let canonical: unknown = raw;
          if (item.kind === "mc" && typeof raw === "number") {
            canonical = raw;
          } else if (item.kind === "order" && Array.isArray(raw)) {
            canonical = raw;
          } else if (item.kind === "numeric") {
            canonical = raw == null ? null : String(raw);
          }
          return {
            itemId: item.id,
            itemHash: await itemHash(item),
            kind: item.kind,
            displayedOrder:
              item.kind === "mc"
                ? d.optionMap
                : item.kind === "order"
                  ? d.initialOrder
                  : null,
            answer: { raw, canonical },
            touched: touched.has(item.id) || skipped.has(item.id),
            clientCorrect: per.pass,
            reflection: null as string | null,
          };
        }),
      );

      const attempt: QuizAttemptRecord = {
        attemptId,
        quizId,
        mode: assessmentMode,
        assessmentCriteriaVersion: ASSESSMENT_CRITERIA_VERSION,
        startedAtISO,
        submittedAtISO: submittedAt.toISOString(),
        shuffleSeed,
        buildCommit: stamp.commit,
        items: itemRecords,
        client: {
          correct: scored.correct,
          total: scored.total,
          score: scored.score,
          numericPass: scored.score >= 80,
          weakTopics: scored.weakTopics,
        },
        unverifiedClaim: true,
      };

      const nextStore = pushQuizAttempt(quizStore.getSnapshot(), attempt);
      quizStore.set(nextStore);
      setLastAttempt(attempt);
      onScored(scored.score, scored.weakTopics, attempt);
    } finally {
      setScoring(false);
    }
  };

  const displayAttempt = lastAttempt ?? priorAttempt;
  const showResult =
    result ??
    (displayAttempt
      ? {
          score: displayAttempt.client.score,
          correct: displayAttempt.client.correct,
          total: displayAttempt.client.total,
          weakTopics: displayAttempt.client.weakTopics,
          perItem: displayAttempt.items.map((it) => ({
            id: it.itemId,
            pass: it.clientCorrect,
            unanswered: !it.touched,
            skipped: false,
            remediationTopic:
              items.find((i) => i.id === it.itemId)?.remediationTopic ?? it.itemId,
            kind: it.kind,
          })),
          allAnswered: displayAttempt.items.every((it) => it.touched),
        }
      : null);
  // Only this-session result locks the form; prior attempts remain visible after reload.
  const formLocked = readOnly || !!result || scoring;

  return (
    <section className="space-y-4" aria-labelledby="quiz-heading" data-testid="quiz-gate">
      <h3 id="quiz-heading" className="font-display text-2xl text-paper">
        {locale === "fa" ? "آزمون عینی (۱۰ مورد)" : "Objective quiz (10 items)"}
        {assessmentMode === "READ_ONLY_PREVIEW"
          ? locale === "fa"
            ? " — پیش‌نمایش فقط‌خواندنی"
            : " — read-only preview"
          : ""}
      </h3>
      <p className="text-xs text-fog">
        {locale === "fa"
          ? "نمرات سمت کلاینت CLAIM هستند — تا مرور منتور UNVERIFIED."
          : "Client scores are CLAIMS — UNVERIFIED until mentor review."}
      </p>

      {displayed.map(({ item, optionMap, initialOrder }) => {
        const orderState =
          (answers[item.id] as number[] | undefined) ??
          initialOrder ??
          (item.options?.map((_, i) => i) ?? []);
        const unanswered =
          showResult?.perItem.find((p) => p.id === item.id)?.unanswered;
        return (
          <div key={item.id} className="border border-line bg-ink/40 p-4" data-item-id={item.id}>
            <p className="text-sm text-paper">{t(item.prompt, locale)}</p>
            {item.kind === "mc" && item.options && optionMap ? (
              <div className="mt-3 space-y-2" role="radiogroup" aria-label={item.id}>
                {optionMap.map((canonicalIdx, displayIdx) => (
                  <label
                    key={displayIdx}
                    className="flex min-h-11 items-center gap-2 text-sm text-fog"
                  >
                    <input
                      type="radio"
                      name={item.id}
                      checked={answers[item.id] === canonicalIdx}
                      disabled={formLocked}
                      onChange={() => {
                        markTouched(item.id);
                        setAnswers((a) => ({
                          ...a,
                          [item.id]: displayToCanonicalMc(optionMap, displayIdx),
                        }));
                      }}
                    />
                    {t(item.options![canonicalIdx]!, locale)}
                  </label>
                ))}
              </div>
            ) : null}
            {item.kind === "numeric" ? (
              <input
                className="mt-3 min-h-11 w-full max-w-xs border border-line bg-ink px-3 font-mono text-sm text-paper"
                value={String(answers[item.id] ?? "")}
                disabled={formLocked}
                onChange={(e) => {
                  markTouched(item.id);
                  setAnswers((a) => ({ ...a, [item.id]: e.target.value }));
                }}
              />
            ) : null}
            {item.kind === "order" && item.options ? (
              <div className="mt-3 space-y-2" role="list" aria-label={`${item.id}-order`}>
                <p className="text-xs text-fog">
                  {locale === "fa"
                    ? "با دکمه‌های بالا/پایین ترتیب را تنظیم کنید. دست‌نخورده = بدون پاسخ."
                    : "Use Up/Down to set the order. Untouched = not answered."}
                </p>
                {!touched.has(item.id) && !result ? (
                  <p className="text-xs text-gold-soft" data-testid={`${item.id}-not-answered`}>
                    {locale === "fa" ? "پاسخ داده نشده" : "not answered"}
                  </p>
                ) : null}
                {unanswered && showResult ? (
                  <p className="text-xs text-gold-soft">
                    {locale === "fa" ? "پاسخ داده نشده" : "not answered"}
                  </p>
                ) : null}
                {orderState.map((optIdx, pos) => (
                  <div
                    key={`${item.id}-${optIdx}`}
                    role="listitem"
                    className="flex min-h-11 items-center gap-2 border border-line/60 px-2"
                  >
                    <span className="w-6 font-mono text-xs text-teal-bright">
                      {pos + 1}.
                    </span>
                    <span className="flex-1 text-sm text-fog">
                      {t(item.options![optIdx]!, locale)}
                    </span>
                    <button
                      type="button"
                      className="min-h-11 border border-line px-2 text-xs text-fog"
                      disabled={formLocked || pos === 0}
                      aria-label={`Move up ${item.id} item ${pos + 1}`}
                      onClick={() => move(item, pos, -1, orderState)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="min-h-11 border border-line px-2 text-xs text-fog"
                      disabled={formLocked || pos === orderState.length - 1}
                      aria-label={`Move down ${item.id} item ${pos + 1}`}
                      onClick={() => move(item, pos, 1, orderState)}
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <label className="mt-2 flex min-h-11 items-center gap-2 text-xs text-fog">
              <input
                type="checkbox"
                checked={skipped.has(item.id)}
                disabled={formLocked}
                onChange={(e) => {
                  setSkipped((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(item.id);
                    else next.delete(item.id);
                    return next;
                  });
                }}
              />
              {locale === "fa" ? "رد کردن این مورد" : "Skip this item"}
            </label>
            {showResult ? (
              <p className="mt-3 text-xs text-fog" data-testid={`rationale-${item.id}`}>
                {showResult.perItem.find((p) => p.id === item.id)?.pass
                  ? locale === "fa"
                    ? "درست (ادعای کلاینت)"
                    : "Correct (client claim)"
                  : locale === "fa"
                    ? "نادرست / بدون پاسخ (ادعای کلاینت)"
                    : "Wrong / unanswered (client claim)"}
                {" · "}
                {t(item.rationale, locale)}
                {!showResult.perItem.find((p) => p.id === item.id)?.pass
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
        disabled={formLocked}
        data-testid="score-quiz"
        onClick={() => void scoreAndPersist()}
      >
        {locale === "fa" ? "ثبت نمره" : "Score quiz"}
      </button>

      {showResult ? (
        <div
          className="space-y-3 border border-line bg-ink/50 p-4"
          data-testid="quiz-results"
          aria-live="polite"
        >
          <p className="text-sm text-gold-soft">
            Score {showResult.score}/100 · {showResult.correct}/{showResult.total}
            {showResult.score < 80
              ? ` · REMEDIATION: ${[...new Set(showResult.weakTopics)].join(", ")}`
              : ""}
            {" · "}
            <span className="text-fog">UNVERIFIED until mentor review</span>
          </p>
          {displayAttempt ? (
            <p className="font-mono text-xs text-teal-bright" data-testid="attempt-meta">
              attemptId=<bdi dir="ltr">{displayAttempt.attemptId}</bdi>
              {" · "}
              {formatAmsterdam(displayAttempt.submittedAtISO)} (Europe/Amsterdam)
              {" · "}
              build={resolveBuildStamp().label}
            </p>
          ) : null}
          <table className="w-full text-left text-xs text-fog" data-testid="per-item-table">
            <thead>
              <tr className="text-teal-bright">
                <th className="py-1">item</th>
                <th>result</th>
                <th>topic</th>
              </tr>
            </thead>
            <tbody>
              {showResult.perItem.map((p) => (
                <tr key={p.id} className="border-t border-line/40">
                  <td className="py-1 font-mono">{p.id}</td>
                  <td>
                    {p.unanswered
                      ? "not answered"
                      : p.pass
                        ? "correct"
                        : "wrong"}
                  </td>
                  <td>{p.remediationTopic}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-fog">
            <a className="text-gold-soft underline" href="/submit">
              {locale === "fa"
                ? "افزودن به بستهٔ ارسال این هفته"
                : "Include in this week's submission packet"}
            </a>
          </p>
        </div>
      ) : null}
    </section>
  );
}
