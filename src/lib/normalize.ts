const APOSTROPHES = /[’ʼ`´ʹ′]/g;

const LAYOUT_FROM = "qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const LAYOUT_TO = "йцукенгшщзхїфівапролджєячсмитьбю";

const HOMO: Record<string, string> = {
  a: "а",
  e: "е",
  i: "і",
  o: "о",
  p: "р",
  c: "с",
  x: "х",
  y: "у",
};

export type InputIssue = "empty" | "multi";

export function foldKey(value: string): string {
  return value.trim().toLowerCase().replaceAll("ґ", "г").replace(APOSTROPHES, "").replaceAll("'", "");
}

function toKey(value: string): string | null {
  let text = value.normalize("NFKC").trim().toLowerCase();
  text = text.replace(APOSTROPHES, "'").replaceAll("ґ", "г").replace(/[\u200b\u00ad]/g, "");
  text = text.replace(/^'+|'+$/g, "");
  if (!/^[а-яєії']+$/.test(text)) return null;
  const folded = text.replaceAll("'", "");
  if (folded.length < 2 || folded.length > 24) return null;
  if (!/[аеєиіїоуюя]/.test(folded)) return null;
  return folded;
}

function mapLayout(value: string, apostropheAsLetter: boolean): string {
  let out = "";
  for (const ch of value.toLowerCase()) {
    if ((ch === "'" || ch === "’" || ch === "ʼ") && !apostropheAsLetter) {
      out += "'";
      continue;
    }
    const source = ch === "’" || ch === "ʼ" ? "'" : ch;
    const index = LAYOUT_FROM.indexOf(source);
    out += index >= 0 ? LAYOUT_TO[index] : ch;
  }
  return out;
}

function mapHomo(value: string): string {
  let out = "";
  for (const ch of value.toLowerCase()) out += HOMO[ch] ?? ch;
  return out;
}

export function candidateKeys(raw: string): { keys: string[] } | { issue: InputIssue } {
  const trimmed = raw.normalize("NFKC").trim();
  if (!trimmed) return { issue: "empty" };
  if (/\s/.test(trimmed) || trimmed.includes("-")) return { issue: "multi" };

  const keys: string[] = [];
  const push = (value: string) => {
    const key = toKey(value);
    if (key && !keys.includes(key)) keys.push(key);
  };

  push(trimmed);
  const lower = trimmed.toLowerCase();
  const hasCyr = /[а-яєіїґ]/i.test(lower);
  const hasLat = /[a-z]/i.test(lower);
  if (!hasCyr && hasLat) {
    push(mapLayout(lower, true));
    push(mapLayout(lower, false));
  } else if (hasCyr && hasLat) {
    push(mapHomo(lower));
  }
  return { keys };
}
