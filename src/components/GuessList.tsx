import { bandForRank, bandLabel, barWidth } from "../lib/color.ts";
import type { Guess } from "../lib/storage.ts";

export function GuessList({
  guesses,
  vocab,
  vocabSize,
  sort,
  freshIndex,
}: {
  guesses: Guess[];
  vocab: string[];
  vocabSize: number;
  sort: "rank" | "order";
  freshIndex: number | null;
}) {
  const shown = guesses.map((guess, order) => ({ guess, order }));
  if (sort === "rank") {
    shown.sort((a, b) => a.guess.rank - b.guess.rank || a.order - b.order);
  }

  if (shown.length === 0) {
    return (
      <p className="hint-line">
        Введіть будь-яке слово. Менший ранг — ближче за значенням до секретного іменника.
      </p>
    );
  }

  return (
    <ol className="guess-list" aria-label="Спроби, від найближчих">
      {shown.map(({ guess, order }) => {
        const tone = bandForRank(guess.rank);
        const word = vocab[guess.index] ?? "";
        return (
          <li
            key={`${guess.index}-${order}`}
            id={`guess-${guess.index}`}
            className={guess.index === freshIndex ? "guess fresh" : "guess"}
          >
            <div className="guess-row">
              <span className="guess-word">
                {word}
                {guess.hint ? <span className="tag">підказка</span> : null}
                {guess.revealed ? <span className="tag">відповідь</span> : null}
              </span>
              <span className={`rank ${tone}`}>{guess.rank}</span>
            </div>
            <div
              className="track"
              role="img"
              aria-label={`${word}, ранг ${guess.rank}, ${bandLabel(tone)}`}
            >
              <div className={`bar ${tone}`} style={{ width: `${barWidth(guess.rank, vocabSize)}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
