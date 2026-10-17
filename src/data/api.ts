import { parseForms, parseRankFile, type RankFile } from "./rankFile.ts";

export type Manifest = {
  name: string;
  locale: string;
  epoch: string;
  puzzleCount: number;
  vocabSize: number;
  greenMax: number;
  yellowMax: number;
  version: number;
};

export type Lexicon = {
  manifest: Manifest;
  vocab: string[];
  forms: Map<string, number>;
};

const base = import.meta.env.BASE_URL;

async function fetchBuffer(path: string): Promise<ArrayBuffer> {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`Не вдалося завантажити ${path}`);
  return response.arrayBuffer();
}

export async function loadLexicon(): Promise<Lexicon> {
  const [manifestRes, vocabRes, formsBuf] = await Promise.all([
    fetch(`${base}data/manifest.json`),
    fetch(`${base}data/vocab.json`),
    fetchBuffer("data/forms.bin"),
  ]);
  if (!manifestRes.ok || !vocabRes.ok) throw new Error("Не вдалося завантажити словник");
  const manifest = (await manifestRes.json()) as Manifest;
  const vocab = (await vocabRes.json()) as string[];
  if (vocab.length !== manifest.vocabSize) throw new Error("Словник не збігається з описом гри");
  return { manifest, vocab, forms: parseForms(formsBuf) };
}

export async function loadRanks(puzzleId: number): Promise<RankFile> {
  const buffer = await fetchBuffer(`data/ranks/${puzzleId}.bin`);
  return parseRankFile(buffer);
}
