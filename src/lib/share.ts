import { bandForRank, type Band } from "./color.ts";

export function guessNoun(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "спробу";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "спроби";
  return "спроб";
}

export function shareSummary(input: {
  practice: boolean;
  dateLabel: string;
  won: boolean;
  gaveUp: boolean;
  attempts: number;
  hints: number;
  ranks: number[];
  greenMax?: number;
  yellowMax?: number;
}): string {
  const greenMax = input.greenMax ?? 300;
  const yellowMax = input.yellowMax ?? 1500;
  const counts: Record<Band, number> = { close: 0, mid: 0, far: 0 };
  for (const rank of input.ranks) counts[bandForRank(rank, greenMax, yellowMax)] += 1;

  const headline = input.practice ? "Сенс · тренування" : `Сенс · ${input.dateLabel}`;
  let result: string;
  if (input.won) result = `Вгадано за ${input.attempts} ${guessNoun(input.attempts)}`;
  else if (input.gaveUp) result = `Відповідь відкрито після ${input.attempts} ${guessNoun(input.attempts)}`;
  else result = `Спроб: ${input.attempts}`;

  const lines = [headline, result];
  if (input.hints > 0) lines.push(`Підказки: ${input.hints}`);
  lines.push(`Близькі: ${counts.close} · середні: ${counts.mid} · далекі: ${counts.far}`);
  return lines.join("\n");
}
