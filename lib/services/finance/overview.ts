import "server-only";
import type { Db } from "../crud";
import { fromPostgrest } from "../errors";

export type Overview = {
  month: string;
  income: number;
  expense: number;
  net: number;
  incomeTarget: number;
  expenseLimit: number;
  /** % of the income target reached (0 when no target). */
  incomeProgressPct: number;
  /** % of the expense limit already used (0 when no limit). */
  expenseUsedPct: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
};

const pct = (value: number, of: number) => (of > 0 ? Math.round((value / of) * 1000) / 10 : 0);

/** Shape one row of the finance_overview RPC (missing parts count as 0). */
export function toOverview(month: string, row: Record<string, unknown> | null | undefined): Overview {
  const n = (key: string) => Number(row?.[key] ?? 0);
  const income = n("income");
  const expense = n("expense");
  const incomeTarget = n("income_target");
  const expenseLimit = n("expense_limit");

  return {
    month,
    income,
    expense,
    net: income - expense,
    incomeTarget,
    expenseLimit,
    incomeProgressPct: pct(income, incomeTarget),
    expenseUsedPct: pct(expense, expenseLimit),
    totalAssets: n("total_assets"),
    totalLiabilities: n("total_liabilities"),
    netWorth: n("net_worth"),
  };
}

/**
 * Port of finance-mobile's useOverviewStats: month income/expense vs targets plus net worth.
 * `month` is the first day of the month (YYYY-MM-01); month buckets use the user's timezone.
 * One round trip: the finance_overview RPC reads the cashflow view, the month's targets and net worth together.
 */
export async function getOverview(db: Db, month: string): Promise<Overview> {
  const { data, error } = await db.rpc("finance_overview", { p_month: month }).maybeSingle();
  if (error) throw fromPostgrest(error);
  return toOverview(month, data as Record<string, unknown> | null);
}
