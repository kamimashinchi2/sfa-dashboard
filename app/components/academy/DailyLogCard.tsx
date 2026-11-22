"use client";

import { useEffect, useState } from "react";
import { classifyStop, parseLenientDecimal } from "../../lib/academy/paperParse";

type Text = { fa: string; en: string };
type Task = { taskId: string; kind: string; task: Text };
type Entry = {
  entryId: string;
  localDate: string;
  eligible: boolean;
  ineligibleReason: string | null;
  countReason?: string | null;
  locked: boolean;
  revisionCount: number;
  taskIds: string[];
  dayCall?: "TRADE" | "NO_TRADE" | null;
  fields: {
    observations: string;
    currentApplication: string;
    spiralApplication: string;
    selfCheck: string;
    groundingRefs?: string[];
    paperPlan?: Record<string, string> | null;
    conditionalPlan?: Record<string, string> | null;
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
  testMode?: boolean;
  allowedDates?: string[];
};

const FRESH = ["FRESH", "RECENT", "STALE", "UNKNOWN"] as const;

const PAPER_FIELDS = [
  ["equity", "Paper equity", "سرمایه کاغذی"],
  ["riskPct", "Size / risk %", "اندازه / درصد ریسک"],
  ["entry", "Entry", "ورود"],
  ["stopLevel", "Hard stop", "استاپ سخت"],
  ["stopType", "Stop type", "نوع استاپ"],
  ["pointValue", "Point value", "ارزش پوینت"],
  ["pointValueSource", "Point-value source", "منبع ارزش پوینت"],
  ["lot", "Lot", "لات"],
  ["spreadCosts", "Spread and costs", "اسپرد و هزینه"],
  ["target", "Target", "هدف"],
  ["netRR", "Net R:R", "نسبت خالص"],
] as const;

const CONDITIONAL_FIELDS = [
  ["condition", "Condition", "شرط"],
  ["entry", "Entry", "ورود"],
  ["stop", "Stop", "استاپ"],
  ["target", "Target", "هدف"],
  ["sizeRisk", "Size / risk", "اندازه / ریسک"],
] as const;

type PaperKey = (typeof PAPER_FIELDS)[number][0];
type ConditionalKey = (typeof CONDITIONAL_FIELDS)[number][0];
type StopMove = "" | "planned" | "unplanned" | "no";

const STOP_CHOICES = [
  ["HARD_STRUCTURAL", "Hard structural", "استاپ ساختاری سخت"],
  ["MENTAL", "Mental", "ذهنی"],
  ["NONE", "None", "بدون استاپ"],
] as const;

const MOVE_CHOICES = [
  ["", "Not answered", "بدون پاسخ"],
  ["planned", "Planned", "از پیش نوشته‌شده"],
  ["unplanned", "Unplanned", "بدون برنامه"],
  ["no", "No", "جابه‌جا نشده"],
] as const;

const NUMERIC_PAPER = new Set<PaperKey>(["equity", "riskPct", "netRR"]);

function blank<K extends string>(fields: readonly (readonly [K, string, string])[]): Record<K, string> {
  return Object.fromEntries(fields.map(([key]) => [key, ""])) as Record<K, string>;
}

function linesOf(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function line(value: Text | null | undefined, locale: "fa" | "en"): string {
  if (!value) return "";
  return locale === "fa" ? value.fa : value.en;
}

const COUNT_REASON: Record<string, { en: string; fa: string }> = {
  NO_CORE_TASK: {
    en: "Does not count: the core task for this week is missing.",
    fa: "حساب نمی‌شود: کار اصلی این هفته نیست.",
  },
  NO_SPIRAL_TASK: {
    en: "Does not count: a spiral task from an earlier week is missing.",
    fa: "حساب نمی‌شود: کار مرور هفته قبل نیست.",
  },
  INCOMPLETE: {
    en: "Does not count: observation or this week's application is empty.",
    fa: "حساب نمی‌شود: مشاهده یا کاربرد درس این هفته خالی است.",
  },
  WEEKEND: {
    en: "Does not count: weekend days are outside the count.",
    fa: "حساب نمی‌شود: روزهای آخر هفته شمرده نمی‌شوند.",
  },
  BEFORE_ISSUE: {
    en: "Does not count: this date is on or before the assignment was issued.",
    fa: "حساب نمی‌شود: این تاریخ هم‌زمان یا قبل از صدور تکلیف است.",
  },
  BEFORE_WINDOW: {
    en: "Does not count: this date is before the current count window.",
    fa: "حساب نمی‌شود: این تاریخ قبل از بازه شمارش این هفته است.",
  },
  AFTER_DUE: {
    en: "Does not count: this date is after the due Friday.",
    fa: "حساب نمی‌شود: این تاریخ بعد از جمعه موعد است.",
  },
  AFTER_SUBMISSION: {
    en: "Does not count: saved after the practical was submitted.",
    fa: "حساب نمی‌شود: بعد از ارسال تمرین ثبت شده.",
  },
  NOT_LOCKED: {
    en: "Does not count yet: it counts after midnight Amsterdam time.",
    fa: "هنوز حساب نمی‌شود: بعد از نیمه‌شب به وقت آمستردام شمرده می‌شود.",
  },
};

function reasonLine(code: string): string {
  const copy = COUNT_REASON[code];
  if (!copy) return code;
  return `${copy.en} / ${copy.fa}`;
}

function latestForDate(entries: Entry[], day: string): Entry | null {
  const matches = entries.filter((entry) => entry.localDate === day);
  if (!matches.length) return null;
  return matches.reduce((best, entry) => (entry.revisionCount > best.revisionCount ? entry : best));
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
  const [grounding, setGrounding] = useState("");
  const [paper, setPaper] = useState<Record<PaperKey, string>>(() => blank(PAPER_FIELDS));
  const [stopMoved, setStopMoved] = useState<StopMove>("");
  const [conditional, setConditional] = useState<Record<ConditionalKey, string>>(() => blank(CONDITIONAL_FIELDS));
  const [testDate, setTestDate] = useState("");

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

  const clearForm = () => {
    setTaskIds([]);
    setObservations("");
    setCurrentApplication("");
    setSpiralApplication("");
    setSelfCheck("");
    setOneLine("");
    setFreshness("UNKNOWN");
    setCalendar("");
    setDayCall("NO_TRADE");
    setGrounding("");
    setPaper(blank(PAPER_FIELDS));
    setStopMoved("");
    setConditional(blank(CONDITIONAL_FIELDS));
  };

  const loadEntry = (entry: Entry) => {
    const fields = entry.fields;
    setTaskIds(entry.taskIds ?? []);
    setObservations(fields?.observations ?? "");
    setCurrentApplication(fields?.currentApplication ?? "");
    setSpiralApplication(fields?.spiralApplication ?? "");
    setSelfCheck(fields?.selfCheck ?? "");
    setOneLine(fields?.routine?.oneLine ?? "");
    setCalendar(fields?.routine?.calendar ?? "");
    const fresh = fields?.routine?.freshness ?? "";
    setFreshness((FRESH as readonly string[]).includes(fresh) ? (fresh as (typeof FRESH)[number]) : "UNKNOWN");
    setDayCall(entry.dayCall === "TRADE" ? "TRADE" : "NO_TRADE");
    setGrounding((fields?.groundingRefs ?? []).join("\n"));
    if (fields?.paperPlan) {
      const saved = { ...blank(PAPER_FIELDS), ...fields.paperPlan };
      saved.stopType = classifyStop(saved.stopType);
      for (const key of ["equity", "riskPct", "netRR"] as const) {
        saved[key] = parseLenientDecimal(saved[key]) ?? saved[key];
      }
      setPaper(saved);
      const moved = fields.paperPlan.stopMoved;
      setStopMoved(moved === "planned" || moved === "unplanned" || moved === "no" ? moved : "");
    } else {
      setPaper(blank(PAPER_FIELDS));
      setStopMoved("");
    }
    setConditional(
      fields?.conditionalPlan ? { ...blank(CONDITIONAL_FIELDS), ...fields.conditionalPlan } : blank(CONDITIONAL_FIELDS),
    );
  };

  const save = async () => {
    setMessage(null);
    const existing = view.testMode && testDate ? latestForDate(view.entries, testDate) : null;
    const res = await fetch(existing ? `/api/mentor/daily-log/${encodeURIComponent(existing.entryId)}` : "/api/mentor/daily-log", {
      method: existing ? "PUT" : "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskIds,
        routine: { freshness, oneLine, calendar },
        observations,
        currentApplication,
        spiralApplication,
        selfCheck,
        dayCall,
        dayCallReason: "",
        groundingRefs: dayCall === "NO_TRADE" ? linesOf(grounding) : [],
        paperPlan: dayCall === "TRADE" ? { ...paper, ...(stopMoved ? { stopMoved } : {}) } : null,
        conditionalPlan:
          dayCall === "NO_TRADE" && Object.values(conditional).some((value) => value.trim())
            ? conditional
            : null,
        ...(view.testMode && testDate ? { testLocalDate: testDate } : {}),
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
          {view.testMode ? (
            <label className="block">
              {locale === "fa" ? "تاریخ آزمون (فقط حساب آزمایشی)" : "Test date (test account only)"}
              <select
                className="mt-1 w-full border border-line bg-ink px-2 py-2"
                data-testid="test-date"
                value={testDate}
                onChange={(event) => {
                  const day = event.target.value;
                  setTestDate(day);
                  if (!day) return;
                  const match = latestForDate(view.entries, day);
                  if (match) loadEntry(match);
                  else clearForm();
                }}
              >
                <option value="">{locale === "fa" ? "انتخاب تاریخ" : "Choose a date"}</option>
                {(view.allowedDates ?? []).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
          {dayCall === "TRADE" ? (
            <fieldset className="space-y-2 border border-line p-3" data-testid="paper-plan">
              <legend className="px-1 text-paper">{locale === "fa" ? "پلن کاغذی" : "Paper plan"}</legend>
              <p className="text-xs text-fog">{locale === "fa" ? "شبیه‌سازی است، سفارش نیست." : "Simulated, not an order."}</p>
              {PAPER_FIELDS.map(([key, en, fa]) =>
                key === "stopType" ? (
                  <label key={key} className="block">
                    {locale === "fa" ? fa : en}
                    <select
                      className="mt-1 w-full border border-line bg-ink px-2 py-2"
                      data-testid="paper-stopType"
                      value={classifyStop(paper.stopType)}
                      onChange={(event) => setPaper((cur) => ({ ...cur, stopType: event.target.value }))}
                    >
                      {STOP_CHOICES.map(([value, labelEn, labelFa]) => (
                        <option key={value} value={value}>
                          {locale === "fa" ? labelFa : labelEn}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label key={key} className="block">
                    {locale === "fa" ? fa : en}
                    <input
                      className="mt-1 w-full border border-line bg-ink px-2 py-2"
                      data-testid={`paper-${key}`}
                      inputMode={NUMERIC_PAPER.has(key) ? "decimal" : undefined}
                      value={paper[key]}
                      onChange={(event) => setPaper((cur) => ({ ...cur, [key]: event.target.value }))}
                    />
                  </label>
                ),
              )}
              <label className="block">
                {locale === "fa" ? "استاپ جابه‌جا شد؟ (برنامه‌ریزی‌شده / بدون برنامه / نه)" : "Stop moved? (planned / unplanned / no)"}
                <select
                  className="mt-1 w-full border border-line bg-ink px-2 py-2"
                  data-testid="paper-stopMoved"
                  value={stopMoved}
                  onChange={(event) => setStopMoved(event.target.value as StopMove)}
                >
                  {MOVE_CHOICES.map(([value, labelEn, labelFa]) => (
                    <option key={value || "blank"} value={value}>
                      {locale === "fa" ? labelFa : labelEn}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          ) : (
            <div className="space-y-2">
              <label className="block">
                {locale === "fa"
                  ? "خوانش‌های دارای timestamp، هر کدام یک خط. یا دقیقاً Observed reaction unavailable"
                  : "Timestamped readings, one per line. Or exactly Observed reaction unavailable"}
                <textarea
                  className="mt-1 w-full border border-line bg-ink px-2 py-2"
                  data-testid="grounding-refs"
                  value={grounding}
                  onChange={(event) => setGrounding(event.target.value)}
                />
              </label>
              <details className="border border-line p-3" data-testid="conditional-plan">
                <summary className="cursor-pointer text-paper">{locale === "fa" ? "پلن شرطی (اختیاری)" : "Conditional plan (optional)"}</summary>
                <div className="mt-2 space-y-2">
                  {CONDITIONAL_FIELDS.map(([key, en, fa]) => (
                    <label key={key} className="block">
                      {locale === "fa" ? fa : en}
                      <input
                        className="mt-1 w-full border border-line bg-ink px-2 py-2"
                        data-testid={`conditional-${key}`}
                        value={conditional[key]}
                        onChange={(event) => setConditional((cur) => ({ ...cur, [key]: event.target.value }))}
                      />
                    </label>
                  ))}
                </div>
              </details>
            </div>
          )}
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
          <p className="text-xs text-fog">{locale === "fa" ? "امروز معامله: پلن کاغذی را کامل کنید. امروز بدون معامله: پلن شرطی اختیاری است و معامله حساب نمی‌شود." : "Trade today needs the paper plan. A conditional plan on a no-trade day is optional and is not a trade."}</p>
          <button type="submit" className="min-h-11 bg-gold px-4 text-sm font-semibold text-ink">
            {locale === "fa" ? "ذخیره گزارش امروز" : "Save today's log"}
          </button>
        </form>
      ) : null}
      <ul className="space-y-1 text-xs text-fog" data-testid="daily-log-entries">
        {view.entries.map((entry) => (
          <li key={entry.entryId}>
            {entry.localDate} · {entry.eligible ? "eligible" : entry.ineligibleReason} · {entry.locked ? (locale === "fa" ? "قفل" : "locked") : (locale === "fa" ? "باز" : "open")} · rev {entry.revisionCount}
            {entry.countReason ? (
              <p data-testid="count-reason">{reasonLine(entry.countReason)}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {message ? <p className="text-xs text-gold-soft">{message}</p> : null}
    </section>
  );
}
