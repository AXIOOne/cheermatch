// Convert between <input type="datetime-local"> values ("YYYY-MM-DDTHH:mm")
// and stored ISO timestamps. The wall-clock value is always read and shown in
// the given IANA time zone (the event's time zone), so the same time comes back
// no matter where the admin's computer is.

const pad = (n: number) => String(n).padStart(2, '0');

/** Wall-clock parts of an instant in a time zone. */
const partsIn = (date: Date, timeZone: string) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, number> = {};
  for (const { type, value } of fmt.formatToParts(date)) {
    if (type !== 'literal') p[type] = Number(value);
  }
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
};

/** Offset (ms) of the time zone from UTC at the given instant. */
const offsetMs = (date: Date, timeZone: string) => {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

export const localInputToIso = (v?: string | null, timeZone = 'UTC'): string | null => {
  if (!v || !v.trim()) return null;
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes handle daylight-saving transitions.
  let t = wall - offsetMs(new Date(wall), timeZone);
  t = wall - offsetMs(new Date(t), timeZone);
  return new Date(t).toISOString();
};

export const isoToLocalInput = (v?: string | null, timeZone = 'UTC'): string => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = partsIn(d, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
};

/** Short label for a time zone, e.g. "EST" / "MDT", at the given instant. */
export const timeZoneAbbr = (timeZone: string, at: Date = new Date()): string => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(at).find((x) => x.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone;
  }
};
