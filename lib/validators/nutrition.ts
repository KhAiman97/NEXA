import { z } from "zod";
import * as c from "./common";
import type { RowOf } from "./finance";

export const foodInput = z.object({
  name: c.name,
  brand: c.optionalText,
  serving_size: z.number().positive().max(100_000).default(100),
  serving_unit: z.string().trim().min(1).max(20).default("g"),
  calories: c.nonNegNumber.max(100_000).default(0),
  protein_g: c.nonNegNumber.max(10_000).default(0),
  carbs_g: c.nonNegNumber.max(10_000).default(0),
  fat_g: c.nonNegNumber.max(10_000).default(0),
  fiber_g: c.nonNegNumber.nullish(),
  sugar_g: c.nonNegNumber.nullish(),
  sodium_mg: c.nonNegNumber.nullish(),
  is_favorite: z.boolean().default(false),
});

const macro = c.nonNegNumber.max(100_000);
export const foodLogInput = z.object({
  logged_at: c.timestamptz.default(() => new Date().toISOString()),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("snack"),
  /** When set, name and macros are copied from the food × servings unless given explicitly. */
  food_id: c.optionalId,
  name: c.name.optional(),
  servings: z.number().positive().max(1000).default(1),
  calories: macro.optional(),
  protein_g: macro.optional(),
  carbs_g: macro.optional(),
  fat_g: macro.optional(),
  note: c.optionalText,
});

export const nutritionGoalInput = z.object({
  calories: c.posInt.nullish(),
  protein_g: c.nonNegInt.nullish(),
  carbs_g: c.nonNegInt.nullish(),
  fat_g: c.nonNegInt.nullish(),
  water_ml: c.posInt.default(2500),
  caffeine_limit_mg: c.nonNegInt.default(400),
});

export const hydrationInput = z.object({
  logged_at: c.timestamptz.default(() => new Date().toISOString()),
  beverage: z.string().trim().min(1).max(100).default("water"),
  volume_ml: z.number().int().min(1).max(5000),
  caffeine_mg: c.nonNegNumber.max(2000).default(0),
  note: c.optionalText,
});

export const dayParam = z.object({ day: c.date });

export type Food = RowOf<typeof foodInput>;
export type FoodLog = RowOf<typeof foodLogInput> & { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number };
export type NutritionGoal = z.infer<typeof nutritionGoalInput> & { user_id: string };
export type HydrationLog = RowOf<typeof hydrationInput>;

export type DailyNutrition = { user_id: string; day: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; entries: number };
export type DailyHydration = { user_id: string; day: string; total_volume_ml: number; total_caffeine_mg: number; drinks: number };
