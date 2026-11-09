import { Download, Headphones } from "lucide-react";
import type { Stage } from "../lib/curriculum";

type Props = {
  stage: Stage;
};

export default function AudioLectureCard({ stage }: Props) {
  return (
    <div className="border border-line bg-ink/40 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Headphones
          className="mt-0.5 h-5 w-5 shrink-0 text-teal-bright"
          aria-hidden
          strokeWidth={1.75}
        />
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-[0.22em] text-teal-bright uppercase">
            NotebookLM
          </p>
          <h3 className="mt-1 font-display text-xl text-paper">
            Audio Lecture &amp; Briefing
          </h3>
          <p className="mt-1 text-sm text-gold-soft">{stage.audioTitle}</p>
        </div>
      </div>

      <div className="mt-5 border border-line bg-ink px-4 py-5">
        <div
          className="flex h-10 items-center gap-3"
          role="group"
          aria-label="Audio player placeholder"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center border border-gold/40 text-gold-soft">
            ▶
          </span>
          <div className="h-1 flex-1 bg-line">
            <div className="h-full w-0 bg-gold" />
          </div>
          <span className="font-mono text-[11px] text-fog">0:00 / --:--</span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-fog">{stage.audioNote}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          title="Audio file not published yet"
          className="inline-flex items-center gap-2 border border-line px-3 py-2 text-xs text-fog opacity-70"
        >
          <Headphones className="h-3.5 w-3.5" aria-hidden />
          Listen
        </button>
        <button
          type="button"
          disabled
          title="Download available when audio is published"
          className="inline-flex items-center gap-2 border border-line px-3 py-2 text-xs text-fog opacity-70"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Download
        </button>
      </div>
    </div>
  );
}
