/**
 * ISO-8601 week math in Europe/Amsterdam via Intl (no new dependency).
 * period = Monday 00:00:00 to Sunday 23:59:59.999 local → stored as UTC Z.
 */

const TZ = "Europe/Amsterdam";

function partsInTz(date: Date, timeZone = TZ): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") bag[p.type] = p.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

/** Instant that is local Y-M-D H:M:S.ms in Amsterdam. */
export function amsterdamLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  // Binary search UTC ms whose Amsterdam wall time matches
  let lo = Date.UTC(year, month - 1, day, hour - 2, minute, second, ms) - 36e5 * 3;
  let hi = Date.UTC(year, month - 1, day, hour + 2, minute, second, ms) + 36e5 * 3;
  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const p = partsInTz(new Date(mid));
    const cmp =
      p.year !== year
        ? p.year - year
        : p.month !== month
          ? p.month - month
          : p.day !== day
            ? p.day - day
            : p.hour !== hour
              ? p.hour - hour
              : p.minute !== minute
                ? p.minute - minute
                : p.second - second;
    if (cmp === 0) {
      // Adjust ms
      const d = new Date(mid);
      d.setUTCMilliseconds(ms);
      // Re-check second boundary
      const p2 = partsInTz(d);
      if (
        p2.year === year &&
        p2.month === month &&
        p2.day === day &&
        p2.hour === hour &&
        p2.minute === minute &&
        p2.second === second
      ) {
        return d;
      }
      return new Date(mid);
    }
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return new Date(lo);
}

function weekdayMon0(year: number, month: number, day: number): number {
  // JS: 0=Sun..6=Sat → Mon=0
  const utcGuess = amsterdamLocalToUtc(year, month, day, 12, 0, 0, 0);
  const wd = utcGuess.getUTCDay();
  return wd === 0 ? 6 : wd - 1;
}

/** ISO week date in Amsterdam for a given instant. */
export function isoWeekInAmsterdam(date: Date = new Date()): {
  isoWeek: string;
  year: number;
  week: number;
} {
  const p = partsInTz(date);
  // Thursday of this week determines ISO year
  const mon0 = weekdayMon0(p.year, p.month, p.day);
  const thursday = amsterdamLocalToUtc(
    p.year,
    p.month,
    p.day - mon0 + 3,
    12,
    0,
    0,
    0,
  );
  const th = partsInTz(thursday);
  const isoYear = th.year;
  const jan4 = amsterdamLocalToUtc(isoYear, 1, 4, 12, 0, 0, 0);
  const jan4p = partsInTz(jan4);
  const jan4Mon0 = weekdayMon0(jan4p.year, jan4p.month, jan4p.day);
  const week1Mon = amsterdamLocalToUtc(
    jan4p.year,
    jan4p.month,
    jan4p.day - jan4Mon0,
    12,
    0,
    0,
    0,
  );
  const week =
    Math.floor((thursday.getTime() - week1Mon.getTime()) / (7 * 86400000)) + 1;
  const isoWeek = `${isoYear}-W${String(week).padStart(2, "0")}`;
  return { isoWeek, year: isoYear, week };
}

export function parseIsoWeek(isoWeek: string): { year: number; week: number } {
  const m = /^(\d{4})-W(\d{2})$/.exec(isoWeek);
  if (!m) throw new Error(`BAD_ISO_WEEK:${isoWeek}`);
  return { year: Number(m[1]), week: Number(m[2]) };
}

/** Monday 00:00:00.000 – Sunday 23:59:59.999 Amsterdam → UTC Z strings. */
export function periodForIsoWeek(isoWeek: string): {
  fromISO: string;
  toISO: string;
} {
  const { year, week } = parseIsoWeek(isoWeek);
  const jan4 = amsterdamLocalToUtc(year, 1, 4, 12, 0, 0, 0);
  const jan4p = partsInTz(jan4);
  const jan4Mon0 = weekdayMon0(jan4p.year, jan4p.month, jan4p.day);
  const week1Mon = amsterdamLocalToUtc(
    jan4p.year,
    jan4p.month,
    jan4p.day - jan4Mon0,
    0,
    0,
    0,
    0,
  );
  const monday = new Date(week1Mon.getTime() + (week - 1) * 7 * 86400000);
  // Re-anchor to exact Monday 00:00 Amsterdam
  const mp = partsInTz(monday);
  const from = amsterdamLocalToUtc(mp.year, mp.month, mp.day, 0, 0, 0, 0);
  const sundayLocal = new Date(from.getTime() + 6 * 86400000);
  const sp = partsInTz(sundayLocal);
  const to = amsterdamLocalToUtc(sp.year, sp.month, sp.day, 23, 59, 59, 999);
  return { fromISO: from.toISOString(), toISO: to.toISOString() };
}

export function currentAndPreviousIsoWeeks(now = new Date()): {
  current: string;
  previous: string;
} {
  const cur = isoWeekInAmsterdam(now);
  const prevDate = new Date(now.getTime() - 7 * 86400000);
  const prev = isoWeekInAmsterdam(prevDate);
  return { current: cur.isoWeek, previous: prev.isoWeek };
}

export function inPeriod(
  atISO: string,
  period: { fromISO: string; toISO: string },
): boolean {
  return atISO >= period.fromISO && atISO <= period.toISO;
}

export function formatResultWeek(isoWeek: string): string {
  const { year, week } = parseIsoWeek(isoWeek);
  return `${year}W${String(week).padStart(2, "0")}`;
}
