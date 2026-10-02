import "server-only";
import type { z } from "zod";
import { createCrud, type Db } from "../crud";
import { subscriptionInput, type Subscription } from "@/lib/validators/finance";
import { ServiceError } from "../errors";
import { transactions } from "./transactions";

export const subscriptions = createCrud<Subscription, z.infer<typeof subscriptionInput>>({
  table: "subscriptions",
  orderBy: "name",
  ascending: true,
});

export type SubscriptionSummary = {
  monthlyTotal: number;
  yearlyTotal: number;
  byKind: { kind: Subscription["kind"]; monthly: number; count: number }[];
};

/** Normalised recurring spend (uses the generated `monthly_cost` column) for active subscriptions. */
export async function summarize(db: Db): Promise<SubscriptionSummary> {
  return summarizeRows(await subscriptions.list(db, { filter: { is_active: true }, limit: 500 }));
}

/** The same totals from rows already in hand (the page RPCs return the subscriptions with everything else). */
export function summarizeRows(active: Subscription[]): SubscriptionSummary {
  const byKind = new Map<Subscription["kind"], { monthly: number; count: number }>();
  let monthlyTotal = 0;
  for (const s of active) {
    const monthly = Number(s.monthly_cost);
    monthlyTotal += monthly;
    const entry = byKind.get(s.kind) ?? { monthly: 0, count: 0 };
    entry.monthly += monthly;
    entry.count += 1;
    byKind.set(s.kind, entry);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    monthlyTotal: round(monthlyTotal),
    yearlyTotal: round(monthlyTotal * 12),
    byKind: [...byKind.entries()]
      .map(([kind, v]) => ({ kind, monthly: round(v.monthly), count: v.count }))
      .sort((a, b) => b.monthly - a.monthly),
  };
}

/**
 * "I have paid this": record a charge for the subscription now. The bill date is left alone. The daily
 * job moves it on, and because this month already has a charge it does not record another.
 */
export async function payNow(db: Db, id: string) {
  const sub = await subscriptions.get(db, id);
  if (!sub.is_active) throw new ServiceError("constraint_violation", "This subscription is cancelled.");
  if (!(Number(sub.amount) > 0)) throw new ServiceError("constraint_violation", "This subscription has no amount to record.");
  return transactions.create(db, {
    type: "expense",
    amount: Number(sub.amount),
    occurred_at: new Date().toISOString(),
    title: sub.name,
    note: "Marked as paid",
    account_id: sub.account_id ?? null,
    category_id: sub.category_id ?? null,
    subscription_id: sub.id,
  });
}

function advance(isoDate: string, cycle: Subscription["billing_cycle"]): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (cycle === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + (cycle === "monthly" ? 1 : cycle === "quarterly" ? 3 : 12));
  return d.toISOString().slice(0, 10);
}

/** Log this billing as an expense (tagged to the subscription) and move next_billing_on forward. */
export async function markBilled(db: Db, id: string) {
  const sub = await subscriptions.get(db, id);
  if (!sub.is_active) throw new ServiceError("constraint_violation", "This subscription is cancelled.");
  const billedOn = sub.next_billing_on ?? new Date().toISOString().slice(0, 10);

  const expense = await transactions.create(db, {
    type: "expense",
    amount: Number(sub.amount),
    occurred_at: `${billedOn}T00:00:00Z`,
    title: sub.name,
    account_id: sub.account_id ?? null,
    category_id: sub.category_id ?? null,
    subscription_id: sub.id,
  });
  const updated = await subscriptions.update(db, id, { next_billing_on: advance(billedOn, sub.billing_cycle) });
  return { subscription: updated, transaction: expense };
}
