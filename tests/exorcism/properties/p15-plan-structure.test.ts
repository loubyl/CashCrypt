import fc from "fast-check";
import { describe, expect, it } from "vitest";
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
const PLAN_SIZE = 3;
const NOW = "2025-06-02";
const MAX_INCOME_DOLLARS = 20000;
const MAX_DEBT_DOLLARS = 50000;
const MAX_SUB_AMOUNT_CENTS = 6000;
const MAX_TX_AMOUNT_CENTS = 1400;
const MAX_ITEMS = 8;
const CENTS_PER_DOLLAR = 100;
const CATEGORIES = ["coffee", "snacks", "rides"] as const;
const FALLBACK_IDS = [
  "fallback:emergency-fund",
  "fallback:review-small-expenses",
  "fallback:review-subscriptions",
];

const debtArb = (index: number): fc.Arbitrary<InputDebt> =>
  fc.record({
    debtId: fc.constant(`debt-${index}`),
    name: fc.constantFrom("Visa", "Loan", "Car"),
    balance: fc.integer({ min: 0, max: MAX_DEBT_DOLLARS * CENTS_PER_DOLLAR }).map((c) => c / CENTS_PER_DOLLAR),
    minimumMonthlyPayment: fc.integer({ min: 0, max: 50000 }).map((c) => c / CENTS_PER_DOLLAR),
    // Small APRs make the extra payment rank low so it gets forced in.
    apr: fc.constantFrom(0, 0.01, 0.05, 0.1, 0.2, 0.3),
  });

const subArb = (index: number): fc.Arbitrary<InputSubscription> =>
  fc.record({
    subscriptionId: fc.constant(`sub-${index}`),
    name: fc.constantFrom("Stream", "Music", "Cloud"),
    // Few distinct amounts so priority ties occur.
    amount: fc.integer({ min: 0, max: MAX_SUB_AMOUNT_CENTS / 500 }).map((n) => (n * 500) / CENTS_PER_DOLLAR),
    cadence: fc.constantFrom("weekly", "monthly", "yearly"),
    usage: fc.constantFrom("often", "rarely", "never"),
    active: fc.boolean(),
  });

const txArb = (index: number): fc.Arbitrary<InputTransaction> =>
  fc.record({
    transactionId: fc.constant(`tx-${index}`),
    amount: fc.integer({ min: 1, max: MAX_TX_AMOUNT_CENTS }).map((c) => c / CENTS_PER_DOLLAR),
    description: fc.constant("small"),
    category: fc.constantFrom(...CATEGORIES),
    date: fc.constant(NOW),
  });

function listArb<T>(make: (i: number) => fc.Arbitrary<T>): fc.Arbitrary<T[]> {
  return fc
    .integer({ min: 0, max: MAX_ITEMS })
    .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => make(i))) as fc.Arbitrary<T[]>);
}

const snapshotArb: fc.Arbitrary<FinancialSnapshot> = fc.record({
  monthlyIncome: fc.integer({ min: 0, max: MAX_INCOME_DOLLARS }),
  debts: listArb(debtArb),
  subscriptions: listArb(subArb),
  transactions: listArb(txArb),
  events: fc.constant<never[]>([]),
  now: fc.constant(NOW),
});

/** Code-point order, like the planner (not the UTF-16 order of `a < b`). */
function compareText(a: string, b: string): number {
  const left = Array.from(a, (c) => c.codePointAt(0) ?? 0);
  const right = Array.from(b, (c) => c.codePointAt(0) ?? 0);
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}

function isOrdered(prev: ExorcismAction, next: ExorcismAction): boolean {
  if (prev.priorityCents !== next.priorityCents) return prev.priorityCents > next.priorityCents;
  const prevFallback = prev.kind === "fallback";
  const nextFallback = next.kind === "fallback";
  if (prevFallback !== nextFallback) return !prevFallback;
  return compareText(prev.id, next.id) < 0;
}

describe("exorcism plan structure", () => {
  it("returns three distinct, sorted, pending actions for any valid snapshot", () => {
    // Feature: app-screens, Property 15: The plan always has three distinct, sorted, pending actions
    // **Validates: Requirements 11.1, 11.2, 11.3, 11.6, 13.5, 13.7, 15.2, 15.3, 15.5, 15.12**
    fc.assert(
      fc.property(snapshotArb, (snapshot) => {
        const plan = generateExorcismPlan(computeHouseState(snapshot), snapshot);
        expect(plan).toHaveLength(PLAN_SIZE);
        expect(new Set(plan.map((a) => a.id)).size).toBe(PLAN_SIZE);
        for (const action of plan) {
          expect(action.done).toBe(false);
          if (action.kind === "fallback") expect(FALLBACK_IDS).toContain(action.id);
        }
        for (let i = 1; i < plan.length; i++) {
          expect(isOrdered(plan[i - 1], plan[i])).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("keeps the order when the extra payment is forced in below the top three", () => {
    // Feature: app-screens, Property 15: The plan always has three distinct, sorted, pending actions
    const forcedArb = fc.record({
      monthlyIncome: fc.integer({ min: 3000, max: MAX_INCOME_DOLLARS }),
      debts: fc.constant<InputDebt[]>([
        { debtId: "debt-0", name: "Visa", balance: 5000, minimumMonthlyPayment: 50, apr: 0.01 },
      ]),
      subscriptions: fc
        .array(fc.integer({ min: 5, max: 60 }), { minLength: 3, maxLength: MAX_ITEMS })
        .map((amounts): InputSubscription[] =>
          amounts.map((a, i) => ({
            subscriptionId: `sub-${i}`,
            name: "Stream",
            amount: a,
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
      fc.property(forcedArb, (snapshot) => {
        const plan = generateExorcismPlan(computeHouseState(snapshot), snapshot);
        expect(plan.some((a) => a.kind === "extra_payment")).toBe(true);
        expect(new Set(plan.map((a) => a.id)).size).toBe(PLAN_SIZE);
        for (let i = 1; i < plan.length; i++) {
          expect(isOrdered(plan[i - 1], plan[i])).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
