import { describe, expect, it } from "vitest";
import { bandForRank, barWidth, closeness } from "./color.ts";

describe("proximity", () => {
  it("uses Contexto-style bands", () => {
    expect(bandForRank(1)).toBe("close");
    expect(bandForRank(300)).toBe("close");
    expect(bandForRank(301)).toBe("mid");
    expect(bandForRank(1500)).toBe("mid");
    expect(bandForRank(1501)).toBe("far");
  });

  it("gives the secret a full bar and distant words a short one", () => {
    expect(closeness(1, 16000)).toBe(1);
    expect(barWidth(1, 16000)).toBe(100);
    expect(barWidth(8000, 16000)).toBeLessThan(30);
    expect(barWidth(20, 16000)).toBeGreaterThan(barWidth(900, 16000));
  });
});
