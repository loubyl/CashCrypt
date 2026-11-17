import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeHouseState } from "@/lib/haunting";
import type { FinancialSnapshot, HouseState } from "@/lib/haunting";
import { MOMENTUM_MAX, SCORE_MAX } from "@/lib/haunting/config";
import { extremeSnapshot } from "@/lib/haunting/testArbitraries";

const PROPERTY_RUNS = 100;
const NOW = "2025-06-15";
const HUGE_AMOUNT = 1e12;
const OUTSIDE_WINDOW_DATE = "2025-01-01";
const FUTURE_DATE = "2025-12-31";
const SOME_CENTS = 5_000;
const SOME_DOLLARS = 50;

function numericFields(state: HouseState): number[] {
  const values = [
    state.lightScore,
    state.baseScore,
    state.momentum,
    state.decayLevel,
    state.windowBrightness,
    state.levelProgress,
  ];
  state.zombies.forEach((z) => values.push(z.monthlyCost));
  state.ghosts.forEach((g) => values.push(g.amount));
  if (state.poltergeist) {
    values.push(state.poltergeist.totalAmount, state.poltergeist.transactionCount);
    values.push(...Object.values(state.poltergeist.byCategory));
  }
  return values;
}

function expectFinite(state: HouseState): void {
  numericFields(state).forEach((value) => expect(Number.isFinite(value)).toBe(true));
}

function baseSnapshot(overrides: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  return {
    monthlyIncome: 3000,
    debts: [{ debtId: "d1", name: "Card", balance: 5000, minimumMonthlyPayment: 100, apr: 0.2 }],
    subscriptions: [
      {
        subscriptionId: "s1",
        name: "Stream",
        amount: 15,
        cadence: "monthly",
        usage: "never",
        active: true,
      },
    ],
    transactions: [
      { transactionId: "t1", amount: 5, description: "Coffee", category: "coffee", date: NOW },
    ],
    events: [],
    now: NOW,
    ...overrides,
  };
}

describe("computeHouseState robustness properties", () => {
  it("completes without throwing and returns only finite numbers for extreme snapshots", () => {
    // Feature: haunting-engine, Property 9: Robustness
    fc.assert(
      fc.property(extremeSnapshot, (snap) => {
        const state = computeHouseState(snap);
        numericFields(state).forEach((value) => expect(Number.isFinite(value)).toBe(true));
      }),
      { numRuns: PROPERTY_RUNS },
    );
  });

  it("returns a perfect score for zero income with no debts and no valid active subscriptions", () => {
    // Feature: haunting-engine, Property 12: Zero-income zero-obligation edge case
    fc.assert(
      fc.property(extremeSnapshot, (snap) => {
        const inactive = snap.subscriptions.map((s) => ({ ...s, active: false }));
        const state = computeHouseState({
          ...snap,
          monthlyIncome: 0,
          debts: [],
          subscriptions: inactive,
        });
        expect(state.lightScore).toBe(SCORE_MAX);
      }),
      { numRuns: PROPERTY_RUNS },
    );
  });
});

describe("computeHouseState example-based robustness", () => {
  it("handles empty debts, subscriptions, transactions and events", () => {
    const state = computeHouseState(
      baseSnapshot({ debts: [], subscriptions: [], transactions: [], events: [] }),
    );
    expectFinite(state);
    expect(state.lightScore).toBe(SCORE_MAX);
    expect(state.zombies).toEqual([]);
    expect(state.ghosts).toEqual([]);
    expect(state.poltergeist).toBeNull();
  });

  it("handles debts whose APRs are all zero", () => {
    const state = computeHouseState(
      baseSnapshot({
        debts: [
          { debtId: "a", name: "A", balance: 1000, minimumMonthlyPayment: 50, apr: 0 },
          { debtId: "b", name: "B", balance: 2000, minimumMonthlyPayment: 80, apr: 0 },
        ],
      }),
    );
    expectFinite(state);
    expect(state.lightScore).toBeGreaterThan(0);
  });

  it("handles amounts of 1e12 in every money field", () => {
    const state = computeHouseState(
      baseSnapshot({
        monthlyIncome: HUGE_AMOUNT,
        debts: [
          { debtId: "d", name: "Huge", balance: HUGE_AMOUNT, minimumMonthlyPayment: HUGE_AMOUNT, apr: 1 },
        ],
        subscriptions: [
          {
            subscriptionId: "s",
            name: "Huge",
            amount: HUGE_AMOUNT,
            cadence: "weekly",
            usage: "never",
            active: true,
          },
        ],
        transactions: [
          { transactionId: "t", amount: HUGE_AMOUNT, description: "x", category: "c", date: NOW },
        ],
        events: [
          { type: "debt_payment", date: NOW, extraPrincipalCents: HUGE_AMOUNT * 100 },
          { type: "subscription_canceled", date: NOW, amountCents: HUGE_AMOUNT * 100 },
        ],
      }),
    );
    expectFinite(state);
    expect(state.momentum).toBeLessThanOrEqual(MOMENTUM_MAX);
  });

  it("treats negative balances, minimum payments and transaction amounts as 0", () => {
    const negative = computeHouseState(
      baseSnapshot({
        debts: [{ debtId: "d", name: "Neg", balance: -5000, minimumMonthlyPayment: -100, apr: 0.1 }],
        subscriptions: [],
        transactions: [
          { transactionId: "t", amount: -SOME_DOLLARS, description: "x", category: "c", date: NOW },
        ],
      }),
    );
    const zero = computeHouseState(
      baseSnapshot({
        debts: [{ debtId: "d", name: "Zero", balance: 0, minimumMonthlyPayment: 0, apr: 0.1 }],
        subscriptions: [],
        transactions: [
          { transactionId: "t", amount: 0, description: "x", category: "c", date: NOW },
        ],
      }),
    );
    expectFinite(negative);
    expect(negative.lightScore).toBe(zero.lightScore);
    expect(negative.ghosts).toEqual([]);
    expect(negative.poltergeist).toBeNull();
  });

  it("gives zero momentum when every event is outside the window", () => {
    const state = computeHouseState(
      baseSnapshot({
        events: [
          { type: "debt_payment", date: OUTSIDE_WINDOW_DATE, extraPrincipalCents: SOME_CENTS },
          { type: "exorcism_action_completed", date: FUTURE_DATE },
          { type: "subscription_canceled", date: OUTSIDE_WINDOW_DATE, amountCents: SOME_CENTS },
        ],
      }),
    );
    expectFinite(state);
    expect(state.momentum).toBe(0);
    expect(state.lightScore).toBe(state.baseScore);
  });
});
