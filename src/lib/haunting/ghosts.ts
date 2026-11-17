// Small expenses: ghost generation and Poltergeist detection. Pure and
// deterministic; never throws and never mutates its inputs.

import { MIN_INCOME_CENTS, POLTERGEIST_RATIO, SMALL_EXPENSE_THRESHOLD_CENTS } from "./config";
import { isInWindow } from "./dates";
import type { Ghost, InternalTransaction, Poltergeist } from "./types";

const EMPTY_TOTAL = 0;
const INCREMENT = 1;

/** True only for finite amounts strictly between 0 and the small-expense threshold. */
export function isSmallExpense(amountCents: number): boolean {
  return (
    Number.isFinite(amountCents) && amountCents > 0 && amountCents < SMALL_EXPENSE_THRESHOLD_CENTS
  );
}

function isQualifying(tx: InternalTransaction, now: string): boolean {
  return isSmallExpense(tx.amountCents) && isInWindow(tx.date, now);
}

function toGhost(tx: InternalTransaction): Ghost {
  return {
    transactionId: tx.transactionId,
    amount: tx.amountCents,
    description: tx.description,
    category: tx.category,
    date: tx.date,
  };
}

function sumCents(transactions: InternalTransaction[]): number {
  return transactions.reduce((total, tx) => total + tx.amountCents, EMPTY_TOTAL);
}

/** Integer-cent totals per category; Object.fromEntries keeps odd keys such as "__proto__" as own data. */
function sumByCategory(transactions: InternalTransaction[]): Record<string, number> {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    totals.set(tx.category, (totals.get(tx.category) ?? EMPTY_TOTAL) + tx.amountCents);
  }
  return Object.fromEntries(totals);
}

function buildPoltergeist(transactions: InternalTransaction[], totalAmount: number): Poltergeist {
  return {
    totalAmount,
    transactionCount: transactions.length,
    byCategory: sumByCategory(transactions),
  };
}

/**
 * Qualifying transactions are small expenses dated inside the rolling window ending on `now`.
 * When income is usable and their total strictly exceeds POLTERGEIST_RATIO × monthly income,
 * they merge into one Poltergeist and no individual ghosts remain. Otherwise each becomes a ghost.
 */
export function computeGhostsAndPoltergeist(
  transactions: InternalTransaction[],
  monthlyIncomeCents: number,
  now: string,
): { ghosts: Ghost[]; poltergeist: Poltergeist | null } {
  const qualifying = transactions.filter((tx) => isQualifying(tx, now));
  const total = sumCents(qualifying);
  const incomeUsable =
    Number.isFinite(monthlyIncomeCents) && monthlyIncomeCents >= MIN_INCOME_CENTS;
  if (incomeUsable && qualifying.length >= INCREMENT && total > POLTERGEIST_RATIO * monthlyIncomeCents) {
    return { ghosts: [], poltergeist: buildPoltergeist(qualifying, total) };
  }
  return { ghosts: qualifying.map(toGhost), poltergeist: null };
}
