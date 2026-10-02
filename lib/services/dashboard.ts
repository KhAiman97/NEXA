import "server-only";
import type { Db } from "./crud";
import { callBundle } from "./bundle";
import { addDays } from "@/lib/format";
import { monthOf, zonedDayRange } from "@/lib/utils/time";
import type { Subscription } from "@/lib/validators/finance";
import type { CourtBooking, DailyExercise, ExerciseGoal, Workout } from "@/lib/validators/fitness";
import type { InventoryItem } from "@/lib/validators/projects";
import type { VehicleRunningCost } from "@/lib/validators/vehicles";
import { toOverview, type Overview } from "./finance/overview";
import { summarizeRows, type SubscriptionSummary } from "./finance/subscriptions";
import { toDaySummary, type DayParts, type DaySummary } from "./nutrition";
import type { ProjectCostSummary } from "./projects";

type DashboardBundle = {
  overview: Record<string, unknown> | null;
  active_subscriptions: Subscription[];
  running_costs: VehicleRunningCost[];
  project_costs: ProjectCostSummary[];
  low_stock: InventoryItem[];
  day: DayParts;
  recent_workouts: Workout[];
  upcoming_bookings: CourtBooking[];
  exercise_goals: ExerciseGoal[];
  exercise_today: DailyExercise[];
};

export type Dashboard = {
  overview: Overview;
  subscriptions: SubscriptionSummary;
  runningCosts: VehicleRunningCost[];
  projectCosts: ProjectCostSummary[];
  /** Items at or below their reorder level, not sold or broken (filtered in the database). */
  lowStock: InventoryItem[];
  day: DaySummary;
  /** Workouts in the last seven local days, newest first. */
  recentWorkouts: Workout[];
  /** Booked court sessions from today on, latest first. */
  upcoming: CourtBooking[];
  goals: ExerciseGoal[];
  goalTotals: DailyExercise[];
};

/** Everything the Overview page shows, in one round trip (the dashboard_bundle RPC). */
export async function loadDashboard(db: Db, today: string, timezone: string): Promise<Dashboard> {
  const month = monthOf(today);
  const day = zonedDayRange(today, timezone);
  const bundle = await callBundle<DashboardBundle>(db, "dashboard_bundle", {
    p_month: month,
    p_today: today,
    p_day_from: day.from,
    p_day_to: day.to,
    p_week_start: zonedDayRange(addDays(today, -6), timezone).from,
  });

  return {
    overview: toOverview(month, bundle.overview),
    subscriptions: summarizeRows(bundle.active_subscriptions),
    runningCosts: bundle.running_costs,
    projectCosts: bundle.project_costs,
    lowStock: bundle.low_stock,
    day: toDaySummary(today, bundle.day),
    recentWorkouts: bundle.recent_workouts,
    upcoming: bundle.upcoming_bookings,
    goals: bundle.exercise_goals,
    goalTotals: bundle.exercise_today,
  };
}
