"use client";

import type { Stage } from "../lib/curriculum";

type Props = {
  stages: Stage[];
  activeId: number;
  onSelect: (id: number) => void;
};

export default function StageNav({ stages, activeId, onSelect }: Props) {
  return (
    <nav aria-label="Curriculum stages" className="relative">
      <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stages.map((stage) => {
          const active = stage.id === activeId;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelect(stage.id)}
              aria-current={active ? "true" : undefined}
              className={`group shrink-0 border-b-2 px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:px-4 ${
                active
                  ? "border-gold text-paper"
                  : "border-transparent text-fog hover:border-line hover:text-paper"
              }`}
            >
              <span className="block font-mono text-[11px] tracking-[0.18em] text-teal-bright uppercase">
                Stage {stage.id}
              </span>
              <span className="mt-1 block max-w-[11rem] font-display text-sm leading-snug sm:max-w-[13rem] sm:text-base">
                {stage.title}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
