import { Suspense } from "react";
import { getSession } from "@/lib/app/session";
import {
  accountFields,
  assetFields,
  categoryFields,
  goalFields,
  liabilityFields,
  liabilityPaymentFields,
  monthlyGoalFields,
  subscriptionFields,
  toOptions,
  transactionFields,
  valuationFields,
} from "@/lib/app/forms";
import { date, day, dayWithYear, label, money, monthName, num, percent } from "@/lib/format";
import { monthOf } from "@/lib/utils/time";
import {
  createAccount,
  createAsset,
  createCategory,
  createGoal,
  createLiability,
  createSubscription,
  createTransaction,
  deleteAccount,
  deleteAsset,
  deleteCategory,
  deleteGoal,
  deleteLiability,
  deleteSubscription,
  deleteTransaction,
  recordLiabilityPayment,
  saveAssetValuation,
  saveMonthlyGoal,
  updateAccount,
  updateAsset,
  updateCategory,
  updateGoal,
  updateLiability,
  updateSubscription,
  updateTransaction,
} from "@/lib/actions/finance";
import { loadFinancePage } from "@/lib/services/finance/page";
import type { TransactionFilters } from "@/lib/services/finance/transactions";
import { Amount } from "@/components/app/amount";
import { CashflowChart } from "@/components/app/charts";
import { DeleteButton } from "@/components/app/delete-button";
import { EntryDialog } from "@/components/app/entry-dialog";
import { LogoLoader } from "@/components/app/logo";
import { ModuleTabs } from "@/components/app/module-tabs";
import { Pager } from "@/components/app/pager";
import { TransactionFilterBar } from "@/components/app/transaction-filters";
import { RowActions, Empty, Figure, Meter, ModulePage, Panel, Pill, Row, RowList, Section, Table, Td } from "@/components/app/ui";

export const metadata = { title: "Finance" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ledger filters from the URL. Anything malformed is ignored rather than sent to the database. */
function readFilters(params: Awaited<SearchParams>): TransactionFilters {
  const one = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key]) ?? "";
  const type = one("type");
  return {
    type: type === "income" || type === "expense" ? type : undefined,
    categoryId: UUID.test(one("category")) ? one("category") : undefined,
    accountId: UUID.test(one("account")) ? one("account") : undefined,
    search: one("q").trim().slice(0, 100) || undefined,
  };
}

/** The same filters as URL parameters, so the pager keeps them from page to page. */
function filterQuery(filters: TransactionFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.type) query.type = filters.type;
  if (filters.categoryId) query.category = filters.categoryId;
  if (filters.accountId) query.account = filters.accountId;
  if (filters.search) query.q = filters.search;
  return query;
}

async function FinanceContent({ searchParams }: { searchParams: SearchParams }) {
  const [{ db, today, currency, timezone }, params] = await Promise.all([getSession(), searchParams]);
  const page = Number.parseInt(String(params.page ?? "1"), 10) || 1;
  const rm = (n: number) => money(n, currency);

  const filters = readFilters(params);
  const {
    overview, cashflow: cashflowRows, ledger, categories: categoryRows, accounts: accountRows, subscriptions: subscriptionRows,
    subscriptionTotals, liabilities: liabilityRows, balances, assetValues: assetRows, assets: assetRecords, goals: goalRows,
  } = await loadFinancePage(db, monthOf(today), page, filters);
  const filtered = Object.values(filters).some(Boolean);
  const query = filterQuery(filters);

  const categoryName = new Map(categoryRows.map((c) => [c.id, c.name]));
  const accountName = new Map(accountRows.map((a) => [a.id, a.name]));
  const assetRecord = new Map(assetRecords.map((a) => [a.id, a]));
  const balanceOf = new Map(balances.map((b) => [b.liability_id, b]));
  const categoryOptions = toOptions(categoryRows);
  const accountOptions = toOptions(accountRows);
  const cashflow = [...cashflowRows].reverse().map((m) => ({ month: day(m.month, { month: "short" }), income: Number(m.income), spending: Number(m.expense) }));
  const sortedSubscriptions = [...subscriptionRows].sort((a, b) => Number(b.is_active) - Number(a.is_active) || Number(b.monthly_cost) - Number(a.monthly_cost));

  const overviewTab = (
    <>
      <Section
        id="month"
        title={`${monthName(overview.month)} so far`}
        aside={
          <EntryDialog
            label="Set monthly targets"
            description={`Income target and spending limit for ${monthName(overview.month)}.`}
            variant="outline"
            fields={monthlyGoalFields(overview.incomeTarget, overview.expenseLimit)}
            fixed={{ month: overview.month }}
            action={saveMonthlyGoal}
          />
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Panel className="p-5">
            <Figure label="Income" value={<Amount value={overview.income} currency={currency} />} />
            <Meter className="mt-4" label="Income against target" value={overview.income} max={overview.incomeTarget || overview.income} tone="pos" />
            <p className="mt-2 text-sm text-muted-foreground">{overview.incomeTarget > 0 ? `${num(overview.incomeProgressPct)}% of ${rm(overview.incomeTarget)} target` : "No income target set"}</p>
          </Panel>
          <Panel className="p-5">
            <Figure label="Spending" value={<Amount value={overview.expense} currency={currency} />} />
            <Meter className="mt-4" label="Spending against limit" value={overview.expense} max={overview.expenseLimit || overview.expense} limit tone="ink" />
            <p className="mt-2 text-sm text-muted-foreground">{overview.expenseLimit > 0 ? `${num(overview.expenseUsedPct)}% of ${rm(overview.expenseLimit)} limit` : "No spending limit set"}</p>
          </Panel>
          <Panel className="p-5">
            <Figure label="Net this month" value={<Amount value={overview.net} currency={currency} />} tone={overview.net < 0 ? "neg" : "pos"} hint="Income minus spending" />
          </Panel>
          <Panel className="p-5">
            <Figure label="Net worth" value={<Amount value={overview.netWorth} currency={currency} />} hint={`${rm(overview.totalAssets)} owned, ${rm(overview.totalLiabilities)} owed`} />
          </Panel>
        </div>
      </Section>

      <Section id="cashflow" title="Cashflow" hint="Income against spending for the last six months.">
        {cashflow.length === 0 ? (
          <Empty title="No transactions yet">Cashflow appears here once income or spending has been recorded.</Empty>
        ) : (
          <Panel className="p-4 sm:p-6">
            <CashflowChart data={cashflow} currency={currency} />
          </Panel>
        )}
      </Section>

      <Section
        id="transactions"
        title="Transactions"
        hint={
          filtered
            ? `${num(ledger.total)} matching: ${rm(ledger.income)} in, ${rm(ledger.expense)} out.`
            : ledger.total > ledger.pageSize
              ? `${num(ledger.total)} entries across all accounts, newest first.`
              : "Every entry across all accounts, newest first."
        }
        aside={<EntryDialog label="Add transaction" fields={transactionFields(categoryOptions, accountOptions)} action={createTransaction} />}
      >
        <TransactionFilterBar filters={query} categories={categoryOptions} accounts={accountOptions} />
        {ledger.total === 0 ? (
          filtered ? (
            <Empty title="Nothing matches">No transaction fits these filters. Clear them to see the whole ledger.</Empty>
          ) : (
            <Empty title="No transactions yet">Add your first income or expense to start the ledger.</Empty>
          )
        ) : (
          <>
          <RowList>
            {ledger.rows.map((t) => (
              <Row
                key={t.id}
                title={t.title}
                meta={[date(t.occurred_at, timezone), t.category_id && categoryName.get(t.category_id), t.account_id && accountName.get(t.account_id)].filter(Boolean).join(" · ")}
                value={<span className={t.type === "income" ? "text-pos" : undefined}>{`${t.type === "income" ? "+" : "−"}${rm(Number(t.amount))}`}</span>}
                actions={<RowActions>
<EntryDialog label="Edit transaction" fields={transactionFields(categoryOptions, accountOptions)} edit={{ id: t.id, values: t }} update={updateTransaction} />
<DeleteButton id={t.id} what={t.title} action={deleteTransaction} />
</RowActions>}
              />
            ))}
          </RowList>
          <Pager page={ledger.page} pages={ledger.pages} total={ledger.total} pageSize={ledger.pageSize} path="/finance" query={query} noun="Transactions" />
          </>
        )}
      </Section>
    </>
  );

  const subscriptionsTab = (
    <Section
      id="subscriptions"
      title="Subscriptions"
      hint={`${rm(subscriptionTotals.monthlyTotal)} a month, ${rm(subscriptionTotals.yearlyTotal)} a year across active subscriptions.`}
      aside={<EntryDialog label="Add subscription" fields={subscriptionFields(categoryOptions, accountOptions)} action={createSubscription} />}
    >
      {sortedSubscriptions.length === 0 ? (
        <Empty title="No subscriptions yet">Add recurring bills to see what they cost each month.</Empty>
      ) : (
        <Table head={[{ label: "Subscription" }, { label: "Type" }, { label: "Billed", right: true }, { label: "Per month", right: true }, { label: "Next bill", right: true }, { label: "" }]} minWidth="44rem">
          {sortedSubscriptions.map((s) => (
            <tr key={s.id} className={s.is_active ? undefined : "text-muted-foreground"}>
              <Td>
                <p className="font-medium">{s.name}</p>
                {s.vendor && <p className="text-xs text-muted-foreground">{s.vendor}</p>}
              </Td>
              <Td>{label(s.kind)}</Td>
              <Td right>
                {money(Number(s.amount), s.currency)} <span className="text-muted-foreground">{s.billing_cycle}</span>
              </Td>
              <Td right>{s.is_active ? rm(Number(s.monthly_cost)) : "—"}</Td>
              <Td right>{s.is_active ? (s.next_billing_on ? day(s.next_billing_on) : "—") : <Pill>Cancelled</Pill>}</Td>
              <Td className="w-px text-right">
                <RowActions>
<EntryDialog label="Edit subscription" fields={subscriptionFields(categoryOptions, accountOptions)} edit={{ id: s.id, values: s }} update={updateSubscription} />
<DeleteButton id={s.id} what={s.name} action={deleteSubscription} />
</RowActions>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );

  const debtsTab = (
    <Section
      id="debts"
      title="Debts"
      hint="What is still owed is the amount borrowed minus every payment recorded."
      aside={
        <>
          {liabilityRows.length > 0 && <EntryDialog label="Record payment" variant="outline" fields={liabilityPaymentFields(toOptions(liabilityRows))} action={recordLiabilityPayment} />}
          <EntryDialog label="Add debt" fields={liabilityFields(accountOptions)} action={createLiability} />
        </>
      }
    >
      {liabilityRows.length === 0 ? (
        <Empty title="No debts recorded">Add a loan, instalment plan or card balance to track how much is left.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {liabilityRows.map((l) => {
            const balance = balanceOf.get(l.id);
            const paid = Number(balance?.total_paid ?? l.opening_paid);
            const outstanding = Number(balance?.outstanding ?? l.principal);
            return (
              <Panel key={l.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.name}</p>
                    <p className="text-sm text-muted-foreground">{[label(l.kind), l.lender].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {l.status !== "active" && <Pill tone={l.status === "paid_off" ? "pos" : "neg"}>{label(l.status)}</Pill>}
                    <RowActions>
<EntryDialog label="Edit debt" fields={liabilityFields(accountOptions)} edit={{ id: l.id, values: l }} update={updateLiability} />
<DeleteButton id={l.id} what={l.name} action={deleteLiability} />
</RowActions>
                  </div>
                </div>
                <p className="mt-4 font-display text-2xl font-semibold tabular-nums tracking-tight">{rm(outstanding)}</p>
                <p className="text-sm text-muted-foreground">still owed of {rm(Number(l.principal))}</p>
                <Meter className="mt-4" label={`${l.name} paid off`} value={paid} max={Number(l.principal)} />
                <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Paid</dt>
                    <dd className="figure mt-0.5">{percent(paid, Number(l.principal))}%</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Monthly</dt>
                    <dd className="figure mt-0.5">{rm(Number(l.monthly_payment))}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Months left</dt>
                    <dd className="figure mt-0.5">{balance?.months_remaining ?? "—"}</dd>
                  </div>
                </dl>
              </Panel>
            );
          })}
        </div>
      )}
    </Section>
  );

  const assetsTab = (
    <Section
      id="assets"
      title="Assets"
      hint="Each asset at its latest recorded value, against what was paid for it."
      aside={
        <>
          {assetRows.length > 0 && (
            <EntryDialog label="Update value" variant="outline" fields={valuationFields(assetRows.map((a) => ({ value: a.asset_id, label: a.name })))} action={saveAssetValuation} />
          )}
          <EntryDialog label="Add asset" fields={assetFields} action={createAsset} />
        </>
      }
    >
      {assetRows.length === 0 ? (
        <Empty title="No assets recorded">Add savings, investments or valuables to build your net worth.</Empty>
      ) : (
        <Table head={[{ label: "Asset" }, { label: "Type" }, { label: "Paid", right: true }, { label: "Value now", right: true }, { label: "Change", right: true }, { label: "" }]} minWidth="44rem">
          {assetRows.map((a) => {
            const change = Number(a.current_value) - Number(a.amount_invested);
            return (
              <tr key={a.asset_id}>
                <Td>
                  <p className="font-medium">{a.name}</p>
                  {a.valued_on && <p className="text-xs text-muted-foreground">Valued {day(a.valued_on)}</p>}
                </Td>
                <Td>{label(a.kind)}</Td>
                <Td right>{rm(Number(a.amount_invested))}</Td>
                <Td right>{rm(Number(a.current_value))}</Td>
                <Td right className={change < 0 ? "text-neg" : "text-pos"}>
                  {change < 0 ? "−" : "+"}
                  {rm(Math.abs(change))}
                </Td>
                <Td className="w-px text-right">
                  <RowActions>
<EntryDialog label="Edit asset" fields={assetFields} edit={{ id: a.asset_id, values: assetRecord.get(a.asset_id) ?? {} }} update={updateAsset} />
<DeleteButton id={a.asset_id} what={a.name} action={deleteAsset} />
</RowActions>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </Section>
  );

  const goalsTab = (
    <Section id="goals" title="Goals" aside={<EntryDialog label="Add goal" fields={goalFields} action={createGoal} />}>
      {goalRows.length === 0 ? (
        <Empty title="No goals yet">Add something to save toward and track how close you are.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {goalRows.map((g) => (
            <Panel key={g.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{g.name}</p>
                <div className="flex items-center gap-1">
                  {g.is_completed && <Pill tone="pos">Reached</Pill>}
                  <RowActions>
<EntryDialog label="Edit goal" fields={goalFields} edit={{ id: g.id, values: g }} update={updateGoal} />
<DeleteButton id={g.id} what={g.name} action={deleteGoal} />
</RowActions>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{label(g.kind)}</p>
              <Meter className="mt-4" label={`${g.name} progress`} value={Number(g.current_amount)} max={Number(g.target_amount)} />
              <p className="mt-3 text-sm">
                <span className="figure font-medium">{rm(Number(g.current_amount))}</span>
                <span className="text-muted-foreground"> of {rm(Number(g.target_amount))}</span>
              </p>
              {g.target_date && <p className="mt-1 text-sm text-muted-foreground">Target date {dayWithYear(g.target_date)}</p>}
            </Panel>
          ))}
        </div>
      )}
    </Section>
  );

  const setupTab = (
    <>
      <Section id="accounts" title="Accounts" hint="Where the money sits." aside={<EntryDialog label="Add account" fields={accountFields} action={createAccount} />}>
        {accountRows.length === 0 ? (
          <Empty title="No accounts yet">Add a bank account, wallet or card to tag transactions with it.</Empty>
        ) : (
          <RowList>
            {accountRows.map((a) => (
              <Row key={a.id} title={a.name} meta={label(a.kind)} value={money(Number(a.opening_balance), a.currency)} sub="Opening balance" actions={<RowActions>
<EntryDialog label="Edit account" fields={accountFields} edit={{ id: a.id, values: a }} update={updateAccount} />
<DeleteButton id={a.id} what={a.name} action={deleteAccount} />
</RowActions>} />
            ))}
          </RowList>
        )}
      </Section>
      <Section id="categories" title="Categories" hint="Labels for sorting income and spending." aside={<EntryDialog label="Add category" fields={categoryFields} action={createCategory} />}>
        {categoryRows.length === 0 ? (
          <Empty title="No categories yet" />
        ) : (
          <RowList>
            {categoryRows.map((c) => (
              <Row key={c.id} title={c.name} meta={`${label(c.kind)} · ${label(c.bucket)}`} actions={<RowActions>
<EntryDialog label="Edit category" fields={categoryFields} edit={{ id: c.id, values: c }} update={updateCategory} />
<DeleteButton id={c.id} what={c.name} action={deleteCategory} />
</RowActions>} />
            ))}
          </RowList>
        )}
      </Section>
    </>
  );

  return (
    <ModuleTabs
      tabs={[
        { id: "overview", label: "Overview", content: overviewTab },
        { id: "subscriptions", label: "Subscriptions", content: subscriptionsTab },
        { id: "debts", label: "Debts", content: debtsTab },
        { id: "assets", label: "Assets", content: assetsTab },
        { id: "goals", label: "Goals", content: goalsTab },
        { id: "setup", label: "Accounts & categories", content: setupTab },
      ]}
    />
  );
}

export default function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <ModulePage module="finance" title="Finance" lede="This month's money, what recurs, what is owed and what is owned.">
      <Suspense fallback={<LogoLoader />}>
        <FinanceContent searchParams={searchParams} />
      </Suspense>
    </ModulePage>
  );
}
