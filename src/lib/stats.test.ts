import { describe, expect, it } from "vitest";
import { emptyStats, recordDaily } from "./stats.ts";

describe("daily stats", () => {
  it("builds a streak across consecutive wins and resets it after a loss", () => {
    let stats = emptyStats();
    stats = recordDaily(stats, "2026-10-15", true, 4);
    stats = recordDaily(stats, "2026-10-16", true, 2);
    expect(stats.streak).toBe(2);
    expect(stats.maxStreak).toBe(2);
    expect(stats.distribution[4]).toBe(1);
    expect(stats.distribution[2]).toBe(1);
    stats = recordDaily(stats, "2026-10-17", false, 8);
    expect(stats.streak).toBe(0);
    expect(stats.maxStreak).toBe(2);
    expect(stats.dailyWon).toBe(2);
    expect(stats.dailyPlayed).toBe(3);
    stats = recordDaily(stats, "2026-10-18", true, 6);
    expect(stats.streak).toBe(1);
  });

  it("does not continue a streak across a missed day", () => {
    let stats = recordDaily(emptyStats(), "2026-10-10", true, 3);
    stats = recordDaily(stats, "2026-10-12", true, 3);
    expect(stats.streak).toBe(1);
  });
});
