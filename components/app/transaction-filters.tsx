"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { Option } from "@/lib/app/forms";
import { cn } from "@/lib/utils";

const CONTROL = "h-9 min-w-0 rounded-lg border border-input bg-card px-2.5 text-sm transition-colors focus-visible:border-ring";
// Each dropdown grows to share its row, so a wrapped row is filled edge to edge instead of leaving a gap.
const SELECT = cn(CONTROL, "min-w-[8.5rem] flex-1 truncate");
const SEARCH_DELAY_MS = 350;

/**
 * Filters for the ledger. They live in the URL (`?type=expense&q=petrol`) and are applied by the
 * database, so the count, the totals and the pager all describe the filtered list. Changing a
 * filter goes back to the first page.
 */
export function TransactionFilterBar({ filters, categories, accounts }: { filters: Record<string, string>; categories: Option[]; accounts: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The URL is the source of truth: follow it when it changes underneath (back button, Clear).
  useEffect(() => setSearch(filters.q ?? ""), [filters.q]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const apply = (next: Record<string, string>) => {
    const query = new URLSearchParams(Object.entries(next).filter(([, value]) => value)).toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  const set = (key: string, value: string) => apply({ ...filters, [key]: value });

  const onSearch = (value: string) => {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => set("q", value.trim()), SEARCH_DELAY_MS);
  };

  const active = Object.values(filters).some(Boolean);

  return (
    <div className={cn("mb-3 flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <label className="relative min-w-48 flex-[2]">
        <span className="sr-only">Search transactions</span>
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search by title" maxLength={100} className={cn(CONTROL, "w-full pl-8")} />
      </label>
      <select aria-label="Type" value={filters.type ?? ""} onChange={(event) => set("type", event.target.value)} className={SELECT}>
        <option value="">All types</option>
        <option value="income">Income</option>
        <option value="expense">Spending</option>
      </select>
      {categories.length > 0 && (
        <select aria-label="Category" value={filters.category ?? ""} onChange={(event) => set("category", event.target.value)} className={SELECT}>
          <option value="">All categories</option>
          {categories.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      {accounts.length > 0 && (
        <select aria-label="Account" value={filters.account ?? ""} onChange={(event) => set("account", event.target.value)} className={SELECT}>
          <option value="">All accounts</option>
          {accounts.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      {active && (
        <button type="button" onClick={() => apply({})} aria-label="Clear filters" title="Clear filters" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:border-mod hover:text-mod">
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}
