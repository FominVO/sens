import { describe, expect, it } from "vitest";
import { hintRank } from "./hint.ts";

describe("hintRank", () => {
  it("opens near rank 1000 before any guess", () => {
    expect(hintRank(null, 16000, new Set())).toBe(960);
  });

  it("halves the distance to the secret", () => {
    expect(hintRank(80, 16000, new Set())).toBe(40);
    expect(hintRank(3, 16000, new Set())).toBe(2);
  });

  it("stops once the player is next to the answer", () => {
    expect(hintRank(2, 16000, new Set())).toBeNull();
    expect(hintRank(1, 16000, new Set())).toBeNull();
  });

  it("skips a rank that is already on the board", () => {
    expect(hintRank(80, 16000, new Set([40, 39]))).toBe(38);
  });
});
