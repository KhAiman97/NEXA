import "server-only";
import type { z } from "zod";
import { createCrud, type Db } from "../crud";
import { fromPostgrest } from "../errors";
import { goalInput, type Goal, type MonthlyGoal, type monthlyGoalInput } from "@/lib/validators/finance";

export const goals = createCrud<Goal, z.infer<typeof goalInput>>({ table: "goals", orderBy: "name", ascending: true });

export async function getMonthlyGoal(db: Db, month: string): Promise<MonthlyGoal | null> {
  const { data, error } = await db.from("monthly_goals").select("*").eq("month", month).maybeSingle();
  if (error) throw fromPostgrest(error);
  return (data as MonthlyGoal | null) ?? null;
}

/** Insert or update the income target / expense limit for a month (unique per user + month). */
export async function setMonthlyGoal(db: Db, input: z.infer<typeof monthlyGoalInput>): Promise<MonthlyGoal> {
  const { data, error } = await db.from("monthly_goals").upsert(input, { onConflict: "user_id,month" }).select().single();
  if (error) throw fromPostgrest(error);
  return data as MonthlyGoal;
}

export async function deleteMonthlyGoal(db: Db, month: string): Promise<void> {
  const { error } = await db.from("monthly_goals").delete().eq("month", month);
  if (error) throw fromPostgrest(error);
}
