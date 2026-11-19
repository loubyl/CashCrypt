import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generateExorcismPlan } from "@/lib/exorcism";
import { computeHouseState } from "@/lib/haunting";
import type { FinancialSnapshot, InputDebt, InputSubscription } from "@/lib/haunting/types";

const NUM_RUNS = 200;
const NOW = "2025-06-02";
const CENTS_PER_DOLLAR = 100;
const MAX_INCOME_CENTS = 3_000_000;
const MAX_BALANCE_CENTS = 5_000_000;
const MAX_DEBTS = 5;
const MAX_SUBS = 8;
const EXTRA_DIVISOR_CENTS = 1000; // 10% of income, then whole dollars
const APRS = [0, 0.01, 0.05, 0.1, 0.2, 0.3] as const;
const DEBT_ID_POOL = ["debt-a", "debt-b", "debt-c", "debt-d", "debt-e"];

type DebtSpec = { balanceCents: number; apr: number; minimum: number };

const debtSpecArb: fc.Arbitrary<DebtSpec> = fc.record({
  // Zero balances and tiny balances are common so the edge cases appear.
  balanceCents: fc.oneof(
    { weight: 1, arbitrary: fc.constant(0) },
    { weight: 4, arbitrary: fc.integer({ min: 1, max: MAX_BALANCE_CENTS }) },
  ),
  apr: fc.constantFrom(...APRS),
  minimum: fc.integer({ min: 0, max: 50000 }),
});

// Ids are drawn without repetition and in shuffled order to exercise the tie-break.
const debtsArb: fc.Arbitrary<InputDebt[]> = fc
  .tuple(
    fc.shuffledSubarray(DEBT_ID_POOL, { minLength: 0, maxLength: MAX_DEBTS }),
    fc.array(debtSpecArb, { minLength: MAX_DEBTS, maxLength: MAX_DEBTS }),
  )
  .map(([ids, specs]) =>
    ids.map((debtId, i) => ({
      debtId,
      name: "Loan",
      balance: specs[i].balanceCents / CENTS_PER_DOLLAR,
      minimumMonthlyPayment: specs[i].minimum / CENTS_PER_DOLLAR,
      apr: specs[i].apr,
    })),
  );

// Many "never used" subscriptions with large amounts crowd the extra payment out.
const crowdingSubsArb: fc.Arbitrary<InputSubscription[]> = fc
  .array(fc.integer({ min: 5, max: 200 }), { minLength: 0, maxLength: MAX_SUBS })
  .map((amounts) =>
    amounts.map((amount, i) => ({
      subscriptionId: `sub-${i}`,
      name: "Stream",
      amount,
      cadence: "monthly" as const,
      usage: "never" as const,
      active: true,
    })),
  );

const snapshotArb: fc.Arbitrary<FinancialSnapshot> = fc.record({
  monthlyIncome: fc.integer({ min: 0, max: MAX_INCOME_CENTS }).map((c) => c / CENTS_PER_DOLLAR),
  debts: debtsArb,
  subscriptions: crowdingSubsArb,
  transactions: fc.constant<never[]>([]),
  events: fc.constant<never[]>([]),
  now: fc.constant(NOW),
});

function incomeCentsOf(snapshot: FinancialSnapshot): number {
  return Math.round(snapshot.monthlyIncome * CENTS_PER_DOLLAR);
}

function expectedTarget(snapshot: FinancialSnapshot): { debtId: string; suggested: number } | null {
  const open = snapshot.debts
    .map((d) => ({ debtId: d.debtId, balance: Math.round(d.balance * CENTS_PER_DOLLAR), apr: d.apr }))
    .filter((d) => d.balance > 0)
    .sort((a, b) =>
      a.apr !== b.apr
        ? b.apr - a.apr
        : a.balance !== b.balance
          ? b.balance - a.balance
          : a.debtId < b.debtId
            ? -1
            : 1,
    );
  const target = open[0];
  if (target === undefined) return null;
  const tenPercentWholeDollars =
    Math.floor(incomeCentsOf(snapshot) / EXTRA_DIVISOR_CENTS) * CENTS_PER_DOLLAR;
  const suggested = Math.min(target.balance, tenPercentWholeDollars);
  return suggested > 0 ? { debtId: target.debtId, suggested } : null;
}

describe("forced debt inclusion", () => {
  it("includes exactly one extra payment on the right debt with the right amount whenever one exists", () => {
    // Feature: app-screens, Property 19: Debt is always addressed with the right payment
    // **Validates: Requirements 12.4, 12.5, 12.15, 15.11**
    fc.assert(
      fc.property(snapshotArb, (snapshot) => {
        const plan = generateExorcismPlan(computeHouseState(snapshot), snapshot);
        const payments = plan.filter((a) => a.kind === "extra_payment");
        const expected = expectedTarget(snapshot);
        if (expected === null) {
          expect(payments).toHaveLength(0);
          return;
        }
        expect(payments).toHaveLength(1);
        expect(payments[0].targetId).toBe(expected.debtId);
        expect(payments[0].suggestedAmountCents).toBe(expected.suggested);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("keeps the extra payment when three or more higher-priority cancellations exist", () => {
    // Feature: app-screens, Property 19: Debt is always addressed with the right payment
    const crowdedArb = fc.record({
      monthlyIncome: fc.integer({ min: 3000, max: 20000 }),
      debts: fc.constant<InputDebt[]>([
        { debtId: "debt-a", name: "Visa", balance: 5000, minimumMonthlyPayment: 50, apr: 0.01 },
      ]),
      subscriptions: fc
        .array(fc.integer({ min: 20, max: 300 }), { minLength: 3, maxLength: MAX_SUBS })
        .map((amounts): InputSubscription[] =>
          amounts.map((amount, i) => ({
            subscriptionId: `sub-${i}`,
            name: "Stream",
            amount,
            cadence: "monthly",
            usage: "never",
            active: true,
          })),
        ),
      transactions: fc.constant<never[]>([]),
      events: fc.constant<never[]>([]),
      now: fc.constant(NOW),
    });
    fc.assert(
      fc.property(crowdedArb, (snapshot) => {
        const plan = generateExorcismPlan(computeHouseState(snapshot), snapshot);
        const payments = plan.filter((a) => a.kind === "extra_payment");
        expect(payments).toHaveLength(1);
        expect(payments[0].targetId).toBe("debt-a");
        expect(payments[0].suggestedAmountCents).toBe(
          Math.min(500000, Math.floor(snapshot.monthlyIncome / 10) * CENTS_PER_DOLLAR),
        );
        expect(plan.filter((a) => a.kind === "cancel_subscription")).toHaveLength(2);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
