// The daily slate rolls over at midnight US Eastern, for everyone.

export const DAILY_TZ = "America/New_York";
/** Day #1 of Slate Replay. */
export const EPOCH_DATE = "2026-09-22";

/** Picks that arrive this long after the deadline are still accepted (network latency). */
export const LOCK_GRACE_MS = 1500;

export function slateDateFor(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUtcMidnight(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMidnight(date) + days * 86_400_000).toISOString().slice(0, 10);
}

export function dayNumber(date: string): number {
  return Math.round((toUtcMidnight(date) - toUtcMidnight(EPOCH_DATE)) / 86_400_000) + 1;
}
