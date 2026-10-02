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

export const TRANSACTIONS_PAGE_SIZE = 10;

export type TransactionsPage = { rows: Transaction[]; total: number; page: number; pages: number; pageSize: number };

/**
 * One page of the ledger, newest first, plus the total for the pager: a single round trip
 * (the transactions_page RPC). A page past the end, e.g. after deleting the last row on the
 * last page, falls back to the last page that exists.
 */
export async function listTransactionsPage(db: Db, page: number, pageSize = TRANSACTIONS_PAGE_SIZE): Promise<TransactionsPage> {
  const fetchPage = async (n: number) => {
    const { data, error } = await db.rpc("transactions_page", { p_limit: pageSize, p_offset: (n - 1) * pageSize });
    if (error) throw fromPostgrest(error);
    const result = data as { total: number; rows: Transaction[] };
    return { rows: result.rows, total: Number(result.total) };
  };

  const wanted = Math.max(1, Math.floor(page) || 1);
  let { rows, total } = await fetchPage(wanted);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(wanted, pages);
  if (current !== wanted) ({ rows, total } = await fetchPage(current));
  return { rows, total, page: current, pages, pageSize };
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
