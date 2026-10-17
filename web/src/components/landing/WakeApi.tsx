"use client";

import { useEffect } from "react";
import { API } from "@/lib/api";

/** Free hosting sleeps when idle: start waking the API while the visitor reads the landing page. */
export function WakeApi() {
  useEffect(() => {
    fetch(`${API}/api/health`, { mode: "cors" }).catch(() => undefined);
  }, []);
  return null;
}
