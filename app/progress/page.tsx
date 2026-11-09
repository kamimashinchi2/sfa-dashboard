"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import AcademyShell from "../components/academy/AcademyShell";
import { useProgress } from "../components/academy/ProgressProvider";
import {
  consentStore,
  outboxStore,
  type ConsentStore,
} from "../lib/academy/persist/outbox";
import { prefsStore } from "../lib/academy/persist";
import { pauseOutboxForLogin, scheduleOutboxFlush, startOutboxListeners } from "../lib/academy/outboxFlush";
import { STUDENT_ID_RE, ALIAS_RE } from "../lib/academy/packet/schema";

type Entitlement = {
  unlockedStage: number;
  currentWeek: number;
  status: string;
};

type LinkStatus = {
  studentId?: string;
  alias?: string;
  unlockedStage?: number;
  currentWeek?: number;
  status?: string;
  telegramLinkStatus?: string;
};

function ProgressBody() {
  const {
    progress,
    xp,
    hydrated,
    warning,
    storageError,
    quotaExceeded,
    quarantine,
    exportBackup,
    importBackup,
    resetProgress,
  } = useProgress();
  const locale = progress.locale;
  const prefs = useSyncExternalStore(
    prefsStore.subscribe,
    prefsStore.getSnapshot,
    prefsStore.getServerSnapshot,
  );
  const consent = useSyncExternalStore(
    consentStore.subscribe,
    consentStore.getSnapshot,
    consentStore.getServerSnapshot,
  );
  const outbox = useSyncExternalStore(
    outboxStore.subscribe,
    outboxStore.getSnapshot,
    outboxStore.getServerSnapshot,
  );

  const [importRaw, setImportRaw] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [enrollmentToken, setEnrollmentToken] = useState("");
  const [sessionMsg, setSessionMsg] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => startOutboxListeners(), []);

  const refreshEntitlements = async () => {
    try {
      const res = await fetch("/api/mentor/entitlements", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.status === 401) {
        setEntitlement(null);
        pauseOutboxForLogin(true);
        return;
      }
      if (!res.ok) {
        setEntitlement(null);
        return;
      }
      const body = (await res.json()) as Entitlement;
      setEntitlement(body);
      pauseOutboxForLogin(false);
    } catch {
      setEntitlement(null);
    }
  };

  const refreshLinkStatus = async () => {
    try {
      const res = await fetch("/api/mentor/link-status", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        setLinkStatus(null);
        return;
      }
      setLinkStatus((await res.json()) as LinkStatus);
    } catch {
      setLinkStatus(null);
    }
  };

  useEffect(() => {
    const kick = () => {
      void refreshEntitlements();
      void refreshLinkStatus();
    };
    const t = window.setTimeout(kick, 0);
    window.addEventListener("focus", kick);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("focus", kick);
    };
  }, []);

  const onLogin = async () => {
    setBusy(true);
    setSessionMsg(null);
    try {
      const res = await fetch("/api/mentor/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ enrollmentToken }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        en?: string;
        fa?: string;
      };
      setEnrollmentToken("");
      if (!res.ok) {
        setSessionMsg(
          body.fa && locale === "fa"
            ? body.fa
            : body.en || body.error || `HTTP_${res.status}`,
        );
        return;
      }
      setSessionMsg(locale === "fa" ? "نشست برقرار شد." : "Session established.");
      pauseOutboxForLogin(false);
      await refreshEntitlements();
      await refreshLinkStatus();
      scheduleOutboxFlush(200);
    } catch {
      setSessionMsg(locale === "fa" ? "خطای شبکه" : "Network error");
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    await fetch("/api/mentor/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: "{}",
    });
    pauseOutboxForLogin(true);
    setEntitlement(null);
    setLinkStatus(null);
    setLinkCode(null);
    setSessionMsg(locale === "fa" ? "خارج شدید — صف متوقف شد." : "Logged out — flush stopped.");
  };

  const onLinkCode = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/mentor/link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
      const body = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !body.code) {
        setSessionMsg(body.error || `HTTP_${res.status}`);
        setLinkCode(null);
        return;
      }
      setLinkCode(body.code);
      // Never put code in outbox/telemetry — UI only
    } finally {
      setBusy(false);
    }
  };

  const setConsent = (on: boolean) => {
    const next: ConsentStore = {
      schemaVersion: 1,
      quizTransportConsent: on,
      consentedAtISO: on ? new Date().toISOString() : null,
    };
    consentStore.set(next);
    if (!on) {
      setSessionMsg(
        locale === "fa"
          ? "رضایت خاموش — صف ارسال متوقف. پاک‌کردن صف محلی شواهدِ قبلاً دریافت‌شده را حذف نمی‌کند."
          : "Consent OFF — enqueue/flush stopped. Clearing the local queue does not delete already-received remote evidence.",
      );
    } else {
      scheduleOutboxFlush(200);
    }
  };

  const confirmIdentityFromLink = () => {
    if (!linkStatus?.studentId || !linkStatus.alias) return;
    if (
      prefs.studentId &&
      prefs.studentId !== linkStatus.studentId &&
      !window.confirm(
        locale === "fa"
          ? "هویت پل با prefs محلی فرق دارد. اتصال مجدد تاریخچه را بی‌صدا بازنویسی نمی‌کند — تأیید می‌کنید؟"
          : "Bridge identity differs from local prefs. This will not silently rebind other-student history — confirm?",
      )
    ) {
      return;
    }
    prefsStore.set({
      ...prefs,
      studentId: linkStatus.studentId,
      alias: linkStatus.alias,
    });
  };

  const queued = outbox.entries.filter((e) => e.status !== "ACKED");
  const identityOk =
    STUDENT_ID_RE.test(prefs.studentId ?? "") &&
    ALIAS_RE.test(prefs.alias ?? "");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10 sm:px-8" data-testid="progress-page">
      <h1 className="font-display text-3xl text-paper">
        {locale === "fa" ? "پیشرفت و هویت" : "Progress & identity"}
      </h1>
      <p className="text-sm text-gold-soft">
        {locale === "fa"
          ? "ذخیره محلی تمرین است نه entitlement. باز شدن درس بعدی فقط پس از تأیید تمرین عملی (پس از تأیید ادمین و تحویل)."
          : "Local practice storage is not entitlement. Next lesson unlocks only after practical approval (after admin delivery)."}
      </p>

      <section className="space-y-3 border border-line bg-ink/40 p-4" data-testid="mentor-session">
        <h2 className="font-display text-xl text-paper">
          {locale === "fa" ? "نشست منتور (پایلوت)" : "Mentor session (pilot)"}
        </h2>
        <p className="text-xs text-fog">
          {locale === "fa"
            ? "اعتبار ثبت‌نام قابل استفاده مجدد است — OTP یا SSO نیست. توکن فقط در کوکی HttpOnly."
            : "Reusable enrollment credential — not an OTP or SSO. Token stays in an HttpOnly cookie only."}
        </p>
        <label className="block text-xs text-fog">
          enrollment credential
          <input
            type="password"
            className="mt-2 min-h-11 w-full border border-line bg-ink px-3 font-mono text-sm text-paper"
            value={enrollmentToken}
            data-testid="enrollment-token"
            autoComplete="off"
            onChange={(e) => setEnrollmentToken(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 bg-gold px-4 text-sm font-semibold text-ink disabled:opacity-40"
            disabled={busy || !enrollmentToken}
            data-testid="mentor-login"
            onClick={() => void onLogin()}
          >
            {locale === "fa" ? "ورود" : "Sign in"}
          </button>
          <button
            type="button"
            className="min-h-11 border border-line px-4 text-sm text-fog"
            data-testid="mentor-logout"
            onClick={() => void onLogout()}
          >
            {locale === "fa" ? "خروج" : "Log out"}
          </button>
          <button
            type="button"
            className="min-h-11 border border-line px-4 text-sm text-fog"
            data-testid="refresh-entitlements"
            onClick={() => {
              void refreshEntitlements();
              void refreshLinkStatus();
            }}
          >
            Refresh
          </button>
        </div>
        {sessionMsg ? (
          <p className="text-xs text-gold-soft" aria-live="polite">
            {sessionMsg}
          </p>
        ) : null}
      </section>

      <section className="space-y-2 border border-line bg-ink/40 p-4" data-testid="entitlements-panel">
        <h2 className="font-display text-xl text-paper">Entitlements</h2>
        {entitlement ? (
          <dl className="font-mono text-sm text-gold-soft space-y-1">
            <div>unlockedStage: {entitlement.unlockedStage} (max 8 — never 9)</div>
            <div>currentWeek: {entitlement.currentWeek}</div>
            <div>status: {entitlement.status}</div>
          </dl>
        ) : (
          <p className="text-sm text-fog">
            {locale === "fa"
              ? "بدون نشست / پل — محتوای آینده قفل است (fail closed)."
              : "No session / bridge — future content locked (fail closed)."}
          </p>
        )}
        {linkStatus ? (
          <div className="mt-3 space-y-2 text-xs text-fog">
            <p>
              bridge identity:{" "}
              <bdi dir="ltr">
                {linkStatus.studentId} / {linkStatus.alias}
              </bdi>{" "}
              · telegram: {linkStatus.telegramLinkStatus ?? "—"}
            </p>
            <button
              type="button"
              className="min-h-11 border border-line px-3 text-xs"
              onClick={confirmIdentityFromLink}
            >
              {locale === "fa"
                ? "تأیید صریح هویت در prefs محلی"
                : "Explicitly match local prefs to bridge identity"}
            </button>
          </div>
        ) : null}
        <p className="text-xs text-fog">
          local prefs:{" "}
          <bdi dir="ltr">
            {prefs.studentId ?? "—"} / {prefs.alias ?? "—"}
          </bdi>{" "}
          {identityOk ? "✓" : "(invalid format)"}
        </p>
      </section>

      <section className="space-y-3 border border-line bg-ink/40 p-4" data-testid="consent-panel">
        <h2 className="font-display text-xl text-paper">
          {locale === "fa" ? "رضایت ارسال آزمون" : "Quiz transport consent"}
        </h2>
        <p className="text-xs text-fog">
          {locale === "fa"
            ? "با روشن کردن، پاسخ‌های کامل هر آیتم، بازتاب‌ها، شناسه/مستعار/بیلد/زمان برای ارزیابی Echo و پردازش خصوصی Drive ارسال می‌شود. نگهداری نیاز به تأیید اپراتور دارد. پیش‌فرض خاموش است؛ فقط تلاش‌های آینده."
            : "When ON, full per-item answers, reflections, alias/ID/build/time are sent for Echo assessment and private Drive processing. Retention requires operator confirmation. Default OFF; future persisted attempts only — no backfill."}
        </p>
        <label className="flex min-h-11 items-center gap-2 text-sm text-paper">
          <input
            type="checkbox"
            checked={consent.quizTransportConsent}
            data-testid="consent-toggle"
            onChange={(e) => setConsent(e.target.checked)}
          />
          {locale === "fa" ? "رضایت می‌دهم (آینده)" : "I consent (future attempts)"}
        </label>
        {consent.consentedAtISO ? (
          <p className="font-mono text-[11px] text-teal-bright">
            consentedAt: {consent.consentedAtISO}
          </p>
        ) : null}
      </section>

      <section className="space-y-3 border border-line bg-ink/40 p-4" data-testid="link-code-panel">
        <h2 className="font-display text-xl text-paper">Telegram link code</h2>
        <p className="text-xs text-fog">
          {locale === "fa"
            ? "کد یک‌بارمصرف ۱۰ دقیقه‌ای — محرمانه. هرگز در outbox/بکاپ/لاگ."
            : "10-minute one-use code — secret. Never in outbox/backups/logs."}
        </p>
        <button
          type="button"
          className="min-h-11 border border-gold/50 px-4 text-sm text-gold-soft"
          disabled={busy}
          data-testid="request-link-code"
          onClick={() => void onLinkCode()}
        >
          {locale === "fa" ? "درخواست کد" : "Request code"}
        </button>
        {linkCode ? (
          <div className="space-y-2" data-testid="link-code-display">
            <p className="font-mono text-lg text-paper">
              <bdi dir="ltr">{linkCode}</bdi>
            </p>
            <p className="text-xs text-fog">
              /link <bdi dir="ltr">{linkCode}</bdi> · /start{" "}
              <bdi dir="ltr">{linkCode}</bdi>
            </p>
            <label className="block text-xs text-fog">
              public bot username (operator-provided)
              <input
                className="mt-1 min-h-11 w-full border border-line bg-ink px-3 font-mono text-sm"
                value={botUsername}
                dir="ltr"
                placeholder="YourPublicBot"
                onChange={(e) => setBotUsername(e.target.value.replace(/^@/, ""))}
              />
            </label>
            {botUsername ? (
              <p className="text-xs text-teal-bright">
                deep link:{" "}
                <bdi dir="ltr">
                  https://t.me/{botUsername}?start={linkCode}
                </bdi>
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 border border-line bg-ink/40 p-4" data-testid="outbox-panel">
        <h2 className="font-display text-xl text-paper">Outbox (sfa.v2.outbox)</h2>
        <p className="font-mono text-xs text-gold-soft">
          queued={queued.length} · receipts={outbox.receipts.length}
        </p>
        <ul className="space-y-2 text-xs text-fog">
          {queued.slice(0, 10).map((e) => (
            <li key={e.attemptId} className="border border-line/40 p-2">
              <bdi dir="ltr">{e.attemptId}</bdi> · {e.status} · retries=
              {e.retries}
              {e.errorCode ? ` · ${e.errorCode}` : ""}
            </li>
          ))}
          {queued.length === 0 ? <li>_none_</li> : null}
        </ul>
        <button
          type="button"
          className="min-h-11 border border-line px-4 text-sm text-fog"
          data-testid="outbox-retry"
          onClick={() => scheduleOutboxFlush(0)}
        >
          Manual retry
        </button>
      </section>

      <p className="text-sm text-fog">
        <a href="/submit" className="text-gold-soft underline">
          Weekly submission packet
        </a>
      </p>
      <p className="text-sm text-fog">
        localStorage practice only — not entitlement. Hydrated: {String(hydrated)}
      </p>
      {warning ? <p className="text-xs text-gold-soft">{warning}</p> : null}
      {storageError ? <p className="text-xs text-red-400">{storageError}</p> : null}
      {quotaExceeded ? (
        <div className="border border-gold/50 bg-ink/50 p-3 text-sm text-gold-soft">
          Storage quota exceeded — memory kept. Please Export a full backup.
          <button
            type="button"
            className="ml-3 min-h-11 border border-gold/50 px-3 text-xs"
            onClick={exportBackup}
          >
            Download full backup
          </button>
        </div>
      ) : null}
      {quarantine ? (
        <div className="border border-red-400/40 p-3 text-sm text-red-300">
          Quarantine: {quarantine.key} · {quarantine.reason}.
        </div>
      ) : null}

      {!hydrated ? (
        <div className="animate-pulse space-y-2" aria-busy>
          <div className="h-6 w-40 bg-line" />
        </div>
      ) : (
        <dl className="space-y-2 font-mono text-sm text-gold-soft">
          <div>locale: {progress.locale}</div>
          <div>selectedStage: {progress.selectedStage}</div>
          <div>xp: {xp}</div>
          <div>lessons: {progress.completedLessonIds.join(", ") || "—"}</div>
          <div>attempts: {progress.attempts.length}</div>
        </dl>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 bg-gold px-4 text-sm font-semibold text-ink"
          onClick={exportBackup}
          data-testid="export-backup"
        >
          Download full backup
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-4 text-sm text-fog"
          onClick={resetProgress}
        >
          Reset section
        </button>
      </div>

      <label className="block text-xs text-fog">
        Import backup JSON (≤2 MB) — excludes outbox/credentials
        <textarea
          className="mt-1 min-h-28 w-full border border-line bg-ink px-3 py-2 font-mono text-xs text-paper"
          value={importRaw}
          onChange={(e) => setImportRaw(e.target.value)}
          data-testid="import-backup-raw"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 border border-gold/50 px-4 text-sm text-gold-soft"
          onClick={() => {
            const r = importBackup(importRaw, "merge");
            setImportMsg(
              r.ok
                ? `Merge OK · sections ${r.diff?.join(",") ?? "—"}`
                : `Merge failed: ${r.error}`,
            );
          }}
        >
          Merge import
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-4 text-sm text-fog"
          onClick={() => {
            const r = importBackup(importRaw, "replace");
            setImportMsg(
              r.ok
                ? `Replace OK · sections ${r.diff?.join(",") ?? "—"}`
                : `Replace failed: ${r.error}`,
            );
          }}
        >
          Replace import
        </button>
      </div>
      {importMsg ? (
        <p className="text-xs text-gold-soft" aria-live="polite">
          {importMsg}
        </p>
      ) : null}
    </div>
  );
}

export default function ProgressPage() {
  return (
    <AcademyShell>
      <ProgressBody />
    </AcademyShell>
  );
}
