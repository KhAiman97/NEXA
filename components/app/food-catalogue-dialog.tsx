"use client";

import type React from "react";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { BookOpen, Check, CupSoda, Search } from "lucide-react";
import type { ActionResult } from "@/lib/actions/run";
import { CATALOGUE_GROUPS, MENU_DRINKS, MENU_MEALS, type CatalogueFood } from "@/lib/app/malaysian-foods";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
type Meal = (typeof MEALS)[number];

/** A sensible default for the time of day the menu is opened. */
function mealForNow(): Meal {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}

/**
 * The built-in Malaysian menu. In "log" mode each dish has a button that records it as a meal now
 * (and saves it to the food library the first time). In "library" mode the button only saves it.
 * In "drinks" mode it is the drink menu: each drink is logged as a drink (fluid, caffeine, calories).
 * Meals and drinks never mix: the meal menu has no drinks and the drink menu has nothing else.
 */
export function FoodCatalogueDialog({
  mode,
  savedNames = [],
  action,
  myFoods = [],
  logSaved,
  addOwn,
}: {
  mode: "log" | "library" | "drinks";
  /** Log mode: the user's own dishes, listed first as "My dishes". */
  myFoods?: CatalogueFood[];
  /** Log mode: logs one of the user's own dishes ({ food_id, meal_type }). */
  logSaved?: (input: unknown) => Promise<ActionResult<unknown>>;
  /** A button to add a dish of your own (an EntryDialog), shown at the top of the menu. */
  addOwn?: React.ReactNode;
  /** Names already in the user's food library, shown as saved. */
  savedNames?: string[];
  action: (input: unknown) => Promise<ActionResult<unknown>>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [meal, setMeal] = useState<Meal>("lunch");
  const [done, setDone] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const saved = useMemo(() => new Set(savedNames.map((n) => n.toLowerCase())), [savedNames]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const mine = mode === "log" ? myFoods : [];
    const menu = mode === "drinks" ? MENU_DRINKS : [...mine, ...MENU_MEALS];
    const matches = q ? menu.filter((f) => f.name.toLowerCase().includes(q) || f.group.toLowerCase().includes(q)) : menu;
    const groups: CatalogueFood["group"][] = mine.length > 0 ? ["My dishes", ...CATALOGUE_GROUPS] : CATALOGUE_GROUPS;
    return groups.map((group) => ({ group, foods: matches.filter((f) => f.group === group) })).filter((g) => g.foods.length > 0);
  }, [query, mode, myFoods]);

  const onOpenChange = (next: boolean) => {
    if (next) {
      setMeal(mealForNow());
      setQuery("");
      setDone({});
      setError(null);
    }
    setOpen(next);
  };

  const run = (item: CatalogueFood) => {
    setBusy(item.key);
    setError(null);
    startTransition(async () => {
      const result =
        item.foodId && logSaved
          ? await logSaved({ food_id: item.foodId, meal_type: meal })
          : await action(mode === "log" ? { key: item.key, meal_type: meal } : { key: item.key });
      setBusy(null);
      if (result.error) setError(`${item.name}: ${result.error.message}`);
      else {
        setDone((d) => ({ ...d, [item.key]: (d[item.key] ?? 0) + 1 }));
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-3 text-sm">
          {mode === "drinks" ? <CupSoda aria-hidden /> : <BookOpen aria-hidden />} {mode === "drinks" ? "Drink menu" : "Malaysian menu"}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92svh] w-[calc(100%-1.5rem)] max-w-xl flex-col gap-0 rounded-2xl bg-sheet p-0 sm:rounded-2xl">
        <DialogHeader className="shrink-0 px-6 pb-4 pr-12 pt-6 text-left">
          <DialogTitle className="font-display text-xl">{mode === "drinks" ? "Drink menu" : "Malaysian menu"}</DialogTitle>
          <DialogDescription>
            {mode === "drinks"
              ? "Pick a drink to add it to today's drinks: it counts toward fluid, caffeine and energy. Figures are for a typical kopitiam glass; edit the entry if yours differs."
              : `${mode === "log" ? "Pick a dish to add it to today's meals." : "Pick dishes to save to your food library."} Figures are typical for one serving; portions vary by stall, so edit a food if yours differs.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-col gap-3 px-6 pb-4">
          {addOwn && <div className="flex justify-end">{addOwn}</div>}
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={mode === "drinks" ? "Search drinks, e.g. teh tarik" : "Search dishes, e.g. nasi lemak"}
              aria-label={mode === "drinks" ? "Search drinks" : "Search dishes"}
              className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-base placeholder:text-muted-foreground focus-visible:border-ring md:text-sm"
            />
          </div>
          {mode === "log" && (
            <div role="radiogroup" aria-label="Meal" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
              {MEALS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={meal === m}
                  onClick={() => setMeal(m)}
                  className={cn("rounded-md px-2 py-1.5 text-sm capitalize transition-colors focus-visible:ring-offset-0", meal === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t px-6 pb-5">
          {groups.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nothing matches &ldquo;{query.trim()}&rdquo;. Use {mode === "drinks" ? "Add drink" : "Add meal"} to type one in yourself.
            </p>
          )}
          {groups.map(({ group, foods }) => (
            <section key={group} aria-label={group}>
              <h3 className="eyebrow sticky top-0 z-10 -mx-6 bg-sheet px-6 pb-2 pt-4 text-muted-foreground">{group}</h3>
              <ul>
                {foods.map((item) => {
                  const count = done[item.key] ?? 0;
                  const isSaved = mode === "library" && (count > 0 || saved.has(item.name.toLowerCase()));
                  return (
                    <li key={item.key} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="figure line-clamp-2 text-xs text-muted-foreground">
                          {mode === "drinks"
                            ? `${item.volume_ml ?? 250} ml · ${item.calories} kcal${item.caffeine_mg ? ` · ${item.caffeine_mg} mg caffeine` : ""}`
                            : `${item.calories} kcal · P ${item.protein_g} · C ${item.carbs_g} · F ${item.fat_g} g · ${item.serving_size} ${item.serving_unit}`}
                        </p>
                      </div>
                      {isSaved ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                          <Check aria-hidden className="size-4" /> Saved
                        </span>
                      ) : (
                        <Button type="button" size="sm" variant={count > 0 ? "outline" : "secondary"} disabled={busy !== null} onClick={() => run(item)} className="h-8 shrink-0">
                          {busy === item.key ? "Saving…" : mode === "library" ? "Save" : count > 0 ? `Logged ×${count}` : mode === "drinks" ? "Log drink" : "Log meal"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {error && (
          <p role="alert" className="mx-6 my-3 shrink-0 rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-sm text-neg">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
