import { MENU_MEALS, type CatalogueFood } from "./malaysian-foods";

/**
 * Suggestions for the rest of the day, worked out from what has been eaten and drunk against the goals.
 * Plain rules, no guessing: each tip says what is short or over and, where food helps, names dishes from
 * the menu that fit what is left of the day's energy.
 */
export type Tip = {
  tone: "warn" | "info" | "pos";
  title: string;
  detail: string;
  /** Dishes from the menu that would help, with the figure that matters for this tip. */
  picks?: { name: string; note: string }[];
};

export type TipInput = {
  energy: number;
  macros: { protein_g: number; carbs_g: number; fat_g: number };
  goal: {
    calories?: number | null;
    protein_g?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
    water_ml: number;
    caffeine_limit_mg: number;
  } | null;
  water_ml: number;
  caffeine_mg: number;
  /** Local hour, 0 to 23: later in the day a shortfall matters more. */
  hour: number;
};

const round = (n: number) => Math.round(n);
const PICKS = 4;

/** Leanest protein first: the most protein per kcal, among dishes that fit in what is left of the day. */
function proteinPicks(kcalLeft: number | null, menu: CatalogueFood[]) {
  const budget = kcalLeft === null ? Infinity : Math.max(kcalLeft, 250);
  return menu
    .filter((f) => f.protein_g >= 12 && f.calories <= budget)
    .sort((a, b) => b.protein_g / Math.max(b.calories, 1) - a.protein_g / Math.max(a.calories, 1))
    .slice(0, PICKS)
    .map((f) => ({ name: f.name, note: `${f.protein_g} g protein · ${f.calories} kcal` }));
}

function namedPicks(keys: string[], menu: CatalogueFood[], note: (f: CatalogueFood) => string) {
  return keys.flatMap((key) => menu.filter((f) => f.key === key)).map((f) => ({ name: f.name, note: note(f) }));
}

export function nutritionTips(input: TipInput, menu: CatalogueFood[] = MENU_MEALS): Tip[] {
  const { goal, energy, macros, hour } = input;
  if (!goal) {
    return [{ tone: "info", title: "Set your daily goals", detail: "Suggestions compare what you have eaten and drunk today with your goals. Use Set daily goals above." }];
  }

  const tips: Tip[] = [];
  const kcalLeft = goal.calories != null ? goal.calories - energy : null;
  const late = hour >= 18;

  if (kcalLeft !== null && kcalLeft < 0) {
    tips.push({
      tone: "warn",
      title: `Over your energy goal by ${round(-kcalLeft)} kcal`,
      detail: "Keep the rest of today light: vegetables, soup and air kosong.",
      picks: namedPicks(["sup-sayur", "garden-salad", "broccoli", "greek-yogurt"], menu, (f) => `${f.calories} kcal`),
    });
  }

  if (goal.protein_g != null) {
    const need = goal.protein_g - macros.protein_g;
    if (need >= 10) {
      tips.push({
        tone: late ? "warn" : "info",
        title: `Take more protein: ${round(need)} g to go`,
        detail:
          `You have had ${round(macros.protein_g)} g of ${round(goal.protein_g)} g.` +
          (kcalLeft !== null && kcalLeft > 0 ? ` These fit in the ${round(kcalLeft)} kcal you have left:` : " Lean choices:"),
        picks: proteinPicks(kcalLeft, menu),
      });
    } else if (macros.protein_g > 0) {
      tips.push({ tone: "pos", title: "Protein goal reached", detail: `${round(macros.protein_g)} g of ${round(goal.protein_g)} g. Well done.` });
    }
  }

  if (goal.fat_g != null && macros.fat_g > goal.fat_g) {
    tips.push({
      tone: "warn",
      title: `Fat is over your goal by ${round(macros.fat_g - goal.fat_g)} g`,
      detail: "For the rest of today, pick bakar, stim or rebus over goreng.",
      picks: namedPicks(["ayam-bakar", "ikan-bakar", "siakap-stim-limau", "chicken-breast"], menu, (f) => `${f.fat_g} g fat · ${f.protein_g} g protein`),
    });
  }

  if (goal.carbs_g != null && macros.carbs_g > goal.carbs_g) {
    tips.push({
      tone: "warn",
      title: `Carbs are over your goal by ${round(macros.carbs_g - goal.carbs_g)} g`,
      detail: "Go easy on rice, noodles and sweet drinks; fill up on protein and vegetables instead.",
    });
  }

  const short = goal.water_ml - input.water_ml;
  if (short > 0) {
    const glasses = Math.ceil(short / 250);
    tips.push({
      tone: hour >= 15 && input.water_ml < goal.water_ml / 2 ? "warn" : "info",
      title: `Drink ${round(short)} ml more water`,
      detail: `About ${glasses} ${glasses === 1 ? "glass" : "glasses"} of air kosong to reach ${round(goal.water_ml)} ml.`,
    });
  }

  if (input.caffeine_mg >= goal.caffeine_limit_mg) {
    tips.push({ tone: "warn", title: "Caffeine limit reached", detail: "No more coffee or tea today: switch to decaf, like Aiman's Coffee, or air kosong." });
  } else if (input.caffeine_mg >= goal.caffeine_limit_mg * 0.8) {
    tips.push({ tone: "info", title: "Close to your caffeine limit", detail: `${round(goal.caffeine_limit_mg - input.caffeine_mg)} mg left. Decaf or air kosong from here keeps you under it.` });
  }

  if (!tips.some((t) => t.tone !== "pos")) {
    tips.push({ tone: "pos", title: "On track today", detail: "Energy, protein, water and caffeine are all where they should be." });
  }

  // Most urgent first.
  const order = { warn: 0, info: 1, pos: 2 } as const;
  return tips.sort((a, b) => order[a.tone] - order[b.tone]);
}
