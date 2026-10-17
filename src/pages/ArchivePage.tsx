import { useState } from "react";
import { Link } from "react-router-dom";
import { HowToDialog, StatsDialog } from "../components/Dialogs.tsx";
import { Header, MenuButton, MenuLink, MenuRule } from "../components/Header.tsx";
import { useLexicon } from "../data/Lexicon.tsx";
import {
  formatLongDate,
  formatMonthTitle,
  localISO,
  monthGrid,
  parseISO,
  puzzleIdForDate,
  WEEKDAYS_SHORT,
} from "../lib/dates.ts";
import { loadStats, listOutcomes, saveThemePreference } from "../lib/storage.ts";

export function ArchivePage() {
  const state = useLexicon();
  const today = localISO();
  const [helpOpen, setHelpOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  const initial = parseISO(today) ?? { year: 2026, month: 10, day: 1 };
  const [cursor, setCursor] = useState({ year: initial.year, month: initial.month - 1 });

  if (state.status === "loading") {
    return (
      <div className="shell">
        <Header meta="Попередні ігри" />
        <div role="status">
          <div className="loading-bar" />
          <p className="hint-line">Завантажуємо календар…</p>
        </div>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="shell">
        <Header meta="Попередні ігри" />
        <p>{state.message}</p>
      </div>
    );
  }

  const { epoch, puzzleCount } = state.lexicon.manifest;
  const epochParts = parseISO(epoch);
  const outcomes = listOutcomes();
  const cells = monthGrid(cursor.year, cursor.month);
  const canPrev = epochParts
    ? cursor.year > epochParts.year || (cursor.year === epochParts.year && cursor.month > epochParts.month - 1)
    : true;
  const canNext = cursor.year < initial.year || (cursor.year === initial.year && cursor.month < initial.month - 1);

  function shift(delta: number) {
    const date = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    setCursor({ year: date.getUTCFullYear(), month: date.getUTCMonth() });
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#121418" : "#f4f2ec");
    saveThemePreference(next);
    setTheme(next);
  }

  return (
    <div className="shell">
      <Header meta="Попередні ігри">
        <MenuLink to="/daily">Слово дня</MenuLink>
        <MenuLink to="/practice">Тренування</MenuLink>
        <MenuRule />
        <MenuButton onSelect={() => setHelpOpen(true)}>Як грати</MenuButton>
        <MenuButton onSelect={() => setStatsOpen(true)}>Статистика</MenuButton>
        <MenuButton onSelect={toggleTheme}>{theme === "dark" ? "Світла тема" : "Темна тема"}</MenuButton>
      </Header>

      <div className="calendar-nav">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Попередній місяць">
          ‹
        </button>
        <h2>{formatMonthTitle(cursor.year, cursor.month)}</h2>
        <button type="button" className="icon-btn" onClick={() => shift(1)} disabled={!canNext} aria-label="Наступний місяць">
          ›
        </button>
      </div>

      <div className="weekdays">
        {WEEKDAYS_SHORT.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="days">
        {cells.map((cell, index) => {
          if (!cell) return <span key={`empty-${index}`} />;
          const future = cell.iso > today;
          const beforeEpoch = cell.iso < epoch;
          const puzzleId = puzzleIdForDate(cell.iso, epoch, puzzleCount);
          const disabled = future || beforeEpoch || puzzleId === null;
          const outcome = outcomes[cell.iso];
          const className = [
            "day",
            cell.iso === today ? "today" : "",
            disabled ? "disabled" : "",
            outcome === "won" ? "won" : "",
            outcome === "lost" ? "lost" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const label = `${formatLongDate(cell.iso)}${outcome === "won" ? ", вгадано" : outcome === "lost" ? ", здались" : ""}`;
          if (disabled) {
            return (
              <span key={cell.iso} className={className} aria-disabled="true">
                {cell.day}
              </span>
            );
          }
          return (
            <Link key={cell.iso} className={className} to={cell.iso === today ? "/daily" : `/day/${cell.iso}`} aria-label={label}>
              {cell.day}
            </Link>
          );
        })}
      </div>
      <p className="legend">Зелена крапка — вгадано, червона — слово відкрито. Тиждень починається з понеділка.</p>
      <div className="links">
        <Link className="primary-btn" to="/daily">
          Сьогодні
        </Link>
        <Link className="ghost-btn" to="/practice">
          Випадкова гра
        </Link>
      </div>
      <HowToDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <StatsDialog open={statsOpen} onOpenChange={setStatsOpen} stats={loadStats()} />
    </div>
  );
}
