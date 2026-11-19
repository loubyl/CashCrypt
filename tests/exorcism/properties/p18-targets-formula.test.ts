import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generateExorcismPlan } from "@/lib/exorcism";
import { computeHouseState } from "@/lib/haunting";
import type { FinancialSnapshot, InputDebt, InputSubscription, Usage } from "@/lib/haunting/types";

const NUM_RUNS = 300;
const NOW = "2025-06-02";
const CENTS_PER_DOLLAR = 100;
const MAX_INCOME_CENTS = 2_000_000;
const MAX_BALANCE_CENTS = 5_000_000;
const MAX_ITEMS = 6;
const INCOME_SHARE_DIVISOR = 10; // 10% of income
const MONTHS = 12;
const WEIGHTS: Record<Usage, number> = { never: 1.0, rarely: 0.6, often: 0.2 };
const CANCEL_PREFIX = "cancel:";
const PAY_PREFIX = "pay:";

const debtArb = (index: number): fc.Arbitrary<InputDebt> =>
  fc.record({
    debtId: fc.constant(`debt-${index}`),
    name: fc.constantFrom("Visa", "Loan", "Car"),
    // Few distinct values so APR and balance ties occur; 0 balances included.
    balance: fc
      .constantFrom(0, 50000, 120000, 120000, 500000, MAX_BALANCE_CENTS)
      .map((c) => c / CENTS_PER_DOLLAR),
    minimumMonthlyPayment: fc.integer({ min: 0, max: 20000 }).map((c) => c / CENTS_PER_DOLLAR),
    apr: fc.constantFrom(0, 0.01, 0.05, 0.1, 0.1, 0.2, 0.299),
  });

const subArb = (index: number): fc.Arbitrary<InputSubscription> =>
  fc.record({
    subscriptionId: fc.constant(`sub-${index}`),
    name: fc.constantFrom("Stream", "Music", "Cloud"),
    amount: fc.integer({ min: 0, max: 6000 }).map((c) => c / CENTS_PER_DOLLAR),
    cadence: fc.constantFrom("weekly", "monthly", "yearly"),
    usage: fc.constantFrom("often", "rarely", "never"),
    active: fc.boolean(),
  });

function listArb<T>(make: (i: number) => fc.Arbitrary<T>, max: number): fc.Arbitrary<T[]> {
  return fc
    .integer({ min: 0, max })
    .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => make(i))) as fc.Arbitrary<T[]>);
}

const snapshotArb: fc.Arbitrary<FinancialSnapshot> = fc.record({
  monthlyIncome: fc.integer({ min: 0, max: MAX_INCOME_CENTS }).map((c) => c / CENTS_PER_DOLLAR),
  debts: listArb(debtArb, MAX_ITEMS),
  // Few subscriptions so the extra payment often lands in the plan.
  subscriptions: listArb(subArb, 3),
  transactions: fc.constant<never[]>([]),
  events: fc.constant<never[]>([]),
  now: fc.constant(NOW),
});

function toCents(dollars: number): number {
  return Math.round(dollars * CENTS_PER_DOLLAR);
}

/** Independent oracle: the debt the planner must target, by APR, balance, then id. */
function expectedTarget(snapshot: FinancialSnapshot): InputDebt | undefined {
  return snapshot.debts
    .filter((d) => toCents(d.balance) > 0)
    .sort((a, b) => {
      if (a.apr !== b.apr) return b.apr - a.apr;
      if (toCents(a.balance) !== toCents(b.balance)) return toCents(b.balance) - toCents(a.balance);
      return a.debtId < b.debtId ? -1 : a.debtId > b.debtId ? 1 : 0;
    })[0];
}

describe("exorcism targets and formulas", () => {
  it("targets real subscriptions and debts and scores them by the formula", () => {
    // Feature: app-screens, Property 18: Cancellation and debt targets are real and scored by the formula
    // **Validates: Requirements 12.1, 12.2, 12.3, 12.6, 12.7, 15.6**
    fc.assert(
      fc.property(snapshotArb, (snapshot) => {
        const houseState = computeHouseState(snapshot);
        const plan = generateExorcismPlan(houseState, snapshot);
        const incomeCents = toCents(snapshot.monthlyIncome);

        for (const action of plan) {
          if (action.kind === "cancel_subscription") {
            const zombie = houseState.zombies.find((z) => `${CANCEL_PREFIX}${z.subscriptionId}` === action.id);
            expect(zombie).toBeDefined();
            if (zombie === undefined) continue;
            const source = snapshot.subscriptions.find((s) => s.subscriptionId === zombie.subscriptionId);
            expect(source?.active).toBe(true);
            expect(action.targetId).toBe(zombie.subscriptionId);
            expect(action.monthlyAmountCents).toBe(zombie.monthlyCost);
            expect(action.priorityCents).toBe(Math.round(zombie.monthlyCost * WEIGHTS[zombie.usage]));
          }
          if (action.kind === "extra_payment") {
            const target = expectedTarget(snapshot);
            expect(target).toBeDefined();
            if (target === undefined) continue;
            const balanceCents = toCents(target.balance);
            expect(balanceCents).toBeGreaterThan(0);
            expect(action.id).toBe(`${PAY_PREFIX}${target.debtId}`);
            expect(action.targetId).toBe(target.debtId);
            const tenPercentWholeDollars =
              Math.floor(incomeCents / (INCOME_SHARE_DIVISOR * CENTS_PER_DOLLAR)) * CENTS_PER_DOLLAR;
            const suggested = Math.min(balanceCents, tenPercentWholeDollars);
            expect(action.suggestedAmountCents).toBe(suggested);
            const interest = Math.round((suggested * target.apr) / MONTHS);
            expect(action.monthlyAmountCents).toBe(interest);
            expect(action.priorityCents).toBe(interest);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
