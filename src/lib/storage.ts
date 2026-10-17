import { normalizeStats, type Stats } from "./stats.ts";

const THEME = "sens.v1.theme";
const STATS = "sens.v1.stats";
const SORT = "sens.v1.sort";
const HELP = "sens.v1.helpSeen";

export type Guess = {
  index: number;
  rank: number;
  hint: boolean;
  revealed?: boolean;
};

export type SavedGame = {
  puzzleId: number;
  guesses: Guess[];
  status: "playing" | "won" | "lost";
  recorded: boolean;
};

export type SortMode = "rank" | "order";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

export function gameKey(kind: "daily" | "archive" | "practice", iso?: string): string {
  if (kind === "practice") return "sens.v1.game.practice";
  return `sens.v1.game.${kind}.${iso}`;
}

export function loadGame(key: string): SavedGame | null {
  const raw = read(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedGame;
    if (!parsed || !Array.isArray(parsed.guesses) || typeof parsed.puzzleId !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGame(key: string, game: SavedGame) {
  write(key, JSON.stringify(game));
}

export function loadStats(): Stats {
  const raw = read(STATS);
  if (!raw) return normalizeStats(null);
  try {
    return normalizeStats(JSON.parse(raw));
  } catch {
    return normalizeStats(null);
  }
}

export function saveStats(stats: Stats) {
  write(STATS, JSON.stringify(stats));
}

export function loadSort(): SortMode {
  return read(SORT) === "order" ? "order" : "rank";
}

export function saveSort(mode: SortMode) {
  write(SORT, mode);
}

export function loadHelpSeen(): boolean {
  return read(HELP) === "1";
}

export function saveHelpSeen() {
  write(HELP, "1");
}

export function loadThemePreference(): "light" | "dark" | null {
  const value = read(THEME);
  return value === "light" || value === "dark" ? value : null;
}

export function saveThemePreference(theme: "light" | "dark") {
  write(THEME, theme);
}

export function listOutcomes(): Record<string, "won" | "lost"> {
  const outcomes: Record<string, "won" | "lost"> = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith("sens.v1.game.daily.") && !key?.startsWith("sens.v1.game.archive.")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as SavedGame;
      if (parsed.status !== "won" && parsed.status !== "lost") continue;
      const iso = key.slice(-10);
      outcomes[iso] = parsed.status;
    }
  } catch {
    return outcomes;
  }
  return outcomes;
}
