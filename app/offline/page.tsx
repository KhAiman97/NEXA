import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

// Pre-cached by the service worker and shown when a page can't be reached.
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <WifiOff className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="font-display text-3xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="max-w-sm text-pretty text-muted-foreground">Your records are stored online, so Nexa needs a connection. Reconnect and it will pick up where you left off.</p>
      {/* A plain link on purpose: a full reload makes the service worker retry the network. */}
      <a href="/dashboard" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
        Try again
      </a>
    </main>
  );
}
