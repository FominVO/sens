export const MONTHS_GENITIVE = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

export const MONTHS_NOMINATIVE = [
  "січень",
  "лютий",
  "березень",
  "квітень",
  "травень",
  "червень",
  "липень",
  "серпень",
  "вересень",
  "жовтень",
  "листопад",
  "грудень",
];

export const WEEKDAYS_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];

export function localISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISO(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

function dayNumber(iso: string): number | null {
  const parts = parseISO(iso);
  if (!parts) return null;
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
}

export function daysBetween(fromIso: string, toIso: string): number | null {
  const from = dayNumber(fromIso);
  const to = dayNumber(toIso);
  if (from === null || to === null) return null;
  return to - from;
}

export function puzzleIdForDate(iso: string, epoch: string, puzzleCount: number): number | null {
  const diff = daysBetween(epoch, iso);
  if (diff === null || diff < 0 || diff >= puzzleCount) return null;
  return diff;
}

export function shiftISO(iso: string, days: number): string | null {
  const parts = parseISO(iso);
  if (!parts) return null;
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatLongDate(iso: string): string {
  const parts = parseISO(iso);
  if (!parts) return iso;
  return `${parts.day} ${MONTHS_GENITIVE[parts.month - 1]} ${parts.year}`;
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  return `${MONTHS_NOMINATIVE[monthIndex]} ${year}`;
}

export function yesterdayISO(iso: string): string | null {
  return shiftISO(iso, -1);
}

export type CalendarCell = { iso: string; day: number } | null;

export function monthGrid(year: number, monthIndex: number): CalendarCell[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const pad = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: CalendarCell[] = Array.from({ length: pad }, () => null);
  for (let day = 1; day <= days; day += 1) {
    const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ iso, day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
