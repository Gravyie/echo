"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GithubLogo } from "@phosphor-icons/react";
import { Mark } from "@/components/Brand";
import { REPO_URL } from "@/lib/site";

const LINKS = [
  ["#problem", "Problem"],
  ["#how", "How it works"],
  ["#results", "Results"],
  ["#falkordb", "FalkorDB"],
  ["#mcp", "MCP"],
];

/** Light-on-painting over the hero, paper once the page scrolls past it. */
export function SiteNav() {
  const [solid, setSolid] = useState(false);
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
            e.preventDefault();
            window.history.replaceState(null, "", "/");
            window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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
