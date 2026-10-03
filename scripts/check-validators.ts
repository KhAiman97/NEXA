// Sanity checks for the validation layer. Run: npx tsx scripts/check-validators.ts
import { partialOf } from "../lib/validators/common";
import { accountInput, transactionInput, monthlyGoalInput } from "../lib/validators/finance";
import { projectInput } from "../lib/validators/projects";
import { fillAmounts, fuelLogInput } from "../lib/validators/vehicles";
import { CATALOGUE_GROUPS, MALAYSIAN_FOODS, MENU_DRINKS, MENU_MEALS } from "../lib/app/malaysian-foods";

let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (!ok) failed++;
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(detail));
};

// 1. partialOf must not re-apply defaults (the Zod 4 pitfall it exists to avoid)
const naive = accountInput.partial().parse({ name: "Maybank" });
check("naive .partial() re-applies defaults (why partialOf exists)", naive.kind === "bank", naive);
const patch = partialOf(accountInput).parse({ name: "Maybank" }) as Record<string, unknown>;
check("partialOf only keeps sent keys", Object.keys(patch).join() === "name", patch);
check("partialOf still validates", !partialOf(accountInput).safeParse({ kind: "nope" }).success);
const txPatch = partialOf(transactionInput).parse({ title: "x" }) as Record<string, unknown>;
check("partialOf drops occurred_at default", !("occurred_at" in txPatch), txPatch);

// 2. Mass-assignment: user_id / id are stripped
const stripped = accountInput.parse({ name: "A", user_id: "evil", id: "evil" }) as Record<string, unknown>;
check("user_id and id stripped from input", !("user_id" in stripped) && !("id" in stripped), stripped);

// 3. Money rounding and bounds
check("money rounds to 2dp", transactionInput.parse({ type: "expense", amount: 10.005 + 0.1, title: "t" }).amount === 10.11 || transactionInput.parse({ type: "expense", amount: 10.1049, title: "t" }).amount === 10.1);
check("amount must be > 0", !transactionInput.safeParse({ type: "expense", amount: 0, title: "t" }).success);
check("negative amount rejected", !transactionInput.safeParse({ type: "income", amount: -5, title: "t" }).success);
check("NaN rejected", !transactionInput.safeParse({ type: "income", amount: NaN, title: "t" }).success);

// 4. Formats
check("timestamptz needs an offset", !transactionInput.safeParse({ type: "expense", amount: 1, title: "t", occurred_at: "2026-10-02T10:00:00" }).success);
check("timestamptz with offset ok", transactionInput.safeParse({ type: "expense", amount: 1, title: "t", occurred_at: "2026-10-02T10:00:00+08:00" }).success);
check("monthly goal month must be the 1st", !monthlyGoalInput.safeParse({ month: "2026-10-15" }).success && monthlyGoalInput.safeParse({ month: "2026-10-01" }).success);
check("expense_tag normalised to lowercase", projectInput.parse({ name: "n", expense_tag: "Pi-NAS" }).expense_tag === "pi-nas");
check("bad expense_tag rejected", !projectInput.safeParse({ name: "n", expense_tag: "has space" }).success);
check("non-uuid ids rejected", !transactionInput.safeParse({ type: "expense", amount: 1, title: "t", account_id: "123" }).success);
check("fuel: total_cost optional", fuelLogInput.safeParse({ vehicle_id: crypto.randomUUID(), odometer_km: 100, liters: 30, price_per_liter: 2.05 }).success);

// 5. Fill-ups: the amount paid or the litres, with the other worked out from the price
const paid = fuelLogInput.safeParse({ vehicle_id: crypto.randomUUID(), odometer_km: 100, total_cost: 50 });
check("fuel: amount alone is enough, price defaults to 1.99", paid.success && paid.data.price_per_liter === 1.99 && paid.data.liters == null);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
check("fuel: RM 50 at 1.99 is 25.126 L", same(fillAmounts({ total_cost: 50, price_per_liter: 1.99 }), { liters: 25.126, total_cost: 50 }));
check("fuel: 30 L at 2.05 is RM 61.50", same(fillAmounts({ liters: 30, price_per_liter: 2.05 }), { liters: 30, total_cost: 61.5 }));
check("fuel: both given are both kept", same(fillAmounts({ liters: 30, total_cost: 60, price_per_liter: 2.05 }), { liters: 30, total_cost: 60 }));
check("fuel: neither given is an error", "error" in fillAmounts({ price_per_liter: 1.99 }));
check("fuel: amount with no price is an error", "error" in fillAmounts({ total_cost: 50, price_per_liter: 0 }));
check("fuel: a zero amount is an error", "error" in fillAmounts({ total_cost: 0, price_per_liter: 1.99 }));

// 6. The built-in food menu: every dish can be saved and logged by its key
const keys = MALAYSIAN_FOODS.map((f) => f.key);
const names = MALAYSIAN_FOODS.map((f) => f.name.toLowerCase());
check("menu: keys are unique", new Set(keys).size === keys.length, keys.filter((k, i) => keys.indexOf(k) !== i).join());
check("menu: names are unique", new Set(names).size === names.length, names.filter((n, i) => names.indexOf(n) !== i).join());
check("menu: every dish belongs to a listed group", MALAYSIAN_FOODS.every((f) => CATALOGUE_GROUPS.includes(f.group)) && CATALOGUE_GROUPS.every((g) => MALAYSIAN_FOODS.some((f) => f.group === g)));
// Calories should be roughly 4 kcal per gram of protein and carbohydrate and 9 per gram of fat.
const off = MALAYSIAN_FOODS.filter((f) => f.calories >= 100 && Math.abs(f.calories - (4 * f.protein_g + 4 * f.carbs_g + 9 * f.fat_g)) / f.calories > 0.15).map((f) => f.name);
check("menu: calories agree with the macros within 15%", off.length === 0, off.join(", "));
check("menu: the bakar dishes and Nescafe are there", ["nasi-lemak-bakar", "ayam-bakar", "daging-bakar", "lemak-bakar", "nasi-kerabu-daging-bakar", "nasi-kerabu-lemak-bakar", "nescafe-ais", "aimans-coffee"].every((k) => MALAYSIAN_FOODS.some((f) => f.key === k)));
check("menu: the western dishes are there", ["pasta-bolognese", "meatballs", "roasted-chicken", "grilled-chicken", "chicken-chop"].every((k) => MALAYSIAN_FOODS.some((f) => f.key === k && f.group === "Western")) && MALAYSIAN_FOODS.some((f) => f.key === "rotiboy"));
check("menu: vegetables are there", ["salad-leaves", "lettuce", "broccoli", "cucumber"].every((k) => MALAYSIAN_FOODS.some((f) => f.key === k && f.group === "Vegetables")));
check("menu: every drink has a volume and caffeine, and only drinks do", MENU_DRINKS.length > 0 && MENU_DRINKS.every((d) => d.volume_ml! > 0 && d.caffeine_mg != null) && MENU_MEALS.every((f) => f.volume_ml == null && f.group !== "Drinks"));
check("menu: meals and drinks together are the whole menu", MENU_MEALS.length + MENU_DRINKS.length === MALAYSIAN_FOODS.length && MENU_DRINKS.some((d) => d.key === "aimans-coffee"));
check("menu: the masakan panas dishes are there", ["nasi-goreng-kampung", "nasi-goreng-daging-merah", "nasi-goreng-sotong", "nasi-goreng-udang", "telur-mata", "paprik-ayam", "kuey-teow-kungfu", "tomyam-seafood"].every((k) => MALAYSIAN_FOODS.some((f) => f.key === k && f.group === "Masakan panas")));

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
