"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

/** Sign out after this long with no interaction. */
const IDLE_MS = 15 * 60 * 1000;

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "pointerdown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
];

/**
 * Idle sign-out for shared or lost field devices. Skipped while offline:
 * signing out without signal would lock the adjuster out mid-inspection.
 * Unsynced captures stay on the device and sync after the next sign-in.
 */
export function IdleSessionGuard() {
  useEffect(() => {
    let lastActivity = Date.now();
    const touch = () => {
      lastActivity = Date.now();
    };
    const check = () => {
      if (!navigator.onLine) {
        touch();
        return;
      }
      if (Date.now() - lastActivity >= IDLE_MS) {
        void signOut({ callbackUrl: "/login?reason=idle" });
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, touch, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(check, 30_000);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, touch);
      }
    };
  }, []);

  return null;
}
