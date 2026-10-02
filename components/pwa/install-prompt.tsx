"use client";

import { useEffect, useState } from "react";
import { Download, EllipsisVertical, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Not in lib.dom.d.ts yet: Chromium's install prompt event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "nexa:install-dismissed";

/**
 * idle: waiting for a tap. installing: the user accepted the browser dialog. installed: the browser confirmed it.
 * manual: the browser dialog was closed or failed, so the browser menu is the only way left.
 */
type Status = "idle" | "installing" | "installed" | "manual";

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
 * After the tap it stays on screen and says what happened: Android builds the app in the background
 * and may put it in the app list rather than on the home screen, which otherwise looks like nothing happened.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true); // hidden until we've checked storage
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (isStandalone()) return;
    setDismissed(readDismissed());
    setShowIosHint(isIosSafari());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setStatus((current) => (current === "manual" ? "idle" : current)); // a fresh event can prompt again
    };
    const onInstalled = () => {
      setDeferred(null);
      setStatus("installed");
    };

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
    setDeferred(null); // the event can only prompt once
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      // appinstalled may already have fired while the dialog was closing: don't step back from "installed".
      setStatus((current) => (current === "installed" ? current : outcome === "accepted" ? "installing" : "manual"));
    } catch (error) {
      console.error("Install prompt failed", error);
      setStatus("manual");
    }
  };

  if (dismissed || (status === "idle" && !deferred && !showIosHint)) return null;

  const menuSteps = (
    <>
      open the browser menu <EllipsisVertical className="inline size-4 align-text-bottom" aria-label="menu" /> and
      choose <span className="font-medium">Install app</span> or{" "}
      <span className="font-medium">Add to Home screen</span>.
    </>
  );

  return (
    <div
      role="region"
      aria-label="Install app"
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-card p-3 shadow-lg lg:bottom-3"
    >
      <div className="flex-1 text-sm">
        <p className="font-medium">{status === "installed" ? "Nexa is installed" : "Install Nexa"}</p>
        {status === "installed" ? (
          <p className="text-muted-foreground">Open it from your home screen or your app list.</p>
        ) : status === "installing" ? (
          <p className="text-muted-foreground" role="status">
            Installing. It will appear on your home screen or in your app list within a minute. If it does not,{" "}
            {menuSteps}
          </p>
        ) : status === "manual" ? (
          <p className="text-muted-foreground">To install, {menuSteps}</p>
        ) : deferred ? (
          <p className="text-muted-foreground">Add it to your home screen for quick, full-screen access.</p>
        ) : (
          <p className="text-muted-foreground">
            Tap <Share className="mx-0.5 inline size-4 align-text-bottom" aria-label="Share" /> then{" "}
            <span className="font-medium">Add to Home Screen</span>.
          </p>
        )}
      </div>
      {deferred && status === "idle" && (
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
