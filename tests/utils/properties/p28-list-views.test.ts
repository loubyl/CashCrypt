import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { normalizeSubscription } from "@/lib/haunting";
import { SMALL_EXPENSE_THRESHOLD_CENTS, WINDOW_DAYS } from "@/lib/haunting/config";
import {
  sortDebtsByBalance,
  sortSubscriptionsByMonthlyCost,
  toTransactionRows,
} from "@/lib/utils/listViews";
import type { DebtRow, SubscriptionRow, TransactionRow } from "@/types/finance";

const NUM_RUNS = 200;
const NOW = "2025-06-15";
const NOW_MS = Date.UTC(2025, 5, 15);
const MS_PER_DAY = 86_400_000;
const MAX_DAYS_BEFORE = WINDOW_DAYS + 20;
const MAX_DAYS_AFTER = 5;
const MAX_AMOUNT_CENTS = 5_000_000;
const MAX_ROWS = 15;
const ID_POOL = ["a", "b", "c", "d", "e", "f", "g", "h"];
const INCOME_CENTS = 400_000;

function dateFromOffset(daysFromNow: number): string {
  return new Date(NOW_MS + daysFromNow * MS_PER_DAY).toISOString().slice(0, 10);
}

function uniqueIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `id-${String(index).padStart(2, "0")}`);
}

const subscriptionsArb = fc
  .array(
    fc.record({
      amountCents: fc.integer({ min: 0, max: MAX_AMOUNT_CENTS }),
      cadence: fc.constantFrom("weekly", "monthly", "yearly" as const),
    }),
    { maxLength: MAX_ROWS },
  )
  .chain((items) =>
    fc.shuffledSubarray(ID_POOL.concat(uniqueIds(MAX_ROWS)), {
      minLength: items.length,
      maxLength: items.length,
    }).map((ids) =>
      items.map(
        (item, index): SubscriptionRow => ({
          id: ids[index],
          name: `Sub ${ids[index]}`,
          amountCents: item.amountCents,
          cadence: item.cadence as SubscriptionRow["cadence"],
          usage: "rarely",
          active: true,
        }),
      ),
    ),
  );

const debtsArb = fc
  .array(fc.integer({ min: 0, max: MAX_AMOUNT_CENTS }), { maxLength: MAX_ROWS })
  .map((balances) =>
    balances.map(
      (balanceCents, index): DebtRow => ({
        id: `debt-${index}`,
        name: `Debt ${index}`,
        balanceCents,
        apr: 0.1,
        minimumPaymentCents: 1000,
      }),
    ),
  );

const transactionsArb = fc
  .array(
    fc.record({
      amountCents: fc.oneof(
        fc.integer({ min: -100, max: 2 * SMALL_EXPENSE_THRESHOLD_CENTS }),
        fc.constantFrom(0, 1, SMALL_EXPENSE_THRESHOLD_CENTS - 1, SMALL_EXPENSE_THRESHOLD_CENTS),
      ),
      daysFromNow: fc.integer({ min: -MAX_DAYS_AFTER, max: MAX_DAYS_BEFORE }),
    }),
    { maxLength: MAX_ROWS },
  )
  .map((items) =>
    items.map(
      (item, index): TransactionRow => ({
        id: `tx-${String(index).padStart(2, "0")}`,
        amountCents: item.amountCents,
        description: `Tx ${index}`,
        category: "other",
        date: dateFromOffset(-item.daysFromNow),
      }),
    ),
  );

function monthlyCost(row: SubscriptionRow): number {
  return normalizeSubscription({
    subscriptionId: row.id,
    name: row.name,
    amountCents: row.amountCents,
    cadence: row.cadence,
    usage: row.usage,
    active: row.active,
  }).monthlyCostCents;
}

function sortedIds(rows: readonly { id: string }[]): string[] {
  return rows.map((row) => row.id).sort();
}

describe("list views", () => {
  // Feature: app-screens, Property 28: List views are permutations in the right order, with ghosts marked correctly
  // **Validates: Requirements 23.1, 24.1, 26.1, 26.2**
  it("sorts subscriptions by non-increasing monthly cost as a permutation of the input", () => {
    fc.assert(
      fc.property(subscriptionsArb, (rows) => {
        const result = sortSubscriptionsByMonthlyCost(rows);
        expect(sortedIds(result)).toEqual(sortedIds(rows));
        for (let i = 1; i < result.length; i += 1) {
          expect(monthlyCost(result[i - 1])).toBeGreaterThanOrEqual(monthlyCost(result[i]));
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: app-screens, Property 28: List views are permutations in the right order, with ghosts marked correctly
  // **Validates: Requirements 23.1, 24.1, 26.1, 26.2**
  it("sorts debts by non-increasing balance as a permutation of the input", () => {
    fc.assert(
      fc.property(debtsArb, (rows) => {
        const result = sortDebtsByBalance(rows);
        expect(sortedIds(result)).toEqual(sortedIds(rows));
        for (let i = 1; i < result.length; i += 1) {
          expect(result[i - 1].balanceCents).toBeGreaterThanOrEqual(result[i].balanceCents);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: app-screens, Property 28: List views are permutations in the right order, with ghosts marked correctly
  // **Validates: Requirements 23.1, 24.1, 26.1, 26.2**
  it("returns only in-window transactions, newest first, with ghosts marked exactly for small amounts", () => {
    fc.assert(
      fc.property(transactionsArb, (rows) => {
        const result = toTransactionRows(rows, NOW, INCOME_CENTS);
        const earliest = dateFromOffset(-(WINDOW_DAYS - 1));
        const expectedIds = rows
          .filter((row) => row.date >= earliest && row.date <= NOW)
          .map((row) => row.id)
          .sort();
        expect(sortedIds(result)).toEqual(expectedIds);
        for (let i = 1; i < result.length; i += 1) {
          expect(result[i - 1].date >= result[i].date).toBe(true);
        }
        for (const row of result) {
          const expectedGhost = row.amountCents > 0 && row.amountCents < SMALL_EXPENSE_THRESHOLD_CENTS;
          expect(row.isGhost).toBe(expectedGhost);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
