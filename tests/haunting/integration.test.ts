import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeHouseState } from "@/lib/haunting";
import type { FinancialSnapshot } from "@/lib/haunting";
import { SCORE_MAX, SCORE_MIN } from "@/lib/haunting/config";
import { cancelSubscription, payDebt, realisticSnapshot } from "@/lib/haunting/testArbitraries";

const NOW = "2025-06-15";
const SCORE_PRECISION = 2;

type Usage = "often" | "rarely" | "never";

function debt(index: number, balance: number, minimumMonthlyPayment: number) {
  return { debtId: `debt-${index}`, name: `Debt ${index}`, balance, minimumMonthlyPayment, apr: 0.1 };
}

function sub(index: number, amount: number, usage: Usage = "often", active = true) {
  return {
    subscriptionId: `sub-${index}`,
    name: `Subscription ${index}`,
    amount,
    cadence: "monthly" as const,
    usage,
    active,
  };
}

function snapshot(
  monthlyIncome: number,
  debts: FinancialSnapshot["debts"],
  subscriptions: FinancialSnapshot["subscriptions"],
): FinancialSnapshot {
  return { monthlyIncome, debts, subscriptions, transactions: [], events: [], now: NOW };
}

function l4Snapshot(cancelLast: boolean): FinancialSnapshot {
  return snapshot(
    3000,
    [debt(1, 18000, 400), debt(2, 6000, 150), debt(3, 2000, 60)],
    [
      sub(1, 120, "never"),
      sub(2, 60, "rarely"),
      sub(3, 50, "often"),
      sub(4, 30, "often"),
      sub(5, 15.49, "never", !cancelLast),
    ],
  );
}

const PERSONAS: { name: string; snap: FinancialSnapshot; score: number; level: number }[] = [
  {
    name: "L1",
    snap: snapshot(5000, [debt(1, 3000, 100)], [sub(1, 15)]),
    score: 87.22,
    level: 1,
  },
  {
    name: "L2",
    snap: snapshot(4000, [debt(1, 8000, 200), debt(2, 2000, 60)], [sub(1, 50), sub(2, 15)]),
    score: 62.74,
    level: 2,
  },
  {
    name: "L3",
    snap: snapshot(
      3500,
      [debt(1, 15000, 350), debt(2, 5000, 100)],
      [sub(1, 80), sub(2, 50), sub(3, 15)],
    ),
    score: 42.74,
    level: 3,
  },
  { name: "L4", snap: l4Snapshot(false), score: 32.74, level: 4 },
  {
    name: "L5",
    snap: snapshot(
      2500,
      [debt(1, 35000, 700), debt(2, 12000, 250), debt(3, 5000, 120)],
      [sub(1, 200), sub(2, 100), sub(3, 80), sub(4, 60), sub(5, 30), sub(6, 15)],
    ),
    score: 17.07,
    level: 5,
  },
];

describe("calibration personas", () => {
  for (const persona of PERSONAS) {
    it(`computes the ${persona.name} persona light score and decay level`, () => {
      const state = computeHouseState(persona.snap);
      expect(state.lightScore).toBeCloseTo(persona.score, SCORE_PRECISION);
      expect(state.decayLevel).toBe(persona.level);
      expect(state.momentum).toBe(0);
      expect(state.baseScore).toBe(state.lightScore);
    });
  }
});

describe("zero-income handling", () => {
  it("returns score 0 and level 5 when income is 0 with a debt balance", () => {
    const state = computeHouseState(snapshot(0, [debt(1, 1000, 50)], []));
    expect(state.lightScore).toBe(0);
    expect(state.decayLevel).toBe(5);
  });

  it("returns score 0 when income is 0 with a valid active subscription", () => {
    const state = computeHouseState(snapshot(0, [], [sub(1, 10)]));
    expect(state.lightScore).toBe(0);
  });

  it("returns a pristine house when income is 0 with no debts and no valid active subscriptions", () => {
    const state = computeHouseState(snapshot(0, [], []));
    expect(state.lightScore).toBe(100);
    expect(state.decayLevel).toBe(1);
    expect(state.windowBrightness).toBe(1);
    expect(state.levelProgress).toBe(1);
  });

  it("treats an income of 50 cents like zero income", () => {
    const withDebt = computeHouseState(snapshot(0.5, [debt(1, 1000, 50)], []));
    expect(withDebt.lightScore).toBe(0);
    expect(withDebt.decayLevel).toBe(5);
    const empty = computeHouseState(snapshot(0.5, [], []));
    expect(empty.lightScore).toBe(100);
    expect(empty.decayLevel).toBe(1);
  });
});

describe("L4 exorcism before and after", () => {
  it("raises the score and removes exactly the canceled zombie", () => {
    const before = computeHouseState(l4Snapshot(false));
    const after = computeHouseState(l4Snapshot(true));
    expect(after.lightScore).toBeGreaterThan(before.lightScore);
    const beforeIds = before.zombies.map((z) => z.subscriptionId);
    const afterIds = after.zombies.map((z) => z.subscriptionId);
    expect(beforeIds).toContain("sub-5");
    expect(afterIds).not.toContain("sub-5");
    expect(afterIds).toEqual(beforeIds.filter((id) => id !== "sub-5"));
  });
});

describe("input immutability", () => {
  function deepFreeze<T>(value: T): T {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
  }

  it("does not throw on a deep-frozen snapshot and leaves it unchanged", () => {
    const input = l4Snapshot(false);
    input.events = [{ type: "debt_payment", date: "2025-06-10", extraPrincipalCents: 30000 }];
    input.transactions = [
      { transactionId: "t1", amount: 4.5, description: "Coffee", category: "food", date: "2025-06-14" },
    ];
    const copy = structuredClone(input);
    deepFreeze(input);
    expect(() => computeHouseState(input)).not.toThrow();
    expect(input).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// End-to-end properties (task 12)
// ---------------------------------------------------------------------------

const PROPERTY_RUNS = 100;
const MAX_CANCELABLE_MONTHLY_COST_CENTS = 1_000_000;
const MAX_PAYMENT_CENTS = 100_000_000;

describe("computeHouseState monotonicity properties", () => {
  it("strictly raises the score and removes one zombie when a subscription is canceled", () => {
    // Feature: haunting-engine, Property 5: Subscription cancellation strict monotonicity
    fc.assert(
      fc.property(realisticSnapshot, fc.nat(), (snap, pick) => {
        fc.pre(snap.monthlyIncome > 0);
        const before = computeHouseState(snap);
        fc.pre(before.lightScore > SCORE_MIN && before.lightScore < SCORE_MAX);
        const candidates = before.zombies.filter(
          (z) => z.monthlyCost <= MAX_CANCELABLE_MONTHLY_COST_CENTS,
        );
        fc.pre(candidates.length > 0);
        const target = candidates[pick % candidates.length];
        const index = snap.subscriptions.findIndex((s) => s.subscriptionId === target.subscriptionId);
        const after = computeHouseState(cancelSubscription(snap, index));
        expect(after.lightScore).toBeGreaterThan(before.lightScore);
        expect(after.zombies).toHaveLength(before.zombies.length - 1);
        expect(after.zombies.map((z) => z.subscriptionId)).not.toContain(target.subscriptionId);
      }),
      { numRuns: PROPERTY_RUNS },
    );
  });

  it("never lowers the score when a debt is paid down, and keeps a perfect score", () => {
    // Feature: haunting-engine, Property 7: Debt payment monotonicity
    fc.assert(
      fc.property(
        realisticSnapshot,
        fc.nat(),
        fc.integer({ min: 1, max: MAX_PAYMENT_CENTS }),
        (snap, pick, deltaCents) => {
          const indexes = snap.debts.flatMap((d, i) => (d.balance > 0 ? [i] : []));
          fc.pre(indexes.length > 0);
          const index = indexes[pick % indexes.length];
          const before = computeHouseState(snap).lightScore;
          const after = computeHouseState(payDebt(snap, index, deltaCents)).lightScore;
          expect(after).toBeGreaterThanOrEqual(before);
          if (before === SCORE_MAX) expect(after).toBe(SCORE_MAX);
        },
      ),
      { numRuns: PROPERTY_RUNS },
    );
  });
});
