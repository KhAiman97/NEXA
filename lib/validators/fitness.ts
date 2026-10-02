import { z } from "zod";
import * as c from "./common";
import { ledgerLink, type RowOf } from "./finance";

const WORKOUT_KINDS = ["strength", "cardio", "run", "cycling", "swim", "walk", "racket", "shooting", "mobility", "other"] as const;
export const RACKET_SPORTS = ["badminton", "tennis", "squash", "padel", "table_tennis", "pickleball"] as const;
const racketSport = z.enum(RACKET_SPORTS);

export const workoutSetInput = z.object({
  exercise: c.name,
  set_no: c.posInt,
  reps: c.nonNegInt.nullish(),
  weight_kg: c.nonNegNumber.max(2000).nullish(),
  duration_s: c.nonNegInt.nullish(),
  notes: c.optionalText,
});

export const workoutInput = z.object({
  performed_at: c.timestamptz.default(() => new Date().toISOString()),
  kind: z.enum(WORKOUT_KINDS).default("other"),
  title: c.name,
  duration_min: c.posInt.nullish(),
  calories_burned: c.nonNegInt.nullish(),
  distance_km: c.nonNegNumber.max(10_000).nullish(),
  avg_heart_rate: z.number().int().min(30).max(250).nullish(),
  perceived_exertion: z.number().int().min(1).max(10).nullish(),
  notes: c.optionalText,
});

export const workoutWithSetsInput = workoutInput.extend({ sets: z.array(workoutSetInput).max(200).default([]) });

export const courtBookingInput = z.object({
  sport: racketSport,
  venue: c.name,
  court_name: c.optionalText,
  starts_at: c.timestamptz,
  ends_at: c.timestamptz,
  cost: c.money.default(0),
  status: z.enum(["booked", "played", "cancelled", "no_show"]).default("booked"),
  booking_ref: c.optionalText,
  notes: c.optionalText,
  record_expense: ledgerLink,
});

export const gameInput = z.object({
  my_score: z.number().int().min(0).max(100),
  opponent_score: z.number().int().min(0).max(100),
});

export const racketMatchInput = z.object({
  sport: racketSport,
  played_at: c.timestamptz.default(() => new Date().toISOString()),
  match_type: z.enum(["singles", "doubles"]).default("singles"),
  opponent: c.optionalText,
  partner: c.optionalText,
  venue: c.optionalText,
  court_booking_id: c.optionalId,
  workout_id: c.optionalId,
  notes: c.optionalText,
  games: z.array(gameInput).max(7).default([]),
});

export const shootingSeriesInput = z.object({
  series_no: c.posInt,
  shots: c.posInt,
  hits: c.nonNegInt.default(0),
  score: c.nonNegNumber.nullish(),
  max_score: c.nonNegNumber.nullish(),
  group_size_mm: c.nonNegNumber.nullish(),
});

export const shootingSessionInput = z.object({
  session_at: c.timestamptz.default(() => new Date().toISOString()),
  discipline: z.enum(["air_rifle", "air_pistol", "rifle", "pistol", "archery", "other"]).default("other"),
  venue: c.optionalText,
  distance_m: z.number().positive().max(2000).nullish(),
  equipment: c.optionalText,
  ammo_type: c.optionalText,
  /** If series are given, shots/hits/score totals are derived from them. */
  total_shots: c.nonNegInt.default(0),
  shots_on_target: c.nonNegInt.default(0),
  total_score: c.nonNegNumber.nullish(),
  max_score: c.nonNegNumber.nullish(),
  avg_group_size_mm: c.nonNegNumber.nullish(),
  ammo_cost: c.money.default(0),
  notes: c.optionalText,
  series: z.array(shootingSeriesInput).max(100).default([]),
  record_expense: ledgerLink,
});

/** "Do this much of one exercise every day", e.g. 20 push-ups. */
export const exerciseGoalInput = z.object({
  name: c.name,
  daily_target: c.posInt,
  unit: z.enum(["reps", "seconds", "minutes"]).default("reps"),
  is_active: z.boolean().default(true),
});

export const exerciseLogInput = z.object({
  goal_id: c.id,
  logged_at: c.timestamptz.default(() => new Date().toISOString()),
  amount: c.posInt,
  note: c.optionalText,
});

export type ExerciseGoal = RowOf<typeof exerciseGoalInput>;
export type ExerciseLog = RowOf<typeof exerciseLogInput>;
export type DailyExercise = { user_id: string; goal_id: string; day: string; total: number; entries: number };

export type Workout = RowOf<typeof workoutInput>;
export type WorkoutSet = RowOf<typeof workoutSetInput> & { workout_id: string };
export type CourtBooking = Omit<RowOf<typeof courtBookingInput>, "record_expense"> & { transaction_id: string | null };
export type RacketMatch = Omit<RowOf<typeof racketMatchInput>, "games">;
export type RacketMatchGame = RowOf<typeof gameInput> & { match_id: string; game_no: number };
export type ShootingSession = Omit<RowOf<typeof shootingSessionInput>, "series" | "record_expense"> & { accuracy_pct: number | null; transaction_id: string | null };
export type ShootingSeries = RowOf<typeof shootingSeriesInput> & { session_id: string };

export type RacketMatchResult = {
  match_id: string;
  user_id: string;
  sport: (typeof RACKET_SPORTS)[number];
  played_at: string;
  match_type: "singles" | "doubles";
  opponent: string | null;
  games_won: number;
  games_lost: number;
  result: "win" | "loss" | "draw" | null;
  points_for: number;
  points_against: number;
};
