import "server-only";
import type { Db } from "../crud";
import { callBundle } from "../bundle";
import type { Account, Asset, Category, Goal, Liability, Subscription } from "@/lib/validators/finance";
import type { AssetWithValue } from "./assets";
import type { LiabilityBalance } from "./liabilities";
import { toOverview, type Overview } from "./overview";
import { summarizeRows, type SubscriptionSummary } from "./subscriptions";
import { TRANSACTIONS_PAGE_SIZE, toFilterArgs, toTransactionsPage, type LedgerResult, type TransactionFilters, type TransactionsPage } from "./transactions";

export type Cashflow = { month: string; income: number; expense: number; net: number };

type FinanceBundle = {
  overview: Record<string, unknown> | null;
  cashflow: Cashflow[];
  ledger: LedgerResult;
  categories: Category[];
  accounts: Account[];
  subscriptions: Subscription[];
  liabilities: Liability[];
  balances: LiabilityBalance[];
  asset_values: AssetWithValue[];
  assets: Asset[];
  goals: Goal[];
};

export type FinancePage = {
  overview: Overview;
  cashflow: Cashflow[];
  ledger: TransactionsPage;
  categories: Category[];
  accounts: Account[];
  subscriptions: Subscription[];
  subscriptionTotals: SubscriptionSummary;
  liabilities: Liability[];
  balances: LiabilityBalance[];
  assetValues: AssetWithValue[];
  assets: Asset[];
  goals: Goal[];
};

/** Everything the Finance page shows, in one round trip (the finance_bundle RPC). */
export async function loadFinancePage(db: Db, month: string, page: number, filters: TransactionFilters = {}): Promise<FinancePage> {
  const pageSize = TRANSACTIONS_PAGE_SIZE;
  const fetchPage = (n: number) =>
    callBundle<FinanceBundle>(db, "finance_bundle", { p_month: month, p_limit: pageSize, p_offset: (n - 1) * pageSize, ...toFilterArgs(filters) });

  const wanted = Math.max(1, Math.floor(page) || 1);
  let bundle = await fetchPage(wanted);
  // A page past the end, e.g. after deleting the last row on the last page: fall back to the last one that exists.
  const pages = Math.max(1, Math.ceil(Number(bundle.ledger.total) / pageSize));
  const current = Math.min(wanted, pages);
  if (current !== wanted) bundle = await fetchPage(current);

  return {
    overview: toOverview(month, bundle.overview),
    cashflow: bundle.cashflow,
    ledger: toTransactionsPage(bundle.ledger, current, pageSize),
    categories: bundle.categories,
    accounts: bundle.accounts,
    subscriptions: bundle.subscriptions,
    subscriptionTotals: summarizeRows(bundle.subscriptions.filter((s) => s.is_active)),
    liabilities: bundle.liabilities,
    balances: bundle.balances,
    assetValues: bundle.asset_values,
    assets: bundle.assets,
    goals: bundle.goals,
  };
}
