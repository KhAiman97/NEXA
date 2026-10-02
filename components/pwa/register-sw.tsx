"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registers /sw.js and offers a reload when a new build is waiting.
 *
 * The reload is offered rather than taken: a worker that takes over by itself swaps the build under a page
 * that is already running (possibly mid-entry), so the new one sits in `waiting` until the user says go.
 *
 * Production only. In development it does the opposite and removes any worker left over from a production
 * build on the same origin, which would otherwise serve stale chunks to `next dev` and confuse HMR.
 */
export function RegisterServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // Only reload on a controller change the user asked for: the first worker claiming the page also fires one.
  const accepted = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => undefined);
      return;
    }

    let registration: ServiceWorkerRegistration | undefined;

    const watch = (reg: ServiceWorkerRegistration) => {
      registration = reg;

      // Already waiting when the page loaded: a build shipped while the app was closed.
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);

      reg.addEventListener("updatefound", () => {
        const incoming = reg.installing;
        if (!incoming) return;
        incoming.addEventListener("statechange", () => {
          // "installed" with a controller present means a newer worker is ready behind the running one.
          // Without a controller it is the first install, which needs no announcement.
          if (incoming.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(incoming);
            setDismissed(false);
          }
        });
      });
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(watch)
      .catch((error: unknown) => {
        console.error("Service worker registration failed", error);
      });

    const onControllerChange = () => {
      if (!accepted.current) return;
      accepted.current = false;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // An installed app may stay open for days without navigating, so nothing else would ask for a new build:
    // check once an hour, and whenever the app comes back to the foreground.
    const check = () => registration?.update().catch(() => undefined);
    const poll = window.setInterval(check, UPDATE_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const update = () => {
    if (!waiting) return;
    // The reload happens in controllerchange, once the new worker has actually taken over;
    // reloading here would race it and land on the old build again.
    accepted.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
    setWaiting(null);
  };

  if (!waiting || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-card p-3 shadow-lg lg:bottom-3"
    >
      <div className="flex-1 text-sm">
        <p className="font-medium">A new version of Nexa is ready</p>
        <p className="text-muted-foreground">Reload to pick it up.</p>
      </div>
      <Button size="sm" onClick={update}>
        <RefreshCw className="size-4" /> Reload
      </Button>
      <Button size="icon" variant="ghost" onClick={() => setDismissed(true)} aria-label="Not now">
        <X className="size-4" />
      </Button>
    </div>
  );
}
