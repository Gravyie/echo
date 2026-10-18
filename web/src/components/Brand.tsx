"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

const FAN = [
  ["M6.5 6.5 C 13 6.5, 14.5 16, 20 16", 0.32],
  ["M6.5 11.25 C 12.5 11.25, 14 16, 20 16", 0.58],
  ["M6.5 16 L 20 16", 0.95],
  ["M6.5 20.75 C 12.5 20.75, 14 16, 20 16", 0.58],
  ["M6.5 25.5 C 13 25.5, 14.5 16, 20 16", 0.32],
] as const;

/**
 * Echo's mark: five sources fanning into one origin.
 * `tile` sets it on an ink (or paper, when inverted) rounded square, like the favicon.
 */
export function Mark({ size = 22, tile = true, invert = false }: { size?: number; tile?: boolean; invert?: boolean }) {
  // Follows the theme: an ink tile on paper, a paper tile on ink. `invert` forces paper (for use over imagery).
  const bg = invert ? "#F4F3EF" : "var(--text)";
  const fg = tile ? (invert ? "#141413" : "var(--bg)") : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      {tile && <rect width="32" height="32" rx="7.5" fill={bg} />}
      <g fill="none" stroke={fg} strokeWidth="1.8" strokeLinecap="round">
        {FAN.map(([d, o]) => (
          <path key={d} d={d} opacity={o} />
        ))}
      </g>
      <circle cx="22.6" cy="16" r="3.4" fill="#E0501A" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      <Mark size={24} />
      <span className="display text-[23px] leading-none">Echo</span>
    </Link>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  const flip = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("echo.theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      onClick={flip}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={`grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text ${className}`}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
