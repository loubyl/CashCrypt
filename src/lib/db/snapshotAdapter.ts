// Pure adapter from stored rows (integer cents) to the engine's FinancialSnapshot
// (decimal dollars at the input boundary). No React, Dexie or Next imports.
import type { CryptRows, EventRow, LocalDate } from "@/types/finance";
import type {
  FinancialEvent,
  FinancialSnapshot,
  InputDebt,
  InputSubscription,
  InputTransaction,
} from "@/lib/haunting/types";

const CENTS_PER_DOLLAR = 100;

/**
 * Converts integer cents to decimal dollars. The engine boundary converts back
 * with Math.round(x * 100), which returns the original integer for every safe
 * integer-cent value, so the round trip is exact.
 */
function centsToDollars(cents: number): number {
  return cents / CENTS_PER_DOLLAR;
}

function toEvent(row: EventRow): FinancialEvent {
  const event: FinancialEvent = { type: row.type, date: row.date };
  if (row.amountCents !== undefined) event.amountCents = row.amountCents;
  if (row.extraPrincipalCents !== undefined) {
    event.extraPrincipalCents = row.extraPrincipalCents;
  }
  return event;
}

/** Builds a new FinancialSnapshot from stored rows. Never mutates `rows`. */
export function toFinancialSnapshot(
  rows: CryptRows,
  now: LocalDate,
): FinancialSnapshot {
  const debts: InputDebt[] = rows.debts.map((d) => ({
    debtId: d.id,
    name: d.name,
    balance: centsToDollars(d.balanceCents),
    minimumMonthlyPayment: centsToDollars(d.minimumPaymentCents),
    apr: d.apr,
  }));
  const subscriptions: InputSubscription[] = rows.subscriptions.map((s) => ({
    subscriptionId: s.id,
    name: s.name,
    amount: centsToDollars(s.amountCents),
    cadence: s.cadence,
    usage: s.usage,
    active: s.active,
  }));
  const transactions: InputTransaction[] = rows.transactions.map((t) => ({
    transactionId: t.id,
    amount: centsToDollars(t.amountCents),
    description: t.description,
    category: t.category,
    date: t.date,
  }));
  return {
    monthlyIncome: centsToDollars(rows.profile?.monthlyIncomeCents ?? 0),
    debts,
    subscriptions,
    transactions,
    events: rows.events.map(toEvent),
    now,
  };
}
