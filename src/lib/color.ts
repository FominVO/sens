export type Band = "close" | "mid" | "far";

export function bandForRank(rank: number, greenMax = 300, yellowMax = 1500): Band {
  if (rank <= greenMax) return "close";
  if (rank <= yellowMax) return "mid";
  return "far";
}

export function bandLabel(band: Band): string {
  if (band === "close") return "близько";
  if (band === "mid") return "середньо";
  return "далеко";
}

export function closeness(rank: number, vocabSize: number): number {
  if (rank <= 1) return 1;
  const size = Math.max(2, vocabSize);
  return Math.max(0, 1 - Math.log(rank) / Math.log(size));
}

export function barWidth(rank: number, vocabSize: number): number {
  const value = closeness(rank, vocabSize) * 100;
  if (rank <= 1) return 100;
  return Math.max(6, Math.round(value));
}
