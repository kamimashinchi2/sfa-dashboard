"use client";

import { useEffect, useState } from "react";

type Text = { fa: string; en: string };
type Task = { taskId: string; kind: string; task: Text };
type Entry = {
  entryId: string;
  localDate: string;
  eligible: boolean;
  ineligibleReason: string | null;
  locked: boolean;
  revisionCount: number;
  taskIds: string[];
  fields: {
    observations: string;
    currentApplication: string;
    spiralApplication: string;
    selfCheck: string;
    routine: { time: string; session: string; calendar: string; freshness: string; oneLine: string };
  };
};

type LogView = {
  active: boolean;
  countedDays: number;
  requiredDays: number;
  dueFriday: string | null;
  nextLockAtISO: string | null;
  windowOpen: boolean;
  opensAtISO: string | null;
  closesAtISO: string | null;
  warning: Text | null;
  entries: Entry[];
  state: string;
};

const FRESH = ["FRESH", "RECENT", "STALE", "UNKNOWN"] as const;

function line(value: Text | null | undefined, locale: "fa" | "en"): string {
  if (!value) return "";
  return locale === "fa" ? value.fa : value.en;
}

export default function DailyLogCard({
  locale,
  tasks,
}: {
  locale: "fa" | "en";
  tasks: Task[];
}) {
  const [view, setView] = useState<LogView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [observations, setObservations] = useState("");
  const [currentApplication, setCurrentApplication] = useState("");
  const [spiralApplication, setSpiralApplication] = useState("");
  const [selfCheck, setSelfCheck] = useState("");
  const [oneLine, setOneLine] = useState("");
  const [freshness, setFreshness] = useState<(typeof FRESH)[number]>("UNKNOWN");
  const [calendar, setCalendar] = useState("");
  const [dayCall, setDayCall] = useState<"TRADE" | "NO_TRADE">("NO_TRADE");
  const [dayCallReason, setDayCallReason] = useState("");

  const load = async () => {
    const res = await fetch("/api/mentor/daily-log?week=current", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as LogView;
    setView(body);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!view?.active) return null;
  const open = view.state === "ASSIGNMENT_ISSUED" || view.state === "REMEDIAL_ISSUED" || view.state === "PRACTICAL_OVERDUE";

  const save = async () => {
    setMessage(null);
    const res = await fetch("/api/mentor/daily-log", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskIds,
        routine: { freshness, oneLine, calendar },
        observations,
        currentApplication,
        spiralApplication,
        selfCheck,
        paperPlan: null,
        dayCall,
        dayCallReason: dayCall === "NO_TRADE" ? dayCallReason : "",
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { fa?: string; en?: string; error?: string };
    if (!res.ok) {
      setMessage(locale === "fa" ? body.fa ?? body.error ?? "ثبت نشد." : body.en ?? body.error ?? "Not saved.");
      return;
    }
    setMessage(locale === "fa" ? "گزارش امروز ذخیره شد." : "Today's log was saved.");
    await load();
  };

  return (
    <section className="space-y-3 border border-line bg-ink/40 p-4" data-testid="daily-log-card">
      <h2 className="font-display text-xl text-paper">{locale === "fa" ? "گزارش امروز" : "Today's log"}</h2>
      <p className="text-sm text-gold-soft" data-testid="no-live-trade">
        {locale === "fa" ? "معامله زنده لازم نیست. سیگنال نیست." : "No live trade required. No signals."}
      </p>
      <p className="font-mono text-xs text-teal-bright" data-testid="logged-days">
        {locale === "fa" ? "روزهای ثبت‌شده" : "Logged days"}: {view.countedDays} / {view.requiredDays}{" "}
        {locale === "fa" ? "(دوشنبه تا جمعه، وقت آمستردام)" : "(Mon–Fri, Amsterdam time)"}
        {view.nextLockAtISO ? ` · ${view.nextLockAtISO}` : ""}
      </p>
      {view.warning ? <p className="text-sm text-fog">{line(view.warning, locale)}</p> : null}
      <p className="text-sm text-fog" data-testid="practical-window">
        {view.windowOpen
          ? locale === "fa"
            ? `بارگذاری تمرین امروز باز است و ${view.closesAtISO ?? ""} بسته می‌شود (وقت آمستردام).`
            : `Practical upload is open today and closes ${view.closesAtISO ?? ""} (Amsterdam time).`
          : locale === "fa"
            ? `بارگذاری تمرین جمعه ${view.dueFriday ?? ""} ساعت ۰۰:۰۰ باز و ۲۳:۵۹ بسته می‌شود (وقت آمستردام).`
            : `Practical upload opens Friday ${view.dueFriday ?? ""}, 00:00, and closes 23:59 (Amsterdam time).`}
      </p>
      {open ? (
        <form
          className="space-y-2 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <ul className="space-y-1">
            {tasks.map((task) => (
              <li key={task.taskId}>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={taskIds.includes(task.taskId)}
                    onChange={(event) =>
                      setTaskIds((cur) =>
                        event.target.checked ? [...cur, task.taskId] : cur.filter((id) => id !== task.taskId),
                      )
                    }
                  />
                  <span>
                    {task.taskId}: {line(task.task, locale)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2" data-testid="day-call">
            <button type="button" className={`min-h-11 border px-3 ${dayCall === "TRADE" ? "border-gold text-gold-soft" : "border-line text-fog"}`} onClick={() => setDayCall("TRADE")}>
              {locale === "fa" ? "امروز معامله" : "Trade today"}
            </button>
            <button type="button" className={`min-h-11 border px-3 ${dayCall === "NO_TRADE" ? "border-gold text-gold-soft" : "border-line text-fog"}`} onClick={() => setDayCall("NO_TRADE")}>
              {locale === "fa" ? "امروز بدون معامله" : "No trade today"}
            </button>
          </div>
          {dayCall === "NO_TRADE" ? (
            <label className="block">
              {locale === "fa" ? "دلیل کوتاه، با timestamp، یا Observed reaction unavailable" : "Short reason from timestamped readings, or Observed reaction unavailable"}
              <input className="mt-1 w-full border border-line bg-ink px-2 py-2" value={dayCallReason} onChange={(e) => setDayCallReason(e.target.value)} />
            </label>
          ) : null}
          <p className="text-xs text-fog">
            {locale === "fa"
              ? "ساعت و session را سرور پر می‌کند و قابل ویرایش نیست."
              : "Time and session are filled by the server and are read-only."}
          </p>
          <label className="block">
            {locale === "fa" ? "تقویم یا NEWS RISK: NOT ASSESSED" : "Calendar, or NEWS RISK: NOT ASSESSED"}
            <input className="mt-1 w-full border border-line bg-ink px-2 py-2" value={calendar} onChange={(e) => setCalendar(e.target.value)} />
          </label>
          <label className="block">
            {locale === "fa" ? "تازگی" : "Freshness"}
            <select className="mt-1 w-full border border-line bg-ink px-2 py-2" value={freshness} onChange={(e) => setFreshness(e.target.value as (typeof FRESH)[number])}>
              {FRESH.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="block">
            {locale === "fa" ? "یک جمله: آیا قبل از چک‌لیست می‌خواستم عمل کنم؟" : "One line: did I want to act before the checklist was complete?"}
            <input className="mt-1 w-full border border-line bg-ink px-2 py-2" value={oneLine} onChange={(e) => setOneLine(e.target.value)} />
          </label>
          <label className="block">
            {locale === "fa" ? "چه دیدم (زمان و منبع)" : "What I observed (time and source)"}
            <textarea className="mt-1 w-full border border-line bg-ink px-2 py-2" value={observations} onChange={(e) => setObservations(e.target.value)} />
          </label>
          <label className="block">
            {locale === "fa" ? "درس این هفته را چطور به‌کار بردم" : "How I applied this week's lesson"}
            <textarea className="mt-1 w-full border border-line bg-ink px-2 py-2" value={currentApplication} onChange={(e) => setCurrentApplication(e.target.value)} />
          </label>
          <label className="block">
            {locale === "fa" ? "هفته‌های قبل را چطور به‌کار بردم" : "How I applied earlier weeks"}
            <textarea className="mt-1 w-full border border-line bg-ink px-2 py-2" value={spiralApplication} onChange={(e) => setSpiralApplication(e.target.value)} />
          </label>
          <label className="block">
            {locale === "fa" ? "خودارزیابی" : "Self-check"}
            <textarea className="mt-1 w-full border border-line bg-ink px-2 py-2" value={selfCheck} onChange={(e) => setSelfCheck(e.target.value)} />
          </label>
          <p className="text-xs text-fog">{locale === "fa" ? "پلن کاغذی در گزارش روزانه اختیاری است. شبیه‌سازی است، سفارش نیست." : "The paper plan on a daily entry is optional. Simulated, not an order."}</p>
          <button type="submit" className="min-h-11 bg-gold px-4 text-sm font-semibold text-ink">
            {locale === "fa" ? "ذخیره گزارش امروز" : "Save today's log"}
          </button>
        </form>
      ) : null}
      <ul className="space-y-1 text-xs text-fog" data-testid="daily-log-entries">
        {view.entries.map((entry) => (
          <li key={entry.entryId}>
            {entry.localDate} · {entry.eligible ? "eligible" : entry.ineligibleReason} · {entry.locked ? (locale === "fa" ? "قفل" : "locked") : (locale === "fa" ? "باز" : "open")} · rev {entry.revisionCount}
          </li>
        ))}
      </ul>
      {message ? <p className="text-xs text-gold-soft">{message}</p> : null}
    </section>
  );
}
