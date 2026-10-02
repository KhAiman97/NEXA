"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/lib/pwa/icon";

/** Set by the sign-in form just before it opens the app; read once here, then cleared. */
export const WELCOME_FLAG = "nexa:welcome";

const SHOW_MS = 2300;
const LEAVE_MS = 500;

/**
 * The full logo, shown once right after signing in: it comes into focus dimmed, rings spread out from behind
 * the mark, a band of light crosses it and leaves it lit, then it lifts away to the page loading underneath.
 * Tap anywhere to skip. The animation itself is CSS (`.welcome-*` in globals.css).
 */
export function WelcomeSplash() {
  const [phase, setPhase] = useState<"off" | "on" | "leaving">("off");

  useEffect(() => {
    let wanted = false;
    try {
      wanted = sessionStorage.getItem(WELCOME_FLAG) === "1";
      sessionStorage.removeItem(WELCOME_FLAG);
    } catch {
      /* storage blocked: no splash */
    }
    if (!wanted) return;

    setPhase("on");
    const leave = setTimeout(() => setPhase("leaving"), SHOW_MS);
    return () => clearTimeout(leave);
  }, []);

  // Leaving, whether on time or by a tap: let the fade finish, then get out of the way.
  useEffect(() => {
    if (phase !== "leaving") return;
    const done = setTimeout(() => setPhase("off"), LEAVE_MS);
    return () => clearTimeout(done);
  }, [phase]);

  if (phase === "off") return null;

  return (
    <div
      role="img"
      aria-label={BRAND.name}
      onClick={() => setPhase("leaving")}
      className="welcome fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black"
      data-leaving={phase === "leaving" || undefined}
    >
      <div className="welcome-stage">
        <span className="welcome-ring" />
        <span className="welcome-ring welcome-ring-late" />
        {/* Plain images: they must paint at once, with no optimiser round trip. The first is the logo dimmed,
            the second the same logo at full brightness, uncovered by the band of light as it crosses. */}
        <div className="welcome-art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="" width={720} height={720} className="welcome-logo welcome-logo-dim" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="" width={720} height={720} className="welcome-logo welcome-logo-lit" />
          <span className="welcome-shine" />
        </div>
      </div>
    </div>
  );
}
