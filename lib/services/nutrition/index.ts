import "server-only";
import type { z } from "zod";
import { createCrud, type Db } from "../crud";
import { fromPostgrest, ServiceError } from "../errors";
import { callBundle } from "../bundle";
import { zonedDayRange } from "@/lib/utils/time";
import {
  foodInput,
  foodLogInput,
  hydrationInput,
  nutritionGoalInput,
  type DailyHydration,
  type DailyNutrition,
  type Food,
  type FoodLog,
  type HydrationLog,
  type NutritionGoal,
} from "@/lib/validators/nutrition";

export const foods = createCrud<Food, z.infer<typeof foodInput>>({ table: "foods", orderBy: "name", ascending: true });
export const foodLogs = createCrud<FoodLog, Omit<FoodLog, "id" | "user_id" | "created_at" | "updated_at">>({ table: "food_logs", orderBy: "logged_at" });
export const hydrationLogs = createCrud<HydrationLog, z.infer<typeof hydrationInput>>({ table: "hydration_logs", orderBy: "logged_at" });

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Log food. With food_id, name and macros come from the library food × servings unless given
 * explicitly. Macros are stored on the log so later edits to the food don't rewrite history.
 */
export async function logFood(db: Db, input: z.infer<typeof foodLogInput>): Promise<FoodLog> {
  const { food_id, name, calories, protein_g, carbs_g, fat_g, servings, ...rest } = input;

  let base: Food | null = null;
  if (food_id) base = await foods.get(db, food_id);

  const resolvedName = name ?? base?.name;
  if (!resolvedName) throw new ServiceError("validation_error", "Provide a name or pick a food from your library.");

  return foodLogs.create(db, {
    ...rest,
    food_id: food_id ?? null,
    name: resolvedName,
    servings,
    calories: calories ?? round2((base?.calories ?? 0) * servings),
    protein_g: protein_g ?? round2((base?.protein_g ?? 0) * servings),
    carbs_g: carbs_g ?? round2((base?.carbs_g ?? 0) * servings),
    fat_g: fat_g ?? round2((base?.fat_g ?? 0) * servings),
  });
}

export async function getNutritionGoal(db: Db): Promise<NutritionGoal | null> {
  const { data, error } = await db.from("nutrition_goals").select("*").maybeSingle();
  if (error) throw fromPostgrest(error);
  return (data as NutritionGoal | null) ?? null;
}

export async function setNutritionGoal(db: Db, input: z.infer<typeof nutritionGoalInput>): Promise<NutritionGoal> {
  const { data, error } = await db.from("nutrition_goals").upsert(input, { onConflict: "user_id" }).select().single();
  if (error) throw fromPostgrest(error);
  return data as NutritionGoal;
}

export type DaySummary = {
  day: string;
  nutrition: Omit<DailyNutrition, "user_id" | "day"> | null;
  hydration: Omit<DailyHydration, "user_id" | "day"> | null;
  /** Energy from meals and drinks together, in kcal. */
  energy: number;
  goal: NutritionGoal | null;
  /** Remaining headroom against goals (null when no goal is set). */
  remaining: { calories: number | null; water_ml: number | null; caffeine_mg: number | null };
  foodLogs: FoodLog[];
  drinks: HydrationLog[];
};

/** What the nutrition_day RPC returns: the day's two total rows, the goal, and the raw entries newest first. */
export type DayParts = {
  nutrition: DailyNutrition | null;
  hydration: DailyHydration | null;
  goal: NutritionGoal | null;
  food_logs: FoodLog[];
  drinks: HydrationLog[];
};

export function toDaySummary(day: string, parts: DayParts): DaySummary {
  const { nutrition: n, hydration: h, goal } = parts;
  const energy = Number(n?.calories ?? 0) + Number(h?.total_calories ?? 0);
  return {
    day,
    energy,
    nutrition: n && { calories: Number(n.calories), protein_g: Number(n.protein_g), carbs_g: Number(n.carbs_g), fat_g: Number(n.fat_g), entries: n.entries },
    hydration: h && { total_volume_ml: Number(h.total_volume_ml), total_caffeine_mg: Number(h.total_caffeine_mg), drinks: h.drinks, total_calories: Number(h.total_calories ?? 0) },
    goal,
    remaining: {
      calories: goal?.calories != null ? goal.calories - energy : null,
      water_ml: goal ? goal.water_ml - Number(h?.total_volume_ml ?? 0) : null,
      caffeine_mg: goal ? goal.caffeine_limit_mg - Number(h?.total_caffeine_mg ?? 0) : null,
    },
    foodLogs: parts.food_logs,
    drinks: parts.drinks,
  };
}

/** Everything for one local day: macros, fluid, caffeine and goal headroom, plus the raw entries. One round trip. */
export async function getDaySummary(db: Db, day: string, timezone: string): Promise<DaySummary> {
  const { from, to } = zonedDayRange(day, timezone);
  return toDaySummary(day, await callBundle<DayParts>(db, "nutrition_day", { p_day: day, p_from: from, p_to: to }));
}

export type NutritionPage = { summary: DaySummary; trend: DailyHydration[]; foods: Food[] };

/** Everything the Nutrition page shows, in one round trip (the nutrition_bundle RPC). */
export async function loadNutritionPage(db: Db, day: string, timezone: string, trendFrom: string): Promise<NutritionPage> {
  const { from, to } = zonedDayRange(day, timezone);
  const bundle = await callBundle<{ day: DayParts; trend: DailyHydration[]; foods: Food[] }>(db, "nutrition_bundle", {
    p_day: day,
    p_from: from,
    p_to: to,
    p_trend_from: trendFrom,
  });
  return { summary: toDaySummary(day, bundle.day), trend: bundle.trend, foods: bundle.foods };
}

/** Daily fluid + caffeine trend between two local dates (inclusive). */
export async function listHydrationTrend(db: Db, fromDay: string, toDay: string): Promise<DailyHydration[]> {
  const { data, error } = await db.from("daily_hydration").select("*").gte("day", fromDay).lte("day", toDay).order("day", { ascending: true });
  if (error) throw fromPostgrest(error);
  return (data ?? []) as DailyHydration[];
}
