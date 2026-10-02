import type { CSSProperties } from "react";

/** The app's sections. Each one owns a colour, used for its sidebar tab and everything on its page. */
export const MODULES = {
  overview: { label: "Overview", eyebrow: "Everything at a glance", href: "/dashboard", cssVar: "--mod-overview" },
  finance: { label: "Finance", eyebrow: "Finance & wealth", href: "/finance", cssVar: "--mod-finance" },
  vehicles: { label: "Vehicles", eyebrow: "Vehicle & logistics", href: "/vehicles", cssVar: "--mod-vehicles" },
  fitness: { label: "Fitness", eyebrow: "Fitness & sports", href: "/fitness", cssVar: "--mod-fitness" },
  nutrition: { label: "Nutrition", eyebrow: "Nutrition & hydration", href: "/nutrition", cssVar: "--mod-nutrition" },
  projects: { label: "Projects", eyebrow: "Projects & inventory", href: "/projects", cssVar: "--mod-projects" },
} as const;

export type ModuleKey = keyof typeof MODULES;

export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

/** Inline style that points `--mod` (and so every `*-mod` utility) at one module's colour. */
export function moduleStyle(key: ModuleKey): CSSProperties {
  return { "--mod": `var(${MODULES[key].cssVar})` } as CSSProperties;
}
