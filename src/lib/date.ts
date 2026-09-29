/** Local calendar day as YYYY-MM-DD (streaks follow the student's local day, not UTC). */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole calendar days from `from` to `to` (DST-safe thanks to rounding). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseKey(to).getTime() - parseKey(from).getTime()) / 86_400_000);
}
