// Sanity checks for the validation layer. Run: npx tsx scripts/check-validators.ts
import { partialOf } from "../lib/validators/common";
import { accountInput, transactionInput, monthlyGoalInput } from "../lib/validators/finance";
import { projectInput } from "../lib/validators/projects";
import { fuelLogInput } from "../lib/validators/vehicles";

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

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
