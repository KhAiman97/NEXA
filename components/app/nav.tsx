"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarFront, CircuitBoard, Dumbbell, LayoutGrid, Soup, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULES, MODULE_KEYS, moduleStyle, type ModuleKey } from "@/lib/app/modules";

const ICONS: Record<ModuleKey, LucideIcon> = {
  overview: LayoutGrid,
  finance: Wallet,
  vehicles: CarFront,
  projects: CircuitBoard,
  nutrition: Soup,
  fitness: Dumbbell,
};

function useActive(): ModuleKey | null {
  const pathname = usePathname();
  return MODULE_KEYS.find((key) => pathname === MODULES[key].href || pathname.startsWith(`${MODULES[key].href}/`)) ?? null;
}

/**
 * Desktop navigation, drawn as a binder's divider tabs: the active tab takes the sheet's colour
 * and overlaps its left edge, so the page reads as the open section.
 */
export function SideNav() {
  const active = useActive();
  return (
    <nav aria-label="Sections">
      <ul className="flex flex-col gap-1">
        {MODULE_KEYS.map((key) => {
          const Icon = ICONS[key];
          const isActive = key === active;
          return (
            <li key={key} style={moduleStyle(key)}>
              <Link
                href={MODULES[key].href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative -mr-px flex items-center gap-3 rounded-l-xl border border-r-0 py-2.5 pl-3 pr-4 text-[15px] transition-colors",
                  isActive
                    ? "border-border bg-sheet font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-sheet/60 hover:text-foreground",
                )}
              >
                <span aria-hidden className={cn("h-6 rounded-full bg-mod transition-all", isActive ? "w-1.5 shadow-[0_0_10px_hsl(var(--mod)/0.7)]" : "w-1 opacity-50 group-hover:opacity-100")} />
                <Icon aria-hidden className={cn("size-[18px] shrink-0", isActive && "text-mod")} />
                {MODULES[key].label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phone navigation: the same tabs along the bottom edge, within thumb reach. */
export function BottomNav() {
  const active = useActive();
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-safe lg:hidden">
      <ul className="mx-auto flex max-w-xl">
        {MODULE_KEYS.map((key) => {
          const Icon = ICONS[key];
          const isActive = key === active;
          return (
            <li key={key} className="min-w-0 flex-1" style={moduleStyle(key)}>
              <Link
                href={MODULES[key].href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative -mt-px flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[11px] leading-none transition-colors focus-visible:ring-offset-0",
                  isActive ? "bg-sheet font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                <span aria-hidden className={cn("absolute inset-x-2 top-0 h-[3px] rounded-b-full bg-mod", !isActive && "opacity-0")} />
                <Icon aria-hidden className={cn("size-5", isActive && "text-mod")} />
                <span className="max-w-full truncate">{MODULES[key].label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
