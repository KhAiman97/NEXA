import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MODULES, moduleStyle, type ModuleKey } from "@/lib/app/modules";

/** Page frame: tints everything inside with the module's colour and renders the page heading. */
export function ModulePage({ module, title, lede, children }: { module: ModuleKey; title: string; lede?: string; children: ReactNode }) {
  return (
    <div style={moduleStyle(module)} className="relative isolate">
      {/* Ambient glow in the module's colour, behind the heading. */}
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-32 -z-10 h-72 w-[40rem] max-w-full rounded-full bg-mod/[0.13] blur-3xl" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-mod shadow-[0_0_18px_hsl(var(--mod)/0.7)]" />
      <header className="px-5 pt-9 sm:px-8 lg:px-10 lg:pt-12">
        <p className="eyebrow text-mod">{MODULES[module].eyebrow}</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {lede && <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">{lede}</p>}
      </header>
      <div className="flex flex-col gap-12 px-5 pb-10 pt-8 sm:px-8 lg:px-10 lg:pb-14">{children}</div>
    </div>
  );
}

export function Section({ id, title, hint, aside, children }: { id: string; title: string; hint?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 lg:scroll-mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h2 id={`${id}-title`} className="font-display text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
        </div>
        {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** `beam` adds a light travelling around the border; keep it to one panel per page. */
export function Panel({ className, beam = false, children }: { className?: string; beam?: boolean; children: ReactNode }) {
  return <div className={cn("rounded-xl border bg-card", beam && "beam", className)}>{children}</div>;
}

/** Circular progress toward a target. Green once reached; red when `limit` is set and the value passes it. */
export function ProgressRing({
  value,
  max,
  size = 72,
  stroke = 7,
  limit = false,
  label,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  limit?: boolean;
  label: string;
  children?: ReactNode;
}) {
  const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const over = limit && max > 0 && value > max;
  const tone = over ? "stroke-neg" : !limit && share >= 1 ? "stroke-pos" : "stroke-mod";
  return (
    <div role="img" aria-label={label} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - share)}
          style={{ "--ring-from": length } as CSSProperties}
          className={cn("ring-fill", tone)}
        />
      </svg>
      <span className="figure absolute inset-0 flex items-center justify-center text-xs font-medium">{children ?? `${Math.round(share * 100)}%`}</span>
    </div>
  );
}

/** A labelled number. `tone` colours the value. */
export function Figure({
  label,
  value,
  hint,
  tone,
  size = "md",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "pos" | "neg" | "mod";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-display font-semibold tabular-nums tracking-tight",
          size === "lg" ? "text-3xl sm:text-4xl" : size === "sm" ? "text-lg" : "text-2xl",
          tone === "pos" && "text-pos",
          tone === "neg" && "text-neg",
          tone === "mod" && "text-mod",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Progress toward a target. Turns red once `value` passes `max` when `limit` is set. */
export function Meter({ value, max, limit = false, tone = "mod", label, className }: { value: number; max: number; limit?: boolean; tone?: "mod" | "pos" | "neg" | "ink"; label: string; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const over = limit && max > 0 && value > max;
  const fill = over ? "bg-neg" : tone === "pos" ? "bg-pos" : tone === "neg" ? "bg-neg" : tone === "ink" ? "bg-foreground" : "bg-mod";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className={cn("meter-fill h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

const PILL_TONES = {
  neutral: "border-border bg-muted text-muted-foreground",
  mod: "border-mod/30 bg-mod/10 text-mod",
  pos: "border-pos/30 bg-pos/10 text-pos",
  neg: "border-neg/30 bg-neg/10 text-neg",
  warn: "border-warn/30 bg-warn/10 text-warn",
} as const;

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof PILL_TONES; children: ReactNode }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", PILL_TONES[tone])}>{children}</span>;
}

/** What to show when a list has nothing in it yet. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed px-5 py-8 text-center">
      <p className="font-medium">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

/**
 * A list row. From tablet width up it is one line: what it is on the left, the figure and the actions on the right.
 * On a phone it is two lines, so the text is not squeezed beside the figure and the buttons:
 * title and figure first, then the details and the actions. Nothing scrolls sideways.
 */
export function Row({ title, meta, value, sub, lead, actions }: { title: ReactNode; meta?: ReactNode; value?: ReactNode; sub?: ReactNode; lead?: ReactNode; actions?: ReactNode }) {
  const figure = Boolean(value || sub);
  // Phone grid rows: a status pill, when there is one, sits on its own line above the title.
  const [first, second] = lead ? ["row-start-2", "row-start-3"] : ["row-start-1", "row-start-2"];
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b px-4 py-3 last:border-b-0 sm:flex">
      {lead && <div className="col-span-2 row-start-1 justify-self-start sm:shrink-0">{lead}</div>}
      <div className="contents sm:block sm:min-w-0 sm:flex-1">
        <p className={cn("col-start-1 line-clamp-2 min-w-0 break-words font-medium sm:line-clamp-1", first, !figure && "col-span-2")}>{title}</p>
        {meta && <p className={cn("col-start-1 line-clamp-2 min-w-0 break-words text-sm text-muted-foreground sm:mt-0.5 sm:line-clamp-1", second, !actions && "col-span-2")}>{meta}</p>}
      </div>
      {figure && (
        <div className={cn("col-start-2 shrink-0 text-right", first)}>
          {value && <p className="figure text-sm font-medium">{value}</p>}
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
      )}
      {actions && <div className={cn("col-start-2 flex shrink-0 items-center justify-end", meta || figure ? second : first)}>{actions}</div>}
    </li>
  );
}

/** Edit and delete controls at the end of a row, card header or table row. */
export function RowActions({ children }: { children: ReactNode }) {
  // `row-actions` is how a table row finds its actions cell when it turns into a card on a phone.
  return <div className="row-actions flex shrink-0 items-center justify-end">{children}</div>;
}

// Lists and tables page themselves ten rows at a time, which needs state: they live in paged.tsx.
export { PAGE_SIZE, RowList, Table } from "./paged";

export function Td({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", right && "figure text-right", className)}>{children}</td>;
}
