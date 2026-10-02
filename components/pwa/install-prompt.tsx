"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Not in lib.dom.d.ts yet: Chromium's install prompt event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "nexa:install-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * Android/Chrome/Edge: shows an Install button once the browser says the app is installable.
 * iOS Safari has no install API, so it shows the manual "Add to Home Screen" steps instead.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true); // hidden until we've checked storage

  useEffect(() => {
    if (isStandalone()) return;
    setDismissed(readDismissed());
    setShowIosHint(isIosSafari());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode: just hide for this session */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (dismissed || (!deferred && !showIosHint)) return null;

  return (
    <div
      role="region"
      aria-label="Install app"
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-card p-3 shadow-lg lg:bottom-3"
    >
      <div className="flex-1 text-sm">
        <p className="font-medium">Install Nexa</p>
        {deferred ? (
          <p className="text-muted-foreground">Add it to your home screen for quick, full-screen access.</p>
        ) : (
          <p className="text-muted-foreground">
            Tap <Share className="mx-0.5 inline size-4 align-text-bottom" aria-label="Share" /> then{" "}
            <span className="font-medium">Add to Home Screen</span>.
          </p>
        )}
      </div>
      {deferred && (
        <Button size="sm" onClick={install}>
          <Download className="size-4" /> Install
        </Button>
      )}
      <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Dismiss">
        <X className="size-4" />
      </Button>
    </div>
  );
}
