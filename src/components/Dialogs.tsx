import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { bandForRank, barWidth } from "../lib/color.ts";
import type { Stats } from "../lib/stats.ts";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal">
          <Dialog.Title asChild>
            <h2>{title}</h2>
          </Dialog.Title>
          <Dialog.Description className="sr-only">{description ?? title}</Dialog.Description>
          <div className="modal-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function HowToDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Як грати"
      description="Щодня є одне секретне слово. Ранг підказує, наскільки ваш здогад близький за значенням."
    >
      <ol className="steps">
        <li>Секретне слово — іменник, однаковий для всіх у цей день.</li>
        <li>Введіть будь-яке слово. Менший ранг означає ближче значення. Ранг 1 — це відповідь.</li>
        <li>Зелена смужка — приблизно до 300-го місця, жовта — до 1500-го, червона — далі.</li>
        <li>Список іде від найближчих здогадів до найдальших.</li>
        <li>У меню є підказка: вона відкриває слово, ближче за ваше найкраще. «Здатися» показує відповідь.</li>
      </ol>
      <p className="hint-line">Приклад, не сьогоднішнє слово:</p>
      <ul className="guess-list" aria-hidden="true">
        <Example word="море" rank={18} vocab={12000} />
        <Example word="озеро" rank={240} vocab={12000} />
        <Example word="стіл" rank={4100} vocab={12000} />
      </ul>
      <p className="hint-line">Нове слово з’являється опівночі за вашим місцевим часом. Старі дні є в попередніх іграх.</p>
      <div className="modal-actions">
        <Dialog.Close className="primary-btn">Зрозуміло</Dialog.Close>
      </div>
    </Modal>
  );
}

function Example({ word, rank, vocab }: { word: string; rank: number; vocab: number }) {
  const tone = bandForRank(rank);
  return (
    <li className="guess">
      <div className="guess-row">
        <span className="guess-word">{word}</span>
        <span className={`rank ${tone}`}>{rank}</span>
      </div>
      <div className="track">
        <div className={`bar ${tone}`} style={{ width: `${barWidth(rank, vocab)}%` }} />
      </div>
    </li>
  );
}

export function StatsDialog({
  open,
  onOpenChange,
  stats,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: Stats;
}) {
  const rate = stats.dailyPlayed ? Math.round((stats.dailyWon / stats.dailyPlayed) * 100) : 0;
  const maxBucket = Math.max(1, ...stats.distribution);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Статистика" description="Лише завершені щоденні ігри. Тренування і архів серію не змінюють.">
      <p className="hint-line">Лише завершені щоденні ігри. Тренування і архів серію не змінюють.</p>
      <div className="stat-grid">
        <div className="stat">
          <b>{stats.dailyPlayed}</b>
          <span>зіграно</span>
        </div>
        <div className="stat">
          <b>{rate}%</b>
          <span>перемог</span>
        </div>
        <div className="stat">
          <b>{stats.streak}</b>
          <span>серія</span>
        </div>
        <div className="stat">
          <b>{stats.maxStreak}</b>
          <span>рекорд</span>
        </div>
      </div>
      {stats.dailyWon === 0 ? (
        <p>Ще немає виграних щоденних ігор.</p>
      ) : (
        <div className="dist" aria-label="Розподіл спроб">
          {stats.distribution.map((count, index) => {
            if (index === 0 || count === 0) return null;
            return (
              <div className="dist-row" key={index}>
                <span>{index === 31 ? "31+" : index}</span>
                <i style={{ width: `${Math.max(6, (count / maxBucket) * 100)}%` }} />
                <span>{count}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="modal-actions">
        <Dialog.Close className="primary-btn">Закрити</Dialog.Close>
      </div>
    </Modal>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={body}>
      <p>{body}</p>
      <div className="modal-actions">
        <Dialog.Close className="ghost-btn">Скасувати</Dialog.Close>
        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
