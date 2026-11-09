"use client";

import { CheckCircle2, ExternalLink, Landmark } from "lucide-react";
import type { Stage } from "../lib/curriculum";
import AudioLectureCard from "./AudioLectureCard";

type Props = {
  stage: Stage;
};

export default function StagePanel({ stage }: Props) {
  return (
    <div key={stage.id} className="stage-panel space-y-10">
      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        <div>
          <p className="text-[10px] font-medium tracking-[0.22em] text-teal-bright uppercase">
            Stage {stage.id} of 8
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-paper sm:text-4xl">
            {stage.title}
          </h2>
          <h3 className="mt-8 flex items-center gap-2 font-display text-xl text-paper">
            <Landmark
              className="h-5 w-5 text-teal-bright"
              aria-hidden
              strokeWidth={1.75}
            />
            Stage Overview &amp; Key Institutional Principles
          </h3>
          <p className="mt-3 max-w-prose text-base leading-relaxed text-fog">
            {stage.overview}
          </p>
          <ul className="mt-5 space-y-2.5 text-sm leading-relaxed text-fog">
            {stage.principles.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="font-display text-xl text-paper">
              Essential External Curriculum Links
            </h3>
            <ul className="mt-4 space-y-3">
              {stage.links.map((link) => (
                <li key={`${stage.id}-${link.href}-${link.label}`}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-gold-soft underline-offset-4 transition-colors hover:text-gold hover:underline"
                  >
                    {link.label}
                    <ExternalLink
                      className="h-3.5 w-3.5 opacity-70"
                      aria-hidden
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="flex items-center gap-2 font-display text-xl text-paper">
              <CheckCircle2
                className="h-5 w-5 text-teal-bright"
                aria-hidden
                strokeWidth={1.75}
              />
              Measurable Milestone Criteria
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-fog">
              {stage.milestones.map((item) => (
                <li key={item} className="border-l border-gold/35 pl-4">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <AudioLectureCard stage={stage} />
    </div>
  );
}
