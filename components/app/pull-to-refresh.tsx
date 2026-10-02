"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** How far the finger has to travel before letting go refreshes, and the furthest the indicator follows it. */
const TRIGGER_PX = 72;
const MAX_PX = 110;

/**
 * Pull down from the top of the page to reload its data. Touch only, so it does nothing with a mouse.
 *
 * The browser's own pull-to-refresh is switched off (overscroll-behavior in globals.css): in an installed
 * app it reloads the whole page, and iOS has none at all. This one asks the server for the current page
 * again and swaps the new data in, so the open tab, the list page and the scroll position are kept.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, startTransition] = useTransition();
  const startY = useRef<number | null>(null);
  const distance = useRef(0);

  useEffect(() => {
    const reset = () => {
      startY.current = null;
      distance.current = 0;
      setPull(0);
    };

    const onStart = (event: TouchEvent) => {
      const target = event.target as Element | null;
      // Only from the very top of the page, with one finger, and never from inside a dialog or a dropdown,
      // which scroll on their own.
      const blocked = event.touches.length !== 1 || window.scrollY > 0 || target?.closest('[role="dialog"], [role="listbox"], [data-radix-popper-content-wrapper]');
      startY.current = blocked ? null : event.touches[0].clientY;
      distance.current = 0;
    };

    const onMove = (event: TouchEvent) => {
      if (startY.current === null) return;
      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0 || window.scrollY > 0) return reset();
      // The indicator moves less than the finger, like a stretched spring.
      distance.current = Math.min(MAX_PX, delta * 0.5);
      setPull(distance.current);
    };

    const onEnd = () => {
      if (startY.current === null) return;
      const far = distance.current >= TRIGGER_PX;
      reset();
      if (far) startTransition(() => router.refresh());
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", reset);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", reset);
    };
  }, [router]);

  const offset = refreshing ? TRIGGER_PX : pull;
  const ready = pull >= TRIGGER_PX;
  if (offset <= 0) return null;

  return (
    <div
      role="status"
      aria-label={refreshing ? "Refreshing" : ready ? "Release to refresh" : "Pull to refresh"}
      className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 flex justify-center"
      style={{ transform: `translateY(${offset - 28}px)`, opacity: Math.min(1, offset / TRIGGER_PX) }}
    >
      <span className={cn("flex size-10 items-center justify-center rounded-full border bg-card shadow-lg transition-colors", (ready || refreshing) && "border-mod text-mod")}>
        <RefreshCw aria-hidden className={cn("size-5", refreshing && "animate-spin")} style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }} />
      </span>
    </div>
  );
}
