"use client";

import type { OhlcFrame } from "../../lib/academy/setup";
import { useProgress } from "./ProgressProvider";

export default function ReplayChart({
  frames,
  cursor,
  onCursor,
}: {
  frames: OhlcFrame[];
  cursor: number;
  onCursor: (n: number) => void;
}) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const visible = frames.filter((f) => f.index <= cursor);
  const max = Math.max(...frames.map((f) => f.index), 0);

  const highs = visible.map((f) => Number(f.high));
  const lows = visible.map((f) => Number(f.low));
  const minP = Math.min(...lows, 0);
  const maxP = Math.max(...highs, 1);
  const span = Math.max(maxP - minP, 1);

  return (
    <div className="border border-line bg-ink/40 p-4">
      <p className="text-[10px] tracking-[0.2em] text-teal-bright uppercase">
        SYNTHETIC OHLC · SETUP_ONLY
      </p>
      <svg
        viewBox="0 0 400 180"
        className="mt-3 h-48 w-full"
        role="img"
        aria-label={locale === "fa" ? "نمودار شبیه‌سازی‌شده" : "Synthetic OHLC chart"}
      >
        {visible.map((f, i) => {
          const x = 30 + i * (340 / Math.max(visible.length, 1));
          const yHigh = 20 + ((maxP - Number(f.high)) / span) * 140;
          const yLow = 20 + ((maxP - Number(f.low)) / span) * 140;
          const yOpen = 20 + ((maxP - Number(f.open)) / span) * 140;
          const yClose = 20 + ((maxP - Number(f.close)) / span) * 140;
          const up = Number(f.close) >= Number(f.open);
          return (
            <g key={f.index}>
              <line
                x1={x}
                x2={x}
                y1={yHigh}
                y2={yLow}
                stroke="#3f9a8c"
                strokeWidth="1"
              />
              <line
                x1={x - 4}
                x2={x + 4}
                y1={yOpen}
                y2={yOpen}
                stroke={up ? "#c9a227" : "#9aa7b5"}
                strokeWidth="2"
              />
              <line
                x1={x - 4}
                x2={x + 4}
                y1={yClose}
                y2={yClose}
                stroke={up ? "#c9a227" : "#9aa7b5"}
                strokeWidth="2"
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 border border-line px-3 text-sm text-fog"
          onClick={() => onCursor(Math.max(0, cursor - 1))}
        >
          Prev
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-3 text-sm text-fog"
          onClick={() => onCursor(Math.min(max, cursor + 1))}
        >
          Next
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-3 text-sm text-fog"
          onClick={() => onCursor(0)}
        >
          Reset
        </button>
        <span className="self-center font-mono text-xs text-gold-soft">
          cursor {cursor}/{max}
        </span>
      </div>
      <table className="mt-4 w-full text-start text-xs text-fog">
        <caption className="sr-only">Evidence table</caption>
        <thead>
          <tr className="text-teal-bright">
            <th className="py-1">i</th>
            <th>O</th>
            <th>H</th>
            <th>L</th>
            <th>C</th>
            <th>facts</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((f) => (
            <tr key={f.index} className="font-mono">
              <td className="py-1">{f.index}</td>
              <td>{f.open}</td>
              <td>{f.high}</td>
              <td>{f.low}</td>
              <td>{f.close}</td>
              <td>{Object.entries(f.facts).map(([k, v]) => `${k}:${v}`).join(" ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
