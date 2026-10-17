import { describe, expect, it } from "vitest";
import { guessNoun, shareSummary } from "./share.ts";

describe("share text", () => {
  it("uses Ukrainian attempt plurals", () => {
    expect(guessNoun(1)).toBe("спробу");
    expect(guessNoun(2)).toBe("спроби");
    expect(guessNoun(5)).toBe("спроб");
    expect(guessNoun(11)).toBe("спроб");
    expect(guessNoun(22)).toBe("спроби");
  });

  it("is a spoiler-free summary without emoji", () => {
    const text = shareSummary({
      practice: false,
      dateLabel: "17 жовтня 2026",
      won: true,
      gaveUp: false,
      attempts: 9,
      hints: 1,
      ranks: [12, 40, 800, 2200, 1],
    });
    expect(text).toBe(
      ["Сенс · 17 жовтня 2026", "Вгадано за 9 спроб", "Підказки: 1", "Близькі: 3 · середні: 1 · далекі: 1"].join(
        "\n",
      ),
    );
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
