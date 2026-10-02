"use server";

import { run, parse } from "./run";
import { id, partialOf, monthStart } from "@/lib/validators/common";
import {
  accountInput, assetInput, bookInput, categoryInput, goalInput, liabilityInput, liabilityPaymentInput,
  monthlyGoalInput, subscriptionInput, transactionInput, valuationInput,
} from "@/lib/validators/finance";
import { accounts, books, categories } from "@/lib/services/finance/reference";
import { transactions } from "@/lib/services/finance/transactions";
import { deletePayment, liabilities, recordPayment } from "@/lib/services/finance/liabilities";
import { markBilled, subscriptions } from "@/lib/services/finance/subscriptions";
import { assets, deleteValuation, upsertValuation } from "@/lib/services/finance/assets";
import { deleteMonthlyGoal, goals, setMonthlyGoal } from "@/lib/services/finance/goals";

const F = ["/finance"];

// Accounts · categories · books
export async function createAccount(input: unknown) { return run(({ db }) => accounts.create(db, parse(accountInput, input)), F); }
export async function updateAccount(accountId: unknown, patch: unknown) { return run(({ db }) => accounts.update(db, parse(id, accountId), parse(partialOf(accountInput), patch)), F); }
export async function deleteAccount(accountId: unknown) { return run(({ db }) => accounts.remove(db, parse(id, accountId)), F); }

export async function createCategory(input: unknown) { return run(({ db }) => categories.create(db, parse(categoryInput, input)), F); }
export async function updateCategory(categoryId: unknown, patch: unknown) { return run(({ db }) => categories.update(db, parse(id, categoryId), parse(partialOf(categoryInput), patch)), F); }
export async function deleteCategory(categoryId: unknown) { return run(({ db }) => categories.remove(db, parse(id, categoryId)), F); }

export async function createBook(input: unknown) { return run(({ db }) => books.create(db, parse(bookInput, input)), F); }
export async function updateBook(bookId: unknown, patch: unknown) { return run(({ db }) => books.update(db, parse(id, bookId), parse(partialOf(bookInput), patch)), F); }
export async function deleteBook(bookId: unknown) { return run(({ db }) => books.remove(db, parse(id, bookId)), F); }

// Transactions
export async function createTransaction(input: unknown) { return run(({ db }) => transactions.create(db, parse(transactionInput, input)), F); }
export async function updateTransaction(transactionId: unknown, patch: unknown) { return run(({ db }) => transactions.update(db, parse(id, transactionId), parse(partialOf(transactionInput), patch)), F); }
export async function deleteTransaction(transactionId: unknown) { return run(({ db }) => transactions.remove(db, parse(id, transactionId)), F); }

// Liabilities (incl. hardware installment plans)
export async function createLiability(input: unknown) { return run(({ db }) => liabilities.create(db, parse(liabilityInput, input)), F); }
export async function updateLiability(liabilityId: unknown, patch: unknown) { return run(({ db }) => liabilities.update(db, parse(id, liabilityId), parse(partialOf(liabilityInput), patch)), F); }
export async function deleteLiability(liabilityId: unknown) { return run(({ db }) => liabilities.remove(db, parse(id, liabilityId)), F); }
export async function recordLiabilityPayment(input: unknown) { return run(({ db }) => recordPayment(db, parse(liabilityPaymentInput, input)), F); }
export async function deleteLiabilityPayment(paymentId: unknown) { return run(({ db }) => deletePayment(db, parse(id, paymentId)), F); }

// Subscriptions / digital overhead
export async function createSubscription(input: unknown) { return run(({ db }) => subscriptions.create(db, parse(subscriptionInput, input)), F); }
export async function updateSubscription(subscriptionId: unknown, patch: unknown) { return run(({ db }) => subscriptions.update(db, parse(id, subscriptionId), parse(partialOf(subscriptionInput), patch)), F); }
export async function deleteSubscription(subscriptionId: unknown) { return run(({ db }) => subscriptions.remove(db, parse(id, subscriptionId)), F); }
export async function markSubscriptionBilled(subscriptionId: unknown) { return run(({ db }) => markBilled(db, parse(id, subscriptionId)), F); }

// Assets
export async function createAsset(input: unknown) { return run(({ db }) => assets.create(db, parse(assetInput, input)), F); }
export async function updateAsset(assetId: unknown, patch: unknown) { return run(({ db }) => assets.update(db, parse(id, assetId), parse(partialOf(assetInput), patch)), F); }
export async function deleteAsset(assetId: unknown) { return run(({ db }) => assets.remove(db, parse(id, assetId)), F); }
export async function saveAssetValuation(input: unknown) { return run(({ db }) => upsertValuation(db, parse(valuationInput, input)), F); }
export async function deleteAssetValuation(valuationId: unknown) { return run(({ db }) => deleteValuation(db, parse(id, valuationId)), F); }

// Goals
export async function createGoal(input: unknown) { return run(({ db }) => goals.create(db, parse(goalInput, input)), F); }
export async function updateGoal(goalId: unknown, patch: unknown) { return run(({ db }) => goals.update(db, parse(id, goalId), parse(partialOf(goalInput), patch)), F); }
export async function deleteGoal(goalId: unknown) { return run(({ db }) => goals.remove(db, parse(id, goalId)), F); }
export async function saveMonthlyGoal(input: unknown) { return run(({ db }) => setMonthlyGoal(db, parse(monthlyGoalInput, input)), F); }
export async function removeMonthlyGoal(month: unknown) { return run(({ db }) => deleteMonthlyGoal(db, parse(monthStart, month)), F); }
