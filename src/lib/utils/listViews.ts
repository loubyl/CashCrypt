// Pure list-view helpers for the screens. No React, no Dexie. Inputs are never mutated.
import { normalizeSubscription } from "@/lib/haunting";
import type { DebtRow, SubscriptionRow } from "@/types/finance";

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
