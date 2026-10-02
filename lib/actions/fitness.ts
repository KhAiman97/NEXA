"use server";

import { run, parse } from "./run";
import { id, partialOf } from "@/lib/validators/common";
import { courtBookingInput, exerciseGoalInput, exerciseLogInput, racketMatchInput, shootingSessionInput, workoutInput, workoutWithSetsInput } from "@/lib/validators/fitness";
import {
  courtBookings, exerciseGoals, exerciseLogs, logCourtBooking, logRacketMatch, logShootingSession, logWorkout,
  racketMatches, shootingSessions, workouts,
} from "@/lib/services/fitness";

// Bookings and ammo can mirror into the ledger.
const FIT = ["/fitness", "/finance"];

export async function createWorkout(input: unknown) { return run(({ db }) => logWorkout(db, parse(workoutWithSetsInput, input)), FIT); }
export async function updateWorkout(workoutId: unknown, patch: unknown) { return run(({ db }) => workouts.update(db, parse(id, workoutId), parse(partialOf(workoutInput), patch)), FIT); }
export async function deleteWorkout(workoutId: unknown) { return run(({ db }) => workouts.remove(db, parse(id, workoutId)), FIT); }

export async function createCourtBooking(input: unknown) { return run(({ db }) => logCourtBooking(db, parse(courtBookingInput, input)), FIT); }
export async function updateCourtBooking(bookingId: unknown, patch: unknown) { return run(({ db }) => courtBookings.update(db, parse(id, bookingId), parse(partialOf(courtBookingInput.omit({ record_expense: true })), patch)), FIT); }
export async function deleteCourtBooking(bookingId: unknown) { return run(({ db }) => courtBookings.remove(db, parse(id, bookingId)), FIT); }

export async function createRacketMatch(input: unknown) { return run(({ db }) => logRacketMatch(db, parse(racketMatchInput, input)), FIT); }
export async function updateRacketMatch(matchId: unknown, patch: unknown) { return run(({ db }) => racketMatches.update(db, parse(id, matchId), parse(partialOf(racketMatchInput.omit({ games: true })), patch)), FIT); }
export async function deleteRacketMatch(matchId: unknown) { return run(({ db }) => racketMatches.remove(db, parse(id, matchId)), FIT); }

export async function createShootingSession(input: unknown) { return run(({ db }) => logShootingSession(db, parse(shootingSessionInput, input)), FIT); }
export async function updateShootingSession(sessionId: unknown, patch: unknown) { return run(({ db }) => shootingSessions.update(db, parse(id, sessionId), parse(partialOf(shootingSessionInput.omit({ series: true, record_expense: true })), patch)), FIT); }
export async function deleteShootingSession(sessionId: unknown) { return run(({ db }) => shootingSessions.remove(db, parse(id, sessionId)), FIT); }

// Daily exercise goals
const GOALS = ["/fitness", "/dashboard"];
export async function createExerciseGoal(input: unknown) { return run(({ db }) => exerciseGoals.create(db, parse(exerciseGoalInput, input)), GOALS); }
export async function updateExerciseGoal(goalId: unknown, patch: unknown) { return run(({ db }) => exerciseGoals.update(db, parse(id, goalId), parse(partialOf(exerciseGoalInput), patch)), GOALS); }
export async function deleteExerciseGoal(goalId: unknown) { return run(({ db }) => exerciseGoals.remove(db, parse(id, goalId)), GOALS); }
export async function createExerciseLog(input: unknown) { return run(({ db }) => exerciseLogs.create(db, parse(exerciseLogInput, input)), GOALS); }
export async function deleteExerciseLog(logId: unknown) { return run(({ db }) => exerciseLogs.remove(db, parse(id, logId)), GOALS); }
