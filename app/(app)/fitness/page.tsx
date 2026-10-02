import { Suspense } from "react";
import { getSession } from "@/lib/app/session";
import { courtBookingFields, exerciseGoalFields, exerciseLogFields, racketMatchFields, shootingFields, toOptions, workoutFields } from "@/lib/app/forms";
import { addDays, date, dateTime, day, label, money, num, time } from "@/lib/format";
import { zonedDayRange } from "@/lib/utils/time";
import {
  createExerciseGoal,
  createExerciseLog,
  deleteExerciseGoal,
  deleteExerciseLog,
  updateExerciseGoal,
} from "@/lib/actions/fitness";
import { createCourtBooking, createRacketMatch, createShootingSession, createWorkout, deleteCourtBooking, deleteRacketMatch, deleteShootingSession, deleteWorkout, updateCourtBooking, updateRacketMatch, updateShootingSession, updateWorkout } from "@/lib/actions/fitness";
import { loadFitnessPage } from "@/lib/services/fitness";
import type { CourtBooking } from "@/lib/validators/fitness";
import { TrendChart } from "@/components/app/charts";
import { DeleteButton } from "@/components/app/delete-button";
import { EntryDialog } from "@/components/app/entry-dialog";
import { LogoLoader } from "@/components/app/logo";
import { ModuleTabs } from "@/components/app/module-tabs";
import { QuickLogButton } from "@/components/app/quick-log-button";
import { RowActions, Empty, Figure, ModulePage, ProgressRing, Panel, Pill, Row, RowList, Section, Table, Td } from "@/components/app/ui";

export const metadata = { title: "Fitness" };

const BOOKING_TONE: Record<CourtBooking["status"], "mod" | "pos" | "neutral" | "neg"> = {
  booked: "mod",
  played: "pos",
  cancelled: "neutral",
  no_show: "neg",
};

const WEEK = 7;
const QUICK_AMOUNTS = { reps: [5, 10], seconds: [15, 30], minutes: [5, 10] } as const;

async function FitnessContent() {
  const { db, currency, timezone, today } = await getSession();
  const weekStart = addDays(today, -(WEEK - 1));
  const todayRange = zonedDayRange(today, timezone);

  const {
    workouts: workoutRows, stats, results, bookings, sessions, shootingTrend, matches: matchRecords, goals: goalRows, daily: dailyRows, todayLogs,
  } = await loadFitnessPage(db, today, todayRange, addDays(today, -60));

  const matchRecord = new Map(matchRecords.map((m) => [m.id, m]));

  const scoreTrend = shootingTrend.filter((p) => p.score_pct != null).map((p) => ({ at: date(p.session_at, timezone), value: Number(p.score_pct) }));

  // day -> total, per goal
  const totals = new Map<string, Map<string, number>>();
  for (const row of dailyRows) {
    if (!totals.has(row.goal_id)) totals.set(row.goal_id, new Map());
    totals.get(row.goal_id)!.set(row.day.slice(0, 10), Number(row.total));
  }
  const goalName = new Map(goalRows.map((g) => [g.id, g]));
  const activeGoals = goalRows.filter((g) => g.is_active);
  const pausedGoals = goalRows.filter((g) => !g.is_active);
  const doneToday = activeGoals.filter((g) => (totals.get(g.id)?.get(today) ?? 0) >= g.daily_target).length;

  /** Days in a row the target was met, ending today (or yesterday while today is still open). */
  const streakOf = (goalId: string, target: number) => {
    const days = totals.get(goalId);
    let streak = 0;
    for (let back = (days?.get(today) ?? 0) >= target ? 0 : 1; back <= 60; back++) {
      if ((days?.get(addDays(today, -back)) ?? 0) < target) break;
      streak++;
    }
    return streak;
  };

  const goalsTab = (
    <>
      <Section
        id="daily-goals"
        title="Today's goals"
        hint={activeGoals.length > 0 ? `${doneToday} of ${activeGoals.length} done today. Tap an amount each time you finish a set.` : undefined}
        aside={
          <>
            {activeGoals.length > 0 && <EntryDialog label="Log exercise" variant="outline" description="For an amount or time the quick buttons do not cover." fields={exerciseLogFields(toOptions(activeGoals))} action={createExerciseLog} />}
            <EntryDialog label="Add daily goal" fields={exerciseGoalFields} action={createExerciseGoal} />
          </>
        }
      >
        {activeGoals.length === 0 ? (
          <Empty title="No daily goals yet">Add an exercise and how much of it you want to do every day, such as 20 push-ups.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {activeGoals.map((g) => {
              const done = totals.get(g.id)?.get(today) ?? 0;
              const left = Math.max(0, g.daily_target - done);
              const streak = streakOf(g.id, g.daily_target);
              const quick = QUICK_AMOUNTS[g.unit];
              return (
                <Panel key={g.id} className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-lg font-semibold tracking-tight">{g.name}</h3>
                    <RowActions>
                      <EntryDialog label="Edit daily goal" fields={exerciseGoalFields} edit={{ id: g.id, values: g }} update={updateExerciseGoal} />
                      <DeleteButton id={g.id} what={g.name} action={deleteExerciseGoal} />
                    </RowActions>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">
                        {num(done)}
                        <span className="text-lg font-medium text-muted-foreground">
                          {" "}
                          / {num(g.daily_target)} {g.unit}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {left === 0 ? "Done for today" : `${num(left)} ${g.unit} to go`}
                        {streak > 0 && ` · ${streak}-day streak`}
                      </p>
                    </div>
                    <ProgressRing label={`${g.name} today`} value={done} max={g.daily_target} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {quick.map((amount) => (
                      <QuickLogButton key={amount} goalId={g.id} amount={amount} action={createExerciseLog}>
                        +{amount}
                      </QuickLogButton>
                    ))}
                    {left > 0 && !quick.some((amount) => amount === left) && (
                      <QuickLogButton goalId={g.id} amount={left} primary action={createExerciseLog}>
                        Finish +{left}
                      </QuickLogButton>
                    )}
                  </div>

                  <ol className="mt-5 flex gap-1.5 border-t pt-4" aria-label="Last 7 days">
                    {Array.from({ length: WEEK }, (_, i) => {
                      const d = addDays(weekStart, i);
                      const total = totals.get(g.id)?.get(d) ?? 0;
                      const met = total >= g.daily_target;
                      return (
                        <li key={d} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${day(d)}: ${num(total)} of ${num(g.daily_target)} ${g.unit}`}>
                          <span aria-hidden className={`h-1.5 w-full rounded-full ${met ? "bg-mod" : total > 0 ? "bg-mod/35" : "bg-muted"}`} />
                          <span className={`eyebrow ${d === today ? "text-foreground" : "text-muted-foreground"}`}>{day(d, { weekday: "narrow" })}</span>
                          <span className="sr-only">{`${day(d)}: ${met ? "target met" : total > 0 ? "partly done" : "nothing logged"}`}</span>
                        </li>
                      );
                    })}
                  </ol>
                </Panel>
              );
            })}
          </div>
        )}
      </Section>

      {todayLogs.length > 0 && (
        <Section id="goal-logs" title="Logged today" hint="Delete an entry if you tapped by mistake.">
          <RowList>
            {todayLogs.map((entry) => (
              <Row
                key={entry.id}
                title={goalName.get(entry.goal_id)?.name ?? "Exercise"}
                meta={time(entry.logged_at, timezone)}
                value={`+${num(entry.amount)} ${goalName.get(entry.goal_id)?.unit ?? ""}`}
                actions={<DeleteButton id={entry.id} what="entry" action={deleteExerciseLog} />}
              />
            ))}
          </RowList>
        </Section>
      )}

      {pausedGoals.length > 0 && (
        <Section id="paused-goals" title="Paused goals" hint="Edit a goal and tick Active to bring it back.">
          <RowList>
            {pausedGoals.map((g) => (
              <Row
                key={g.id}
                title={g.name}
                meta={`${num(g.daily_target)} ${g.unit} a day`}
                actions={
                  <RowActions>
                    <EntryDialog label="Edit daily goal" fields={exerciseGoalFields} edit={{ id: g.id, values: g }} update={updateExerciseGoal} />
                    <DeleteButton id={g.id} what={g.name} action={deleteExerciseGoal} />
                  </RowActions>
                }
              />
            ))}
          </RowList>
        </Section>
      )}
    </>
  );

  const workoutsTab = (
    <Section id="workouts" title="Recent workouts" hint="The latest 15 sessions of any kind." aside={<EntryDialog label="Add workout" fields={workoutFields} action={createWorkout} />}>
      {workoutRows.length === 0 ? (
        <Empty title="No workouts logged yet">Add a session to start your training log.</Empty>
      ) : (
        <RowList>
          {workoutRows.map((w) => (
            <Row
              key={w.id}
              title={w.title}
              meta={[date(w.performed_at, timezone), label(w.kind), w.distance_km != null && `${num(Number(w.distance_km), 1)} km`, w.avg_heart_rate != null && `${w.avg_heart_rate} bpm`].filter(Boolean).join(" · ")}
              value={w.duration_min != null ? `${num(w.duration_min)} min` : undefined}
              sub={w.calories_burned != null ? `${num(w.calories_burned)} kcal` : undefined}
              actions={<RowActions>
<EntryDialog label="Edit workout" fields={workoutFields} edit={{ id: w.id, values: w }} update={updateWorkout} />
<DeleteButton id={w.id} what={w.title} action={deleteWorkout} />
</RowActions>}
            />
          ))}
        </RowList>
      )}
    </Section>
  );

  const racketTab = (
    <>
      <Section id="racket" title="Matches" hint="A match is won by taking more games than the opponent." aside={<EntryDialog label="Add match" fields={racketMatchFields} action={createRacketMatch} />}>
        {results.length === 0 ? (
          <Empty title="No matches recorded yet">Add a match with its game scores to build your record.</Empty>
        ) : (
          <div className="flex flex-col gap-4">
            <Panel className="grid grid-cols-2 gap-x-4 gap-y-6 p-5 sm:grid-cols-4 sm:p-6">
              <Figure label="Win rate" value={`${num(stats.winRatePct)}%`} tone="mod" />
              <Figure label="Matches" value={num(stats.played)} />
              <Figure label="Won / lost" value={`${stats.wins} / ${stats.losses}`} hint={stats.draws ? `${stats.draws} drawn` : undefined} />
              <Figure label="Points" value={`${num(stats.pointsFor)} / ${num(stats.pointsAgainst)}`} hint="For / against" />
            </Panel>
            <RowList>
              {results.map((r) => (
                <Row
                  key={r.match_id}
                  title={r.opponent ? `vs ${r.opponent}` : "Match"}
                  meta={`${date(r.played_at, timezone)} · ${label(r.sport)} ${r.match_type}`}
                  value={`${r.games_won} – ${r.games_lost}`}
                  sub={`${num(Number(r.points_for))} – ${num(Number(r.points_against))} points`}
                  lead={r.result ? <Pill tone={r.result === "win" ? "pos" : r.result === "loss" ? "neg" : "neutral"}>{label(r.result)}</Pill> : undefined}
                  actions={<RowActions>
<EntryDialog label="Edit match" fields={racketMatchFields} edit={{ id: r.match_id, values: matchRecord.get(r.match_id) ?? {} }} update={updateRacketMatch} />
<DeleteButton id={r.match_id} what="match" action={deleteRacketMatch} />
</RowActions>}
                />
              ))}
            </RowList>
          </div>
        )}
      </Section>

      <Section id="courts" title="Court bookings" hint="Upcoming and recent bookings, newest first." aside={<EntryDialog label="Add booking" fields={courtBookingFields} action={createCourtBooking} />}>
        {bookings.length === 0 ? (
          <Empty title="No courts booked yet" />
        ) : (
          <RowList>
            {bookings.map((b) => (
              <Row
                key={b.id}
                title={[b.venue, b.court_name].filter(Boolean).join(", ")}
                meta={`${dateTime(b.starts_at, timezone)} to ${time(b.ends_at, timezone)} · ${label(b.sport)}`}
                value={money(Number(b.cost), currency)}
                sub={b.booking_ref ?? undefined}
                lead={<Pill tone={BOOKING_TONE[b.status]}>{label(b.status)}</Pill>}
                actions={<RowActions>
<EntryDialog label="Edit booking" fields={courtBookingFields} edit={{ id: b.id, values: b }} update={updateCourtBooking} />
<DeleteButton id={b.id} what="booking" action={deleteCourtBooking} />
</RowActions>}
              />
            ))}
          </RowList>
        )}
      </Section>
    </>
  );

  const rangeTab = (
    <>
      {scoreTrend.length > 1 && (
        <Section id="range-trend" title="Score trend" hint="Score as a share of the maximum, session by session.">
          <Panel className="p-4 sm:p-6">
            <TrendChart data={scoreTrend} unit="%" label="Score" />
          </Panel>
        </Section>
      )}
      <Section id="range" title="Sessions" hint="Accuracy is shots on target out of shots fired." aside={<EntryDialog label="Add session" fields={shootingFields} action={createShootingSession} />}>
        {sessions.length === 0 ? (
          <Empty title="No range sessions yet">Add a session to track score and accuracy over time.</Empty>
        ) : (
          <Table head={[{ label: "Date" }, { label: "Discipline" }, { label: "Venue" }, { label: "Score", right: true }, { label: "Accuracy", right: true }, { label: "Group", right: true }, { label: "" }]} minWidth="46rem">
            {sessions.map((s) => (
              <tr key={s.id}>
                <Td>{date(s.session_at, timezone)}</Td>
                <Td>
                  <p className="font-medium">{label(s.discipline)}</p>
                  {s.distance_m != null && <p className="text-xs text-muted-foreground">{num(Number(s.distance_m))} m</p>}
                </Td>
                <Td>{s.venue ?? "—"}</Td>
                <Td right>
                  {s.total_score != null ? num(Number(s.total_score), 1) : "—"}
                  {s.max_score != null && <span className="text-muted-foreground"> / {num(Number(s.max_score), 0)}</span>}
                </Td>
                <Td right>{s.accuracy_pct != null ? `${num(Number(s.accuracy_pct), 1)}%` : "—"}</Td>
                <Td right>{s.avg_group_size_mm != null ? `${num(Number(s.avg_group_size_mm), 1)} mm` : "—"}</Td>
                <Td className="w-px text-right">
                  <RowActions>
<EntryDialog label="Edit session" fields={shootingFields} edit={{ id: s.id, values: s }} update={updateShootingSession} />
<DeleteButton id={s.id} what="session" action={deleteShootingSession} />
</RowActions>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </>
  );

  return (
    <ModuleTabs
      tabs={[
        { id: "goals", label: "Daily goals", content: goalsTab },
        { id: "workouts", label: "Workouts", content: workoutsTab },
        { id: "racket", label: "Racket sports", content: racketTab },
        { id: "range", label: "Target sports", content: rangeTab },
      ]}
    />
  );
}

export default function FitnessPage() {
  return (
    <ModulePage module="fitness" title="Fitness" lede="Daily exercise goals, training sessions, racket matches and time at the range.">
      <Suspense fallback={<LogoLoader />}>
        <FitnessContent />
      </Suspense>
    </ModulePage>
  );
}
