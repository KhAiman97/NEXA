import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getSession } from "@/lib/app/session";
import { loadDashboard } from "@/lib/services/dashboard";
import { MODULES, moduleStyle, type ModuleKey } from "@/lib/app/modules";
import { dateTime, longDay, money, monthName, num } from "@/lib/format";
import { Amount } from "@/components/app/amount";
import { LogoLoader } from "@/components/app/logo";
import { SpotlightCard } from "@/components/app/spotlight-card";
import { Figure, Meter, ModulePage, Panel } from "@/components/app/ui";

export const metadata = { title: "Overview" };

function ModuleCard({ module, facts }: { module: ModuleKey; facts: { label: string; value: string; hint?: string }[] }) {
  const m = MODULES[module];
  return (
    <SpotlightCard style={moduleStyle(module)} className="overflow-hidden rounded-xl border bg-card transition-colors hover:border-mod">
    <Link href={m.href} className="group relative flex h-full flex-col p-5 pl-6">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-mod shadow-[0_0_14px_hsl(var(--mod)/0.6)]" />
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold tracking-tight">{m.label}</h3>
        <ArrowUpRight aria-hidden className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-mod" />
      </div>
      <dl className="mt-4 flex flex-col gap-3">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">{fact.label}</dt>
            <dd className="text-right">
              <span className="figure text-sm font-medium">{fact.value}</span>
              {fact.hint && <span className="block text-xs text-muted-foreground">{fact.hint}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </Link>
    </SpotlightCard>
  );
}

async function OverviewContent() {
  const session = await getSession();
  const { db, today, currency, timezone } = session;
  const data = await loadDashboard(db, today, timezone);
  const { overview, subscriptions, runningCosts, projectCosts, lowStock, recentWorkouts, upcoming, goals: goalRows, goalTotals } = data;
  // Food and drink are grouped by local day, which needs a profile with a timezone.
  const dayRows = session.hasProfile ? data.day : null;

  const rm = (n: number) => money(n, currency);
  const vehicle = [...runningCosts].sort((a, b) => Number(b.distance_km) - Number(a.distance_km))[0];
  const activeProjects = projectCosts.filter((p) => p.status === "active");
  const projectSpend = projectCosts.reduce((sum, p) => sum + Number(p.spent), 0);
  const nextBooking = upcoming[upcoming.length - 1];
  const workoutMinutes = recentWorkouts.reduce((sum, w) => sum + Number(w.duration_min ?? 0), 0);
  const goal = dayRows?.goal;
  const doneOf = new Map(goalTotals.map((t) => [t.goal_id, Number(t.total)]));
  const goalsDone = goalRows.filter((g) => (doneOf.get(g.id) ?? 0) >= g.daily_target).length;

  return (
    <>
      <p className="-mt-2 text-muted-foreground">
        {longDay(today)}. Signed in as {session.name}.
      </p>

      <section aria-labelledby="month-title">
        <h2 id="month-title" className="mb-4 font-display text-lg font-semibold tracking-tight">
          {monthName(overview.month)} so far
        </h2>
        <Panel beam className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-6" style={moduleStyle("finance")}>
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <p className="font-medium">Income</p>
                <p className="figure text-sm">
                  {rm(overview.income)}
                  {overview.incomeTarget > 0 && <span className="text-muted-foreground"> of {rm(overview.incomeTarget)}</span>}
                </p>
              </div>
              <Meter label="Income against this month's target" value={overview.income} max={overview.incomeTarget || overview.income} tone="pos" />
              <p className="mt-2 text-sm text-muted-foreground">
                {overview.incomeTarget > 0 ? `${num(overview.incomeProgressPct)}% of your income target` : "No income target set for this month"}
              </p>
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <p className="font-medium">Spending</p>
                <p className="figure text-sm">
                  {rm(overview.expense)}
                  {overview.expenseLimit > 0 && <span className="text-muted-foreground"> of {rm(overview.expenseLimit)}</span>}
                </p>
              </div>
              <Meter label="Spending against this month's limit" value={overview.expense} max={overview.expenseLimit || overview.expense} limit tone="ink" />
              <p className="mt-2 text-sm text-muted-foreground">
                {overview.expenseLimit > 0
                  ? overview.expense > overview.expenseLimit
                    ? `${rm(overview.expense - overview.expenseLimit)} over your spending limit`
                    : `${rm(overview.expenseLimit - overview.expense)} left before your spending limit`
                  : "No spending limit set for this month"}
              </p>
            </div>
          </div>
          <div className="grid content-start gap-6 border-t pt-6 sm:grid-cols-2 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <Figure label="Net this month" value={<Amount value={overview.net} currency={currency} />} tone={overview.net < 0 ? "neg" : "pos"} />
            <Figure label="Net worth" value={<Amount value={overview.netWorth} currency={currency} />} hint={`${rm(overview.totalAssets)} owned, ${rm(overview.totalLiabilities)} owed`} />
          </div>
        </Panel>
      </section>

      <section aria-labelledby="sections-title">
        <h2 id="sections-title" className="mb-4 font-display text-lg font-semibold tracking-tight">
          Your sections
        </h2>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <ModuleCard
            module="finance"
            facts={[
              { label: "Subscriptions", value: `${rm(subscriptions.monthlyTotal)} / month` },
              { label: "Owned", value: rm(overview.totalAssets) },
              { label: "Owed", value: rm(overview.totalLiabilities) },
            ]}
          />
          <ModuleCard
            module="vehicles"
            facts={
              vehicle
                ? [
                    { label: `${vehicle.name} odometer`, value: `${num(vehicle.current_odometer_km)} km` },
                    { label: "Running cost", value: vehicle.cost_per_km != null ? `${money(Number(vehicle.cost_per_km), currency, 3)} / km` : "Not enough data" },
                    { label: "Spent so far", value: rm(Number(vehicle.total_cost)) },
                  ]
                : [{ label: "Vehicles", value: "None added yet" }]
            }
          />
          <ModuleCard
            module="fitness"
            facts={[
              goalRows.length > 0
                ? { label: "Daily goals today", value: `${goalsDone} of ${goalRows.length} done`, hint: goalRows.map((g) => `${g.name} ${doneOf.get(g.id) ?? 0}/${g.daily_target}`).join(", ") }
                : { label: "Daily goals", value: "None set" },
              { label: "Workouts, last 7 days", value: num(recentWorkouts.length), hint: workoutMinutes ? `${num(workoutMinutes)} minutes` : undefined },
              nextBooking
                ? { label: "Next court", value: dateTime(nextBooking.starts_at, timezone), hint: nextBooking.venue }
                : { label: "Next court", value: "Nothing booked" },
            ]}
          />
          <ModuleCard
            module="nutrition"
            facts={[
              { label: "Energy today", value: `${num(dayRows?.energy)} kcal`, hint: goal?.calories ? `of ${num(goal.calories)} kcal` : undefined },
              { label: "Water today", value: `${num(dayRows?.hydration?.total_volume_ml)} ml`, hint: goal ? `of ${num(goal.water_ml)} ml` : undefined },
              { label: "Caffeine today", value: `${num(dayRows?.hydration?.total_caffeine_mg)} mg`, hint: goal ? `limit ${num(goal.caffeine_limit_mg)} mg` : undefined },
            ]}
          />
          <ModuleCard
            module="projects"
            facts={[
              { label: "Active builds", value: num(activeProjects.length), hint: activeProjects.map((p) => p.name).join(", ") || undefined },
              { label: "Spent on builds", value: rm(projectSpend) },
              { label: "Parts running low", value: num(lowStock.length) },
            ]}
          />
        </div>
      </section>
    </>
  );
}

export default function DashboardPage() {
  return (
    <ModulePage module="overview" title="Overview" lede="Money, vehicles, builds, food and training on one page.">
      <Suspense fallback={<LogoLoader />}>
        <OverviewContent />
      </Suspense>
    </ModulePage>
  );
}
