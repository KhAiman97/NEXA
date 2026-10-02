"use client";

import Link, { useLinkStatus } from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEP = "inline-flex h-9 items-center gap-1 rounded-lg border bg-card px-3 text-sm font-medium transition-colors";

/** Dims its link while the next page is on its way. */
function Label({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={cn("inline-flex items-center gap-1", pending && "animate-pulse opacity-60")}>{children}</span>;
}

function Step({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled className={cn(STEP, "text-muted-foreground/50")}>
        {children}
      </span>
    );
  }
  // scroll={false}: the list stays where it is instead of jumping to the top of the page.
  return (
    <Link href={href} scroll={false} className={cn(STEP, "hover:border-mod hover:text-mod")}>
      <Label>{children}</Label>
    </Link>
  );
}

/**
 * Previous / next for a list paged on the server. The page number lives in the URL (`?page=2`),
 * so the back button and a reload both land on the same page. Page 1 has no parameter.
 */
export function Pager({ page, pages, total, pageSize, path, noun }: { page: number; pages: number; total: number; pageSize: number; path: string; noun: string }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n <= 1 ? path : `${path}?page=${n}`);
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav aria-label={`${noun} pages`} className="mt-3 flex items-center justify-between gap-3">
      <Step href={href(page - 1)} disabled={page <= 1}>
        <ChevronLeft aria-hidden className="size-4" /> Newer
      </Step>
      <p className="figure text-center text-sm text-muted-foreground" aria-live="polite">
        {first}–{last} of {total}
        <span className="hidden sm:inline">
          {" "}
          · page {page} of {pages}
        </span>
      </p>
      <Step href={href(page + 1)} disabled={page >= pages}>
        Older <ChevronRight aria-hidden className="size-4" />
      </Step>
    </nav>
  );
}
