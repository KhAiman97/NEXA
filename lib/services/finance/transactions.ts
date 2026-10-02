import "server-only";
import type { z } from "zod";
import { createCrud, type Db } from "../crud";
import { fromPostgrest } from "../errors";
import {
  transactionInput,
  type Transaction,
  type ledgerLink,
} from "@/lib/validators/finance";
import type { transactionQuery } from "@/lib/validators/finance";

type TransactionInsert = z.infer<typeof transactionInput>;
type LedgerLink = z.infer<typeof ledgerLink>;

export const transactions = createCrud<Transaction, TransactionInsert>({
  table: "transactions",
  orderBy: "occurred_at",
});

export function listTransactions(db: Db, query: z.infer<typeof transactionQuery> = {}) {
  const { from, to, limit, offset, ...filter } = query;
  return transactions.list(db, { filter, range: { column: "occurred_at", from, to }, limit, offset });
}

type ExpenseSpec = {
  title: string;
  amount: number;
  occurredAt: string;
  link?: LedgerLink | null;
};

/**
 * Create a ledger expense, run `then` with its id, and delete the expense again if `then` fails.
 * Pass `spec = null/undefined` to skip the ledger entry. supabase-js has no multi-statement
 * transactions, so this is compensation rather than atomicity: a crash between the two inserts
 * can leave an orphan expense (it is still visible and deletable in the ledger).
 */
export async function withLinkedExpense<T>(
  db: Db,
  spec: ExpenseSpec | null | undefined,
  then: (transactionId: string | null) => Promise<T>,
): Promise<T> {
  if (!spec || !spec.link || spec.amount <= 0) return then(null);

  const created = await transactions.create(db, {
    type: "expense",
    amount: spec.amount,
    occurred_at: spec.occurredAt,
    title: spec.title,
    account_id: spec.link.account_id ?? null,
    category_id: spec.link.category_id ?? null,
    project_id: spec.link.project_id ?? null,
  });

  try {
    return await then(created.id);
  } catch (err) {
    const { error } = await db.from("transactions").delete().eq("id", created.id);
    if (error) console.error("[withLinkedExpense] rollback failed", fromPostgrest(error).message);
    throw err;
  }
}
