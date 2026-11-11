"use client";

import { useEffect, useState } from "react";
import AcademyShell from "../components/academy/AcademyShell";
import { useProgress } from "../components/academy/ProgressProvider";

type Me = { role?: string; displayName?: string };
type DecisionRow = {
  id: string;
  student: string;
  state: string;
  delivered_at: number | null;
  body: Record<string, unknown>;
};

function AdminBody() {
  const { progress } = useProgress();
  const locale = progress.locale;
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<DecisionRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const meRes = await fetch("/api/mentor/me", { credentials: "same-origin", cache: "no-store" });
      if (!meRes.ok) return;
      const profile = (await meRes.json()) as Me;
      if (cancel) return;
      setMe(profile);
      if (profile.role !== "ADMIN") return;
      const res = await fetch("/api/mentor/admin/decisions", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { en?: string; fa?: string };
        setMessage(locale === "fa" ? body.fa ?? "دسترسی رد شد" : body.en ?? "Access denied");
        return;
      }
      const body = (await res.json()) as { decisions?: DecisionRow[] };
      setRows(body.decisions ?? []);
    })();
    return () => {
      cancel = true;
    };
  }, [locale]);

  const override = async (id: string) => {
    setMessage(null);
    const res = await fetch(`/api/mentor/admin/decisions/${encodeURIComponent(id)}/override`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ reason }),
    });
    const body = (await res.json().catch(() => ({}))) as { fa?: string; en?: string; message?: string };
    setReason("");
    setMessage(
      res.ok
        ? locale === "fa"
          ? "باطل شد. اگر کار بعدی مانع بازگشت امن باشد، سرور رد می‌کند."
          : "Override requested. Later work that blocks a safe rollback is rejected by the server."
        : locale === "fa"
          ? body.fa ?? body.message ?? "رد شد"
          : body.en ?? body.message ?? "Rejected",
    );
  };

  if (!me) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-10 text-fog">
        <a className="underline" href="/login">
          {locale === "fa" ? "ورود" : "Log in"}
        </a>
      </p>
    );
  }
  if (me.role !== "ADMIN") {
    return (
      <p className="mx-auto max-w-3xl px-4 py-10 text-gold-soft" data-testid="admin-denied">
        {locale === "fa" ? "این صفحه فقط برای مدیر است." : "This page is only for an admin."}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8" data-testid="admin-page">
      <h1 className="font-display text-3xl text-paper">{locale === "fa" ? "تصمیم‌ها" : "Decisions"}</h1>
      <p className="text-xs text-fog">
        {locale === "fa"
          ? "پنجره اصلاح ۲۴ ساعت است. اگر دانشجو بعد از آن کار جدیدی شروع کرده باشد، بازگشت خودکار رد می‌شود."
          : "The correction window is 24 hours. If the student started later work, automatic rollback is refused."}
      </p>
      <label className="block text-xs text-fog">
        {locale === "fa" ? "دلیل ابطال" : "Override reason"}
        <textarea className="mt-1 min-h-20 w-full border border-line bg-ink px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <ul className="space-y-3">
        {rows.map((row) => {
          return (
            <li key={row.id} className="border border-line p-3 text-sm text-fog">
              <p className="font-mono text-xs text-gold-soft">
                <bdi dir="ltr">{row.id}</bdi> · {row.state}
                {row.delivered_at
                  ? ` · delivered ${row.delivered_at}`
                  : ""}
              </p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(row.body, null, 2)}</pre>
              <button type="button" className="mt-2 min-h-11 border border-line px-3 text-xs" onClick={() => void override(row.id)}>
                {locale === "fa" ? "ابطال" : "Override"}
              </button>
            </li>
          );
        })}
      </ul>
      {message ? <p className="text-xs text-gold-soft">{message}</p> : null}
    </div>
  );
}

export default function AdminPage() {
  return (
    <AcademyShell>
      <AdminBody />
    </AcademyShell>
  );
}
