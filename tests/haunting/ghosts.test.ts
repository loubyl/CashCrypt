import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  MIN_INCOME_CENTS,
  POLTERGEIST_RATIO,
  SMALL_EXPENSE_THRESHOLD_CENTS,
  WINDOW_DAYS,
} from "@/lib/haunting/config";
import { computeGhostsAndPoltergeist, isSmallExpense } from "@/lib/haunting/ghosts";
import { computeHouseState } from "@/lib/haunting";
import type { FinancialSnapshot, InternalTransaction } from "@/lib/haunting/types";

const NUM_RUNS = 100;
const NOW = "2025-06-15";
const MS_PER_DAY = 86_400_000;
const NOW_MS = Date.UTC(2025, 5, 15);
const OLDEST_IN_WINDOW_OFFSET = -(WINDOW_DAYS - 1);
const JUST_OUTSIDE_WINDOW_OFFSET = -WINDOW_DAYS;
const INCOME_CENTS = 300_000;
const LOW_AMOUNT_CENTS = 1;
const HIGH_AMOUNT_CENTS = SMALL_EXPENSE_THRESHOLD_CENTS - 1;
const COFFEE_CENTS = 450;
const SNACK_CENTS = 700;
const MAX_INCOME_CENTS = 5_000_000;
const MIN_OFFSET = -(WINDOW_DAYS + 10);
const MAX_OFFSET = 5;
const MAX_TRANSACTIONS = 30;
const CATEGORIES = ["coffee", "snacks", "rides", "__proto__"];

function dateWithOffset(offsetDays: number): string {
  return new Date(NOW_MS + offsetDays * MS_PER_DAY).toISOString().slice(0, 10);
}

const makeTx = (overrides: Partial<InternalTransaction> = {}): InternalTransaction => ({
  transactionId: "tx-1",
  amountCents: COFFEE_CENTS,
  description: "Coffee",
  category: "coffee",
  date: NOW,
  ...overrides,
});

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

describe("isSmallExpense", () => {
  it("rejects zero and negative amounts", () => {
    expect(isSmallExpense(0)).toBe(false);
    expect(isSmallExpense(-1)).toBe(false);
    expect(isSmallExpense(-SMALL_EXPENSE_THRESHOLD_CENTS)).toBe(false);
  });

  it("accepts the smallest and largest amounts below the threshold", () => {
    expect(isSmallExpense(LOW_AMOUNT_CENTS)).toBe(true);
    expect(isSmallExpense(HIGH_AMOUNT_CENTS)).toBe(true);
  });

  it("rejects an amount equal to the threshold", () => {
    expect(isSmallExpense(SMALL_EXPENSE_THRESHOLD_CENTS)).toBe(false);
  });
});

describe("computeGhostsAndPoltergeist window", () => {
  it("includes transactions dated now and 29 days before now", () => {
    const txs = [
      makeTx({ transactionId: "a", date: NOW }),
      makeTx({ transactionId: "b", date: dateWithOffset(OLDEST_IN_WINDOW_OFFSET) }),
    ];
    const { ghosts } = computeGhostsAndPoltergeist(txs, INCOME_CENTS, NOW);
    expect(ghosts.map((g) => g.transactionId)).toEqual(["a", "b"]);
  });

  it("excludes transactions dated 30 or 31 days before now", () => {
    const txs = [
      makeTx({ transactionId: "a", date: dateWithOffset(JUST_OUTSIDE_WINDOW_OFFSET) }),
      makeTx({ transactionId: "b", date: dateWithOffset(JUST_OUTSIDE_WINDOW_OFFSET - 1) }),
    ];
    expect(computeGhostsAndPoltergeist(txs, INCOME_CENTS, NOW).ghosts).toEqual([]);
  });

  it("excludes transactions dated one day after now", () => {
    const txs = [makeTx({ date: dateWithOffset(1) })];
    expect(computeGhostsAndPoltergeist(txs, INCOME_CENTS, NOW).ghosts).toEqual([]);
  });
});

describe("computeGhostsAndPoltergeist Poltergeist threshold", () => {
  it("returns one ghost per qualifying transaction and no Poltergeist below the threshold", () => {
    const txs = [
      makeTx({ transactionId: "a", amountCents: COFFEE_CENTS }),
      makeTx({ transactionId: "b", amountCents: SNACK_CENTS, category: "snacks" }),
      makeTx({ transactionId: "big", amountCents: SMALL_EXPENSE_THRESHOLD_CENTS }),
    ];
    const result = computeGhostsAndPoltergeist(txs, INCOME_CENTS, NOW);
    expect(result.poltergeist).toBeNull();
    expect(result.ghosts).toEqual([
      { transactionId: "a", amount: COFFEE_CENTS, description: "Coffee", category: "coffee", date: NOW },
      { transactionId: "b", amount: SNACK_CENTS, description: "Coffee", category: "snacks", date: NOW },
    ]);
  });

  it("stays without a Poltergeist when the total equals the threshold exactly", () => {
    const income = 100_000;
    const threshold = POLTERGEIST_RATIO * income;
    const count = 10;
    const each = threshold / count;
    const txs = Array.from({ length: count }, (_, i) =>
      makeTx({ transactionId: `t${i}`, amountCents: each }),
    );
    const result = computeGhostsAndPoltergeist(txs, income, NOW);
    expect(result.poltergeist).toBeNull();
    expect(result.ghosts).toHaveLength(count);
  });

  it("creates a Poltergeist when the total is one cent above the threshold", () => {
    const income = 100_000;
    const threshold = POLTERGEIST_RATIO * income;
    const count = 10;
    const each = threshold / count;
    const txs = Array.from({ length: count }, (_, i) =>
      makeTx({ transactionId: `t${i}`, amountCents: each + (i === 0 ? 1 : 0) }),
    );
    const result = computeGhostsAndPoltergeist(txs, income, NOW);
    expect(result.poltergeist?.totalAmount).toBe(threshold + 1);
    expect(result.ghosts).toEqual([]);
  });

  it("builds a Poltergeist with total, count and per-category totals and no ghosts", () => {
    const txs = [
      makeTx({ transactionId: "a", amountCents: 1_400, category: "coffee" }),
      makeTx({ transactionId: "b", amountCents: 1_300, category: "coffee" }),
      makeTx({ transactionId: "c", amountCents: 1_200, category: "snacks" }),
    ];
    const result = computeGhostsAndPoltergeist(txs, 20_000, NOW);
    expect(result.ghosts).toEqual([]);
    expect(result.poltergeist).toEqual({
      totalAmount: 3_900,
      transactionCount: 3,
      byCategory: { coffee: 2_700, snacks: 1_200 },
    });
  });

  it("returns ghosts individually when income is zero", () => {
    const txs = [makeTx({ transactionId: "a" }), makeTx({ transactionId: "b" })];
    const result = computeGhostsAndPoltergeist(txs, 0, NOW);
    expect(result.poltergeist).toBeNull();
    expect(result.ghosts).toHaveLength(txs.length);
  });

  it("returns no ghosts and no Poltergeist for empty transactions", () => {
    expect(computeGhostsAndPoltergeist([], INCOME_CENTS, NOW)).toEqual({
      ghosts: [],
      poltergeist: null,
    });
  });
});

type RawTx = { amount: number; offset: number; category: string };

const amountArb = fc.oneof(
  fc.integer({ min: 1, max: HIGH_AMOUNT_CENTS }),
  fc.integer({ min: HIGH_AMOUNT_CENTS, max: SMALL_EXPENSE_THRESHOLD_CENTS + 500 }),
  fc.integer({ min: -2_000, max: 0 }),
);
const badAmountArb = fc.oneof(
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
  fc.integer({ min: -100_000, max: 0 }),
);
const rawTxArb: fc.Arbitrary<RawTx> = fc.record({
  amount: amountArb,
  offset: fc.integer({ min: MIN_OFFSET, max: MAX_OFFSET }),
  category: fc.constantFrom(...CATEGORIES),
});
const rawTxsArb = fc.array(rawTxArb, { maxLength: MAX_TRANSACTIONS });
const incomeArb = fc.oneof(
  fc.integer({ min: 0, max: MAX_INCOME_CENTS }),
  fc.integer({ min: 0, max: 50_000 }),
);

function toTxs(raws: RawTx[]): InternalTransaction[] {
  return raws.map((raw, i) =>
    makeTx({
      transactionId: `t${i}`,
      amountCents: raw.amount,
      category: raw.category,
      date: dateWithOffset(raw.offset),
    }),
  );
}

const qualifies = (raw: RawTx): boolean =>
  raw.amount > 0 &&
  raw.amount < SMALL_EXPENSE_THRESHOLD_CENTS &&
  raw.offset >= OLDEST_IN_WINDOW_OFFSET &&
  raw.offset <= 0;

describe("ghosts properties", () => {
  // Feature: haunting-engine, Property 8: Ghost-poltergeist conservation
  it("keeps ghosts and Poltergeist consistent with the qualifying transactions", () => {
    fc.assert(
      fc.property(rawTxsArb, incomeArb, (raws, income) => {
        const txs = toTxs(raws);
        const qualifyingIds = txs.filter((_, i) => qualifies(raws[i])).map((tx) => tx.transactionId);
        const total = txs.reduce(
          (sum, tx, i) => (qualifies(raws[i]) ? sum + tx.amountCents : sum),
          0,
        );
        const { ghosts, poltergeist } = computeGhostsAndPoltergeist(txs, income, NOW);
        if (poltergeist === null) {
          expect(ghosts.map((g) => g.transactionId)).toEqual(qualifyingIds);
          return;
        }
        expect(ghosts).toEqual([]);
        expect(poltergeist.totalAmount).toBe(total);
        expect(poltergeist.transactionCount).toBe(qualifyingIds.length);
        const categorySum = Object.values(poltergeist.byCategory).reduce((a, b) => a + b, 0);
        expect(categorySum).toBe(poltergeist.totalAmount);
        expect(income).toBeGreaterThanOrEqual(MIN_INCOME_CENTS);
        expect(total).toBeGreaterThan(POLTERGEIST_RATIO * income);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 8: Ghost-poltergeist conservation
  it("creates a Poltergeist exactly when usable income is strictly exceeded", () => {
    fc.assert(
      fc.property(rawTxsArb, incomeArb, (raws, income) => {
        const total = raws.filter(qualifies).reduce((sum, raw) => sum + raw.amount, 0);
        const expected =
          income >= MIN_INCOME_CENTS && total > 0 && total > POLTERGEIST_RATIO * income;
        const { poltergeist } = computeGhostsAndPoltergeist(toTxs(raws), income, NOW);
        expect(poltergeist !== null).toBe(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 19: Small-expense bounds
  it("accepts an amount as small only when it is finite and strictly inside (0, threshold)", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.double({ noNaN: false }), fc.integer({ min: -3_000, max: 3_000 })),
        (amount) => {
          const expected =
            Number.isFinite(amount) && amount > 0 && amount < SMALL_EXPENSE_THRESHOLD_CENTS;
          expect(isSmallExpense(amount)).toBe(expected);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 19: Small-expense bounds
  it("ignores transactions with bad amounts or dates outside the window", () => {
    const badTxArb = fc.oneof(
      fc.record({
        amount: badAmountArb,
        offset: fc.integer({ min: OLDEST_IN_WINDOW_OFFSET, max: 0 }),
        category: fc.constantFrom(...CATEGORIES),
      }),
      fc.record({
        amount: fc.integer({ min: 1, max: HIGH_AMOUNT_CENTS }),
        offset: fc.oneof(
          fc.integer({ min: MIN_OFFSET, max: JUST_OUTSIDE_WINDOW_OFFSET }),
          fc.integer({ min: 1, max: MAX_OFFSET }),
        ),
        category: fc.constantFrom(...CATEGORIES),
      }),
    );
    fc.assert(
      fc.property(fc.array(badTxArb, { maxLength: MAX_TRANSACTIONS }), incomeArb, (raws, income) => {
        const result = computeGhostsAndPoltergeist(toTxs(raws), income, NOW);
        expect(result).toEqual({ ghosts: [], poltergeist: null });
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 19: Small-expense bounds
  it("does not let bad transactions change the result for the good ones", () => {
    const badRawArb = fc.record({
      amount: badAmountArb,
      offset: fc.integer({ min: MIN_OFFSET, max: MAX_OFFSET }),
      category: fc.constantFrom(...CATEGORIES),
    });
    fc.assert(
      fc.property(rawTxsArb, fc.array(badRawArb, { maxLength: 10 }), incomeArb, (raws, bad, income) => {
        const goodOnly = computeGhostsAndPoltergeist(toTxs(raws), income, NOW);
        const mixed = computeGhostsAndPoltergeist(toTxs([...raws, ...bad]), income, NOW);
        expect(mixed.poltergeist).toEqual(goodOnly.poltergeist);
        expect(mixed.ghosts).toEqual(goodOnly.ghosts);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 20: Ghost functions do not mutate their inputs
  it("does not throw on deep-frozen transactions and leaves them unchanged", () => {
    fc.assert(
      fc.property(rawTxsArb, incomeArb, (raws, income) => {
        const txs = deepFreeze(toTxs(raws));
        const snapshot = structuredClone(txs);
        expect(() => computeGhostsAndPoltergeist(txs, income, NOW)).not.toThrow();
        expect(txs).toEqual(snapshot);
        raws.forEach((raw) => expect(() => isSmallExpense(raw.amount)).not.toThrow());
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("computeHouseState Level 4 Poltergeist scenario", () => {
  const MONTHLY_INCOME_DOLLARS = 3_000;
  const TRANSACTION_COUNT = 30;
  const POLTERGEIST_AMOUNT_DOLLARS = 12;
  const GHOST_AMOUNT_DOLLARS = 9;
  const CENTS_PER_DOLLAR = 100;

  function snapshotWith(amountDollars: number): FinancialSnapshot {
    return {
      monthlyIncome: MONTHLY_INCOME_DOLLARS,
      debts: [],
      subscriptions: [],
      transactions: Array.from({ length: TRANSACTION_COUNT }, (_, i) => ({
        transactionId: `t${i}`,
        amount: amountDollars,
        description: "Small expense",
        category: "coffee",
        date: dateWithOffset(-i),
      })),
      events: [],
      now: NOW,
    };
  }

  it("merges 30 transactions of $12.00 on $3,000 income into a Poltergeist with no ghosts", () => {
    const { poltergeist, ghosts } = computeHouseState(snapshotWith(POLTERGEIST_AMOUNT_DOLLARS));
    expect(poltergeist).not.toBeNull();
    expect(poltergeist?.totalAmount).toBe(
      TRANSACTION_COUNT * POLTERGEIST_AMOUNT_DOLLARS * CENTS_PER_DOLLAR,
    );
    expect(poltergeist?.transactionCount).toBe(TRANSACTION_COUNT);
    expect(ghosts).toEqual([]);
  });

  it("keeps 30 transactions of $9.00 on $3,000 income as 30 individual ghosts", () => {
    const { poltergeist, ghosts } = computeHouseState(snapshotWith(GHOST_AMOUNT_DOLLARS));
    expect(poltergeist).toBeNull();
    expect(ghosts).toHaveLength(TRANSACTION_COUNT);
  });
});
