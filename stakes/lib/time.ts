// Timezone / deadline helpers.
//
// The whole app hinges on "midnight in YOUR timezone." We store each user's
// IANA timezone (e.g. "America/Los_Angeles") on their profile; the server
// computes actual deadline instants. On the client we only need to (a) detect
// the device timezone and (b) render friendly countdowns.

import { formatDistanceToNowStrict } from "date-fns";

/** Best-effort device IANA timezone, e.g. "America/Los_Angeles". */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
}

/** "in 3 hours" / "2 days ago" for a due_at ISO string. */
export function humanCountdown(iso: string): string {
  const due = new Date(iso);
  const now = new Date();
  const past = due.getTime() < now.getTime();
  const rel = formatDistanceToNowStrict(due);
  return past ? `${rel} ago` : `in ${rel}`;
}

/** True once the deadline has passed. */
export function isPastDue(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

/** YYYY-MM-DD for today in the given timezone (defaults to device tz). */
export function localDateKey(tz: string = deviceTimezone(), when = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(when);
}

/** Inclusive day count between two YYYY-MM-DD date strings. */
export function daysBetween(startISO: string, endISO: string): number {
  const a = new Date(startISO + "T00:00:00Z").getTime();
  const b = new Date(endISO + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}
