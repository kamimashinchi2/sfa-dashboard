"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ProgressProvider, useProgress } from "./ProgressProvider";
import SupportPath from "./SupportPath";
import TawkLoader from "./TawkLoader";

function Frame({
  title,
  children,
}: {
  title: { fa: string; en: string };
  children: (locale: "fa" | "en") => ReactNode;
}) {
  const { progress, setLocale } = useProgress();
  const locale = progress.locale;
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
  }, [locale]);
  return (
    <div className="atmosphere min-h-dvh px-4 py-8 text-paper">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl">{locale === "fa" ? title.fa : title.en}</h1>
          <button
            type="button"
            className="min-h-11 border border-line px-3 text-xs text-fog"
            onClick={() => setLocale(locale === "fa" ? "en" : "fa")}
          >
            {locale === "fa" ? "English" : "فارسی"}
          </button>
        </div>
        {children(locale)}
      </div>
      <TawkLoader />
    </div>
  );
}

export function AuthShell({
  title,
  children,
}: {
  title: { fa: string; en: string };
  children: (locale: "fa" | "en") => ReactNode;
}) {
  return (
    <ProgressProvider>
      <Frame title={title}>{children}</Frame>
    </ProgressProvider>
  );
}

function fieldClass() {
  return "mt-1 min-h-11 w-full border border-line bg-ink px-3 text-sm text-paper";
}

export function SignupForm({ token }: { token: string }) {
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancel = false;
    void fetch("/api/mentor/data-notice", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as { text?: string };
        if (!cancel && body.text) setNotice(body.text);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <AuthShell title={{ fa: "ساخت حساب", en: "Join" }}>
      {(locale) => (
        <form
          className="space-y-3 border border-line bg-ink/40 p-4"
          data-testid="join-form"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setMessage(null);
            const body = {
              inviteToken: token,
              displayName: name.trim(),
              email: email.trim(),
              password,
              acceptDataNotice: true as const,
            };
            void fetch("/api/mentor/signup", {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify(body),
            })
              .then(async (res) => {
                const payload = (await res.json().catch(() => ({}))) as {
                  fa?: string;
                  en?: string;
                  error?: string;
                  sessionToken?: string;
                };
                if (payload.sessionToken) {
                  setMessage(locale === "fa" ? "خطای نشست." : "Session error.");
                  return;
                }
                if (!res.ok) {
                  setMessage(locale === "fa" ? payload.fa ?? payload.error ?? "خطا" : payload.en ?? payload.error ?? "Error");
                  return;
                }
                router.push("/progress");
              })
              .catch(() => setMessage(locale === "fa" ? "شبکه در دسترس نیست." : "Network unavailable."))
              .finally(() => {
                setPassword("");
                setBusy(false);
              });
          }}
        >
          <p className="text-xs text-fog">
            {locale === "fa"
              ? "ایمیل فقط شناسه ورود است. ایمیل تأیید یا بازیابی ارسال نمی‌شود. اگر رمز را فراموش کنید، از گفتگوی پشتیبانی بخواهید مالک آکادمی یک پیوند یک‌بارمصرف ۳۰ دقیقه‌ای بدهد."
              : "Email is only a login identifier. No verification or recovery email is sent. If you forget the password, ask the support chat and the owner will give you a one-time 30-minute link."}
          </p>
          <label className="block text-xs text-fog">
            {locale === "fa" ? "نام نمایشی" : "Display name"}
            <input className={fieldClass()} value={name} data-testid="display-name" autoComplete="name" onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block text-xs text-fog">
            {locale === "fa" ? "ایمیل" : "Email"}
            <input className={fieldClass()} type="email" value={email} data-testid="email" autoComplete="username" onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block text-xs text-fog">
            {locale === "fa" ? "رمز عبور (حداقل ۱۲ نویسه)" : "Password (at least 12 characters)"}
            <input
              className={fieldClass()}
              type="password"
              value={password}
              data-testid="password"
              autoComplete="new-password"
              minLength={12}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <p className="text-xs text-fog" data-testid="data-notice">
            {notice || (locale === "fa" ? "در حال دریافت اطلاعیه داده…" : "Loading the data notice…")}
          </p>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={accepted} data-testid="accept-notice" onChange={(e) => setAccepted(e.target.checked)} required />
            {locale === "fa" ? "اطلاعیه داده را می‌پذیرم" : "I accept the data notice"}
          </label>
          <button
            type="submit"
            className="min-h-11 w-full bg-gold text-sm font-semibold text-ink disabled:opacity-40"
            data-testid="signup-submit"
            disabled={busy || !accepted || password.length < 12}
          >
            {locale === "fa" ? "ساخت حساب" : "Create account"}
          </button>
          {message ? (
            <p className="text-xs text-gold-soft" role="alert">
              {message}
            </p>
          ) : null}
        </form>
      )}
    </AuthShell>
  );
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <AuthShell title={{ fa: "ورود", en: "Log in" }}>
      {(locale) => (
        <form
          className="space-y-3 border border-line bg-ink/40 p-4"
          data-testid="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setMessage(null);
            void fetch("/api/mentor/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({ email: email.trim(), password }),
            })
              .then(async (res) => {
                const payload = (await res.json().catch(() => ({}))) as {
                  fa?: string;
                  en?: string;
                  error?: string;
                  sessionToken?: string;
                };
                if (payload.sessionToken) {
                  setMessage(locale === "fa" ? "خطای نشست." : "Session error.");
                  return;
                }
                if (!res.ok) {
                  setMessage(locale === "fa" ? payload.fa ?? "ورود ناموفق" : payload.en ?? "Login failed");
                  return;
                }
                router.push("/progress");
              })
              .catch(() => setMessage(locale === "fa" ? "شبکه در دسترس نیست." : "Network unavailable."))
              .finally(() => {
                setPassword("");
                setBusy(false);
              });
          }}
        >
          <SupportPath locale={locale} />
          <label className="block text-xs text-fog">
            {locale === "fa" ? "ایمیل" : "Email"}
            <input className={fieldClass()} type="email" value={email} data-testid="login-email" autoComplete="username" onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block text-xs text-fog">
            {locale === "fa" ? "رمز عبور" : "Password"}
            <input className={fieldClass()} type="password" value={password} data-testid="login-password" autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit" className="min-h-11 w-full bg-gold text-sm font-semibold text-ink disabled:opacity-40" data-testid="login-submit" disabled={busy}>
            {locale === "fa" ? "ورود" : "Log in"}
          </button>
          {message ? (
            <p className="text-xs text-gold-soft" role="alert">
              {message}
            </p>
          ) : null}
        </form>
      )}
    </AuthShell>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <AuthShell title={{ fa: "رمز جدید", en: "New password" }}>
      {(locale) => (
        <form
          className="space-y-3 border border-line bg-ink/40 p-4"
          data-testid="reset-form"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setMessage(null);
            void fetch("/api/mentor/reset-password", {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({ token, password }),
            })
              .then(async (res) => {
                const payload = (await res.json().catch(() => ({}))) as { fa?: string; en?: string };
                if (!res.ok) {
                  setMessage(locale === "fa" ? payload.fa ?? "بازیابی ناموفق" : payload.en ?? "Reset failed");
                  return;
                }
                setMessage(locale === "fa" ? "رمز عوض شد. همه نشست‌ها باطل شدند." : "Password updated. All sessions were revoked.");
                window.setTimeout(() => router.push("/login"), 600);
              })
              .catch(() => setMessage(locale === "fa" ? "شبکه در دسترس نیست." : "Network unavailable."))
              .finally(() => {
                setPassword("");
                setBusy(false);
              });
          }}
        >
          <p className="text-xs text-fog">
            {locale === "fa"
              ? "این پیوند یک‌بارمصرف است و حدود ۳۰ دقیقه اعتبار دارد. ایمیل بازیابی ارسال نمی‌شود."
              : "This link is single-use and expires in about 30 minutes. No recovery email is sent."}
          </p>
          <label className="block text-xs text-fog">
            {locale === "fa" ? "رمز جدید (حداقل ۱۲ نویسه)" : "New password (at least 12 characters)"}
            <input
              className={fieldClass()}
              type="password"
              value={password}
              data-testid="reset-password"
              autoComplete="new-password"
              minLength={12}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="min-h-11 w-full bg-gold text-sm font-semibold text-ink disabled:opacity-40" disabled={busy || password.length < 12}>
            {locale === "fa" ? "ذخیره رمز" : "Save password"}
          </button>
          {message ? (
            <p className="text-xs text-gold-soft" role="status">
              {message}
            </p>
          ) : null}
        </form>
      )}
    </AuthShell>
  );
}
