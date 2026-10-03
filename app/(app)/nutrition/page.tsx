import { Suspense } from "react";
import { Star } from "lucide-react";
import { getSession } from "@/lib/app/session";
import { drinkFields, foodFields, foodLogFields, nutritionGoalFields, toOptions } from "@/lib/app/forms";
import { addDays, day, label, longDay, num, time } from "@/lib/format";
import { createFood, createFoodLog, createHydrationLog, deleteFood, deleteFoodLog, deleteHydrationLog, logMenuDrink, logMenuFood, saveMenuFood, saveNutritionGoal, updateFood, updateFoodLog, updateHydrationLog } from "@/lib/actions/nutrition";
import { loadNutritionPage } from "@/lib/services/nutrition";
import type { FoodLog } from "@/lib/validators/nutrition";
import { Amount } from "@/components/app/amount";
import { GoalBarChart } from "@/components/app/charts";
import { DeleteButton } from "@/components/app/delete-button";
import { EntryDialog } from "@/components/app/entry-dialog";
import { FoodCatalogueDialog } from "@/components/app/food-catalogue-dialog";
import { LogoLoader } from "@/components/app/logo";
import { ModuleTabs } from "@/components/app/module-tabs";
import { RowActions, Empty, Figure, Meter, ModulePage, ProgressRing, Panel, Row, RowList, Section, Table, Td } from "@/components/app/ui";

export const metadata = { title: "Nutrition" };

const MEALS: FoodLog["meal_type"][] = ["breakfast", "lunch", "dinner", "snack"];
const TREND_DAYS = 14;

async function NutritionContent() {
  const session = await getSession();
  const { db, today, timezone } = session;

  if (!session.hasProfile) {
    return <Empty title="Your profile is not set up yet">Food and drink are grouped by your local day, which needs a profile with a timezone. Ask the administrator to create one for this account.</Empty>;
  }

  const { summary, trend, foods: foodRows } = await loadNutritionPage(db, today, timezone, addDays(today, -(TREND_DAYS - 1)));

  const goal = summary.goal;
  const eaten = summary.nutrition ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, entries: 0 };
  const drunk = summary.hydration ?? { total_volume_ml: 0, total_caffeine_mg: 0, drinks: 0 };
  const volumeByDay = new Map(trend.map((t) => [t.day.slice(0, 10), Number(t.total_volume_ml)]));
  const trendData = Array.from({ length: TREND_DAYS }, (_, i) => {
    const d = addDays(today, i - (TREND_DAYS - 1));
    return { day: day(d), value: volumeByDay.get(d) ?? 0 };
  });
  const macros = [
    { name: "Protein", value: eaten.protein_g, target: goal?.protein_g },
    { name: "Carbs", value: eaten.carbs_g, target: goal?.carbs_g },
    { name: "Fat", value: eaten.fat_g, target: goal?.fat_g },
  ];
  const meals = [...summary.foodLogs].sort((a, b) => MEALS.indexOf(a.meal_type) - MEALS.indexOf(b.meal_type) || a.logged_at.localeCompare(b.logged_at));
  const drinks = [...summary.drinks].sort((a, b) => a.logged_at.localeCompare(b.logged_at));

  const todayTab = (
    <>
      <Section id="today" title="Today" hint={longDay(today)} aside={<EntryDialog label="Set daily goals" variant="outline" fields={nutritionGoalFields(goal)} action={saveNutritionGoal} />}>
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel className="relative p-5 sm:p-6">
            <Figure
              className="pr-20"
              label="Energy"
              value={<Amount value={summary.energy} unit="kcal" />}
              hint={
                goal?.calories
                  ? summary.remaining.calories! >= 0
                    ? `${num(summary.remaining.calories)} kcal left of ${num(goal.calories)}`
                    : `${num(-summary.remaining.calories!)} kcal over ${num(goal.calories)}`
                  : "No energy goal set"
              }
            />
            <div className="absolute right-5 top-5 sm:right-6 sm:top-6">
              <ProgressRing label="Energy against goal" value={summary.energy} max={goal?.calories ?? summary.energy} limit />
            </div>
            <dl className="mt-6 flex flex-col gap-4">
              {macros.map((m) => (
                <div key={m.name}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <dt>{m.name}</dt>
                    <dd className="figure">
                      {num(m.value)} g{m.target != null && <span className="text-muted-foreground"> of {num(m.target)} g</span>}
                    </dd>
                  </div>
                  <Meter label={`${m.name} against goal`} value={m.value} max={m.target ?? m.value} tone="ink" className="h-1.5" />
                </div>
              ))}
            </dl>
          </Panel>

          <Panel className="relative p-5 sm:p-6">
            <Figure
              className="pr-20"
              label="Water and other drinks"
              value={<Amount value={drunk.total_volume_ml} unit="ml" />}
              hint={goal ? (summary.remaining.water_ml! > 0 ? `${num(summary.remaining.water_ml)} ml to reach ${num(goal.water_ml)} ml` : `Goal of ${num(goal.water_ml)} ml reached`) : "No water goal set"}
            />
            <div className="absolute right-5 top-5 sm:right-6 sm:top-6">
              <ProgressRing label="Fluid against goal" value={drunk.total_volume_ml} max={goal?.water_ml ?? drunk.total_volume_ml} />
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              {num(drunk.drinks)} {drunk.drinks === 1 ? "drink" : "drinks"} logged today
            </p>
          </Panel>

          <Panel className="relative p-5 sm:p-6">
            <Figure
              className="pr-20"
              label="Caffeine"
              value={<Amount value={drunk.total_caffeine_mg} unit="mg" />}
              hint={goal ? (summary.remaining.caffeine_mg! >= 0 ? `${num(summary.remaining.caffeine_mg)} mg under your ${num(goal.caffeine_limit_mg)} mg limit` : `${num(-summary.remaining.caffeine_mg!)} mg over your ${num(goal.caffeine_limit_mg)} mg limit`) : "No caffeine limit set"}
            />
            <div className="absolute right-5 top-5 sm:right-6 sm:top-6">
              <ProgressRing label="Caffeine against limit" value={drunk.total_caffeine_mg} max={goal?.caffeine_limit_mg ?? drunk.total_caffeine_mg} limit />
            </div>
          </Panel>
        </div>
      </Section>

      <Section id="meals" title="Meals today" hint="Pick from the Malaysian menu if you do not know the calories and macros of a dish."
        aside={
          <>
            <FoodCatalogueDialog mode="log" action={logMenuFood} />
            <EntryDialog label="Add meal" fields={foodLogFields(toOptions(foodRows))} action={createFoodLog} />
          </>
        }>
        {meals.length === 0 ? (
          <Empty title="Nothing eaten yet today">Pick a dish from the Malaysian menu, or add a meal yourself, to count it toward today&apos;s energy and macros.</Empty>
        ) : (
          <RowList>
            {meals.map((f) => (
              <Row
                key={f.id}
                title={f.name}
                meta={`${label(f.meal_type)} · ${time(f.logged_at, timezone)} · ${num(Number(f.servings), Number(f.servings) % 1 ? 1 : 0)} ${Number(f.servings) === 1 ? "serving" : "servings"}`}
                value={`${num(Number(f.calories))} kcal`}
                sub={`P ${num(Number(f.protein_g))} · C ${num(Number(f.carbs_g))} · F ${num(Number(f.fat_g))} g`}
                actions={<RowActions>
<EntryDialog label="Edit meal" fields={foodLogFields(toOptions(foodRows))} edit={{ id: f.id, values: f }} update={updateFoodLog} />
<DeleteButton id={f.id} what={f.name} action={deleteFoodLog} />
</RowActions>}
              />
            ))}
          </RowList>
        )}
      </Section>

      <Section id="drinks" title="Drinks today" hint="Pick from the drink menu, or add one yourself. Drinks count toward fluid, caffeine and energy."
        aside={
          <>
            <FoodCatalogueDialog mode="drinks" action={logMenuDrink} />
            <EntryDialog label="Add drink" fields={drinkFields} action={createHydrationLog} />
          </>
        }>
        {drinks.length === 0 ? (
          <Empty title="Nothing drunk yet today">Pick a drink from the drink menu, or add one yourself, to count it toward today&apos;s fluid, caffeine and energy.</Empty>
        ) : (
          <RowList>
            {drinks.map((d) => (
              <Row
                key={d.id}
                title={label(d.beverage)}
                meta={time(d.logged_at, timezone)}
                value={`${num(d.volume_ml)} ml`}
                sub={[Number(d.calories ?? 0) > 0 && `${num(Number(d.calories))} kcal`, Number(d.caffeine_mg) > 0 && `${num(Number(d.caffeine_mg))} mg caffeine`].filter(Boolean).join(" · ") || undefined}
                actions={<RowActions>
<EntryDialog label="Edit drink" fields={drinkFields} edit={{ id: d.id, values: d }} update={updateHydrationLog} />
<DeleteButton id={d.id} what={d.beverage} action={deleteHydrationLog} />
</RowActions>}
              />
            ))}
          </RowList>
        )}
      </Section>
    </>
  );

  const trendTab = (
    <Section id="hydration" title={`Fluid, last ${TREND_DAYS} days`} hint="Solid bars are days the goal was met.">
      <Panel className="p-4 sm:p-6">
        <GoalBarChart data={trendData} goal={goal?.water_ml} unit="ml" label="Fluid" />
      </Panel>
    </Section>
  );

  const libraryTab = (
    <Section id="foods" title="Food library" hint="Saved foods, per serving." aside={
        <>
          <FoodCatalogueDialog mode="library" savedNames={foodRows.map((f) => f.name)} action={saveMenuFood} />
          <EntryDialog label="Add food" fields={foodFields} action={createFood} />
        </>
      }>
      {foodRows.length === 0 ? (
        <Empty title="No saved foods yet">Save foods you eat often so logging a meal takes one pick.</Empty>
      ) : (
        <Table head={[{ label: "Food" }, { label: "Serving" }, { label: "kcal", right: true }, { label: "Protein", right: true }, { label: "Carbs", right: true }, { label: "Fat", right: true }, { label: "" }]} minWidth="44rem">
          {foodRows.map((f) => (
            <tr key={f.id}>
              <Td>
                <p className="flex items-center gap-1.5 font-medium">
                  {f.name}
                  {f.is_favorite && <Star aria-label="Favourite" className="size-3.5 fill-mod text-mod" />}
                </p>
                {f.brand && <p className="text-xs text-muted-foreground">{f.brand}</p>}
              </Td>
              <Td>
                {num(Number(f.serving_size))} {f.serving_unit}
              </Td>
              <Td right>{num(Number(f.calories))}</Td>
              <Td right>{num(Number(f.protein_g), 1)} g</Td>
              <Td right>{num(Number(f.carbs_g), 1)} g</Td>
              <Td right>{num(Number(f.fat_g), 1)} g</Td>
              <Td className="w-px text-right">
                <RowActions>
<EntryDialog label="Edit food" fields={foodFields} edit={{ id: f.id, values: f }} update={updateFood} />
<DeleteButton id={f.id} what={f.name} action={deleteFood} />
</RowActions>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );

  return (
    <ModuleTabs
      tabs={[
        { id: "today", label: "Today", content: todayTab },
        { id: "trend", label: "Trend", content: trendTab },
        { id: "library", label: "Food library", content: libraryTab },
      ]}
    />
  );
}

export default function NutritionPage() {
  return (
    <ModulePage module="nutrition" title="Nutrition" lede="What you ate and drank today, measured against your goals.">
      <Suspense fallback={<LogoLoader />}>
        <NutritionContent />
      </Suspense>
    </ModulePage>
  );
}
