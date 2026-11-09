"use client";

import { useMemo, useState } from "react";
import type { TimedObservation } from "../../lib/academy/pointInTime";
import { snapshotRelease, type ReleasePacket } from "../../lib/academy/pointInTime";
import { computeWindowReturns } from "../../lib/academy/windowReturns";
import EvidenceTimeline from "./EvidenceTimeline";
import { useProgress } from "./ProgressProvider";

const RELEASE = "2024-03-01T13:30:00.000Z";
const AS_OF = "2024-03-01T15:00:00.000Z";

const packetA: ReleasePacket = {
  id: "pkt-hot-a",
  symbolContext: "US_CPI",
  releasedAt: RELEASE,
  actual: "0.4",
  forecast: "0.2",
  priorOriginal: "0.3",
  revisions: [{ revisedAt: "2024-04-01T13:30:00.000Z", value: "0.35" }],
  evidenceIds: ["ev-cpi-a"],
};

const packetB: ReleasePacket = {
  id: "pkt-hot-b",
  symbolContext: "US_CPI",
  releasedAt: RELEASE,
  actual: "0.4",
  forecast: "0.2",
  priorOriginal: "0.3",
  revisions: [],
  evidenceIds: ["ev-cpi-b"],
};

function obs(
  id: string,
  symbol: string,
  value: string,
  observedAt: string,
): TimedObservation {
  return {
    id,
    symbol,
    value,
    unit: symbol === "XAUUSD" ? "USD/oz" : "price",
    observedAt,
    availableAt: observedAt,
    evidenceIds: [id],
  };
}

const OBS: TimedObservation[] = [
  obs("e0", "EURUSD", "1.1000", "2024-03-01T13:29:30.000Z"),
  obs("e1", "EURUSD", "1.1011", "2024-03-01T13:35:00.000Z"),
  obs("e2", "EURUSD", "1.1000", "2024-03-01T13:45:00.000Z"),
  obs("e3", "EURUSD", "1.1022", "2024-03-01T14:30:00.000Z"),
  obs("j0", "USDJPY", "150", "2024-03-01T13:29:30.000Z"),
  obs("j1", "USDJPY", "150.15", "2024-03-01T13:35:00.000Z"),
  obs("j2", "USDJPY", "150", "2024-03-01T13:45:00.000Z"),
  obs("j3", "USDJPY", "150.30", "2024-03-01T14:30:00.000Z"),
  obs("g0", "XAUUSD", "2000", "2024-03-01T13:29:30.000Z"),
  obs("g1", "XAUUSD", "2002", "2024-03-01T13:35:00.000Z"),
  // Missing Gold 15m intentionally
  obs("g3", "XAUUSD", "2004", "2024-03-01T14:30:00.000Z"),
  obs("y0", "US2Y", "4.20", "2024-03-01T13:29:00.000Z"),
  obs("d0", "DXY", "104.0", "2024-03-01T13:29:00.000Z"),
  obs("v0", "VIX", "14.5", "2024-03-01T13:29:00.000Z"),
];

export default function CrossAssetCapstone({ readOnly }: { readOnly?: boolean }) {
  const { progress } = useProgress();
  const locale = progress.locale;
  const [frozenA, setFrozenA] = useState(false);
  const [revealA, setRevealA] = useState(false);
  const [frozenB, setFrozenB] = useState(false);
  const [revealB, setRevealB] = useState(false);
  const [expectations, setExpectations] = useState("Conditional USD bid; gold unproven");

  const snapA = useMemo(
    () => snapshotRelease(packetA, revealA ? AS_OF : "2024-03-01T13:00:00.000Z"),
    [revealA],
  );
  const snapB = useMemo(
    () => snapshotRelease(packetB, revealB ? AS_OF : "2024-03-01T13:00:00.000Z"),
    [revealB],
  );

  const eurusd = useMemo(
    () =>
      computeWindowReturns({
        symbol: "EURUSD",
        releaseAt: RELEASE,
        observations: OBS,
        asOf: AS_OF,
      }),
    [],
  );
  const gold = useMemo(
    () =>
      computeWindowReturns({
        symbol: "XAUUSD",
        releaseAt: RELEASE,
        observations: OBS,
        asOf: AS_OF,
      }),
    [],
  );

  return (
    <div className="space-y-4 border border-line bg-ink/30 p-4">
      <h3 className="font-display text-xl text-paper">
        {locale === "fa" ? "کپستون چنددارایی" : "Cross-Asset Capstone"}
      </h3>
      <p className="text-xs text-fog">
        CONTEXT_ONLY · SYNTHETIC packets · mid returns descriptive, not executable P&L
      </p>
      <label className="block text-xs text-fog">
        Freeze expectations before reveal
        <textarea
          className="mt-1 min-h-16 w-full border border-line bg-ink px-3 py-2 text-sm text-paper"
          value={expectations}
          disabled={readOnly || (revealA && revealB)}
          onChange={(e) => setExpectations(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 border border-line px-3 text-sm text-fog"
          disabled={readOnly}
          onClick={() => setFrozenA(true)}
        >
          Freeze packet A
        </button>
        <button
          type="button"
          className="min-h-11 border border-gold/50 px-3 text-sm text-gold-soft"
          disabled={readOnly || !frozenA}
          onClick={() => setRevealA(true)}
        >
          Reveal packet A
        </button>
        <button
          type="button"
          className="min-h-11 border border-line px-3 text-sm text-fog"
          disabled={readOnly}
          onClick={() => setFrozenB(true)}
        >
          Freeze packet B
        </button>
        <button
          type="button"
          className="min-h-11 border border-gold/50 px-3 text-sm text-gold-soft"
          disabled={readOnly || !frozenB}
          onClick={() => setRevealB(true)}
        >
          Reveal packet B
        </button>
      </div>
      <div className="grid gap-3 text-xs text-fog sm:grid-cols-2">
        <div className="border border-line p-3 font-mono">
          A actual={String(snapA.actual)} forecast={String(snapA.forecast)} rev=
          {String(snapA.appliedRevision)} issues={snapA.issues.join(",") || "—"}
        </div>
        <div className="border border-line p-3 font-mono">
          B actual={String(snapB.actual)} forecast={String(snapB.forecast)} issues=
          {snapB.issues.join(",") || "—"}
        </div>
      </div>
      <EvidenceTimeline rows={OBS} asOf={AS_OF} locale={locale} />
      <div className="text-xs text-fog">
        <p className="text-teal-bright">EURUSD window returns</p>
        <ul className="font-mono">
          {eurusd.map((w) => (
            <li key={w.window}>
              {w.window}: {w.returnPct ?? "null"} {w.reason ?? ""} [{w.startAt}→{w.endAt}]
            </li>
          ))}
        </ul>
        <p className="mt-2 text-teal-bright">XAUUSD (missing 15m)</p>
        <ul className="font-mono">
          {gold.map((w) => (
            <li key={w.window}>
              {w.window}: {w.returnPct ?? "null"} {w.reason ?? ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
