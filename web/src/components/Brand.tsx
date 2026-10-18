"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

/**
 * Echo's mark: one solid origin and its repeats, each fainter than the last.
 * Outlines take the current text colour, so it works on paper, on ink and over imagery.
 */
export function Mark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={`shrink-0 ${className}`}>
      <g fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="22.4" cy="16" r="6.4" opacity=".22" />
        <circle cx="18" cy="16" r="6.4" opacity=".45" />
        <circle cx="13.6" cy="16" r="6.4" opacity=".75" />
      </g>
      <circle cx="9.2" cy="16" r="6.4" fill="#E0501A" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      <Mark size={26} />
      <span className="display text-[23px] leading-none">Echo</span>
    </Link>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    try {
      setDark(localStorage.getItem("echo.theme") === "dark" || document.documentElement.dataset.theme === "dark");
    } catch {}
  }, []);
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
