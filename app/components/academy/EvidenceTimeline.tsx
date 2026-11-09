"use client";

import type { TimedObservation } from "../../lib/academy/pointInTime";
import { DISPLAY_TZ } from "../../lib/academy/pointInTime";

export default function EvidenceTimeline({
  rows,
  asOf,
  locale,
}: {
  rows: TimedObservation[];
  asOf: string;
  locale: "fa" | "en";
}) {
  const visible = rows.filter((r) => r.availableAt <= asOf);
  return (
    <div className="border border-line bg-ink/40 p-4">
      <p className="text-[10px] tracking-[0.2em] text-teal-bright uppercase">
        Evidence timeline · asOf {asOf} · display {DISPLAY_TZ}
      </p>
      <table className="mt-3 w-full text-start text-xs text-fog">
        <caption className="sr-only">
          {locale === "fa" ? "جدول شواهد" : "Evidence table"}
        </caption>
        <thead>
          <tr className="text-teal-bright">
            <th className="py-1">symbol</th>
            <th>value</th>
            <th>unit</th>
            <th>observedAt</th>
            <th>availableAt</th>
            <th>evidence</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.id} className="font-mono">
              <td className="py-1">{r.symbol}</td>
              <td>{r.value}</td>
              <td>{r.unit}</td>
              <td>{r.observedAt}</td>
              <td>{r.availableAt}</td>
              <td>{r.evidenceIds.join(",")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {visible.length === 0 ? (
        <p className="mt-2 text-xs text-fog">NO_AVAILABLE_EVIDENCE_AT_ASOF</p>
      ) : null}
    </div>
  );
}
