"use client";

import { useEffect, useState } from "react";
import PracticalUpload from "./PracticalUpload";
import { SafeMarkdown } from "../../lib/academy/safeMarkdown";
import { maybeLegacyImport } from "../../lib/academy/legacyImport";
import { formatDualTime, nextStep, noticeLabel, statusLabel } from "../../lib/academy/studentCopy";

type Text = { fa: string; en: string };

type Assignment = {
  week: number;
  stage: number;
  title: Text;
  coreTasks: Text[];
  weaknessDrills: { weaknessId: string; task: Text }[];
  spiralReview: { stage: number; skill: string; task: Text }[];
  riskRules: {
    maxRiskPct: string;
    hardStructuralStop: boolean;
    minNetRR: string;
    noSignals: boolean;
  };
  deliverables: Text[];
  dueAtISO: string;
};

type Me = {
  studentId: string;
  displayName: string;
  email: string | null;
  role: "STUDENT" | "ADMIN";
  unlockedStage: number;
  currentWeek: number;
  status: string;
  telegramEnabled: boolean;
  telegramLinked: boolean;
};

type Notification = {
  id: string;
  body: { kind?: string; verdict?: string; decisionId?: string; url?: string };
  created: number;
  isRead: boolean;
};

type DecisionView = {
  id?: string;
  state?: string;
  body?: {
    verdict?: string;
    feedback?: Text;
    format?: string;
    stage?: number;
    week?: number;
  };
};

function when(isoOrUnix: string | number): string {
  const both = formatDualTime(isoOrUnix);
  return `${both.amsterdam} Europe/Amsterdam · ${both.local} local`;
}

function text(value: Text | undefined, locale: "fa" | "en"): string {
  if (!value) return "";
  return locale === "fa" ? value.fa : value.en;
}

export default function StudentDashboard({ locale }: { locale: "fa" | "en" }) {
  const [me, setMe] = useState<Me | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [weekStatus, setWeekStatus] = useState<string | null>(null);
  const [notes, setNotes] = useState<Notification[]>([]);
  const [openNotes, setOpenNotes] = useState(false);
  const [decisions, setDecisions] = useState<DecisionView[]>([]);
  const [reportMd, setReportMd] = useState<string>("");
  const [legacyNote, setLegacyNote] = useState<string | null>(null);
  const [telegramMsg, setTelegramMsg] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "anon" | "ready" | "error">("loading");

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const meRes = await fetch("/api/mentor/me", { credentials: "same-origin", cache: "no-store" });
      if (meRes.status === 401) {
        if (!cancel) setLoadState("anon");
        return;
      }
      if (!meRes.ok) {
        if (!cancel) setLoadState("error");
        return;
      }
      const profile = (await meRes.json()) as Me;
      if (cancel) return;
      setMe(profile);
      setLoadState("ready");
      const imported = await maybeLegacyImport(profile.studentId);
      if (imported.status === "quarantine") {
        setLegacyNote(
          locale === "fa"
            ? "سابقهٔ محلی به شناسهٔ دیگری بسته است و وارد حساب نشد."
            : "Local history belongs to a different id and was not imported.",
        );
      }
      const [asg, report] = await Promise.all([
        fetch("/api/mentor/assignment", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/mentor/report", { credentials: "same-origin", cache: "no-store" }),
      ]);
      if (asg.ok) {
        const body = (await asg.json()) as {
          status?: string;
          assignment?: Assignment | null;
        };
        if (!cancel) {
          setWeekStatus(body.status ?? null);
          setAssignment(body.assignment ?? null);
        }
      }
      if (report.ok) {
        const body = (await report.json()) as {
          markdown?: string;
          decisions?: DecisionView[];
        };
        if (!cancel) {
          setReportMd(typeof body.markdown === "string" ? body.markdown : "");
          setDecisions(Array.isArray(body.decisions) ? body.decisions : []);
        }
      }
    };
    void load().catch(() => {
      if (!cancel) setLoadState("error");
    });
    return () => {
      cancel = true;
    };
  }, [locale]);

  useEffect(() => {
    if (!me) return;
    let timer = 0;
    let delay = 30_000;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") {
        timer = window.setTimeout(() => void tick(), delay);
        return;
      }
      try {
        const res = await fetch("/api/mentor/notifications", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) throw new Error("notifications");
        const body = (await res.json()) as { notifications?: Notification[] };
        setNotes(body.notifications ?? []);
        delay = 30_000;
      } catch {
        delay = Math.min(delay * 2, 120_000);
      }
      if (!stopped) timer = window.setTimeout(() => void tick(), delay);
    };
    timer = window.setTimeout(() => void tick(), 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [me]);

  const markRead = async (id: string) => {
    await fetch(`/api/mentor/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: "{}",
    });
    setNotes((cur) => cur.map((note) => (note.id === id ? { ...note, isRead: true } : note)));
  };

  const connectTelegram = async () => {
    setTelegramMsg(null);
    const res = await fetch("/api/mentor/telegram/connect-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: "{}",
    });
    const body = (await res.json().catch(() => ({}))) as { url?: string; en?: string; fa?: string };
    if (!res.ok || !body.url) {
      setTelegramMsg(locale === "fa" ? body.fa ?? "تلگرام در دسترس نیست." : body.en ?? "Telegram is unavailable.");
      return;
    }
    window.open(body.url, "_blank", "noopener,noreferrer");
  };

  const unread = notes.filter((note) => !note.isRead).length;
  const latest = [...decisions].reverse().find((row) => row.body?.verdict);
  const awaitingSenior = me?.status === "AWAITING_SENIOR_MENTOR" || weekStatus === "AWAITING_SENIOR_MENTOR";
  const step = nextStep({
    signedIn: loadState === "ready" && me != null,
    status: weekStatus ?? me?.status ?? null,
    stage: me?.unlockedStage ?? 1,
    locale,
  });

  return (
    <div className="space-y-6" data-testid="student-dashboard">
      <section className="space-y-2 border border-gold/50 bg-ink/60 p-4" data-testid="next-step">
        <p className="text-[10px] tracking-[0.18em] text-gold-soft uppercase">
          {locale === "fa" ? "قدم بعدی" : "What to do next"}
        </p>
        {loadState === "loading" ? (
          <h2 className="font-display text-2xl text-paper" data-testid="dashboard-loading" aria-busy="true">
            {locale === "fa" ? "در حال خواندن وضعیت حساب…" : "Loading your account…"}
          </h2>
        ) : (
          <>
            <h2 className="font-display text-2xl text-paper">{step.heading}</h2>
            <p className="text-sm text-fog">{step.body}</p>
            {step.href && step.cta ? (
              <a className="inline-flex min-h-11 items-center border border-gold/50 px-3 text-sm text-gold-soft" href={step.href} data-testid="next-step-link">
                {step.cta}
              </a>
            ) : null}
          </>
        )}
      </section>
      {loadState === "error" ? (
        <p className="text-sm text-gold-soft" role="alert" data-testid="dashboard-error">
          {locale === "fa"
            ? "وضعیت حساب خوانده نشد. اتصال را بررسی کنید و صفحه را تازه کنید."
            : "Your account status could not be loaded. Check the connection and refresh."}
        </p>
      ) : null}
      <section className="space-y-2 border border-line bg-ink/40 p-4" data-testid="entitlements-panel">
        <h2 className="font-display text-xl text-paper">
          {locale === "fa" ? "وضعیت حساب" : "Account status"}
        </h2>
        {me ? (
          <dl className="space-y-1 font-mono text-sm text-gold-soft">
            <div>
              {locale === "fa" ? "مرحله" : "stage"}: {me.unlockedStage} / 8
            </div>
            <div>
              {locale === "fa" ? "هفته" : "week"}: {me.currentWeek}
            </div>
            <div data-testid="week-status">
              {locale === "fa" ? "وضعیت" : "status"}: {statusLabel(me.status, locale)}
            </div>
          </dl>
        ) : loadState === "anon" ? (
          <p className="text-sm text-fog">
            {locale === "fa" ? "برای دیدن درس‌ها وارد شوید." : "Sign in to see your lessons."}{" "}
            <a className="text-gold-soft underline" href="/login">
              {locale === "fa" ? "ورود" : "Log in"}
            </a>
          </p>
        ) : null}
        <p className="text-xs text-fog">
          {locale === "fa"
            ? "تأیید آزمون فقط تمرین را مجاز می‌کند. درس بعدی فقط با تمرین عملی مثبت باز می‌شود. بررسی Echo زمان تضمین‌شده ندارد."
            : "Quiz approval authorizes practice only. The next lesson unlocks after a positive practical. Echo review has no guaranteed grading time."}
        </p>
        {awaitingSenior ? (
          <p className="text-sm text-gold-soft" data-testid="senior-mentor">
            {locale === "fa"
              ? "مرحله ۸ مثبت است: در انتظار منتور ارشد. مرحله ۹ یا فارغ‌التحصیلی خودکار وجود ندارد."
              : "Stage 8 is positive: awaiting the senior mentor. There is no stage 9 or automatic graduation."}
          </p>
        ) : null}
        {legacyNote ? (
          <p className="text-xs text-gold-soft" data-testid="legacy-quarantine">
            {legacyNote}
          </p>
        ) : null}
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="min-h-11 border border-line px-4 text-sm text-fog"
          data-testid="notifications-bell"
          onClick={() => setOpenNotes((open) => !open)}
        >
          {locale === "fa" ? "اعلان‌ها" : "Notifications"} ({unread})
        </button>
        {me?.telegramEnabled && !me.telegramLinked ? (
          <button
            type="button"
            className="min-h-11 border border-gold/50 px-4 text-sm text-gold-soft"
            data-testid="telegram-connect"
            onClick={() => void connectTelegram()}
          >
            {locale === "fa" ? "اعلان در تلگرام" : "Get notifications on Telegram"}
          </button>
        ) : null}
        {me?.telegramLinked ? (
          <p className="text-xs text-teal-bright">{locale === "fa" ? "تلگرام متصل است." : "Telegram is linked."}</p>
        ) : null}
      </section>
      {telegramMsg ? <p className="text-xs text-gold-soft">{telegramMsg}</p> : null}
      {openNotes ? (
        <ul className="space-y-2 text-sm text-fog" data-testid="notification-list">
          {notes.length === 0 ? <li>{locale === "fa" ? "اعلانی نیست." : "No notifications."}</li> : null}
          {notes.map((note) => (
            <li key={note.id} className="border border-line/50 p-3">
              <p>
                {noticeLabel(note.body.kind, locale)}
                {note.body.verdict ? ` · ${note.body.verdict}` : ""} · {when(note.created)}
              </p>
              {!note.isRead ? (
                <button type="button" className="mt-2 min-h-11 border border-line px-3 text-xs" onClick={() => void markRead(note.id)}>
                  {locale === "fa" ? "خوانده شد" : "Mark read"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <section className="space-y-3 border border-line bg-ink/40 p-4" data-testid="assignment-panel">
        <h2 className="font-display text-xl text-paper">
          {locale === "fa" ? "تکلیف شخصی" : "Personalized assignment"}
        </h2>
        {!me ? null : !assignment ? (
          <p className="text-sm text-fog" data-testid="assignment-pending">
            {weekStatus === "QUIZ_SUBMITTED"
              ? locale === "fa"
                ? "آزمون ثبت شد و در انتظار بررسی Echo است. هنوز تکلیفی صادر نشده."
                : "Quiz is submitted and pending Echo review. No assignment has been issued yet."
              : locale === "fa"
                ? "تکلیف پس از بررسی آزمون (تأیید یا تأیید نسبی) صادر می‌شود. رد آزمون یعنی مطالعه و آزمون دوباره."
                : "An assignment is issued after quiz review (approved or partial). A rejected quiz means restudy and retake."}
          </p>
        ) : (
          <div className="space-y-3 text-sm text-fog">
            <h3 className="text-paper">{text(assignment.title, locale)}</h3>
            <p className="font-mono text-xs text-teal-bright" data-testid="assignment-due">
              {locale === "fa" ? "موعد" : "Due"} {when(assignment.dueAtISO)}
            </p>
            <ul className="list-disc space-y-1 ps-5">
              {assignment.coreTasks.map((task, idx) => (
                <li key={idx}>{text(task, locale)}</li>
              ))}
            </ul>
            {assignment.weaknessDrills.length > 0 ? (
              <div>
                <p className="text-paper">{locale === "fa" ? "تمرین ضعف‌ها" : "Weakness drills"}</p>
                <ul className="list-disc space-y-1 ps-5">
                  {assignment.weaknessDrills.map((drill) => (
                    <li key={drill.weaknessId}>{text(drill.task, locale)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {assignment.spiralReview.length > 0 ? (
              <div>
                <p className="text-paper">{locale === "fa" ? "مرور مارپیچ" : "Spiral review"}</p>
                <ul className="list-disc space-y-1 ps-5">
                  {assignment.spiralReview.map((item, idx) => (
                    <li key={`${item.stage}-${idx}`}>
                      {item.skill}: {text(item.task, locale)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p>
              risk ≤ {assignment.riskRules.maxRiskPct}% · netRR ≥ {assignment.riskRules.minNetRR} ·{" "}
              {assignment.riskRules.hardStructuralStop
                ? locale === "fa"
                  ? "استاپ ساختاری سخت لازم است"
                  : "structural hard stop required"
                : ""}
              {assignment.riskRules.noSignals
                ? locale === "fa"
                  ? " · سیگنال یا توصیه معامله نیست"
                  : " · no signals or trade advice"
                : ""}
            </p>
          </div>
        )}
        {latest?.body ? (
          <div className="border border-gold/40 p-3 text-sm" data-testid="echo-verdict">
            <p className="text-gold-soft">
              Echo · {latest.body.verdict} · {latest.body.format === "sfa-quiz-decision" ? "quiz" : "practical"}
            </p>
            <p className="mt-2 text-fog">{text(latest.body.feedback, locale)}</p>
            {latest.body.verdict === "NOT_APPROVED" ? (
              <p className="mt-2 text-xs text-fog">
                {locale === "fa"
                  ? "این نتیجه درس بعدی را باز نمی‌کند. برای آزمون: مطالعه و تکرار. برای تمرین: هفته جبرانی در همین مرحله."
                  : "This result does not unlock the next lesson. A quiz needs restudy and retake. A practical adds a remedial week at the same stage."}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {me && (weekStatus === "ASSIGNMENT_ISSUED" || weekStatus === "REMEDIAL_ISSUED" || me.status === "ASSIGNMENT_ISSUED" || me.status === "REMEDIAL_ISSUED") ? (
        <PracticalUpload locale={locale} />
      ) : me ? (
        <p className="text-sm text-fog" data-testid="practical-closed">
          {locale === "fa"
            ? "بارگذاری تمرین بعد از تأیید یا تأیید نسبی آزمون باز می‌شود. الان همان قدم بالای صفحه را انجام دهید."
            : "The practical upload opens after the quiz is approved or partially approved. Do the step at the top of this page first."}
        </p>
      ) : null}

      {reportMd ? (
        <section className="space-y-2 border border-line bg-ink/40 p-4" data-testid="report-panel">
          <h2 className="font-display text-xl text-paper">{locale === "fa" ? "گزارش" : "Report"}</h2>
          <SafeMarkdown source={reportMd} />
        </section>
      ) : null}
    </div>
  );
}
