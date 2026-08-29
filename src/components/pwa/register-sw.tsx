"use client";

import { useEffect } from "react";
import { runSync } from "@/lib/offline/sync";

export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "BLACKMIRROR_SYNC") void runSync();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
  return null;
}
