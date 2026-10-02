import "server-only";
import type { Db } from "../crud";
import { fromPostgrest } from "../errors";
import { getNetWorth } from "./assets";
import { getMonthlyGoal } from "./goals";

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

/**
 * Port of finance-mobile's useOverviewStats: month income/expense vs targets plus net worth.
 * `month` is the first day of the month (YYYY-MM-01); month buckets use the user's timezone.
 */
export async function getOverview(db: Db, month: string): Promise<Overview> {
  const [cashflow, goal, worth] = await Promise.all([
    db.from("monthly_cashflow").select("income, expense, net").eq("month", month).maybeSingle(),
    getMonthlyGoal(db, month),
    getNetWorth(db),
  ]);
  if (cashflow.error) throw fromPostgrest(cashflow.error);

  const income = Number(cashflow.data?.income ?? 0);
  const expense = Number(cashflow.data?.expense ?? 0);
  const incomeTarget = Number(goal?.income_target ?? 0);
  const expenseLimit = Number(goal?.expense_limit ?? 0);

  return {
    month,
    income,
    expense,
    net: income - expense,
    incomeTarget,
    expenseLimit,
    incomeProgressPct: pct(income, incomeTarget),
    expenseUsedPct: pct(expense, expenseLimit),
    totalAssets: worth.total_assets,
    totalLiabilities: worth.total_liabilities,
    netWorth: worth.net_worth,
  };
}
