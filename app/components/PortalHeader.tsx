"use client";

import { Calculator, Menu } from "lucide-react";
import StatusBadges from "./StatusBadges";

type Props = {
  onOpenSizer: () => void;
};

export default function PortalHeader({ onOpenSizer }: Props) {
  return (
    <header className="relative z-10 border-b border-line bg-ink/50 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-2xl tracking-tight text-paper sm:text-3xl">
              Smart Financial Academy
            </p>
            <p
              className="mt-1 text-sm text-gold-soft sm:text-base"
              lang="fa"
              dir="rtl"
            >
              آکادمی هوشمند بازارهای مالی
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onOpenSizer}
              className="inline-flex items-center gap-2 border border-gold/45 px-3 py-2 text-xs font-semibold tracking-wide text-gold-soft transition-colors hover:border-gold hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:px-4 sm:text-sm"
            >
              <Calculator className="h-4 w-4" aria-hidden strokeWidth={1.75} />
              Position sizer
            </button>
            <a
              href="#curriculum"
              className="inline-flex items-center gap-2 text-xs text-fog transition-colors hover:text-paper sm:text-sm"
            >
              <Menu className="h-4 w-4 sm:hidden" aria-hidden />
              <span className="hidden sm:inline">Curriculum</span>
            </a>
          </div>
        </div>

        <StatusBadges />
      </div>
    </header>
  );
}
