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

/** Ledger filters. They are applied inside the transactions_page RPC, not after the rows come back. */
export type TransactionFilters = { type?: "income" | "expense"; categoryId?: string; accountId?: string; search?: string };

/** What the transactions_page RPC returns: one page of rows plus totals for everything that matched. */
export type LedgerResult = { total: number; income: number; expense: number; rows: Transaction[] };

export type TransactionsPage = {
  rows: Transaction[];
  /** Rows matching the filters, across all pages. */
  total: number;
  /** Income and spending summed over everything that matched, not just this page. */
  income: number;
  expense: number;
  page: number;
  pages: number;
  pageSize: number;
};

export function toFilterArgs(filters: TransactionFilters) {
  return {
    p_type: filters.type ?? null,
    p_category_id: filters.categoryId ?? null,
    p_account_id: filters.accountId ?? null,
    p_search: filters.search?.trim() || null,
  };
}

export function toTransactionsPage(result: LedgerResult, page: number, pageSize: number): TransactionsPage {
  const total = Number(result.total);
  return {
    rows: result.rows,
    total,
    income: Number(result.income),
    expense: Number(result.expense),
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    pageSize,
  };
}

/**
 * One page of the ledger, newest first, plus the totals for the pager: a single round trip
 * (the transactions_page RPC). A page past the end, e.g. after deleting the last row on the
 * last page, falls back to the last page that exists.
 */
export async function listTransactionsPage(db: Db, page: number, filters: TransactionFilters = {}, pageSize = TRANSACTIONS_PAGE_SIZE): Promise<TransactionsPage> {
  const fetchPage = async (n: number) => {
    const { data, error } = await db.rpc("transactions_page", { p_limit: pageSize, p_offset: (n - 1) * pageSize, ...toFilterArgs(filters) });
    if (error) throw fromPostgrest(error);
    return data as LedgerResult;
  };

  const wanted = Math.max(1, Math.floor(page) || 1);
  let result = await fetchPage(wanted);
  const current = Math.min(wanted, Math.max(1, Math.ceil(Number(result.total) / pageSize)));
  if (current !== wanted) result = await fetchPage(current);
  return toTransactionsPage(result, current, pageSize);
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
