"use client";

import { useEffect } from "react";

/** Registers /sw.js. Production only: a service worker in `next dev` caches stale chunks and confuses HMR. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error: unknown) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}
