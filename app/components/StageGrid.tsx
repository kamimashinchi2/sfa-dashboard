"use client";

import type { Stage } from "../lib/curriculum";

type Props = {
  stages: Stage[];
  activeId: number;
  onSelect: (id: number) => void;
};

export default function StageGrid({ stages, activeId, onSelect }: Props) {
  return (
    <nav aria-label="Eight-stage curriculum" className="relative">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
        {stages.map((stage) => {
          const active = stage.id === activeId;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelect(stage.id)}
              aria-current={active ? "true" : undefined}
              className={`group border px-3 py-3 text-left transition-[border-color,background-color,color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:px-4 sm:py-4 ${
                active
                  ? "border-gold/70 bg-gold/10 text-paper"
                  : "border-line bg-ink/30 text-fog hover:border-gold/35 hover:text-paper"
              }`}
            >
              <span className="block font-mono text-[10px] tracking-[0.2em] text-teal-bright uppercase sm:text-[11px]">
                Stage {stage.id}
              </span>
              <span className="mt-1.5 block font-display text-sm leading-snug sm:text-[15px]">
                {stage.title}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
