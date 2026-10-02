"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A card with a soft glow that follows the pointer (styles: `.spotlight` in globals.css). */
export function SpotlightCard({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div
      style={style}
      className={cn("spotlight", className)}
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--sx", `${event.clientX - box.left}px`);
        event.currentTarget.style.setProperty("--sy", `${event.clientY - box.top}px`);
      }}
    >
      {children}
    </div>
  );
}
