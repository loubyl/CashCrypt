import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { MAX_MONEY_CENTS } from "@/lib/validation/limits";
import type { CryptRows } from "@/types/finance";

const NUM_RUNS = 200;
const CENTS_PER_DOLLAR = 100;
const NOW = "2025-01-15";
const MAX_ROWS = 8;

const cents = fc.integer({ min: 0, max: MAX_MONEY_CENTS });
const id = fc.string({ minLength: 1, maxLength: 8 });
const text = fc.string({ maxLength: 12 });

const debtRow = fc.record({
  id,
  name: text,
  balanceCents: cents,
  apr: fc.double({ min: 0, max: 1, noNaN: true }),
  minimumPaymentCents: cents,
});

const subscriptionRow = fc.record({
  id,
  name: text,
  amountCents: cents,
  cadence: fc.constantFrom("weekly", "monthly", "yearly") as fc.Arbitrary<
    "weekly" | "monthly" | "yearly"
  >,
  usage: fc.constantFrom("often", "rarely", "never") as fc.Arbitrary<
    "often" | "rarely" | "never"
  >,
  active: fc.boolean(),
});

const transactionRow = fc.record({
  id,
  amountCents: cents,
  description: text,
  category: text,
  date: fc.constant(NOW),
});

const cryptRows: fc.Arbitrary<CryptRows> = fc.record({
  profile: fc.record({ monthlyIncomeCents: cents }),
  debts: fc.array(debtRow, { maxLength: MAX_ROWS }),
  subscriptions: fc.array(subscriptionRow, { maxLength: MAX_ROWS }),
  transactions: fc.array(transactionRow, { maxLength: MAX_ROWS }),
  events: fc.constant([]),
  plans: fc.constant([]),
});

const toCents = (dollars: number): number =>
  Math.round(dollars * CENTS_PER_DOLLAR);

describe("Property 4: Cents survive the dollars boundary", () => {
  // Feature: app-screens, Property 4: Cents survive the dollars boundary
  // **Validates: Requirements 4.2, 4.7**
  it("recovers every stored cent value through Math.round(x * 100)", () => {
    fc.assert(
      fc.property(cryptRows, (rows) => {
        const snapshot = toFinancialSnapshot(rows, NOW);
        expect(toCents(snapshot.monthlyIncome)).toBe(
          rows.profile.monthlyIncomeCents,
        );
        rows.debts.forEach((d, i) => {
          expect(toCents(snapshot.debts[i].balance)).toBe(d.balanceCents);
          expect(toCents(snapshot.debts[i].minimumMonthlyPayment)).toBe(
            d.minimumPaymentCents,
          );
        });
        rows.subscriptions.forEach((s, i) => {
          expect(toCents(snapshot.subscriptions[i].amount)).toBe(s.amountCents);
        });
        rows.transactions.forEach((t, i) => {
          expect(toCents(snapshot.transactions[i].amount)).toBe(t.amountCents);
        });
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("recovers the boundary values 0, 1 and MAX_MONEY_CENTS", () => {
    for (const value of [0, 1, 99, MAX_MONEY_CENTS - 1, MAX_MONEY_CENTS]) {
      const rows: CryptRows = {
        profile: { monthlyIncomeCents: value },
        debts: [],
        subscriptions: [],
        transactions: [],
        events: [],
        plans: [],
      };
      expect(toCents(toFinancialSnapshot(rows, NOW).monthlyIncome)).toBe(value);
    }
  });
});
