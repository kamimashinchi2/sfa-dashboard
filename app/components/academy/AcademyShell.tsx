"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { Calculator, BookOpen, Languages } from "lucide-react";
import { ui, t } from "../../lib/academy/dictionary";
import { ProgressProvider, useProgress } from "./ProgressProvider";
import StatusPanel from "./StatusPanel";

function ShellInner({ children }: { children: ReactNode }) {
  const { progress, setLocale, hydrated, warning, storageError, xp, resetProgress } =
    useProgress();
  const locale = progress.locale;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
  }, [locale]);

  return (
    <div className="atmosphere relative flex min-h-dvh flex-1 flex-col overflow-x-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-sheen opacity-70" />

      <div className="relative z-20 border-b border-gold/30 bg-ink/80 px-4 py-2 text-center text-xs text-gold-soft">
        {t(ui.pilotNotice, locale)}
        {warning ? ` · ${warning}` : ""}
        {storageError ? ` · storage: ${storageError}` : ""}
      </div>

      <header className="relative z-10 border-b border-line bg-ink/50 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Link href="/academy" className="font-display text-2xl tracking-tight text-paper sm:text-3xl">
                Smart Financial Academy
              </Link>
              <p className="mt-1 text-sm text-gold-soft sm:text-base" lang="fa" dir="rtl">
                آکادمی هوشمند بازارهای مالی
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 border border-line px-3 py-2 text-xs text-fog hover:text-paper"
                onClick={() => setLocale(locale === "fa" ? "en" : "fa")}
              >
                <Languages className="h-4 w-4" aria-hidden />
                {t(ui.localeToggle, locale)}
              </button>
              <Link
                href="/simulators/risk-grid"
                className="inline-flex min-h-11 items-center gap-2 border border-gold/45 px-3 py-2 text-xs font-semibold text-gold-soft hover:bg-gold/10"
              >
                <Calculator className="h-4 w-4" aria-hidden />
                Risk Grid
              </Link>
              <Link
                href="/journal/builder"
                className="inline-flex min-h-11 items-center gap-2 border border-line px-3 py-2 text-xs text-fog hover:text-paper"
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                Journal
              </Link>
              <Link
                href="/progress"
                className="inline-flex min-h-11 items-center gap-2 border border-line px-3 py-2 text-xs text-fog hover:text-paper"
              >
                XP {hydrated ? xp : "—"}
              </Link>
            </div>
          </div>
          <StatusPanel />
        </div>
      </header>

      <div className="relative z-10 border-b border-line bg-teal/20 px-4 py-2 text-center text-xs font-medium tracking-wide text-teal-bright">
        {t(ui.syntheticBanner, locale)}
      </div>

      <main className="relative z-10 flex flex-1 flex-col">{children}</main>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-fog sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="font-display text-paper">Smart Financial Academy</p>
            <p className="mt-1 text-xs">{t(ui.audioUnavailable, locale)}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/legal/disclaimer" className="hover:text-paper">
              Disclaimer
            </Link>
            <button type="button" onClick={resetProgress} className="hover:text-paper">
              {t(ui.progressReset, locale)}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function AcademyShell({ children }: { children: ReactNode }) {
  return (
    <ProgressProvider>
      <ShellInner>{children}</ShellInner>
    </ProgressProvider>
  );
}
