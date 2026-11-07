const MS_PER_DAY = 86_400_000;

function toUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// NaN when either date is invalid.
export function daysBetween(earlier: string, later: string): number {
  return (toUtc(later).getTime() - toUtc(earlier).getTime()) / MS_PER_DAY;
}

export function subtractDays(isoDate: string, days: number): string {
  return new Date(toUtc(isoDate).getTime() - days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function formatLong(isoDate: string): string {
  return toUtc(isoDate).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShort(isoDate: string): string {
  return toUtc(isoDate).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}
