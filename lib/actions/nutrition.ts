"use server";

import { z } from "zod";
import { run, parse } from "./run";
import { MALAYSIAN_FOODS } from "@/lib/app/malaysian-foods";
import type { Db } from "@/lib/services/crud";
import { ServiceError } from "@/lib/services/errors";
import { id, partialOf } from "@/lib/validators/common";
import { foodInput, foodLogInput, hydrationInput, nutritionGoalInput } from "@/lib/validators/nutrition";
import { foodLogs, foods, hydrationLogs, logFood, setNutritionGoal } from "@/lib/services/nutrition";

const N = ["/nutrition"];

export async function createFood(input: unknown) { return run(({ db }) => foods.create(db, parse(foodInput, input)), N); }
export async function updateFood(foodId: unknown, patch: unknown) { return run(({ db }) => foods.update(db, parse(id, foodId), parse(partialOf(foodInput), patch)), N); }
export async function deleteFood(foodId: unknown) { return run(({ db }) => foods.remove(db, parse(id, foodId)), N); }

export async function createFoodLog(input: unknown) { return run(({ db }) => logFood(db, parse(foodLogInput, input)), N); }
export async function updateFoodLog(logId: unknown, patch: unknown) { return run(({ db }) => foodLogs.update(db, parse(id, logId), parse(partialOf(foodLogInput), patch)), N); }
export async function deleteFoodLog(logId: unknown) { return run(({ db }) => foodLogs.remove(db, parse(id, logId)), N); }

export async function createHydrationLog(input: unknown) { return run(({ db }) => hydrationLogs.create(db, parse(hydrationInput, input)), N); }
export async function updateHydrationLog(logId: unknown, patch: unknown) { return run(({ db }) => hydrationLogs.update(db, parse(id, logId), parse(partialOf(hydrationInput), patch)), N); }
export async function deleteHydrationLog(logId: unknown) { return run(({ db }) => hydrationLogs.remove(db, parse(id, logId)), N); }

export async function saveNutritionGoal(input: unknown) { return run(({ db }) => setNutritionGoal(db, parse(nutritionGoalInput, input)), N); }

// Built-in Malaysian menu (lib/app/malaysian-foods.ts)
const menuItem = z.object({ key: z.string().max(60) });
const menuMeal = menuItem.extend({ meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]) });

/** The library copy of a menu dish, created the first time it is used. */
async function ensureMenuFood(db: Db, key: string) {
  const item = MALAYSIAN_FOODS.find((f) => f.key === key);
  if (!item) throw new ServiceError("not_found", "That dish is not on the menu.");
  const [existing] = await foods.list(db, { filter: { name: item.name }, limit: 1 });
  if (existing) return existing;
  return foods.create(
    db,
    parse(foodInput, { name: item.name, serving_size: item.serving_size, serving_unit: item.serving_unit, calories: item.calories, protein_g: item.protein_g, carbs_g: item.carbs_g, fat_g: item.fat_g }),
  );
}

export async function saveMenuFood(input: unknown) { return run(({ db }) => ensureMenuFood(db, parse(menuItem, input).key), N); }

/** Log one serving of a menu dish as a meal now, saving it to the library first if needed. */
export async function logMenuFood(input: unknown) {
  return run(async ({ db }) => {
    const { key, meal_type } = parse(menuMeal, input);
    const saved = await ensureMenuFood(db, key);
    return logFood(db, parse(foodLogInput, { food_id: saved.id, meal_type }));
  }, [...N, "/dashboard"]);
}
