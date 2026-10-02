import "server-only";
import type { z } from "zod";
import { createCrud, selectView, type Db } from "../crud";
import { fromPostgrest } from "../errors";
import { withLinkedExpense } from "../finance/transactions";
import {
  courtBookingInput,
  exerciseGoalInput,
  exerciseLogInput,
  racketMatchInput,
  shootingSessionInput,
  workoutInput,
  workoutWithSetsInput,
  type CourtBooking,
  type DailyExercise,
  type ExerciseGoal,
  type ExerciseLog,
  type RacketMatch,
  type RacketMatchGame,
  type RacketMatchResult,
  type ShootingSeries,
  type ShootingSession,
  type Workout,
  type WorkoutSet,
} from "@/lib/validators/fitness";

type Strip<T> = Omit<T, "id" | "user_id" | "created_at" | "updated_at">;

export const workouts = createCrud<Workout, z.infer<typeof workoutInput>>({ table: "workouts", orderBy: "performed_at" });
export const courtBookings = createCrud<CourtBooking, Strip<CourtBooking>>({ table: "court_bookings", orderBy: "starts_at" });
export const racketMatches = createCrud<RacketMatch, Strip<RacketMatch>>({ table: "racket_matches", orderBy: "played_at" });
// accuracy_pct is a generated column: readable, never writable.
export const shootingSessions = createCrud<ShootingSession, Strip<Omit<ShootingSession, "accuracy_pct">>>({ table: "shooting_sessions", orderBy: "session_at" });

/** Delete a parent row we just created when its children fail to insert. */
async function discard(db: Db, table: string, id: string): Promise<void> {
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) console.error(`[fitness] rollback of ${table}/${id} failed`, error.code);
}

// ------------------------------------------------------------------ workouts

export async function logWorkout(db: Db, input: z.infer<typeof workoutWithSetsInput>): Promise<Workout & { sets: WorkoutSet[] }> {
  const { sets, ...workout } = input;
  const created = await workouts.create(db, workout);
  if (sets.length === 0) return { ...created, sets: [] };

  const { data, error } = await db.from("workout_sets").insert(sets.map((s) => ({ ...s, workout_id: created.id }))).select();
  if (error) {
    await discard(db, "workouts", created.id);
    throw fromPostgrest(error);
  }
  return { ...created, sets: (data ?? []) as WorkoutSet[] };
}

export async function getWorkout(db: Db, id: string): Promise<Workout & { sets: WorkoutSet[] }> {
  const [workout, setsResult] = await Promise.all([
    workouts.get(db, id),
    db.from("workout_sets").select("*").eq("workout_id", id).order("exercise").order("set_no"),
  ]);
  if (setsResult.error) throw fromPostgrest(setsResult.error);
  return { ...workout, sets: (setsResult.data ?? []) as WorkoutSet[] };
}

// ------------------------------------------------------------- racket sports

export async function logCourtBooking(db: Db, input: z.infer<typeof courtBookingInput>): Promise<CourtBooking> {
  const { record_expense, ...booking } = input;
  return withLinkedExpense(
    db,
    { title: `${booking.sport.replace(/_/g, " ")} court – ${booking.venue}`, amount: booking.cost, occurredAt: booking.starts_at, link: record_expense },
    (transactionId) => courtBookings.create(db, { ...booking, transaction_id: transactionId }),
  );
}

/** Log a match together with its per-game scores. */
export async function logRacketMatch(db: Db, input: z.infer<typeof racketMatchInput>): Promise<RacketMatch & { games: RacketMatchGame[] }> {
  const { games, ...match } = input;
  const created = await racketMatches.create(db, match);
  if (games.length === 0) return { ...created, games: [] };

  const { data, error } = await db
    .from("racket_match_games")
    .insert(games.map((g, i) => ({ ...g, match_id: created.id, game_no: i + 1 })))
    .select();
  if (error) {
    await discard(db, "racket_matches", created.id);
    throw fromPostgrest(error);
  }
  return { ...created, games: (data ?? []) as RacketMatchGame[] };
}

export function listMatchResults(db: Db, sport?: RacketMatchResult["sport"], limit = 50) {
  return selectView<RacketMatchResult>(db, "racket_match_results", { filter: { sport }, orderBy: "played_at", ascending: false, limit });
}

export type RacketStats = { played: number; wins: number; losses: number; draws: number; winRatePct: number; pointsFor: number; pointsAgainst: number };

export async function getRacketStats(db: Db, sport?: RacketMatchResult["sport"]): Promise<RacketStats> {
  const results = (await listMatchResults(db, sport, 500)).filter((r) => r.result !== null);
  const wins = results.filter((r) => r.result === "win").length;
  const losses = results.filter((r) => r.result === "loss").length;
  const played = results.length;
  return {
    played,
    wins,
    losses,
    draws: played - wins - losses,
    winRatePct: played ? Math.round((wins / played) * 1000) / 10 : 0,
    pointsFor: results.reduce((s, r) => s + Number(r.points_for), 0),
    pointsAgainst: results.reduce((s, r) => s + Number(r.points_against), 0),
  };
}

// ------------------------------------------------------------ target sports

/**
 * Log a shooting session. When series are supplied, shots / hits / score totals are derived from
 * them so the session row can never disagree with its breakdown.
 */
export async function logShootingSession(db: Db, input: z.infer<typeof shootingSessionInput>): Promise<ShootingSession & { series: ShootingSeries[] }> {
  const { series, record_expense, ...session } = input;

  if (series.length > 0) {
    session.total_shots = series.reduce((s, x) => s + x.shots, 0);
    session.shots_on_target = series.reduce((s, x) => s + x.hits, 0);
    if (series.every((x) => x.score != null)) session.total_score = series.reduce((s, x) => s + (x.score ?? 0), 0);
    if (series.every((x) => x.max_score != null)) session.max_score = series.reduce((s, x) => s + (x.max_score ?? 0), 0);
  }

  return withLinkedExpense(
    db,
    {
      title: `Range session${session.venue ? ` – ${session.venue}` : ""}`,
      amount: session.ammo_cost,
      occurredAt: session.session_at,
      link: record_expense,
    },
    async (transactionId) => {
      const created = await shootingSessions.create(db, { ...session, transaction_id: transactionId });
      if (series.length === 0) return { ...created, series: [] };

      const { data, error } = await db.from("shooting_series").insert(series.map((s) => ({ ...s, session_id: created.id }))).select();
      if (error) {
        await discard(db, "shooting_sessions", created.id);
        throw fromPostgrest(error);
      }
      return { ...created, series: (data ?? []) as ShootingSeries[] };
    },
  );
}

export type ShootingTrendPoint = { session_at: string; discipline: ShootingSession["discipline"]; total_shots: number; accuracy_pct: number | null; score_pct: number | null };

/** Accuracy and score % per session, oldest first, for charting. */
export async function getShootingTrend(db: Db, discipline?: ShootingSession["discipline"], limit = 60): Promise<ShootingTrendPoint[]> {
  const sessions = await shootingSessions.list(db, { filter: { discipline }, limit });
  return sessions
    .map((s) => ({
      session_at: s.session_at,
      discipline: s.discipline,
      total_shots: s.total_shots,
      accuracy_pct: s.accuracy_pct != null ? Number(s.accuracy_pct) : null,
      score_pct: s.total_score != null && s.max_score ? Math.round((Number(s.total_score) / Number(s.max_score)) * 1000) / 10 : null,
    }))
    .reverse();
}

// -------------------------------------------------------------- daily goals

export const exerciseGoals = createCrud<ExerciseGoal, z.infer<typeof exerciseGoalInput>>({ table: "exercise_goals", orderBy: "created_at", ascending: true });
export const exerciseLogs = createCrud<ExerciseLog, z.infer<typeof exerciseLogInput>>({ table: "exercise_logs", orderBy: "logged_at" });

/** Per-goal totals for each local day between two dates (inclusive). Days with nothing logged have no row. */
export async function listDailyExercise(db: Db, fromDay: string, toDay: string): Promise<DailyExercise[]> {
  const { data, error } = await db.from("daily_exercise").select("*").gte("day", fromDay).lte("day", toDay);
  if (error) throw fromPostgrest(error);
  return (data ?? []) as DailyExercise[];
}
