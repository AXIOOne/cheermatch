// Shared capture-window rules for the mobile API.
// A capture is only allowed when the event is not closed and "now" falls
// inside the event's submission (capture) window.

export const CLOSED_EVENT_STATUSES = ["completed", "archived"];

export type CaptureWindowEvent = {
  status?: string | null;
  submission_open_at?: string | null;
  submission_close_at?: string | null;
  sub_deadline?: string | null;
  end_date?: string | null;
};

export const isClosedEvent = (status?: string | null): boolean =>
  CLOSED_EVENT_STATUSES.includes(String(status ?? "").toLowerCase());

const endOfDay = (d?: string | null): number | null => {
  if (!d) return null;
  const t = Date.parse(`${d}T23:59:59Z`);
  return Number.isNaN(t) ? null : t;
};

const ts = (v?: string | null): number | null => {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

/** Returns null when capture is allowed, otherwise a human-readable reason. */
export function captureBlockedReason(
  event: CaptureWindowEvent | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!event) return "Event not found";
  if (isClosedEvent(event.status)) return "This event is closed";

  const n = now.getTime();
  const opensAt = ts(event.submission_open_at);
  const closesAt = ts(event.submission_close_at) ?? endOfDay(event.sub_deadline) ?? endOfDay(event.end_date);

  if (opensAt != null && n < opensAt) {
    return `Video capture for this event opens ${new Date(opensAt).toISOString()}`;
  }
  if (closesAt != null && n > closesAt) {
    return `The video capture window for this event closed ${new Date(closesAt).toISOString()}`;
  }
  return null;
}

export const isCaptureOpen = (event: CaptureWindowEvent | null | undefined, now?: Date): boolean =>
  captureBlockedReason(event, now) === null;

export const CAPTURE_WINDOW_SELECT =
  "id, status, submission_open_at, submission_close_at, sub_deadline, end_date";
