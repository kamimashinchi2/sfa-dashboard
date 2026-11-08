"use client";

import type { Stage } from "../lib/curriculum";

type Props = {
  stage: Stage;
};

export default function StageViewer({ stage }: Props) {
  return (
    <div
      key={stage.id}
      className="stage-panel grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14"
    >
      <div>
        <p className="text-xs font-medium tracking-[0.22em] text-teal-bright uppercase">
          Stage {stage.id} of 8
        </p>
        <h2 className="mt-3 font-display text-3xl tracking-tight text-paper sm:text-4xl">
          {stage.title}
        </h2>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-fog">
          {stage.summary}
        </p>

        <h3 className="mt-10 font-display text-xl text-paper">
          Core curriculum
        </h3>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-fog">
          {stage.topics.map((topic) => (
            <li key={topic} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal-bright" />
              <span>{topic}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-10">
        <div>
          <h3 className="font-display text-xl text-paper">Essential reading</h3>
          <ul className="mt-4 space-y-3">
            {stage.readings.map((reading) => (
              <li key={reading.href}>
                <a
                  href={reading.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gold-soft underline-offset-4 transition-colors hover:text-gold hover:underline"
                >
                  {reading.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-display text-xl text-paper">Pass criteria</h3>
          <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-fog">
            {stage.passCriteria.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>

        <div className="border-t border-line pt-8">
          <p className="text-xs font-medium tracking-[0.22em] text-teal-bright uppercase">
            Coming soon
          </p>
          <h3 className="mt-2 font-display text-xl text-paper">
            Audio Lecture &amp; Notes
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-fog">
            NotebookLM audio walkthrough and study-note embeds for this stage
            will land here. Use the readings and pass criteria until then.
          </p>
        </div>
      </div>
    </div>
  );
}
