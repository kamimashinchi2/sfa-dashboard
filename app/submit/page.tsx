"use client";

import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import AcademyShell from "../components/academy/AcademyShell";
import { copyTextToClipboard } from "../lib/academy/copyClipboard";
import { downloadTextFile } from "../lib/academy/download";
import {
  buildPacket,
  currentAndPreviousIsoWeeks,
  looksLikeEmailOrPhone,
  packetFilename,
  periodForIsoWeek,
  renderMarkdown,
  ALIAS_RE,
  STUDENT_ID_RE,
  type SubmissionPacket,
} from "../lib/academy/packet";
import {
  prefsStore,
  quizStore,
  responsesStore,
  simRunsStore,
  storageKey,
  updateSimRunDecision,
  type StudentDecision,
} from "../lib/academy/persist";
import { useProgress } from "../components/academy/ProgressProvider";
import { resolveBuildStamp, APP_RELEASE_LABEL } from "../lib/academy/buildStamp";
import PracticalUpload from "../components/academy/PracticalUpload";

function SubmitInner() {
  const { progress } = useProgress();
  const locale = progress.locale;
  const prefs = useSyncExternalStore(
    prefsStore.subscribe,
    prefsStore.getSnapshot,
    prefsStore.getServerSnapshot,
  );
  const quiz = useSyncExternalStore(
    quizStore.subscribe,
    quizStore.getSnapshot,
    quizStore.getServerSnapshot,
  );
  const responses = useSyncExternalStore(
    responsesStore.subscribe,
    responsesStore.getSnapshot,
    responsesStore.getServerSnapshot,
  );
  const sims = useSyncExternalStore(
    simRunsStore.subscribe,
    simRunsStore.getSnapshot,
    simRunsStore.getServerSnapshot,
  );

  const weeks = useSyncExternalStore(
    () => () => {},
    () => {
      // Stable client snapshot for the session (avoid new Date() during prerender)
      const g = globalThis as typeof globalThis & {
        __sfaWeeks?: { current: string; previous: string };
      };
      if (!g.__sfaWeeks) g.__sfaWeeks = currentAndPreviousIsoWeeks(new Date());
      return g.__sfaWeeks;
    },
    () => ({ current: "2026-W46", previous: "2026-W45" }),
  );
  const [isoWeek, setIsoWeek] = useState<string | null>(null);
  const activeWeek = isoWeek ?? weeks.current;
  const period = useMemo(() => periodForIsoWeek(activeWeek), [activeWeek]);

  const [studentId, setStudentId] = useState(prefs.studentId ?? "");
  const [alias, setAlias] = useState(prefs.alias ?? "");
  const [weeklyText, setWeeklyText] = useState("");
  const [emotionBefore, setEmotionBefore] = useState(5);
  const [emotionAfter, setEmotionAfter] = useState(5);
  const [reflections, setReflections] = useState<Record<string, string>>({});
  const [excludedQuiz, setExcludedQuiz] = useState<Set<string>>(new Set());
  const [excludedLesson, setExcludedLesson] = useState<Set<string>>(new Set());
  const [excludedSim, setExcludedSim] = useState<Set<string>>(new Set());
  const [excludedJournal] = useState<Set<string>>(new Set());
  const [lastPacket, setLastPacket] = useState<SubmissionPacket | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekQuizzes = period
    ? quiz.attempts.filter(
        (a) =>
          a.submittedAtISO >= period.fromISO && a.submittedAtISO <= period.toISO,
      )
    : [];
  const weekLessons = period
    ? responses.lessonResponses.filter(
        (r) => r.savedAtISO >= period.fromISO && r.savedAtISO <= period.toISO,
      )
    : [];
  const weekSims = period
    ? sims.entries.filter(
        (r) => r.atISO >= period.fromISO && r.atISO <= period.toISO,
      )
    : [];

  let journalEntries: {
    id: string;
    updatedAtISO: string;
    missionId: string | null;
    stage: number;
    hypothesis: string;
    invalidation: string;
    falsification: string;
    counterevidence: string;
    emotions: string;
    nextTask: string;
  }[] = [];
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(storageKey("journal"));
      if (raw) {
        const parsed = JSON.parse(raw) as { entries?: typeof journalEntries };
        journalEntries = (parsed.entries ?? []).filter(
          (j) =>
            period &&
            j.updatedAtISO >= period.fromISO &&
            j.updatedAtISO <= period.toISO,
        );
      }
    } catch {
      /* ignore */
    }
  }

  const missing: string[] = [];
  if (!STUDENT_ID_RE.test(studentId)) missing.push("studentId (S##)");
  if (!ALIAS_RE.test(alias)) missing.push("alias");
  if (weeklyText.trim().length < 50) missing.push("weekly reflection ≥50 chars");

  for (const a of weekQuizzes) {
    if (excludedQuiz.has(a.attemptId)) continue;
    if (a.mode !== "ASSESSED") continue;
    for (const it of a.items) {
      if (it.clientCorrect && it.touched) continue;
      const key = `${a.attemptId}:${it.itemId}`;
      const refl = reflections[key] ?? it.reflection ?? "";
      if (refl.trim().length < 20) {
        missing.push(`reflection for ${it.itemId}`);
      }
      if (looksLikeEmailOrPhone(refl)) {
        missing.push(`PII in reflection ${it.itemId}`);
      }
    }
  }
  if (looksLikeEmailOrPhone(weeklyText)) missing.push("PII in weekly reflection");
  for (const r of weekLessons) {
    if (looksLikeEmailOrPhone(r.text)) missing.push(`PII in lesson ${r.lessonId}`);
  }

  const identityOk = STUDENT_ID_RE.test(studentId) && ALIAS_RE.test(alias);
  const canExport = missing.length === 0 && !busy;

  const persistIdentity = () => {
    prefsStore.set({
      ...prefsStore.getSnapshot(),
      locale,
      studentId,
      alias,
    });
  };

  const build = async (): Promise<{ packet: SubmissionPacket; md: string; filename: string }> => {
    persistIdentity();
    // Apply reflections onto included assessed attempts
    const attempts = weekQuizzes
      .filter((a) => !excludedQuiz.has(a.attemptId) || a.mode === "ASSESSED")
      .filter((a) => a.mode === "ASSESSED" || !excludedQuiz.has(a.attemptId))
      .map((a) => ({
        ...a,
        items: a.items.map((it) => {
          const key = `${a.attemptId}:${it.itemId}`;
          const refl = reflections[key] ?? it.reflection;
          return { ...it, reflection: refl };
        }),
      }));

    // HARD_BLOCK and ASSESSED cannot be excluded
    const simRuns = weekSims.filter((r) => {
      if (r.status === "HARD_BLOCK") return true;
      return !excludedSim.has(r.runId);
    });

    const log = prefs.exportLog ?? [];
    const prior = log
      .filter((e) => e.week === activeWeek)
      .sort((a, b) => b.seq - a.seq)[0];
    const packetSeq = (prior?.seq ?? 0) + 1;
    let quizBankHash: string;
    try {
      const res = await fetch("/api/meta/quiz-bank-hash", { cache: "no-store" });
      if (!res.ok) throw new Error(`QUIZ_BANK_HASH_HTTP_${res.status}`);
      const body = (await res.json()) as { quizBankHash?: string };
      if (!body.quizBankHash || !/^[0-9a-f]{64}$/.test(body.quizBankHash)) {
        throw new Error("QUIZ_BANK_HASH_INVALID");
      }
      quizBankHash = body.quizBankHash;
    } catch (e) {
      throw new Error(
        e instanceof Error ? e.message : "QUIZ_BANK_HASH_UNAVAILABLE",
      );
    }

    const packet = await buildPacket({
      domains: {
        quizAttempts: attempts,
        lessonResponses: weekLessons.filter((r) => !excludedLesson.has(r.id)),
        simulatorRuns: simRuns,
        journalEntries: journalEntries.filter((j) => !excludedJournal.has(j.id)) as never,
        selfReports: responses.selfReports.filter(
          (r) =>
            r.atISO >= period.fromISO &&
            r.atISO <= period.toISO,
        ),
        prefs: { locale, studentId, alias, exportLog: log },
      },
      isoWeek: activeWeek,
      locale,
      weeklyReflection: {
        text: weeklyText,
        emotionBefore,
        emotionAfter,
      },
      quizBankHash,
      packetSeq,
      supersedesDigest: prior?.digest ?? null,
      build: resolveBuildStamp(),
    });

    const md = renderMarkdown(packet);
    const filename = packetFilename({
      studentId,
      isoWeek: activeWeek,
      packetSeq,
    });
    return { packet, md, filename };
  };

  const afterExport = (packet: SubmissionPacket) => {
    const log = [...(prefsStore.getSnapshot().exportLog ?? [])];
    log.unshift({
      week: activeWeek,
      seq: packet.packetSeq,
      digest: packet.integrity.digest,
      atISO: packet.generatedAtISO,
    });
    prefsStore.set({
      ...prefsStore.getSnapshot(),
      locale,
      studentId,
      alias,
      exportLog: log.slice(0, 50),
    });
    setLastPacket(packet);
  };

  const bilingualDigestError = (raw: string) => {
    const fa =
      "ساخت بسته ناموفق بود (احتمالاً digest). می‌توانید متن را کپی کنید یا بعداً با HTTPS دوباره تلاش کنید.";
    const en =
      "Packet build failed (likely digest). You can copy selectable text, or retry over HTTPS.";
    return `${locale === "fa" ? fa : en} · ${raw}`;
  };

  const onDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      const { packet, md, filename } = await build();
      if (!packet.integrity?.digest) {
        throw new Error("DIGEST_MISSING");
      }
      downloadTextFile({
        filename,
        content: md,
        mime: "text/markdown;charset=utf-8",
        revokeDelayMs: 45_000,
      });
      afterExport(packet);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "EXPORT_FAIL";
      setError(bilingualDigestError(msg));
    } finally {
      setBusy(false);
    }
  };

  const onCopyMd = async () => {
    setBusy(true);
    setError(null);
    try {
      const { packet, md } = await build();
      if (!packet.integrity?.digest) {
        throw new Error("DIGEST_MISSING");
      }
      await copyTextToClipboard(md);
      afterExport(packet);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "COPY_FAIL";
      setError(bilingualDigestError(msg));
    } finally {
      setBusy(false);
    }
  };

  const onCopyCode = async () => {
    if (!lastPacket) return;
    await copyTextToClipboard(lastPacket.integrity.resultCode);
  };

  const stamp = resolveBuildStamp();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6" data-testid="submit-page">
      <header className="space-y-2">
        <p className="text-[10px] tracking-[0.2em] text-teal-bright uppercase">
          {APP_RELEASE_LABEL} · {stamp.label}
        </p>
        <h1 className="font-display text-3xl text-paper sm:text-4xl">
          {locale === "fa" ? "بستهٔ ارسال هفتگی" : "Weekly submission packet"}
        </h1>
        <p className="text-sm text-fog">
          {locale === "fa"
            ? "تمرین هفتگی را همین‌جا بارگذاری کنید. بستهٔ زیر فقط شواهد آموزشی روی همین دستگاه است و درس را باز نمی‌کند."
            : "Upload the weekly practical here. The packet below is local educational evidence and does not unlock a lesson."}
        </p>
      </header>

      <PracticalUpload locale={locale} />

      <section className="space-y-3 border border-line bg-ink/40 p-4">
        <h2 className="font-display text-xl text-paper">
          {locale === "fa" ? "هویت آکادمی" : "Academy identity"}
        </h2>
        <p className="text-xs text-fog">
          {locale === "fa"
            ? "از نام مستعار و شناسه‌ای که منتور داده استفاده کنید. هرگز نام واقعی، ایمیل یا تلفن."
            : "Use the alias and ID your mentor gave you. Never your real name, email, or phone."}
        </p>
        <label className="block text-xs text-fog">
          studentId
          <input
            className="mt-2 min-h-11 w-full border border-line bg-ink px-3 font-mono text-sm text-paper"
            value={studentId}
            dir="ltr"
            data-testid="student-id"
            placeholder="S07"
            onChange={(e) => setStudentId(e.target.value.trim())}
            onBlur={persistIdentity}
          />
        </label>
        <label className="block text-xs text-fog">
          alias
          <input
            className="mt-2 min-h-11 w-full border border-line bg-ink px-3 font-mono text-sm text-paper"
            value={alias}
            dir="ltr"
            data-testid="alias"
            placeholder="Falcon-07"
            onChange={(e) => setAlias(e.target.value.trim())}
            onBlur={persistIdentity}
          />
        </label>
        {!identityOk ? (
          <p className="text-xs text-gold-soft">
            {"studentId /^S\\d{2,4}$/ · alias /^[A-Za-z][A-Za-z0-9-]{2,23}$/"}
          </p>
        ) : null}
      </section>

      <section className="space-y-3 border border-line bg-ink/40 p-4">
        <h2 className="font-display text-xl text-paper">
          {locale === "fa" ? "هفته" : "Week"}
        </h2>
        <div className="flex flex-col gap-2" role="radiogroup">
          {[weeks.current, weeks.previous].map((w) => {
            const p = periodForIsoWeek(w);
            return (
              <label key={w} className="flex min-h-11 items-center gap-2 text-sm text-paper">
                <input
                  type="radio"
                  name="isoWeek"
                  checked={activeWeek === w}
                  onChange={() => setIsoWeek(w)}
                />
                <span>
                  <bdi dir="ltr">{w}</bdi> · {p.fromISO.slice(0, 10)} → {p.toISO.slice(0, 10)}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 border border-line bg-ink/40 p-4">
        <h2 className="font-display text-xl text-paper">
          {locale === "fa" ? "پیش‌نمایش شواهد" : "Evidence preview"}
        </h2>
        <p className="text-xs text-gold-soft">
          {locale === "fa"
            ? "اکو فقط آنچه را که شامل می‌کنید می‌بیند."
            : "Echo sees only what you include."}
        </p>
        <div className="space-y-2">
          <p className="text-xs text-teal-bright">Quiz attempts</p>
          {weekQuizzes.length === 0 ? (
            <p className="text-xs text-fog">_none_</p>
          ) : null}
          {weekQuizzes.map((a) => {
            const locked = a.mode === "ASSESSED";
            const checked = locked || !excludedQuiz.has(a.attemptId);
            return (
              <label key={a.attemptId} className="flex min-h-11 items-start gap-2 text-xs text-fog">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  disabled={locked}
                  onChange={(e) => {
                    setExcludedQuiz((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.delete(a.attemptId);
                      else next.add(a.attemptId);
                      return next;
                    });
                  }}
                />
                <span>
                  <bdi dir="ltr">{a.attemptId}</bdi> · {a.mode} · score claim {a.client.score}
                </span>
              </label>
            );
          })}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-teal-bright">Lesson responses</p>
          {weekLessons.map((r) => (
            <label key={r.id} className="flex min-h-11 items-start gap-2 text-xs text-fog">
              <input
                type="checkbox"
                className="mt-1"
                checked={!excludedLesson.has(r.id)}
                onChange={(e) => {
                  setExcludedLesson((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.delete(r.id);
                    else next.add(r.id);
                    return next;
                  });
                }}
              />
              <span>
                {r.lessonId} · <bdi dir="ltr">{r.savedAtISO}</bdi>
              </span>
            </label>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-teal-bright">Simulator runs</p>
          {weekSims.map((r) => {
            const locked = r.status === "HARD_BLOCK";
            return (
              <div key={r.runId} className="space-y-1 border border-line/40 p-2">
                <label className="flex min-h-11 items-start gap-2 text-xs text-fog">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={locked || !excludedSim.has(r.runId)}
                    disabled={locked}
                    onChange={(e) => {
                      setExcludedSim((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.delete(r.runId);
                        else next.add(r.runId);
                        return next;
                      });
                    }}
                  />
                  <span>
                    <bdi dir="ltr">{r.runId}</bdi> · {r.tool} · {r.status}
                  </span>
                </label>
                <fieldset className="flex flex-wrap gap-3 text-xs text-fog">
                  <legend className="sr-only">studentDecision</legend>
                  {(
                    ["EXPLORATION", "FINAL_PLAN", "REJECTED_BY_STUDENT"] as StudentDecision[]
                  ).map((d) => (
                    <label key={d} className="inline-flex min-h-11 items-center gap-1">
                      <input
                        type="radio"
                        name={`dec-${r.runId}`}
                        checked={r.studentDecision === d}
                        onChange={() => {
                          simRunsStore.set(
                            updateSimRunDecision(simRunsStore.getSnapshot(), r.runId, d),
                          );
                        }}
                      />
                      {d}
                    </label>
                  ))}
                </fieldset>
              </div>
            );
          })}
        </div>
        {!progress.advancedAssessedEnabled ? (
          <p className="text-xs text-fog" data-testid="advanced-preview-note">
            Advanced labs: preview only, not assessable this week
          </p>
        ) : null}
      </section>

      <section className="space-y-3 border border-line bg-ink/40 p-4">
        <h2 className="font-display text-xl text-paper">
          {locale === "fa" ? "بازتاب‌های الزامی" : "Required reflections"}
        </h2>
        <p className="text-xs text-fog">
          {locale === "fa"
            ? "چه فرضی داشتید؟ دفعهٔ بعد چه چیزی را بررسی می‌کنید؟"
            : "What did you assume? What will you check next time?"}
        </p>
        {weekQuizzes
          .filter((a) => a.mode === "ASSESSED" && !excludedQuiz.has(a.attemptId))
          .flatMap((a) =>
            a.items
              .filter((it) => !it.clientCorrect || !it.touched)
              .map((it) => {
                const key = `${a.attemptId}:${it.itemId}`;
                return (
                  <label key={key} className="block text-xs text-fog">
                    {it.itemId}
                    <textarea
                      className="mt-2 min-h-20 w-full border border-line bg-ink px-3 py-2 text-sm text-paper"
                      value={reflections[key] ?? ""}
                      data-testid={`reflection-${it.itemId}`}
                      onChange={(e) =>
                        setReflections((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </label>
                );
              }),
          )}
        <label className="block text-xs text-fog">
          {locale === "fa" ? "بازتاب هفتگی (≥۵۰)" : "Weekly reflection (≥50)"}
          <textarea
            className="mt-2 min-h-28 w-full border border-line bg-ink px-3 py-2 text-sm text-paper"
            value={weeklyText}
            data-testid="weekly-reflection"
            onChange={(e) => setWeeklyText(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="text-xs text-fog">
            emotionBefore 0–10
            <input
              type="number"
              min={0}
              max={10}
              className="mt-2 min-h-11 w-24 border border-line bg-ink px-2 font-mono text-sm text-paper"
              value={emotionBefore}
              data-testid="emotion-before"
              onChange={(e) => setEmotionBefore(Number(e.target.value))}
            />
          </label>
          <label className="text-xs text-fog">
            emotionAfter 0–10
            <input
              type="number"
              min={0}
              max={10}
              className="mt-2 min-h-11 w-24 border border-line bg-ink px-2 font-mono text-sm text-paper"
              value={emotionAfter}
              data-testid="emotion-after"
              onChange={(e) => setEmotionAfter(Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      {missing.length ? (
        <ul className="border border-line bg-ink/30 p-3 text-xs text-gold-soft" data-testid="export-missing">
          {missing.slice(0, 12).map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-sm text-gold-soft">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 bg-gold px-4 text-sm font-semibold text-ink disabled:opacity-40"
          disabled={!canExport}
          data-testid="download-packet"
          onClick={() => void onDownload()}
        >
          {locale === "fa" ? "دانلود .md" : "Download .md"}
        </button>
        <button
          type="button"
          className="min-h-11 border border-gold/50 px-4 text-sm text-gold-soft disabled:opacity-40"
          disabled={!canExport}
          data-testid="copy-packet"
          onClick={() => void onCopyMd()}
        >
          {locale === "fa" ? "کپی Markdown" : "Copy Markdown"}
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-4 text-sm text-fog disabled:opacity-40"
          disabled={!lastPacket}
          data-testid="copy-result-code"
          onClick={() => void onCopyCode()}
        >
          {locale === "fa" ? "کپی Result Code" : "Copy Result Code"}
        </button>
      </div>

      {lastPacket ? (
        <section
          className="space-y-2 border border-line bg-ink/50 p-4"
          data-testid="export-success"
        >
          <p className="text-sm text-teal-bright">
            {locale === "fa" ? "آمادهٔ آپلود" : "Ready to upload"}
          </p>
          <p className="font-mono text-xs text-paper">
            <bdi dir="ltr">
              {packetFilename({
                studentId: lastPacket.student.studentId,
                isoWeek: lastPacket.isoWeek,
                packetSeq: lastPacket.packetSeq,
              })}
            </bdi>
          </p>
          <p className="text-xs text-fog">
            {locale === "fa"
              ? "این فایل شواهد محلی است. تمرین هفتگی را با بخش بارگذاری بالا بفرستید، نه از جای دیگری."
              : "This file is local evidence. Send the weekly practical with the uploader above."}
          </p>
          <p className="font-mono text-xs text-gold-soft" data-testid="result-code">
            <bdi dir="ltr">{lastPacket.integrity.resultCode}</bdi>
          </p>
          <p className="text-[10px] text-fog">
            Digest is tamper-evidence for accidental edits — not a signature or proof. Client
            scores remain UNVERIFIED until mentor review.
          </p>
          <pre className="max-h-64 overflow-auto border border-line/40 p-2 text-[10px] text-fog" data-testid="packet-preview">
            {renderMarkdown(lastPacket).slice(0, 2000)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}

export default function SubmitPage() {
  return (
    <AcademyShell>
      <Suspense fallback={<div className="p-8 text-fog">…</div>}>
        <SubmitInner />
      </Suspense>
    </AcademyShell>
  );
}
