// Runs the page loaders (lib/services) against the real SQL functions in an in-memory Postgres.
// It catches what the schema test and the type checker cannot: an argument name that does not match
// the function's, or a loader reading a key the function does not return.
// Run: npm run test:bundles
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "@/lib/services/crud";
import { loadDashboard } from "@/lib/services/dashboard";
import { loadFinancePage } from "@/lib/services/finance/page";
import { listTransactionsPage } from "@/lib/services/finance/transactions";
import { loadFitnessPage } from "@/lib/services/fitness";
import { getDaySummary, loadNutritionPage } from "@/lib/services/nutrition";
import { loadProjectsPage } from "@/lib/services/projects";
import { loadVehiclesPage } from "@/lib/services/vehicles";
import { zonedDayRange } from "@/lib/utils/time";

const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TZ = "Asia/Kuala_Lumpur";
const TODAY = "2031-05-04";

async function main() {
  const pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec(`
    create schema auth;
    create schema extensions;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
    create or replace function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create or replace function auth.jwt() returns jsonb language sql stable as
      $$ select jsonb_build_object('sub', nullif(current_setting('request.jwt.claim.sub', true), ''), 'email', 'a@x.com') $$;
    create role authenticated nologin;
    create role anon nologin;
    grant usage on schema auth, extensions to authenticated;
    grant execute on function auth.uid(), auth.jwt() to authenticated;
  `);
  const dir = path.join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).sort()) await pg.exec(readFileSync(path.join(dir, file), "utf8"));

  await pg.exec(`insert into auth.users (id, email) values ('${USER}', 'a@x.com')`);
  const asUser = async <T>(run: () => Promise<T>): Promise<T> => {
    await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${USER}', false);`);
    try {
      return await run();
    } finally {
      await pg.exec("reset role");
    }
  };

  // The same call shape supabase-js sends: a function name and named arguments.
  const calls: string[] = [];
  const db = {
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      calls.push(fn);
      const names = Object.keys(args);
      const sql = `select public.${fn}(${names.map((name, i) => `${name} => $${i + 1}`).join(", ")}) as result`;
      try {
        const { rows } = await asUser(() => pg.query<{ result: unknown }>(sql, Object.values(args)));
        return { data: rows[0].result, error: null };
      } catch (err) {
        return { data: null, error: { code: (err as { code?: string }).code ?? "XX000", message: (err as Error).message } };
      }
    },
  } as unknown as Db;

  await asUser(() =>
    pg.exec(`
      insert into finance_accounts (id, name) values ('11111111-1111-1111-1111-111111111111', 'Bank');
      insert into categories (id, name, kind) values ('22222222-2222-2222-2222-222222222222', 'Food', 'expense');
      insert into transactions (type, amount, title, occurred_at, account_id, category_id)
        select case when n % 4 = 0 then 'income' else 'expense' end, n, 'tx ' || n, timestamptz '2031-05-01T10:00:00+08' + n * interval '1 hour',
               '11111111-1111-1111-1111-111111111111', case when n % 2 = 0 then '22222222-2222-2222-2222-222222222222'::uuid end
        from generate_series(1, 25) n;
      insert into subscriptions (name, amount, billing_cycle, is_active) values ('Netflix', 55, 'monthly', true), ('Old gym', 99, 'monthly', false);
      insert into monthly_goals (month, income_target, expense_limit) values ('2031-05-01', 500, 300);
      insert into vehicles (id, name, initial_odometer_km) values ('33333333-3333-3333-3333-333333333333', 'Bezza', 1000);
      insert into fuel_logs (vehicle_id, filled_at, odometer_km, liters, price_per_liter, total_cost, is_full_tank) values
        ('33333333-3333-3333-3333-333333333333', '2031-04-01T10:00:00+08', 1100, 20, 2, 40, true),
        ('33333333-3333-3333-3333-333333333333', '2031-04-10T10:00:00+08', 1500, 25, 2, 50, true);
      insert into maintenance_logs (vehicle_id, kind, performed_on, cost, next_due_on, next_due_km) values
        ('33333333-3333-3333-3333-333333333333', 'oil_change', '2030-01-01', 10, '2030-06-01', null),
        ('33333333-3333-3333-3333-333333333333', 'oil_change', '2031-03-01', 10, '2031-09-01', 1200);
      insert into projects (name, status, expense_tag) values ('Pi cluster', 'active', 'pi-cluster');
      insert into inventory_items (name, quantity, reorder_level) values ('Resistors', 1, 5), ('Wire', 9, 5);
      insert into foods (name, calories) values ('Nasi lemak', 644);
      insert into food_logs (name, meal_type, servings, calories, protein_g, carbs_g, fat_g, logged_at) values ('Nasi lemak', 'breakfast', 1, 644, 18, 80, 27, '2031-05-04T08:00:00+08');
      insert into hydration_logs (beverage, volume_ml, caffeine_mg, logged_at) values ('water', 500, 0, '2031-05-04T09:00:00+08'), ('kopi', 250, 95, '2031-05-03T09:00:00+08');
      insert into nutrition_goals (calories, water_ml, caffeine_limit_mg) values (2000, 2500, 400);
      insert into workouts (title, performed_at, duration_min) values ('Run', '2031-05-02T07:00:00+08', 30);
      insert into exercise_goals (id, name, unit, daily_target) values ('44444444-4444-4444-4444-444444444444', 'Push-ups', 'reps', 20);
      insert into exercise_logs (goal_id, amount, logged_at) values ('44444444-4444-4444-4444-444444444444', 10, '2031-05-04T07:00:00+08');
      insert into court_bookings (sport, venue, starts_at, ends_at, status) values ('badminton', 'Hall', '2031-05-06T20:00:00+08', '2031-05-06T21:00:00+08', 'booked');
      insert into racket_matches (id, sport, played_at) values ('66666666-6666-6666-6666-666666666666', 'badminton', '2031-05-01T20:00:00+08');
      insert into racket_match_games (match_id, game_no, my_score, opponent_score) values
        ('66666666-6666-6666-6666-666666666666', 1, 21, 15), ('66666666-6666-6666-6666-666666666666', 2, 21, 19);
      insert into shooting_sessions (discipline, session_at, total_shots, shots_on_target, total_score, max_score) values ('air_rifle', '2031-05-02T10:00:00+08', 60, 57, 580, 600);
    `),
  );

  let pass = 0;
  let fail = 0;
  const check = (name: string, ok: boolean, extra: unknown = "") => {
    if (ok) pass++;
    else fail++;
    console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(extra));
  };
  const oneCall = (fn: string) => calls.length === 1 && calls[0] === fn;
  const day = zonedDayRange(TODAY, TZ);

  calls.length = 0;
  const finance = await loadFinancePage(db, "2031-05-01", 1);
  check("finance: one round trip", oneCall("finance_bundle"), calls);
  check("finance: ledger paged 10 at a time, newest first", finance.ledger.rows.length === 10 && finance.ledger.total === 25 && finance.ledger.pages === 3 && finance.ledger.rows[0].title === "tx 25", finance.ledger);
  check("finance: overview totals and targets", finance.overview.income === 84 && finance.overview.expense === 241 && finance.overview.incomeTarget === 500 && finance.overview.net === -157, finance.overview);
  check("finance: lists and subscription totals", finance.accounts.length === 1 && finance.categories.length === 1 && finance.subscriptions.length === 2 && finance.subscriptionTotals.monthlyTotal === 55 && finance.cashflow.length === 1, finance.subscriptionTotals);

  const filtered = await loadFinancePage(db, "2031-05-01", 1, { type: "income", categoryId: "22222222-2222-2222-2222-222222222222" });
  check("finance: filters applied by the database", filtered.ledger.total === 6 && filtered.ledger.rows.every((t) => t.type === "income") && filtered.ledger.income === 84 && filtered.ledger.expense === 0, filtered.ledger);
  const searched = await loadFinancePage(db, "2031-05-01", 1, { search: " TX 2 " });
  check("finance: search", searched.ledger.total === 7 && searched.ledger.rows.every((t) => t.title.startsWith("tx 2")), searched.ledger.rows.map((t) => t.title));
  calls.length = 0;
  const pastEnd = await loadFinancePage(db, "2031-05-01", 9);
  check("finance: a page past the end falls back to the last page", pastEnd.ledger.page === 3 && pastEnd.ledger.rows.length === 5 && calls.length === 2, [pastEnd.ledger.page, calls]);
  const ledgerOnly = await listTransactionsPage(db, 2, { accountId: "11111111-1111-1111-1111-111111111111" });
  check("transactions: paged RPC on its own", ledgerOnly.page === 2 && ledgerOnly.rows.length === 10 && ledgerOnly.rows[0].title === "tx 15", ledgerOnly.rows[0]);

  calls.length = 0;
  const dashboard = await loadDashboard(db, TODAY, TZ);
  check("dashboard: one round trip", oneCall("dashboard_bundle"), calls);
  check("dashboard: finance and subscriptions", dashboard.overview.income === 84 && dashboard.subscriptions.monthlyTotal === 55 && dashboard.subscriptions.yearlyTotal === 660, dashboard.subscriptions);
  check("dashboard: low stock only", dashboard.lowStock.length === 1 && dashboard.lowStock[0].name === "Resistors", dashboard.lowStock);
  check("dashboard: today's food and water against the goal", dashboard.day.nutrition?.calories === 644 && dashboard.day.hydration?.total_volume_ml === 500 && dashboard.day.remaining.water_ml === 2000 && dashboard.day.goal?.water_ml === 2500, dashboard.day);
  check("dashboard: week's workouts, upcoming booking, goals", dashboard.recentWorkouts.length === 1 && dashboard.upcoming.length === 1 && dashboard.goals.length === 1 && Number(dashboard.goalTotals[0]?.total) === 10 && dashboard.runningCosts.length === 1 && dashboard.projectCosts.length === 1, [dashboard.recentWorkouts.length, dashboard.upcoming.length, dashboard.goalTotals]);

  calls.length = 0;
  const vehicles = await loadVehiclesPage(db, TODAY);
  const detail = vehicles.details.get("33333333-3333-3333-3333-333333333333");
  check("vehicles: one round trip, no per-vehicle follow-ups", oneCall("vehicles_bundle"), calls);
  check("vehicles: lists", vehicles.vehicles.length === 1 && vehicles.fuel.length === 2 && vehicles.maintenance.length === 2 && Number(vehicles.costs[0].current_odometer_km) === 1500, vehicles.costs);
  check("vehicles: fuel segment for the vehicle", detail?.segments.length === 1 && Number(detail.segments[0].km_per_liter) === 16, detail?.segments);
  check("vehicles: reminders use only the latest service of each kind", detail?.due.overdueByDate.length === 0 && detail?.due.dueByOdometer.length === 1 && detail.due.dueByOdometer[0].performed_on === "2031-03-01", detail?.due);

  calls.length = 0;
  const projects = await loadProjectsPage(db);
  check("projects: one round trip with all three lists", oneCall("projects_bundle") && projects.projects.length === 1 && projects.costs.length === 1 && projects.inventory.length === 2, calls);

  calls.length = 0;
  const nutrition = await loadNutritionPage(db, TODAY, TZ, "2031-04-21");
  check("nutrition: one round trip", oneCall("nutrition_bundle"), calls);
  check("nutrition: day summary, trend and foods", nutrition.summary.foodLogs.length === 1 && nutrition.summary.drinks.length === 1 && nutrition.summary.hydration?.total_caffeine_mg === 0 && nutrition.trend.length === 2 && nutrition.foods.length === 1 && nutrition.summary.remaining.calories === 1356, nutrition.summary);
  const yesterday = await getDaySummary(db, "2031-05-03", TZ);
  check("nutrition: single-day RPC", yesterday.hydration?.total_caffeine_mg === 95 && yesterday.nutrition === null && yesterday.foodLogs.length === 0, yesterday);

  calls.length = 0;
  const fitness = await loadFitnessPage(db, TODAY, day, "2031-03-05");
  check("fitness: one round trip", oneCall("fitness_bundle"), calls);
  check("fitness: record and results", fitness.stats.played === 1 && fitness.stats.wins === 1 && fitness.stats.winRatePct === 100 && fitness.stats.pointsFor === 42 && fitness.results.length === 1 && fitness.matches.length === 1, fitness.stats);
  check("fitness: shooting trend, goals and today's logs", fitness.shootingTrend.length === 1 && fitness.shootingTrend[0].accuracy_pct === 95 && fitness.shootingTrend[0].score_pct === 96.7 && fitness.sessions.length === 1 && fitness.goals.length === 1 && fitness.todayLogs.length === 1 && fitness.daily.length === 1 && fitness.workouts.length === 1 && fitness.bookings.length === 1, fitness.shootingTrend);

  const session = await db.rpc("app_session");
  const s = session.data as { user_id: string; email: string; profile: { timezone: string; currency: string } | null };
  check("session: id, email and settings in one call", s.user_id === USER && s.email === "a@x.com" && s.profile?.timezone === TZ && s.profile?.currency === "MYR", session);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
