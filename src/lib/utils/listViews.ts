// Pure list-view helpers for the screens. No React, no Dexie. Inputs are never mutated.
import { normalizeSubscription } from "@/lib/haunting";
import { MIN_INCOME_CENTS, POLTERGEIST_RATIO } from "@/lib/haunting/config";
import { isInWindow } from "@/lib/haunting/dates";
import { isSmallExpense } from "@/lib/haunting/ghosts";
import type { DebtRow, LocalDate, SubscriptionRow, TransactionRow } from "@/types/finance";

const EMPTY_TOTAL = 0;
const NO_ROWS = 0;

export type TransactionListRow = TransactionRow & { isGhost: boolean };

export type SmallExpenseSummary = {
  totalCents: number;
  /** Poltergeist threshold in integer cents: POLTERGEIST_RATIO times monthly income, rounded. */
  thresholdCents: number;
  /** True while the small-expense total strictly exceeds the threshold (same rule as the engine). */
  awake: boolean;
};

function compareIds(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Descending by value, ties broken by id ascending. */
function compareDescendingThenId(
  valueA: number,
  valueB: number,
  idA: string,
  idB: string,
): number {
  if (valueA !== valueB) return valueB - valueA;
  return compareIds(idA, idB);
}

function getMonthlyCostCents(row: SubscriptionRow): number {
  return normalizeSubscription({
    subscriptionId: row.id,
    name: row.name,
    amountCents: row.amountCents,
    cadence: row.cadence,
    usage: row.usage,
    active: row.active,
  }).monthlyCostCents;
}

/** Returns a new array sorted by normalized monthly cost, highest first; ties by id ascending. */
export function sortSubscriptionsByMonthlyCost(rows: readonly SubscriptionRow[]): SubscriptionRow[] {
  return rows
    .map((row) => ({ row, cost: getMonthlyCostCents(row) }))
    .sort((a, b) => compareDescendingThenId(a.cost, b.cost, a.row.id, b.row.id))
    .map((entry) => entry.row);
}

/** Returns a new array sorted by balance, highest first; ties by id ascending. */
export function sortDebtsByBalance(rows: readonly DebtRow[]): DebtRow[] {
  return [...rows].sort((a, b) =>
    compareDescendingThenId(a.balanceCents, b.balanceCents, a.id, b.id),
  );
}

/** Transactions dated inside the 30-day window ending on `now`, as a new array. */
function getWindowTransactions(
  rows: readonly TransactionRow[],
  now: LocalDate,
): TransactionRow[] {
  return rows.filter((row) => isInWindow(row.date, now));
}

/** Date descending, then id ascending. */
function compareNewestFirst(a: TransactionRow, b: TransactionRow): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return compareIds(a.id, b.id);
}

/**
 * In-window transactions, newest first (date descending, then id ascending), each flagged as a
 * Ghost when its amount is a small expense. `income` is accepted for call-site symmetry with
 * `getSmallExpenseSummary`; the Ghost flag does not depend on it.
 */
export function toTransactionRows(
  rows: readonly TransactionRow[],
  now: LocalDate,
  income: number,
): TransactionListRow[] {
  void income;
  return getWindowTransactions(rows, now)
    .sort(compareNewestFirst)
    .map((row) => ({ ...row, isGhost: isSmallExpense(row.amountCents) }));
}

/** Total of in-window small expenses, the Poltergeist threshold and whether the Poltergeist is awake. */
export function getSmallExpenseSummary(
  rows: readonly TransactionRow[],
  now: LocalDate,
  monthlyIncomeCents: number,
): SmallExpenseSummary {
  const small = getWindowTransactions(rows, now).filter((row) => isSmallExpense(row.amountCents));
  const totalCents = small.reduce((sum, row) => sum + row.amountCents, EMPTY_TOTAL);
  const incomeUsable =
    Number.isFinite(monthlyIncomeCents) && monthlyIncomeCents >= MIN_INCOME_CENTS;
  const exactThreshold = incomeUsable ? POLTERGEIST_RATIO * monthlyIncomeCents : EMPTY_TOTAL;
  return {
    totalCents,
    thresholdCents: Math.round(exactThreshold),
    awake: incomeUsable && small.length > NO_ROWS && totalCents > exactThreshold,
  };
}
