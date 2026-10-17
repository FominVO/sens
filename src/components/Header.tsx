import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Header({
  meta,
  extra,
  children,
}: {
  meta: string;
  extra?: string;
  children?: ReactNode;
}) {
  return (
    <header className="topbar">
      <Link className="brand" to="/daily">
        <span className="brand-name">Сенс</span>
        <span className="brand-meta">{meta}</span>
        {extra ? <span className="attempts">{extra}</span> : null}
      </Link>
      {children ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="icon-btn" aria-label="Меню">
            <DotsIcon />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="menu-pop" align="end" sideOffset={8}>
              {children}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : null}
    </header>
  );
}

export function MenuButton({
  children,
  onSelect,
  disabled,
}: {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Item className="menu-link" onSelect={onSelect} disabled={disabled}>
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <DropdownMenu.Item asChild>
      <Link className="menu-link" to={to}>
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}

export function MenuRule() {
  return <DropdownMenu.Separator asChild><hr /></DropdownMenu.Separator>;
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="4" cy="9" r="1.4" fill="currentColor" />
      <circle cx="9" cy="9" r="1.4" fill="currentColor" />
      <circle cx="14" cy="9" r="1.4" fill="currentColor" />
    </svg>
  );
}
