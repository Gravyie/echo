import Link from "next/link";

export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/";

/** Echo's mark: one solid origin with the rings it sends out. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="3.2" fill="var(--accent)" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="var(--accent)" strokeOpacity="0.55" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="10.6" fill="none" stroke="var(--accent)" strokeOpacity="0.25" strokeWidth="1.2" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Mark />
      <span className="font-display text-lg font-semibold tracking-tight">Echo</span>
    </Link>
  );
}
