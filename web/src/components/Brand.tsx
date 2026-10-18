"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

/** Echo's mark: one solid origin with the rings it sends out. */
export function Mark({ size = 22, color = "var(--accent)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="9.2" y="9.2" width="5.6" height="5.6" fill={color} />
      <circle cx="12" cy="12" r="7" fill="none" stroke={color} strokeOpacity="0.6" strokeWidth="1.3" />
      <circle cx="12" cy="12" r="10.6" fill="none" stroke={color} strokeOpacity="0.28" strokeWidth="1.1" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      <Mark />
      <span className="display text-[22px] leading-none">Echo</span>
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
