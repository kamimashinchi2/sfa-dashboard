"use client";

import { useState } from "react";
import { JOURNAL_URL, stages } from "../lib/curriculum";
import RulebookDrawer from "./RulebookDrawer";
import StageNav from "./StageNav";
import StageViewer from "./StageViewer";

export default function AcademyPortal() {
  const [activeId, setActiveId] = useState(2);
  const [rulebookOpen, setRulebookOpen] = useState(false);
  const activeStage = stages.find((stage) => stage.id === activeId) ?? stages[1];

  return (
    <div className="atmosphere relative flex min-h-full flex-1 flex-col overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid-sheen opacity-70"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5 sm:px-8">
        <p className="font-display text-sm tracking-[0.18em] text-gold-soft uppercase">
          Learning portal
        </p>
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => setRulebookOpen(true)}
            className="text-sm text-fog transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Rulebook
          </button>
          <a
            href={JOURNAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sm text-fog transition-colors hover:text-paper sm:inline"
          >
            Trade journal
          </a>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col">
        <section className="relative mx-auto flex min-h-[calc(100svh-4.5rem)] w-full max-w-6xl flex-col justify-center px-6 pb-16 pt-6 sm:px-8 lg:pb-24">
          <div
            aria-hidden
            className="chart-silhouette pointer-events-none absolute inset-y-8 -right-8 left-[28%] hidden opacity-80 md:block lg:left-[36%]"
          />

          <div className="relative max-w-xl lg:max-w-2xl">
            <p className="reveal font-display text-4xl leading-[0.95] tracking-tight text-paper sm:text-5xl md:text-6xl lg:text-7xl">
              Smart Financial
              <span className="block text-gold-soft">Academy</span>
            </p>

            <h1 className="reveal reveal-delay-1 mt-8 max-w-lg font-display text-2xl leading-snug text-paper sm:text-3xl">
              Eight-stage path to disciplined price action
            </h1>

            <p className="reveal reveal-delay-2 mt-4 max-w-md text-base leading-relaxed text-fog sm:text-lg">
              Progress from FX foundations through market structure, macro, and
              risk math — then ship a capstone research notebook.
            </p>

            <div className="reveal reveal-delay-3 mt-10 flex flex-wrap items-center gap-4">
              <a
                href={JOURNAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-pulse inline-flex items-center justify-center rounded-md bg-gold px-6 py-3.5 text-sm font-semibold tracking-wide text-ink transition-[transform,background-color] duration-200 hover:translate-y-[-1px] hover:bg-gold-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Submit Weekly Trade Journal
              </a>
              <a
                href="#curriculum"
                className="text-sm text-fog underline-offset-4 transition-colors hover:text-paper hover:underline"
              >
                Enter curriculum
              </a>
            </div>
          </div>
        </section>

        <section
          id="curriculum"
          className="relative border-t border-line bg-ink-elevated/40"
        >
          <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-8 lg:py-16">
            <div className="max-w-2xl">
              <p className="text-xs font-medium tracking-[0.22em] text-teal-bright uppercase">
                Master Curriculum v1.0
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight text-paper sm:text-4xl">
                Stage curriculum
              </h2>
              <p className="mt-4 text-base leading-relaxed text-fog">
                Select a stage to review topics, essential reading, and measurable
                pass criteria. Stage 2 locks Mission 1 market structure.
              </p>
            </div>

            <div className="mt-8 border-b border-line">
              <StageNav
                stages={stages}
                activeId={activeId}
                onSelect={setActiveId}
              />
            </div>

            <div className="mt-10 lg:mt-12">
              <StageViewer stage={activeStage} />
            </div>
          </div>
        </section>

        <section className="relative border-t border-line">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-14 sm:px-8 sm:flex-row sm:items-end sm:justify-between lg:py-16">
            <div className="max-w-xl">
              <p className="text-xs font-medium tracking-[0.22em] text-teal-bright uppercase">
                Weekly cadence
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight text-paper">
                Journal before you size up
              </h2>
              <p className="mt-4 text-base leading-relaxed text-fog">
                Log thesis, structure, risk, and outcome each week. Open the
                rulebook anytime you size a position.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setRulebookOpen(true)}
                className="inline-flex items-center justify-center rounded-md border border-gold/50 px-6 py-3.5 text-sm font-semibold tracking-wide text-gold-soft transition-colors hover:border-gold hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Open rulebook
              </button>
              <a
                href={JOURNAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md bg-gold px-6 py-3.5 text-sm font-semibold tracking-wide text-ink transition-colors hover:bg-gold-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Submit Weekly Trade Journal
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-fog sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-display text-paper">Smart Financial Academy</p>
          <p>Interactive learning portal · Stages 1–8</p>
        </div>
      </footer>

      <RulebookDrawer
        open={rulebookOpen}
        onClose={() => setRulebookOpen(false)}
      />
    </div>
  );
}
