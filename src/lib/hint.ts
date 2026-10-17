export function hintRank(best: number | null, vocabSize: number, taken: Set<number>): number | null {
  if (best !== null && best <= 2) return null;
  const seed = Math.min(1000, Math.max(40, Math.round(vocabSize * 0.06)));
  const target = best === null ? seed : Math.max(2, Math.floor(best / 2));
  const ceiling = best ?? vocabSize;
  if (!taken.has(target) && target < ceiling) return target;
  for (let rank = target - 1; rank >= 2; rank -= 1) {
    if (!taken.has(rank)) return rank;
  }
  for (let rank = target + 1; rank < ceiling; rank += 1) {
    if (!taken.has(rank)) return rank;
  }
  return null;
}
