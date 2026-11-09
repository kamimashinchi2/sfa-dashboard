"use client";

import { ExternalLink, MessageCircle } from "lucide-react";
import { JOURNAL_URL, type Stage } from "../lib/curriculum";

type Props = {
  stage: Stage;
};

function openEcho() {
  window.Tawk_API?.maximize?.();
}

export default function MissionDispatch({ stage }: Props) {
  return (
    <section
      aria-labelledby="mission-heading"
      className="border border-line bg-ink-elevated/50 p-5 sm:p-6"
    >
      <p className="text-[10px] font-medium tracking-[0.22em] text-teal-bright uppercase">
        Mission &amp; Homework Dispatch
      </p>
      <h3
        id="mission-heading"
        className="mt-2 font-display text-2xl tracking-tight text-paper"
      >
        Active weekly mission
      </h3>
      <p className="mt-1 font-mono text-xs text-gold-soft">
        Stage {stage.id} · {stage.title}
      </p>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-fog sm:text-base">
        {stage.mission}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={JOURNAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="cta-pulse inline-flex items-center gap-2 bg-gold px-5 py-3 text-sm font-semibold tracking-wide text-ink transition-[transform,background-color] duration-200 hover:translate-y-[-1px] hover:bg-gold-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Submit Trade Journal (Google Drive)
          <ExternalLink className="h-4 w-4" aria-hidden strokeWidth={1.75} />
        </a>
        <button
          type="button"
          onClick={openEcho}
          className="inline-flex items-center gap-2 border border-gold/50 px-5 py-3 text-sm font-semibold tracking-wide text-gold-soft transition-colors hover:border-gold hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <MessageCircle className="h-4 w-4" aria-hidden strokeWidth={1.75} />
          Discuss with Echo (AI Mentor)
        </button>
      </div>
    </section>
  );
}
