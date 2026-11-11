"use client";

import { useState } from "react";
import { stages } from "../lib/curriculum";
import MissionDispatch from "./MissionDispatch";
import PortalHeader from "./PortalHeader";
import PositionSizer from "./PositionSizer";
import StageGrid from "./StageGrid";
import StagePanel from "./StagePanel";

export default function AcademyPortal() {
  const [activeId, setActiveId] = useState(1);
  const [sizerOpen, setSizerOpen] = useState(false);
  const activeStage = stages.find((stage) => stage.id === activeId) ?? stages[0];

  return (
    <div className="atmosphere relative flex min-h-full flex-1 flex-col overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid-sheen opacity-70"
      />

      <PortalHeader onOpenSizer={() => setSizerOpen(true)} />

      <main className="relative z-10 flex flex-1 flex-col">
        <section className="relative mx-auto w-full max-w-6xl px-6 pb-10 pt-10 sm:px-8 sm:pt-12">
          <div
            aria-hidden
            className="chart-silhouette pointer-events-none absolute inset-y-4 -right-8 left-[42%] hidden opacity-60 lg:block"
          />
          <div className="relative max-w-2xl">
            <p className="reveal text-[10px] font-medium tracking-[0.22em] text-teal-bright uppercase">
              Student Learning Portal
            </p>
            <h1 className="reveal reveal-delay-1 mt-3 font-display text-3xl leading-tight tracking-tight text-paper sm:text-4xl md:text-5xl">
              Eight-stage institutional curriculum
            </h1>
            <p className="reveal reveal-delay-2 mt-4 max-w-xl text-base leading-relaxed text-fog">
              Select a stage, clear its milestones, size every idea at the 1.0%
              risk cap, and upload the weekly practical on the dashboard — with Echo online
              for mentor review.
            </p>
          </div>
        </section>

        <section
          id="curriculum"
          className="relative border-t border-line bg-ink-elevated/35"
        >
          <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-12 sm:px-8 lg:space-y-12 lg:py-16">
            <div className="max-w-2xl">
              <p className="text-[10px] font-medium tracking-[0.22em] text-teal-bright uppercase">
                Master Curriculum
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight text-paper sm:text-4xl">
                Interactive stage grid
              </h2>
              <p className="mt-3 text-base leading-relaxed text-fog">
                All eight stages are selectable. Content, links, audio briefing,
                milestones, and the active mission update with your selection.
              </p>
            </div>

            <StageGrid
              stages={stages}
              activeId={activeId}
              onSelect={setActiveId}
            />

            <StagePanel stage={activeStage} />

            <MissionDispatch stage={activeStage} />
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-fog sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="font-display text-paper">Smart Financial Academy</p>
            <p className="mt-1 text-xs text-gold-soft" lang="fa" dir="rtl">
              آکادمی هوشمند بازارهای مالی
            </p>
          </div>
          <p>Student Learning Portal · Stages 1–8 · Echo online</p>
        </div>
      </footer>

      <PositionSizer open={sizerOpen} onClose={() => setSizerOpen(false)} />
    </div>
  );
}
