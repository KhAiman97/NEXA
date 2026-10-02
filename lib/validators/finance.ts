import { z } from "zod";
import * as c from "./common";

export type Base = { id: string; user_id: string; created_at: string; updated_at: string };
export type RowOf<S extends z.ZodType> = z.infer<S> & Base;

const ACCOUNT_KINDS = ["cash", "bank", "ewallet", "credit_card", "savings", "other"] as const;
export const accountInput = z.object({
  name: c.name,
  kind: z.enum(ACCOUNT_KINDS).default("bank"),
  currency: c.currency.default("MYR"),
  opening_balance: z.number().finite().default(0),
  colour: c.colour,
  is_active: z.boolean().default(true),
});

const BUCKETS = [
  "general", "housing", "utilities", "food", "transport", "vehicle", "health", "fitness", "sports",
  "hardware", "prototyping", "digital_overhead", "cloud_subscription", "insurance", "debt", "other",
] as const;
export const categoryInput = z.object({
  name: c.name,
  kind: z.enum(["income", "expense"]),
  bucket: z.enum(BUCKETS).default("general"),
  colour: c.colour,
  icon: z.string().max(50).nullish(),
});

export const bookInput = z.object({
  name: c.name,
  description: c.optionalText,
  starts_on: c.date.nullish(),
  ends_on: c.date.nullish(),
  colour: c.colour,
  is_active: z.boolean().default(true),
});

export const transactionInput = z.object({
  type: z.enum(["income", "expense"]),
  amount: c.positiveMoney,
  occurred_at: c.timestamptz.default(() => new Date().toISOString()),
  title: c.name,
  note: c.optionalText,
  account_id: c.optionalId,
  category_id: c.optionalId,
  book_id: c.optionalId,
  project_id: c.optionalId,
  subscription_id: c.optionalId,
  inventory_item_id: c.optionalId,
});

export const transactionQuery = z.object({
  type: z.enum(["income", "expense"]).optional(),
  account_id: c.id.optional(),
  category_id: c.id.optional(),
  book_id: c.id.optional(),
  project_id: c.id.optional(),
  from: c.timestamptz.optional(),
  to: c.timestamptz.optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

const LIABILITY_KINDS = ["loan", "hardware_installment", "credit_card", "bnpl", "other"] as const;
export const liabilityInput = z.object({
  name: c.name,
  kind: z.enum(LIABILITY_KINDS).default("loan"),
  lender: c.optionalText,
  principal: c.money,
  opening_paid: c.money.default(0),
  interest_rate_pct: c.nonNegNumber.default(0),
  term_months: c.posInt.nullish(),
  monthly_payment: c.money,
  starts_on: c.date.nullish(),
  due_day: z.number().int().min(1).max(31).nullish(),
  status: z.enum(["active", "paid_off", "defaulted"]).default("active"),
  account_id: c.optionalId,
  colour: c.colour,
  icon: z.string().max(50).nullish(),
  notes: c.optionalText,
});

/** Optionally mirror a payment/charge into the ledger as an expense. */
export const ledgerLink = z
  .object({
    category_id: c.optionalId,
    account_id: c.optionalId,
    project_id: c.optionalId,
  })
  .optional();

export const liabilityPaymentInput = z.object({
  liability_id: c.id,
  paid_on: c.date.default(() => new Date().toISOString().slice(0, 10)),
  amount: c.positiveMoney,
  note: c.optionalText,
  record_expense: ledgerLink,
});

const SUB_KINDS = [
  "cloud_infra", "saas", "ai_api", "domain_hosting", "software_license",
  "streaming", "telco_internet", "membership", "other",
] as const;
export const subscriptionInput = z.object({
  name: c.name,
  kind: z.enum(SUB_KINDS).default("saas"),
  vendor: c.optionalText,
  amount: c.money,
  currency: c.currency.default("MYR"),
  billing_cycle: z.enum(["weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
  next_billing_on: c.date.nullish(),
  started_on: c.date.nullish(),
  cancelled_on: c.date.nullish(),
  auto_renew: z.boolean().default(true),
  is_active: z.boolean().default(true),
  account_id: c.optionalId,
  category_id: c.optionalId,
  colour: c.colour,
  icon: z.string().max(50).nullish(),
  notes: c.optionalText,
});

const ASSET_KINDS = ["cash", "stock", "fund", "crypto", "gold", "property", "vehicle", "device", "other"] as const;
export const assetInput = z.object({
  name: c.name,
  kind: z.enum(ASSET_KINDS).default("other"),
  code: z.string().trim().max(50).nullish(),
  purchased_on: c.date.nullish(),
  amount_invested: c.money.default(0),
  disposed_on: c.date.nullish(),
  colour: c.colour,
  notes: c.optionalText,
});

export const valuationInput = z.object({
  asset_id: c.id,
  valued_on: c.date.default(() => new Date().toISOString().slice(0, 10)),
  value: c.money,
});

export const goalInput = z.object({
  name: c.name,
  kind: z.enum(["savings", "emergency_fund", "purchase", "debt_payoff"]).default("savings"),
  target_amount: c.money,
  current_amount: c.money.default(0),
  target_date: c.date.nullish(),
  is_completed: z.boolean().default(false),
  colour: c.colour,
  icon: z.string().max(50).nullish(),
});

export const monthlyGoalInput = z.object({
  month: c.monthStart,
  income_target: c.money.default(0),
  expense_limit: c.money.default(0),
});

// Row types (what the services return)
export type Account = RowOf<typeof accountInput>;
export type Category = RowOf<typeof categoryInput>;
export type Book = RowOf<typeof bookInput>;
export type Transaction = RowOf<typeof transactionInput>;
export type Liability = RowOf<typeof liabilityInput>;
export type LiabilityPayment = Omit<RowOf<typeof liabilityPaymentInput>, "record_expense"> & { transaction_id: string | null };
export type Subscription = RowOf<typeof subscriptionInput> & { monthly_cost: number };
export type Asset = RowOf<typeof assetInput>;
export type AssetValuation = RowOf<typeof valuationInput>;
export type Goal = RowOf<typeof goalInput>;
export type MonthlyGoal = RowOf<typeof monthlyGoalInput>;
