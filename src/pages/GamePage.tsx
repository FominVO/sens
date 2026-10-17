import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ConfirmDialog, HowToDialog, StatsDialog } from "../components/Dialogs.tsx";
import { GuessList } from "../components/GuessList.tsx";
import { Header, MenuButton, MenuLink, MenuRule } from "../components/Header.tsx";
import { loadRanks } from "../data/api.ts";
import { useLexicon } from "../data/Lexicon.tsx";
import type { Lexicon } from "../data/api.ts";
import { bandForRank, bandLabel } from "../lib/color.ts";
import { formatLongDate, localISO, parseISO, puzzleIdForDate } from "../lib/dates.ts";
import { hintRank } from "../lib/hint.ts";
import { candidateKeys } from "../lib/normalize.ts";
import { shareSummary } from "../lib/share.ts";
import { recordDaily } from "../lib/stats.ts";
import {
  gameKey,
  loadGame,
  loadHelpSeen,
  loadSort,
  loadStats,
  saveGame,
  saveHelpSeen,
  saveSort,
  saveStats,
  saveThemePreference,
  type Guess,
  type SortMode,
} from "../lib/storage.ts";

type Mode = "daily" | "archive" | "practice";

export function GamePage({ mode }: { mode: Mode }) {
  const state = useLexicon();
  const params = useParams();
  const today = localISO();
  if (state.status === "loading") return <StatusScreen title="Завантажуємо словник…" />;
  if (state.status === "error") return <StatusScreen title={state.message} retry />;
  return <ReadyGame mode={mode} today={today} archiveIso={params.iso ?? ""} lexicon={state.lexicon} />;
}

function ReadyGame({
  mode,
  today,
  archiveIso,
  lexicon,
}: {
  mode: Mode;
  today: string;
  archiveIso: string;
  lexicon: Lexicon;
}) {
  const { manifest } = lexicon;
  const [practiceId, setPracticeId] = useState<number | null>(null);

  useEffect(() => {
    if (mode !== "practice") return;
    const saved = loadGame(gameKey("practice"));
    if (saved && saved.puzzleId >= 0 && saved.puzzleId < manifest.puzzleCount) {
      setPracticeId(saved.puzzleId);
      return;
    }
    setPracticeId(pickPracticeId(manifest.puzzleCount, puzzleIdForDate(today, manifest.epoch, manifest.puzzleCount)));
  }, [mode, manifest.puzzleCount, manifest.epoch, today]);

  if (mode === "practice" && practiceId === null) return <StatusScreen title="Готуємо тренування…" />;

  const resolved = resolvePuzzle(mode, today, archiveIso, manifest.epoch, manifest.puzzleCount, practiceId);
  if (resolved.kind === "redirect") return <Navigate to="/daily" replace />;
  if (resolved.kind === "blocked") return <StatusScreen title={resolved.message} home />;

  return (
    <Puzzle
      key={`${mode}-${resolved.puzzleId}-${resolved.storageKey}`}
      mode={mode}
      today={today}
      iso={resolved.iso}
      puzzleId={resolved.puzzleId}
      storageKey={resolved.storageKey}
      puzzleCount={manifest.puzzleCount}
      epoch={manifest.epoch}
      vocab={lexicon.vocab}
      forms={lexicon.forms}
      vocabSize={manifest.vocabSize}
      greenMax={manifest.greenMax}
      yellowMax={manifest.yellowMax}
      onNewPractice={(nextId) => {
        saveGame(gameKey("practice"), { puzzleId: nextId, guesses: [], status: "playing", recorded: false });
        setPracticeId(nextId);
      }}
    />
  );
}

function Puzzle({
  mode,
  today,
  iso,
  puzzleId,
  storageKey,
  puzzleCount,
  epoch,
  vocab,
  forms,
  vocabSize,
  greenMax,
  yellowMax,
  onNewPractice,
}: {
  mode: Mode;
  today: string;
  iso: string | null;
  puzzleId: number;
  storageKey: string;
  puzzleCount: number;
  epoch: string;
  vocab: string[];
  forms: Map<string, number>;
  vocabSize: number;
  greenMax: number;
  yellowMax: number;
  onNewPractice: (nextId: number) => void;
}) {
  const [ranks, setRanks] = useState<Uint16Array | null>(null);
  const [secretIndex, setSecretIndex] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [recorded, setRecorded] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [freshIndex, setFreshIndex] = useState<number | null>(null);
  const [sort, setSort] = useState<SortMode>(() => loadSort());
  const [helpOpen, setHelpOpen] = useState(() => mode === "daily" && !loadHelpSeen());
  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState(() => loadStats());
  const [confirm, setConfirm] = useState<"giveup" | "practice" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  useEffect(() => {
    let active = true;
    setReady(false);
    setError(null);
    loadRanks(puzzleId)
      .then((file) => {
        if (!active) return;
        if (file.vocabSize !== vocab.length || file.secretIndex >= vocab.length) throw new Error("size");
        const saved = loadGame(storageKey);
        const same = saved?.puzzleId === puzzleId;
        setRanks(file.ranks);
        setSecretIndex(file.secretIndex);
        setGuesses(same ? saved.guesses : []);
        setStatus(same ? saved.status : "playing");
        setRecorded(same ? Boolean(saved.recorded) : false);
        setReady(true);
      })
      .catch(() => {
        if (active) setError("Не вдалося завантажити слово цієї гри.");
      });
    return () => {
      active = false;
    };
  }, [puzzleId, storageKey, vocab.length, reloadKey]);

  useEffect(() => {
    if (!ready || secretIndex === null) return;
    saveGame(storageKey, { puzzleId, guesses, status, recorded });
  }, [ready, storageKey, puzzleId, guesses, status, recorded, secretIndex]);

  useEffect(() => {
    if (freshIndex === null) return;
    document.getElementById(`guess-${freshIndex}`)?.scrollIntoView({
      block: "nearest",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [freshIndex, guesses.length]);

  const attempts = guesses.filter((guess) => !guess.revealed);
  const hintCount = attempts.filter((guess) => guess.hint).length;
  const indexByRank = useMemo(() => {
    if (!ranks) return [] as number[];
    const table = new Array<number>(ranks.length + 1);
    for (let index = 0; index < ranks.length; index += 1) table[ranks[index]] = index;
    return table;
  }, [ranks]);

  function finish(nextStatus: "won" | "lost", nextGuesses: Guess[]) {
    setStatus(nextStatus);
    setGuesses(nextGuesses);
    setRecorded((already) => {
      if (!already && mode === "daily") {
        const played = nextGuesses.filter((guess) => !guess.revealed);
        const nextStats = recordDaily(loadStats(), today, nextStatus === "won", played.length);
        saveStats(nextStats);
        setStats(nextStats);
      }
      return true;
    });
  }

  function submitWord(raw: string) {
    if (!ranks || status !== "playing") return;
    const parsed = candidateKeys(raw);
    if ("issue" in parsed) {
      setMessage(parsed.issue === "multi" ? "Введіть одне слово, без дефіса." : "Введіть слово.");
      return;
    }
    let index: number | undefined;
    for (const key of parsed.keys) {
      const found = forms.get(key);
      if (found !== undefined) {
        index = found;
        break;
      }
    }
    if (index === undefined) {
      setMessage("Немає такого слова у словнику. Спробуйте іменник — можна в будь-якій формі.");
      return;
    }
    if (guesses.some((guess) => guess.index === index)) {
      setMessage("Це слово вже є в списку.");
      setFreshIndex(index);
      return;
    }
    const rank = ranks[index];
    const tone = bandForRank(rank, greenMax, yellowMax);
    const next = [...guesses, { index, rank, hint: false }];
    setDraft("");
    setMessage(null);
    setFreshIndex(index);
    setLive(`${vocab[index]}, ранг ${rank}, ${bandLabel(tone)}`);
    if (rank === 1) finish("won", next);
    else setGuesses(next);
  }

  function giveHint() {
    if (!ranks || status !== "playing") return;
    const best = attempts.length ? Math.min(...attempts.map((guess) => guess.rank)) : null;
    const rank = hintRank(best, vocabSize, new Set(guesses.map((guess) => guess.rank)));
    if (rank === null) {
      setMessage("Підказка вже не потрібна: ви за крок від слова.");
      return;
    }
    const index = indexByRank[rank];
    if (index === undefined || guesses.some((guess) => guess.index === index)) {
      setMessage("Не вдалося дібрати нову підказку.");
      return;
    }
    setGuesses([...guesses, { index, rank, hint: true }]);
    setFreshIndex(index);
    setMessage(null);
    setLive(`Підказка: ${vocab[index]}, ранг ${rank}, ${bandLabel(bandForRank(rank, greenMax, yellowMax))}`);
  }

  function giveUp() {
    if (secretIndex === null) return;
    const next = guesses.some((guess) => guess.index === secretIndex)
      ? guesses
      : [...guesses, { index: secretIndex, rank: 1, hint: false, revealed: true }];
    setFreshIndex(secretIndex);
    finish("lost", next);
  }

  async function share() {
    const text = shareSummary({
      practice: mode === "practice",
      dateLabel: formatLongDate(iso ?? today),
      won: status === "won",
      gaveUp: status === "lost",
      attempts: attempts.length,
      hints: hintCount,
      ranks: attempts.map((guess) => guess.rank),
      greenMax,
      yellowMax,
    });
    try {
      await navigator.clipboard.writeText(text);
      setToast("Скопійовано");
    } catch {
      setToast("Не вдалося скопіювати");
    }
    window.setTimeout(() => setToast(null), 1800);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#121418" : "#f4f2ec");
    saveThemePreference(next);
    setTheme(next);
  }

  function toggleSort() {
    const next = sort === "rank" ? "order" : "rank";
    setSort(next);
    saveSort(next);
  }

  function requestPractice() {
    if (status === "playing" && guesses.length > 0) setConfirm("practice");
    else {
      onNewPractice(pickPracticeId(puzzleCount, puzzleIdForDate(today, epoch, puzzleCount), puzzleId));
    }
  }

  const meta =
    mode === "practice"
      ? "Тренування"
      : mode === "archive" && iso
        ? `Архів · ${formatLongDate(iso)}`
        : `Слово дня · ${formatLongDate(today)}`;
  const secret = secretIndex === null ? "" : vocab[secretIndex];
  const playing = status === "playing";

  return (
    <div className="shell">
      <a className="skip" href="#guess">
        Перейти до поля вводу
      </a>
      <Header
        meta={meta}
        extra={ready ? `Спроби: ${attempts.length}${hintCount ? ` · підказки: ${hintCount}` : ""}` : "Завантаження…"}
      >
        <MenuButton onSelect={giveHint} disabled={!playing || !ready}>
          Підказка
        </MenuButton>
        <MenuButton onSelect={() => setConfirm("giveup")} disabled={!playing || !ready}>
          Здатися
        </MenuButton>
        <MenuButton onSelect={() => void share()} disabled={!ready || (playing && attempts.length === 0)}>
          Поділитися
        </MenuButton>
        <MenuRule />
        <MenuLink to="/previous">Попередні ігри</MenuLink>
        {mode === "practice" ? (
          <MenuButton onSelect={requestPractice}>Нове тренування</MenuButton>
        ) : (
          <MenuLink to="/practice">Тренування</MenuLink>
        )}
        {mode !== "daily" ? <MenuLink to="/daily">Слово дня</MenuLink> : null}
        <MenuRule />
        <MenuButton onSelect={() => setHelpOpen(true)}>Як грати</MenuButton>
        <MenuButton onSelect={() => setStatsOpen(true)}>Статистика</MenuButton>
        <MenuButton onSelect={toggleSort}>{sort === "rank" ? "Порядок ходів" : "За близькістю"}</MenuButton>
        <MenuButton onSelect={toggleTheme}>{theme === "dark" ? "Світла тема" : "Темна тема"}</MenuButton>
      </Header>

      <div className="play-card">
        {error ? (
          <div className="error-panel">
            <p>{error}</p>
            <button type="button" className="primary-btn" onClick={() => setReloadKey((value) => value + 1)}>
              Спробувати ще раз
            </button>
          </div>
        ) : !ready || !ranks ? (
          <div role="status">
            <div className="loading-bar" />
            <p className="hint-line">Завантажуємо ранги…</p>
          </div>
        ) : playing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitWord(draft);
            }}
          >
            <div className="guess-form">
              <label className="sr-only" htmlFor="guess">
                Слово
              </label>
              <input
                id="guess"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (message) setMessage(null);
                }}
                placeholder="Введіть слово"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                maxLength={40}
                lang="uk"
                aria-invalid={message ? true : undefined}
                aria-describedby="guess-message"
              />
              <button className="primary-btn" type="submit">
                Спроба
              </button>
            </div>
          </form>
        ) : (
          <div className="result" role="status">
            <span>{status === "won" ? "Ви вгадали." : "Цього разу слово відкрито."}</span>
            <strong>{secret}</strong>
            <button type="button" className="primary-btn" onClick={() => void share()}>
              Поділитися
            </button>
            {mode === "practice" ? (
              <button type="button" className="ghost-btn" onClick={requestPractice}>
                Інше слово
              </button>
            ) : (
              <Link className="ghost-btn" to="/previous">
                Попередні ігри
              </Link>
            )}
          </div>
        )}
        <p id="guess-message" className="message" role="status">
          {message}
        </p>
        <p className="sr-only" aria-live="polite">
          {live}
        </p>
      </div>

      {ready && ranks ? (
        <GuessList guesses={guesses} vocab={vocab} vocabSize={vocabSize} sort={sort} freshIndex={freshIndex} />
      ) : null}

      <HowToDialog
        open={helpOpen}
        onOpenChange={(open) => {
          setHelpOpen(open);
          if (!open) saveHelpSeen();
        }}
      />
      <StatsDialog open={statsOpen} onOpenChange={setStatsOpen} stats={stats} />
      <ConfirmDialog
        open={confirm === "giveup"}
        onOpenChange={(open) => setConfirm(open ? "giveup" : null)}
        title="Здатися?"
        body={
          mode === "daily"
            ? "Секретне слово буде відкрито, а серію перемог перервано."
            : "Секретне слово буде відкрито."
        }
        confirmLabel="Показати слово"
        onConfirm={giveUp}
      />
      <ConfirmDialog
        open={confirm === "practice"}
        onOpenChange={(open) => setConfirm(open ? "practice" : null)}
        title="Нове тренування?"
        body="Поточне слово зникне з цієї сесії."
        confirmLabel="Інше слово"
        onConfirm={() =>
          onNewPractice(pickPracticeId(puzzleCount, puzzleIdForDate(today, epoch, puzzleCount), puzzleId))
        }
      />
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function pickPracticeId(count: number, avoid: number | null, current?: number): number {
  if (count <= 1) return 0;
  let next = Math.floor(Math.random() * count);
  for (let guard = 0; guard < 8 && (next === avoid || next === current); guard += 1) {
    next = Math.floor(Math.random() * count);
  }
  return next;
}

function resolvePuzzle(
  mode: Mode,
  today: string,
  archiveIso: string,
  epoch: string,
  puzzleCount: number,
  practiceId: number | null,
):
  | { kind: "ok"; puzzleId: number; iso: string | null; storageKey: string }
  | { kind: "redirect" }
  | { kind: "blocked"; message: string } {
  if (mode === "daily") {
    const puzzleId = puzzleIdForDate(today, epoch, puzzleCount);
    if (puzzleId === null) {
      return { kind: "blocked", message: "Слово на сьогодні ще не підготовлене. Загляньте в попередні ігри." };
    }
    return { kind: "ok", puzzleId, iso: today, storageKey: gameKey("daily", today) };
  }
  if (mode === "archive") {
    if (!parseISO(archiveIso)) return { kind: "blocked", message: "Немає такої дати." };
    if (archiveIso === today) return { kind: "redirect" };
    if (archiveIso > today) return { kind: "blocked", message: "Ця гра ще не відкрита." };
    const puzzleId = puzzleIdForDate(archiveIso, epoch, puzzleCount);
    if (puzzleId === null) return { kind: "blocked", message: "На цю дату слова немає в архіві." };
    return { kind: "ok", puzzleId, iso: archiveIso, storageKey: gameKey("archive", archiveIso) };
  }
  return {
    kind: "ok",
    puzzleId: practiceId ?? 0,
    iso: null,
    storageKey: gameKey("practice"),
  };
}

function StatusScreen({ title, retry, home }: { title: string; retry?: boolean; home?: boolean }) {
  return (
    <div className="shell">
      <Header meta="Сенс" />
      <div className="panel empty-panel" style={{ padding: 16 }}>
        <p>{title}</p>
        <div className="links">
          {retry ? (
            <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
              Спробувати ще раз
            </button>
          ) : null}
          {home ? (
            <Link className="primary-btn" to="/daily">
              До слова дня
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
