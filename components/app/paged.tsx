"use client";

import { Children, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Every list in the app shows this many entries at a time. */
export const PAGE_SIZE = 10;

const STEP = "inline-flex h-9 items-center gap-1 rounded-lg border bg-card px-3 text-sm font-medium transition-colors enabled:hover:border-mod enabled:hover:text-mod disabled:text-muted-foreground/50";

/** Slices rows that are already on the page into pages. The rows themselves are rendered on the server. */
function usePages(children: ReactNode, pageSize: number) {
  const items = Children.toArray(children);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const [wanted, setPage] = useState(1);
  // Deleting the last row of the last page leaves `wanted` past the end.
  const page = Math.min(wanted, pages);
  const first = (page - 1) * pageSize;

  const controls =
    pages > 1 ? (
      <nav aria-label="Pages" className="mt-3 flex items-center justify-between gap-3">
        <button type="button" className={STEP} disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft aria-hidden className="size-4" /> Previous
        </button>
        <p className="figure text-center text-sm text-muted-foreground" aria-live="polite">
          {first + 1}–{Math.min(first + pageSize, items.length)} of {items.length}
        </p>
        <button type="button" className={STEP} disabled={page >= pages} onClick={() => setPage(page + 1)}>
          Next <ChevronRight aria-hidden className="size-4" />
        </button>
      </nav>
    ) : null;

  return { visible: items.slice(first, first + pageSize), controls };
}

/** A list of rows, ten at a time. */
export function RowList({ children, className, pageSize = PAGE_SIZE }: { children: ReactNode; className?: string; pageSize?: number }) {
  const { visible, controls } = usePages(children, pageSize);
  return (
    <div>
      <ul className={cn("overflow-hidden rounded-xl border bg-card", className)}>{visible}</ul>
      {controls}
    </div>
  );
}

/**
 * A table, ten rows at a time. Where its frame is wide enough it is a normal table. On a phone each row
 * becomes a card (see `.stack-table` in globals.css): the first cell is the heading, the other cells sit
 * in columns under their column label, and the row's actions go top right. Nothing scrolls sideways.
 *
 * For that to work a row's first cell must be what the row is, and its actions must be wrapped in RowActions.
 */
export function Table({ head, children, minWidth = "36rem", pageSize = PAGE_SIZE }: { head: { label: string; right?: boolean }[]; children: ReactNode; minWidth?: string; pageSize?: number }) {
  const { visible, controls } = usePages(children, pageSize);
  // Column labels as CSS strings, picked up by each cell's ::before on a phone.
  const labels = Object.fromEntries(head.map((h, i) => [`--l${i + 1}`, JSON.stringify(h.label)]));

  return (
    <div>
      <div className="stack-frame overflow-x-auto rounded-xl border bg-card">
        <table className="stack-table w-full border-collapse text-sm" style={{ "--table-min": minWidth, ...labels } as CSSProperties}>
          <thead>
            <tr className="border-b bg-muted/60">
              {head.map((h, i) => (
                <th key={h.label || i} scope="col" className={cn("eyebrow px-4 py-3 text-muted-foreground", h.right ? "text-right" : "text-left")}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr:last-child]:border-b-0 [&>tr]:border-b">{visible}</tbody>
        </table>
      </div>
      {controls}
    </div>
  );
}
