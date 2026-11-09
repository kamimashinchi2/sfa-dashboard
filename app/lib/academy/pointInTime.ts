import type { ISO } from "./contracts";

export type ReleasePacket = {
  id: string;
  symbolContext: string;
  releasedAt: ISO;
  actual: string | null;
  forecast: string | null;
  priorOriginal: string | null;
  revisions: { revisedAt: ISO; value: string }[];
  evidenceIds: string[];
};

export type TimedObservation = {
  id: string;
  symbol: string;
  value: string;
  unit: string;
  observedAt: ISO;
  availableAt: ISO;
  evidenceIds: string[];
};

const OFFSET_RE = /([Zz]|[+-]\d{2}:\d{2})$/;

/** Reject ambiguous unzoned DST timestamps; require ISO with offset. */
export function assertZonedInstant(iso: string): {
  ok: boolean;
  reason?: string;
} {
  if (!OFFSET_RE.test(iso)) {
    return { ok: false, reason: "UNZONED_OR_AMBIGUOUS_TIMESTAMP" };
  }
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return { ok: false, reason: "INVALID_ISO" };
  return { ok: true };
}

/**
 * Filter observations available at asOf. Pre-release actual is null.
 * Future revisions cannot change earlier snapshots.
 */
export function snapshotRelease(
  packet: ReleasePacket,
  asOf: ISO,
): {
  actual: string | null;
  forecast: string | null;
  priorOriginal: string | null;
  appliedRevision: string | null;
  issues: string[];
} {
  const issues: string[] = [];
  for (const ts of [packet.releasedAt, asOf]) {
    const z = assertZonedInstant(ts);
    if (!z.ok) issues.push(z.reason ?? "BAD_TS");
  }
  if (packet.forecast !== null) {
    // Forecast must have existed by release — treated as present in packet
  } else {
    issues.push("FORECAST_MISSING");
  }

  const beforeRelease = asOf < packet.releasedAt;
  const actual = beforeRelease ? null : packet.actual;
  if (beforeRelease && packet.actual !== null) {
    // Hide pre-release actual
  }

  let appliedRevision: string | null = null;
  for (const rev of packet.revisions) {
    if (rev.revisedAt <= asOf && rev.revisedAt >= packet.releasedAt) {
      appliedRevision = rev.value;
    }
  }
  // Never apply revisions after asOf
  for (const rev of packet.revisions) {
    if (rev.revisedAt > asOf) {
      // ignored for this snapshot
    }
  }

  return {
    actual,
    forecast: packet.forecast,
    priorOriginal: packet.priorOriginal,
    appliedRevision,
    issues,
  };
}

export function filterAvailable(
  rows: TimedObservation[],
  asOf: ISO,
): TimedObservation[] {
  return rows.filter((r) => {
    const z = assertZonedInstant(r.availableAt);
    if (!z.ok) return false;
    return r.availableAt <= asOf;
  });
}

/** Display helper note — Europe/Amsterdam CET/CEST. */
export const DISPLAY_TZ = "Europe/Amsterdam";
