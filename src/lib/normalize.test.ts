import { describe, expect, it } from "vitest";
import { candidateKeys, foldKey } from "./normalize.ts";

describe("foldKey", () => {
  it("folds apostrophes and ґ", () => {
    expect(foldKey("М’ясо")).toBe("мясо");
    expect(foldKey("ґрунт")).toBe("грунт");
    expect(foldKey("Ґанок")).toBe("ганок");
    expect(foldKey("мʼясо")).toBe("мясо");
  });
});

describe("candidateKeys", () => {
  it("accepts a dictionary noun", () => {
    expect(candidateKeys("  Кіт ")).toEqual({ keys: ["кіт"] });
  });

  it("maps a Latin keyboard layout to Ukrainian", () => {
    expect(candidateKeys("rsn")).toEqual({ keys: ["кіт"] });
    const sea = candidateKeys("vjht");
    expect("keys" in sea && sea.keys.includes("море")).toBe(true);
  });

  it("keeps an apostrophe word reachable from either layout", () => {
    const ascii = candidateKeys("м'ясо");
    const curly = candidateKeys("м’ясо");
    expect("keys" in ascii && ascii.keys.includes("мясо")).toBe(true);
    expect("keys" in curly && curly.keys.includes("мясо")).toBe(true);
  });

  it("rejects more than one word", () => {
    expect(candidateKeys("синє море")).toEqual({ issue: "multi" });
    expect(candidateKeys("будь-хто")).toEqual({ issue: "multi" });
  });

  it("rejects an empty field", () => {
    expect(candidateKeys("   ")).toEqual({ issue: "empty" });
  });
});
