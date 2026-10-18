"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GithubLogo } from "@phosphor-icons/react";
import { Mark, ThemeToggle } from "@/components/Brand";
import { REPO_URL } from "@/lib/site";

const LINKS = [
  ["/#how", "How it works"],
  ["/#results", "Results"],
  ["/#integrations", "Integrations"],
  ["/#falkordb", "FalkorDB"],
  ["/docs", "Docs"],
];

/**
 * Glide back to the top. Done frame by frame because the browser's smooth scroll gets cancelled
 * when the pinned product tour re-renders mid-scroll. Any wheel or touch from the visitor stops it.
 */
function glideToTop() {
  const start = window.scrollY;
  if (start <= 0) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, 0);
    return;
  }
  const duration = Math.min(1200, 450 + start * 0.06);
  const t0 = performance.now();
  let stopped = false;
  const stop = () => (stopped = true);
  window.addEventListener("wheel", stop, { once: true, passive: true });
  window.addEventListener("touchstart", stop, { once: true, passive: true });
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const frame = (now: number) => {
    if (stopped) return;
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, Math.round(start * (1 - ease(t))));
    if (t < 1) requestAnimationFrame(frame);
    else {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    }
  };
  requestAnimationFrame(frame);
}

/** Light-on-painting over the hero, paper once the page scrolls past it. */
export function SiteNav({ alwaysSolid = false }: { alwaysSolid?: boolean } = {}) {
  const [scrolled, setSolid] = useState(false);
  const solid = alwaysSolid || scrolled;
  useEffect(() => {
    const on = () => setSolid(window.scrollY > window.innerHeight * 0.55);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,color] duration-300 ${
        solid ? "border-b border-line bg-bg/85 text-text backdrop-blur-md" : "border-b border-transparent text-white"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 md:px-8">
        <Link
          href="/"
          aria-label="Echo, back to top"
          onClick={(e) => {
            // already on the landing page: glide back to the top instead of a no-op navigation
            if (window.location.pathname !== "/") return;
            e.preventDefault();
            window.history.replaceState(null, "", "/");
            glideToTop();
          }}
          className="flex items-center gap-2"
        >
          <Mark size={30} />
          <span className="display text-[23px] leading-none">Echo</span>
        </Link>
        <div className={`hidden items-center gap-7 text-[13.5px] md:flex ${solid ? "text-muted" : "text-white/80"}`}>
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className={`transition-colors ${solid ? "hover:text-text" : "hover:text-white"}`}>
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href={REPO_URL}
            aria-label="Source code on GitHub"
            className={`hidden size-8 place-items-center rounded-md transition-colors sm:grid ${solid ? "text-muted hover:bg-surface-2 hover:text-text" : "text-white/80 hover:text-white"}`}
          >
            <GithubLogo size={18} />
          </a>
          <ThemeToggle className={solid ? "" : "!text-white/80 hover:!bg-white/10 hover:!text-white"} />
          <Link
            href="/studio"
            className={`ml-2 rounded-md px-3.5 py-2 text-[13.5px] font-medium transition-[transform,background-color] active:scale-[0.98] ${
              solid ? "bg-text text-bg hover:bg-text/90" : "bg-white text-[#141413] hover:bg-white/90"
            }`}
          >
            Open the studio
          </Link>
        </div>
      </nav>
    </header>
  );
}
