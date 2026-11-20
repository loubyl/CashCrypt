import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import type { CryptRows, DebtRow } from "@/types/finance";

const NUM_RUNS = 200;
const NOW = "2025-06-15";
const MAX_CENTS = 100_000_000;
const MAX_DEBTS = 8;
const CENTS_PER_DOLLAR = 100;

// Half the debts are paid off, so the zero-balance case is common.
const debtsArb: fc.Arbitrary<DebtRow[]> = fc
  .array(
    fc.record({
      paidOff: fc.boolean(),
      balanceCents: fc.integer({ min: 1, max: MAX_CENTS }),
      minimumPaymentCents: fc.integer({ min: 0, max: MAX_CENTS }),
      apr: fc.double({ min: 0, max: 1, noNaN: true }),
    }),
    { maxLength: MAX_DEBTS },
  )
  .map((items) =>
    items.map(({ paidOff, balanceCents, ...rest }, i) => ({
      id: `debt-${i}`,
      name: `Debt ${i}`,
      balanceCents: paidOff ? 0 : balanceCents,
      ...rest,
    })),
  );

const rowsArb: fc.Arbitrary<CryptRows> = debtsArb.map((debts) => ({
  profile: { monthlyIncomeCents: 300_000 },
  debts,
  subscriptions: [],
  transactions: [],
  events: [],
  plans: [],
}));

const toCents = (dollars: number) => Math.round(dollars * CENTS_PER_DOLLAR);

describe("Property 36: Paid-off debts add no minimum payment", () => {
  // Feature: app-screens, Property 36: Paid-off debts add no minimum payment
  // **Validates: Requirement 4.3**
  it("passes a minimum of 0 for every zero-balance debt and every other minimum unchanged", () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const before = structuredClone(rows);
        const snapshot = toFinancialSnapshot(rows, NOW);
        rows.debts.forEach((debt, i) => {
          const expected = debt.balanceCents === 0 ? 0 : debt.minimumPaymentCents;
          expect(toCents(snapshot.debts[i].minimumMonthlyPayment)).toBe(expected);
          expect(toCents(snapshot.debts[i].balance)).toBe(debt.balanceCents);
        });
        const sumMinimums = snapshot.debts.reduce((sum, d) => sum + toCents(d.minimumMonthlyPayment), 0);
        const owedMinimums = rows.debts
          .filter((d) => d.balanceCents > 0)
          .reduce((sum, d) => sum + d.minimumPaymentCents, 0);
        expect(sumMinimums).toBe(owedMinimums);
        // The stored rows keep their minimum.
        expect(rows).toEqual(before);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
