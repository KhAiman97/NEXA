import "server-only";
import type { z } from "zod";
import { createCrud, selectView, type Db } from "../crud";
import { fromPostgrest } from "../errors";
import { withLinkedExpense } from "./transactions";
import {
  liabilityInput,
  type Liability,
  type LiabilityPayment,
  type liabilityPaymentInput,
} from "@/lib/validators/finance";

export const liabilities = createCrud<Liability, z.infer<typeof liabilityInput>>({ table: "liabilities", orderBy: "name", ascending: true });

export type LiabilityBalance = {
  liability_id: string;
  user_id: string;
  name: string;
  kind: Liability["kind"];
  principal: number;
  monthly_payment: number;
  total_paid: number;
  outstanding: number;
  months_remaining: number | null;
};

/** Balances are derived from principal − opening_paid − payments (view `liability_balances`). */
export function listLiabilityBalances(db: Db) {
  return selectView<LiabilityBalance>(db, "liability_balances", { orderBy: "name" });
}

export async function listPayments(db: Db, liabilityId: string): Promise<LiabilityPayment[]> {
  const { data, error } = await db
    .from("liability_payments")
    .select("*")
    .eq("liability_id", liabilityId)
    .order("paid_on", { ascending: false });
  if (error) throw fromPostgrest(error);
  return (data ?? []) as LiabilityPayment[];
}

/**
 * Record a repayment (optionally mirrored into the ledger as an expense).
 * Marks the liability `paid_off` once nothing is outstanding.
 */
export async function recordPayment(db: Db, input: z.infer<typeof liabilityPaymentInput>) {
  const { record_expense, liability_id, ...payment } = input;

  const { data: liability, error: lookupError } = await db.from("liabilities").select("name").eq("id", liability_id).maybeSingle();
  if (lookupError) throw fromPostgrest(lookupError);

  const row = await withLinkedExpense(
    db,
    liability && record_expense
      ? { title: `${liability.name} payment`, amount: payment.amount, occurredAt: `${payment.paid_on}T00:00:00Z`, link: record_expense }
      : null,
    async (transactionId) => {
      const { data, error } = await db
        .from("liability_payments")
        .insert({ ...payment, liability_id, transaction_id: transactionId })
        .select()
        .single();
      if (error) throw fromPostgrest(error);
      return data as LiabilityPayment;
    },
  );

  const { data: balance } = await db.from("liability_balances").select("outstanding").eq("liability_id", liability_id).maybeSingle();
  if (balance && Number(balance.outstanding) === 0) {
    await db.from("liabilities").update({ status: "paid_off" }).eq("id", liability_id).eq("status", "active");
  }
  return row;
}

export async function deletePayment(db: Db, id: string): Promise<void> {
  const { error } = await db.from("liability_payments").delete().eq("id", id);
  if (error) throw fromPostgrest(error);
}
