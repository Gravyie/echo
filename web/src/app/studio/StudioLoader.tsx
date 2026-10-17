"use client";

import dynamic from "next/dynamic";

const Studio = dynamic(() => import("@/components/studio/Studio"), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-[100dvh] place-items-center">
      <div className="skeleton size-16 rounded-full" />
    </div>
  ),
});

export function StudioLoader() {
  return <Studio />;
}
