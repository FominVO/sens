import { yesterdayISO } from "./dates.ts";

export type Stats = {
  dailyPlayed: number;
  dailyWon: number;
  streak: number;
  maxStreak: number;
  lastWinDate: string | null;
  distribution: number[];
};

const BUCKETS = 31;

export function emptyStats(): Stats {
  return {
    dailyPlayed: 0,
    dailyWon: 0,
    streak: 0,
    maxStreak: 0,
    lastWinDate: null,
    distribution: Array.from({ length: BUCKETS + 1 }, () => 0),
  };
}

export function normalizeStats(value: unknown): Stats {
  const base = emptyStats();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<Stats>;
  const distribution = base.distribution.slice();
  if (Array.isArray(raw.distribution)) {
    for (let i = 0; i < distribution.length; i += 1) {
      const item = raw.distribution[i];
      distribution[i] = typeof item === "number" && item > 0 ? Math.floor(item) : 0;
    }
  }
  return {
    dailyPlayed: numberOr(raw.dailyPlayed),
    dailyWon: numberOr(raw.dailyWon),
    streak: numberOr(raw.streak),
    maxStreak: numberOr(raw.maxStreak),
    lastWinDate: typeof raw.lastWinDate === "string" ? raw.lastWinDate : null,
    distribution,
  };
}

function numberOr(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function recordDaily(stats: Stats, iso: string, won: boolean, attempts: number): Stats {
  const next = normalizeStats(stats);
  next.dailyPlayed += 1;
  if (!won) {
    next.streak = 0;
    return next;
  }
  next.dailyWon += 1;
  const yesterday = yesterdayISO(iso);
  next.streak = next.lastWinDate && yesterday && next.lastWinDate === yesterday ? next.streak + 1 : 1;
  next.maxStreak = Math.max(next.maxStreak, next.streak);
  next.lastWinDate = iso;
  const bucket = Math.min(BUCKETS, Math.max(1, attempts));
  next.distribution[bucket] += 1;
  return next;
}
