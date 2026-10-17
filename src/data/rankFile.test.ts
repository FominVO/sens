import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { foldKey } from "../lib/normalize.ts";
import { parseForms, parseRankFile } from "./rankFile.ts";

const ready = existsSync("public/data/manifest.json");

function fileBuffer(path: string): ArrayBuffer {
  const data = readFileSync(path);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

const CASES: Record<string, string[]> = {
  кіт: ["кішка", "пес", "кошеня", "собака"],
  море: ["океан", "хвиля", "берег"],
  яблуко: ["груша", "слива", "фрукт"],
  школа: ["учитель", "вчитель", "учень"],
  лікар: ["лікарня", "пацієнт"],
  хліб: ["булка", "тісто", "борошно"],
  ніч: ["вечір", "ранок", "сон"],
};

describe.skipIf(!ready)("generated Ukrainian ranks", () => {
  const manifest = JSON.parse(readFileSync("public/data/manifest.json", "utf8")) as {
    puzzleCount: number;
    vocabSize: number;
  };
  const vocab = JSON.parse(readFileSync("public/data/vocab.json", "utf8")) as string[];

  it("keeps a vocabulary of common lemmas and a year of puzzles", () => {
    expect(vocab.length).toBe(manifest.vocabSize);
    expect(vocab.length).toBeGreaterThanOrEqual(10000);
    expect(vocab.length).toBeLessThanOrEqual(20000);
    expect(manifest.puzzleCount).toBeGreaterThanOrEqual(365);
  });

  it("stores each puzzle as a permutation with the secret at rank 1", () => {
    const puzzle = parseRankFile(fileBuffer("public/data/ranks/0.bin"));
    expect(puzzle.ranks[puzzle.secretIndex]).toBe(1);
    expect(new Set(puzzle.ranks).size).toBe(puzzle.vocabSize);
  });

  it("ranks synonyms near the secret", () => {
    const forms = parseForms(fileBuffer("public/data/forms.bin"));
    const wanted = new Map(Object.keys(CASES).map((word) => [foldKey(word), word]));
    const found = new Map<string, ReturnType<typeof parseRankFile>>();
    for (let id = 0; id < manifest.puzzleCount && found.size < wanted.size; id += 1) {
      const puzzle = parseRankFile(fileBuffer(`public/data/ranks/${id}.bin`));
      const key = foldKey(vocab[puzzle.secretIndex]);
      if (wanted.has(key) && !found.has(key)) found.set(key, puzzle);
    }
    expect(found.size).toBeGreaterThanOrEqual(4);
    for (const [key, puzzle] of found) {
      const ranks = CASES[wanted.get(key) as string]
        .map((word) => forms.get(foldKey(word)))
        .filter((index): index is number => index !== undefined)
        .map((index) => puzzle.ranks[index]);
      expect(ranks.length).toBeGreaterThan(0);
      expect(Math.min(...ranks)).toBeLessThanOrEqual(400);
    }
  });
});
