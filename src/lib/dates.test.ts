import { describe, expect, it } from "vitest";
import { daysBetween, formatLongDate, monthGrid, puzzleIdForDate, yesterdayISO } from "./dates.ts";

describe("calendar dates", () => {
  it("counts local calendar days without timezone drift", () => {
    expect(daysBetween("2025-09-01", "2026-10-17")).toBe(411);
    expect(puzzleIdForDate("2026-10-17", "2025-09-01", 520)).toBe(411);
    expect(puzzleIdForDate("2025-08-31", "2025-09-01", 520)).toBeNull();
    expect(puzzleIdForDate("2027-02-04", "2025-09-01", 520)).toBeNull();
  });

  it("rejects an impossible date", () => {
    expect(puzzleIdForDate("2026-02-31", "2025-09-01", 520)).toBeNull();
  });

  it("formats a Ukrainian date and steps back one day", () => {
    expect(formatLongDate("2026-10-17")).toBe("17 жовтня 2026");
    expect(yesterdayISO("2026-03-01")).toBe("2026-02-28");
  });

  it("starts the month grid on Monday", () => {
    const october2026 = monthGrid(2026, 9);
    expect(october2026[0]).toBeNull();
    expect(october2026[3]).toEqual({ iso: "2026-10-01", day: 1 });
  });
});
