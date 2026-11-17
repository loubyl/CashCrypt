import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MIN_INCOME_CENTS, SCORE_MAX } from "@/lib/haunting/config";
import { computeBaseScore, computeWeightedSum } from "@/lib/haunting/lightScore";
import type {
  InternalDebt,
  InternalSnapshot,
  InternalSubscription,
} from "@/lib/haunting/types";

const L1_INCOME_CENTS = 500000;
const EXPECTED_L1_SUM = 0.1465;
const EXPECTED_L1_BASE_SCORE = 87.22;
const SUM_PRECISION = 6;
const SCORE_PRECISION = 2;
const ZERO_INCOME_BELOW_MIN_CENTS = 50;

function makeDebt(balanceCents: number, minimumMonthlyPaymentCents: number): InternalDebt {
  return {
    debtId: "d1",
    name: "Debt",
    balanceCents,
    minimumMonthlyPaymentCents,
    apr: 0.1,
  };
}

function makeSub(
  monthlyCostCents: number,
  overrides: Partial<InternalSubscription> = {},
): InternalSubscription {
  return {
    subscriptionId: "s1",
    name: "Sub",
    monthlyCostCents,
    usage: "often",
    active: true,
    valid: true,
    ...overrides,
  };
}

function makeSnapshot(
  monthlyIncomeCents: number,
  debts: InternalDebt[] = [],
  subscriptions: InternalSubscription[] = [],
): InternalSnapshot {
  return {
    monthlyIncomeCents,
    debts,
    subscriptions,
    transactions: [],
    events: [],
    now: "2025-01-15",
  };
}

describe("computeWeightedSum", () => {
  it("returns S of about 0.1465 for the L1 persona", () => {
    const sum = computeWeightedSum(L1_INCOME_CENTS, [makeDebt(300000, 10000)], [makeSub(1500)]);
    expect(sum).toBeCloseTo(EXPECTED_L1_SUM, SUM_PRECISION);
  });

  it("returns the exact weighted sum for hand-built inputs", () => {
    // A = 20000/200000 = 0.1, B = 240000/2400000 = 0.1, C = 10000/200000 = 0.05
    const sum = computeWeightedSum(200000, [makeDebt(240000, 20000)], [makeSub(10000)]);
    expect(sum).toBeCloseTo(1.0 * 0.1 + 2.5 * 0.1 + 0.5 * 0.05, SUM_PRECISION);
  });

  it("returns 0 when there are no debts and no subscriptions", () => {
    expect(computeWeightedSum(L1_INCOME_CENTS, [], [])).toBe(0);
  });

  it("returns 0 when the income is zero", () => {
    expect(computeWeightedSum(0, [makeDebt(300000, 10000)], [makeSub(1500)])).toBe(0);
  });

  it("sums several debts and subscriptions", () => {
    const together = computeWeightedSum(
      L1_INCOME_CENTS,
      [makeDebt(100000, 5000), makeDebt(200000, 5000)],
      [makeSub(1000), makeSub(500)],
    );
    const single = computeWeightedSum(L1_INCOME_CENTS, [makeDebt(300000, 10000)], [makeSub(1500)]);
    expect(together).toBeCloseTo(single, SUM_PRECISION);
  });

  it("treats negative balances and minimum payments as 0", () => {
    const sum = computeWeightedSum(L1_INCOME_CENTS, [makeDebt(-300000, -10000)], []);
    expect(sum).toBe(0);
  });

  it("treats a negative balance as 0 without offsetting other debts", () => {
    const withNegative = computeWeightedSum(
      L1_INCOME_CENTS,
      [makeDebt(300000, 10000), makeDebt(-100000, -5000)],
      [],
    );
    const withoutNegative = computeWeightedSum(L1_INCOME_CENTS, [makeDebt(300000, 10000)], []);
    expect(withNegative).toBeCloseTo(withoutNegative, SUM_PRECISION);
  });

  it("gives a fully paid debt no weight", () => {
    const withPaid = computeWeightedSum(L1_INCOME_CENTS, [makeDebt(0, 0)], [makeSub(1500)]);
    const withoutDebt = computeWeightedSum(L1_INCOME_CENTS, [], [makeSub(1500)]);
    expect(withPaid).toBe(withoutDebt);
  });
});

describe("computeBaseScore", () => {
  it("returns about 87.22 for the L1 persona", () => {
    const score = computeBaseScore(
      makeSnapshot(L1_INCOME_CENTS, [makeDebt(300000, 10000)], [makeSub(1500)]),
    );
    expect(score).toBeCloseTo(EXPECTED_L1_BASE_SCORE, SCORE_PRECISION);
  });

  it("returns 0 on zero income with a debt balance above zero", () => {
    expect(computeBaseScore(makeSnapshot(0, [makeDebt(100000, 5000)]))).toBe(0);
  });

  it("returns 0 on zero income with a valid active subscription", () => {
    expect(computeBaseScore(makeSnapshot(0, [], [makeSub(1500)]))).toBe(0);
  });

  it("returns 100 on zero income with no debts and no subscriptions", () => {
    expect(computeBaseScore(makeSnapshot(0))).toBe(100);
  });

  it("treats an income of 50 cents as zero income", () => {
    const income = ZERO_INCOME_BELOW_MIN_CENTS;
    expect(computeBaseScore(makeSnapshot(income, [makeDebt(100000, 5000)]))).toBe(0);
    expect(computeBaseScore(makeSnapshot(income, [], [makeSub(1500)]))).toBe(0);
    expect(computeBaseScore(makeSnapshot(income))).toBe(100);
  });

  it("returns 100 on zero income when the only subscriptions are inactive or invalid", () => {
    const subs = [makeSub(1500, { active: false }), makeSub(1500, { valid: false })];
    expect(computeBaseScore(makeSnapshot(0, [], subs))).toBe(100);
  });

  it("returns 100 with positive income and nothing to pay", () => {
    expect(computeBaseScore(makeSnapshot(L1_INCOME_CENTS))).toBe(100);
  });

  it("ignores negative balances and minimum payments", () => {
    const score = computeBaseScore(makeSnapshot(L1_INCOME_CENTS, [makeDebt(-300000, -10000)]));
    expect(score).toBe(100);
  });

  it("gives a fully paid debt the same score as having no debt", () => {
    const subs = [makeSub(1500)];
    const paid = computeBaseScore(makeSnapshot(L1_INCOME_CENTS, [makeDebt(0, 0)], subs));
    const none = computeBaseScore(makeSnapshot(L1_INCOME_CENTS, [], subs));
    expect(paid).toBe(none);
  });

  it("returns 100 on zero income when every debt has a zero balance", () => {
    expect(computeBaseScore(makeSnapshot(0, [makeDebt(0, 0), makeDebt(0, 0)]))).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Property tests for the base score formula (design.md, Property 13).
// The realistic generator is built inline here; task 11.1 moves the shared
// version into src/lib/haunting/testArbitraries.ts.
// ---------------------------------------------------------------------------

const NUM_RUNS = 200;
const MAX_INCOME_CENTS = 1_000_000;
const MAX_REALISTIC_CENTS = 10_000_000; // 1e7, the "realistic" amount ceiling
const MAX_MIN_PAYMENT_CENTS = 1_000_000;
const MAX_ITEMS = 5;
const MIN_INCREASE_CENTS = 1;
const MAX_INCREASE_CENTS = 1_000_000;
const RELATIVE_GAP = 1e-9;

const debtArb = fc.record({
  debtId: fc.constant("d"),
  name: fc.constant("Debt"),
  balanceCents: fc.integer({ min: 0, max: MAX_REALISTIC_CENTS }),
  minimumMonthlyPaymentCents: fc.integer({ min: 0, max: MAX_MIN_PAYMENT_CENTS }),
  apr: fc.constant(0.1),
});

const validActiveSubArb = fc.record({
  subscriptionId: fc.constant("s"),
  name: fc.constant("Sub"),
  monthlyCostCents: fc.integer({ min: 1, max: MAX_MIN_PAYMENT_CENTS }),
  usage: fc.constantFrom("often" as const, "rarely" as const, "never" as const),
  active: fc.constant(true),
  valid: fc.constant(true),
});

/** A realistic snapshot with income >= MIN_INCOME_CENTS and at least one debt and one subscription. */
const snapshotArb: fc.Arbitrary<InternalSnapshot> = fc.record({
  monthlyIncomeCents: fc.integer({ min: MIN_INCOME_CENTS, max: MAX_INCOME_CENTS }),
  debts: fc.array(debtArb, { minLength: 1, maxLength: MAX_ITEMS }),
  subscriptions: fc.array(validActiveSubArb, { minLength: 1, maxLength: MAX_ITEMS }),
  transactions: fc.constant<InternalSnapshot["transactions"]>([]),
  events: fc.constant<InternalSnapshot["events"]>([]),
  now: fc.constant("2025-01-15"),
});

type IncreaseKind = "balance" | "minimumPayment" | "subscription";

const increaseArb = fc.record({
  kind: fc.constantFrom<IncreaseKind>("balance", "minimumPayment", "subscription"),
  index: fc.nat(),
  deltaCents: fc.integer({ min: MIN_INCREASE_CENTS, max: MAX_INCREASE_CENTS }),
});

/** Returns a new snapshot where exactly one burden grows by at least one cent. */
function increaseBurden(
  snapshot: InternalSnapshot,
  increase: { kind: IncreaseKind; index: number; deltaCents: number },
): InternalSnapshot {
  if (increase.kind === "subscription") {
    const target = increase.index % snapshot.subscriptions.length;
    return {
      ...snapshot,
      subscriptions: snapshot.subscriptions.map((sub, i) =>
        i === target ? { ...sub, monthlyCostCents: sub.monthlyCostCents + increase.deltaCents } : sub,
      ),
    };
  }
  const target = increase.index % snapshot.debts.length;
  return {
    ...snapshot,
    debts: snapshot.debts.map((debt, i) => {
      if (i !== target) return debt;
      return increase.kind === "balance"
        ? { ...debt, balanceCents: debt.balanceCents + increase.deltaCents }
        : {
            ...debt,
            minimumMonthlyPaymentCents: debt.minimumMonthlyPaymentCents + increase.deltaCents,
          };
    }),
  };
}

function weightedSumOf(snapshot: InternalSnapshot): number {
  return computeWeightedSum(
    snapshot.monthlyIncomeCents,
    snapshot.debts,
    snapshot.subscriptions.filter((sub) => sub.valid && sub.active),
  );
}

describe("computeBaseScore properties", () => {
  // Feature: haunting-engine, Property 13: Base score is positive and strictly decreasing in the weighted sum
  it("is never 0 and never above the maximum when income is at least the minimum", () => {
    fc.assert(
      fc.property(snapshotArb, (snapshot) => {
        const score = computeBaseScore(snapshot);
        expect(Number.isFinite(score)).toBe(true);
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(SCORE_MAX);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 13: Base score is positive and strictly decreasing in the weighted sum
  it("strictly lowers the score when any burden grows by at least one cent", () => {
    fc.assert(
      fc.property(snapshotArb, increaseArb, (snapshot, increase) => {
        const heavier = increaseBurden(snapshot, increase);
        expect(weightedSumOf(heavier)).toBeGreaterThan(weightedSumOf(snapshot));
        expect(computeBaseScore(heavier)).toBeLessThan(computeBaseScore(snapshot));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 13: Base score is positive and strictly decreasing in the weighted sum
  it("orders any two snapshots by their weighted sum, in reverse", () => {
    fc.assert(
      fc.property(snapshotArb, snapshotArb, (a, b) => {
        const sumA = weightedSumOf(a);
        const sumB = weightedSumOf(b);
        // Skip pairs whose sums are closer than floating-point resolution can separate.
        fc.pre(Math.abs(sumA - sumB) > RELATIVE_GAP * (1 + Math.max(sumA, sumB)));
        const scoreA = computeBaseScore(a);
        const scoreB = computeBaseScore(b);
        if (sumA < sumB) expect(scoreA).toBeGreaterThan(scoreB);
        else expect(scoreA).toBeLessThan(scoreB);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
