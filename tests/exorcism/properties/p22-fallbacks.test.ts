import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FALLBACK_KEYS, PLAN_SIZE } from "@/lib/exorcism/config";
import { generateExorcismPlan } from "@/lib/exorcism";
import type { ExorcismAction } from "@/lib/exorcism";
import { computeHouseState } from "@/lib/haunting";
import type {
  FinancialSnapshot,
  InputDebt,
  InputSubscription,
  InputTransaction,
} from "@/lib/haunting/types";

const NUM_RUNS = 200;
const NOW = "2025-06-02";
const MAX_INCOME_DOLLARS = 20000;
const MAX_DEBT_DOLLARS = 50000;
const MAX_ITEMS = 5;
const MAX_TX_ITEMS = 10;
const CENTS_PER_DOLLAR = 100;
const EMERGENCY_FUND_PERCENT = 5;
const PERCENT_DENOMINATOR = 100;
const GENERIC_EMERGENCY_TITLE = "Set aside a small amount for an emergency fund";
const FALLBACK_PREFIX = "fallback:";
const CATEGORIES = ["coffee", "snacks", "rides"] as const;

const debtArb = (index: number): fc.Arbitrary<InputDebt> =>
  fc.record({
    debtId: fc.constant(`debt-${index}`),
    name: fc.constantFrom("Visa", "Loan", "Car"),
    balance: fc.integer({ min: 0, max: MAX_DEBT_DOLLARS }),
    minimumMonthlyPayment: fc.integer({ min: 0, max: 500 }),
    apr: fc.constantFrom(0, 0.05, 0.2, 0.3),
  });

const subArb = (index: number): fc.Arbitrary<InputSubscription> =>
  fc.record({
    subscriptionId: fc.constant(`sub-${index}`),
    name: fc.constantFrom("Stream", "Music", "Cloud"),
    amount: fc.integer({ min: 0, max: 60 }),
    cadence: fc.constantFrom("weekly", "monthly", "yearly"),
    usage: fc.constantFrom("often", "rarely", "never"),
    active: fc.boolean(),
  });

const txArb = (index: number): fc.Arbitrary<InputTransaction> =>
  fc.record({
    transactionId: fc.constant(`tx-${index}`),
    amount: fc.integer({ min: 1, max: 1400 }).map((c) => c / CENTS_PER_DOLLAR),
    description: fc.constant("small"),
    category: fc.constantFrom(...CATEGORIES),
    date: fc.constant(NOW),
  });

function listArb<T>(make: (i: number) => fc.Arbitrary<T>, max: number): fc.Arbitrary<T[]> {
  return fc
    .integer({ min: 0, max })
    .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => make(i))) as fc.Arbitrary<T[]>);
}

// Small incomes are included so the emergency-fund amount is often 0.
const incomeArb = fc.oneof(
  fc.integer({ min: 0, max: 40 }),
  fc.integer({ min: 0, max: MAX_INCOME_DOLLARS }),
);

const snapshotArb: fc.Arbitrary<FinancialSnapshot> = fc.record({
  monthlyIncome: incomeArb,
  debts: listArb(debtArb, 3),
  subscriptions: listArb(subArb, MAX_ITEMS),
  transactions: listArb(txArb, MAX_TX_ITEMS),
  events: fc.constant<never[]>([]),
  now: fc.constant(NOW),
});

function fallbacksOf(plan: ExorcismAction[]): ExorcismAction[] {
  return plan.filter((a) => a.kind === "fallback");
}

function emergencyTitle(incomeDollars: number): string {
  const dollars = Math.floor((incomeDollars * EMERGENCY_FUND_PERCENT) / PERCENT_DENOMINATOR);
  return dollars === 0
    ? GENERIC_EMERGENCY_TITLE
    : `Set aside $${dollars.toLocaleString("en-US")} for an emergency fund`;
}

describe("exorcism fallbacks", () => {
  it("uses fallbacks only for missing slots, in key order, with zero amounts", () => {
    // Feature: app-screens, Property 22: Fallbacks fill only what is missing
    // **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.6, 13.9**
    fc.assert(
      fc.property(snapshotArb, (snapshot) => {
        const houseState = computeHouseState(snapshot);
        const plan = generateExorcismPlan(houseState, snapshot);
        const fallbacks = fallbacksOf(plan);
        const real = plan.length - fallbacks.length;
        const allIds = FALLBACK_KEYS.map((k) => `${FALLBACK_PREFIX}${k}`);

        expect(plan).toHaveLength(PLAN_SIZE);
        expect(fallbacks).toHaveLength(PLAN_SIZE - real);
        for (const f of fallbacks) {
          expect(f.priorityCents).toBe(0);
          expect(f.monthlyAmountCents).toBe(0);
          expect(allIds).toContain(f.id);
        }
        // Distinct, and exactly the first k keys in the fixed order.
        expect(fallbacks.map((f) => f.id)).toEqual(allIds.slice(0, fallbacks.length));
        // Fallbacks never come before a real action with higher priority.
        const firstFallback = plan.findIndex((a) => a.kind === "fallback");
        if (firstFallback >= 0) {
          for (const a of plan.slice(firstFallback)) expect(a.kind).toBe("fallback");
        }
        // Three or more subscription candidates leave no room for a fallback.
        if (houseState.zombies.length >= PLAN_SIZE) expect(fallbacks).toHaveLength(0);
        // When a fallback is present, every cancel candidate made the plan.
        if (fallbacks.length > 0) {
          const cancels = plan.filter((a) => a.kind === "cancel_subscription");
          expect(cancels).toHaveLength(houseState.zombies.length);
        }
        // Emergency-fund title uses 5% of income, floored to whole dollars.
        const emergency = fallbacks.find((f) => f.id === `${FALLBACK_PREFIX}${FALLBACK_KEYS[0]}`);
        if (emergency !== undefined) {
          expect(emergency.title).toBe(emergencyTitle(snapshot.monthlyIncome));
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("keeps the extra payment and fills the other slots with fallbacks when subscriptions are few", () => {
    // Feature: app-screens, Property 22: Fallbacks fill only what is missing
    // **Validates: Requirements 13.1, 13.6, 13.9**
    const fewSubsArb = fc.record({
      monthlyIncome: fc.integer({ min: 10, max: MAX_INCOME_DOLLARS }),
      debts: fc.constant<InputDebt[]>([
        { debtId: "debt-0", name: "Visa", balance: 5000, minimumMonthlyPayment: 50, apr: 0.2 },
      ]),
      subscriptions: listArb(subArb, 4),
      transactions: fc.constant<never[]>([]),
      events: fc.constant<never[]>([]),
      now: fc.constant(NOW),
    });
    fc.assert(
      fc.property(fewSubsArb, (snapshot) => {
        const houseState = computeHouseState(snapshot);
        const plan = generateExorcismPlan(houseState, snapshot);
        const expectedFallbacks = Math.max(0, PLAN_SIZE - (houseState.zombies.length + 1));
        expect(plan.some((a) => a.kind === "extra_payment")).toBe(true);
        expect(fallbacksOf(plan)).toHaveLength(expectedFallbacks);
        expect(plan).toHaveLength(PLAN_SIZE);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
