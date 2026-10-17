import type { Metadata } from "next";
import { StudioLoader } from "./StudioLoader";

export const metadata: Metadata = {
  title: "Echo studio",
  description: "Ask a research agent, watch it trace every claim to its origin in FalkorDB, and retract sources live.",
};

export default function StudioPage() {
  return <StudioLoader />;
}
