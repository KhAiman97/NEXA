import "server-only";
import type { z } from "zod";
import { createCrud, selectView, type Db } from "../crud";
import { fromPostgrest, ServiceError } from "../errors";
import { getProfile } from "../profile";
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
  goal: NutritionGoal | null;
  /** Remaining headroom against goals (null when no goal is set). */
  remaining: { calories: number | null; water_ml: number | null; caffeine_mg: number | null };
  foodLogs: FoodLog[];
  drinks: HydrationLog[];
};

/** Everything for one local day: macros, fluid, caffeine and goal headroom, plus the raw entries. */
export async function getDaySummary(db: Db, userId: string, day: string): Promise<DaySummary> {
  const profile = await getProfile(db, userId);
  const { from, to } = zonedDayRange(day, profile.timezone);

  const [nutrition, hydration, goal, foodRows, drinkRows] = await Promise.all([
    selectView<DailyNutrition>(db, "daily_nutrition", { filter: { day }, limit: 1 }),
    selectView<DailyHydration>(db, "daily_hydration", { filter: { day }, limit: 1 }),
    getNutritionGoal(db),
    foodLogs.list(db, { range: { column: "logged_at", from, to }, limit: 500 }),
    hydrationLogs.list(db, { range: { column: "logged_at", from, to }, limit: 500 }),
  ]);

  const n = nutrition[0] ?? null;
  const h = hydration[0] ?? null;
  return {
    day,
    nutrition: n && { calories: Number(n.calories), protein_g: Number(n.protein_g), carbs_g: Number(n.carbs_g), fat_g: Number(n.fat_g), entries: n.entries },
    hydration: h && { total_volume_ml: Number(h.total_volume_ml), total_caffeine_mg: Number(h.total_caffeine_mg), drinks: h.drinks },
    goal,
    remaining: {
      calories: goal?.calories != null ? goal.calories - Number(n?.calories ?? 0) : null,
      water_ml: goal ? goal.water_ml - Number(h?.total_volume_ml ?? 0) : null,
      caffeine_mg: goal ? goal.caffeine_limit_mg - Number(h?.total_caffeine_mg ?? 0) : null,
    },
    foodLogs: foodRows,
    drinks: drinkRows,
  };
}

/** Daily fluid + caffeine trend between two local dates (inclusive). */
export async function listHydrationTrend(db: Db, fromDay: string, toDay: string): Promise<DailyHydration[]> {
  const { data, error } = await db.from("daily_hydration").select("*").gte("day", fromDay).lte("day", toDay).order("day", { ascending: true });
  if (error) throw fromPostgrest(error);
  return (data ?? []) as DailyHydration[];
}
