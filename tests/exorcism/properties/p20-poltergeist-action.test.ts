import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generateExorcismPlan } from "@/lib/exorcism";
import { computeHouseState } from "@/lib/haunting";
import type { FinancialSnapshot, HouseState, InputSubscription } from "@/lib/haunting/types";

const NUM_RUNS = 200;
const NOW = "2025-06-02";
const CENTS_PER_DOLLAR = 100;
const MAX_INCOME_DOLLARS = 20000;
const MAX_TOTAL_CENTS = 5_000_000;
const MAX_CATEGORY_CENTS = 500_000;
const MAX_SUBS = 6;
const REDUCE_PREFIX = "reduce:";
// POLTERGEIST_RATIO is 0.1. With whole-dollar incomes the threshold is
// income cents / 10, so the reference below stays in exact integer math.
const RATIO_DENOMINATOR = 10;

// Category names include a BMP character above the surrogate range and an
// astral character, whose code-point order differs from UTF-16 order.
const CATEGORY_NAMES = ["coffee", "Coffee", "snacks", "a", "b", "\uFF5E", "\u{1F600}"];

const hostileNumberArb = fc.constantFrom(
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  -5,
  0,
);
const categoryValueArb = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: 1, max: MAX_CATEGORY_CENTS }) },
  // Few distinct values so ties for the largest category are common.
  { weight: 3, arbitrary: fc.constantFrom(500, 1000, 2000) },
  { weight: 1, arbitrary: hostileNumberArb },
);

const byCategoryArb: fc.Arbitrary<Record<string, number>> = fc
  .uniqueArray(fc.constantFrom(...CATEGORY_NAMES), { maxLength: CATEGORY_NAMES.length })
  .chain((names) =>
    fc.tuple(...names.map(() => categoryValueArb)).map((values) => {
      const record: Record<string, number> = {};
      names.forEach((name, i) => {
        record[name] = values[i];
      });
      return record;
    }),
  );

const poltergeistArb = fc.option(
  fc.record({
    totalAmount: fc.integer({ min: 0, max: MAX_TOTAL_CENTS }),
    transactionCount: fc.integer({ min: 0, max: 100 }),
    byCategory: byCategoryArb,
  }),
  { nil: null },
);

const subscriptionsArb: fc.Arbitrary<InputSubscription[]> = fc
  .array(
    fc.record({
      name: fc.constantFrom("Stream", "Music", "Cloud"),
      amount: fc.integer({ min: 0, max: 60 }),
      cadence: fc.constantFrom("weekly", "monthly", "yearly"),
      usage: fc.constantFrom("often", "rarely", "never"),
      active: fc.boolean(),
    }),
    { maxLength: MAX_SUBS },
  )
  .map((subs) => subs.map((s, i) => ({ ...s, subscriptionId: `sub-${i}` })));

function debtsArb(allowDebts: boolean) {
  return allowDebts
    ? fc.array(
        fc.record({
          name: fc.constantFrom("Visa", "Loan"),
          balance: fc.integer({ min: 0, max: 50000 }),
          minimumMonthlyPayment: fc.integer({ min: 0, max: 500 }),
          apr: fc.constantFrom(0, 0.01, 0.2, 0.3),
        }),
        { maxLength: 3 },
      ).map((debts) => debts.map((d, i) => ({ ...d, debtId: `debt-${i}` })))
    : fc.constant<never[]>([]);
}

type Scenario = { snapshot: FinancialSnapshot; houseState: HouseState };

function scenarioArb(options: { allowOthers: boolean }): fc.Arbitrary<Scenario> {
  return fc
    .record({
      monthlyIncome: fc.integer({ min: 0, max: MAX_INCOME_DOLLARS }),
      debts: debtsArb(options.allowOthers),
      subscriptions: options.allowOthers ? subscriptionsArb : fc.constant<never[]>([]),
      poltergeist: poltergeistArb,
    })
    .map(({ poltergeist, ...rest }) => {
      const snapshot: FinancialSnapshot = {
        ...rest,
        transactions: [],
        events: [],
        now: NOW,
      };
      const houseState: HouseState = { ...computeHouseState(snapshot), poltergeist };
      return { snapshot, houseState };
    });
}

function compareCodePoints(a: string, b: string): number {
  const left = Array.from(a, (c) => c.codePointAt(0) ?? 0);
  const right = Array.from(b, (c) => c.codePointAt(0) ?? 0);
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}

/** Reference: largest finite value above 0; ties go to the smallest code-point name. */
function referenceCategory(byCategory: Record<string, number>): string | null {
  let best: string | null = null;
  for (const [name, value] of Object.entries(byCategory)) {
    if (!Number.isFinite(value) || value <= 0) continue;
    if (best === null) {
      best = name;
      continue;
    }
    const bestValue = byCategory[best];
    if (value > bestValue || (value === bestValue && compareCodePoints(name, best) < 0)) {
      best = name;
    }
  }
  return best;
}

/** Reference: ceil((total - 10% of income) / 100) * 100, in exact integer cents. */
function referenceExcess(totalCents: number, monthlyIncomeDollars: number): number {
  const incomeCents = monthlyIncomeDollars * CENTS_PER_DOLLAR;
  const scaledGap = RATIO_DENOMINATOR * totalCents - incomeCents;
  if (scaledGap <= 0) return 0;
  const unit = RATIO_DENOMINATOR * CENTS_PER_DOLLAR;
  return Math.ceil(scaledGap / unit) * CENTS_PER_DOLLAR;
}

type Expected = { category: string; excessCents: number } | null;

function expectedReduction({ snapshot, houseState }: Scenario): Expected {
  const poltergeist = houseState.poltergeist;
  if (poltergeist === null) return null;
  const category = referenceCategory(poltergeist.byCategory);
  if (category === null) return null;
  const excessCents = referenceExcess(poltergeist.totalAmount, snapshot.monthlyIncome);
  return excessCents > 0 ? { category, excessCents } : null;
}

describe("Poltergeist action", () => {
  it("is absent when its conditions fail, otherwise precise and unique", () => {
    // Feature: app-screens, Property 20: The Poltergeist action is precise and optional
    // **Validates: Requirements 12.10, 12.11, 12.12, 12.13, 15.8**
    fc.assert(
      fc.property(scenarioArb({ allowOthers: true }), (scenario) => {
        const plan = generateExorcismPlan(scenario.houseState, scenario.snapshot);
        const reductions = plan.filter((a) => a.kind === "reduce_small_expenses");
        const expected = expectedReduction(scenario);
        expect(reductions.length).toBeLessThanOrEqual(1);
        if (expected === null) {
          expect(reductions).toHaveLength(0);
          expect(plan.some((a) => a.id.startsWith(REDUCE_PREFIX))).toBe(false);
          return;
        }
        for (const action of reductions) {
          expect(action.id).toBe(`${REDUCE_PREFIX}${expected.category}`);
          expect(action.targetId).toBe(expected.category);
          expect(action.priorityCents).toBe(expected.excessCents);
          expect(action.monthlyAmountCents).toBe(expected.excessCents);
          expect(action.monthlyAmountCents % CENTS_PER_DOLLAR).toBe(0);
          expect(action.title).toBe(
            `Cut ${expected.category} by $${(expected.excessCents / CENTS_PER_DOLLAR).toLocaleString("en-US")} this month to dispel the Poltergeist`,
          );
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("breaks ties by the smallest name in code-point order, not UTF-16 order", () => {
    // Feature: app-screens, Property 20: The Poltergeist action is precise and optional
    const tieArb = fc.record({
      value: fc.integer({ min: 1, max: MAX_CATEGORY_CENTS }),
      order: fc.boolean(),
    });
    fc.assert(
      fc.property(tieArb, ({ value, order }) => {
        const names = order ? ["\uFF5E", "\u{1F600}"] : ["\u{1F600}", "\uFF5E"];
        const byCategory: Record<string, number> = {};
        for (const name of names) byCategory[name] = value;
        const snapshot: FinancialSnapshot = {
          monthlyIncome: 0,
          debts: [],
          subscriptions: [],
          transactions: [],
          events: [],
          now: NOW,
        };
        const houseState: HouseState = {
          ...computeHouseState(snapshot),
          poltergeist: { totalAmount: MAX_TOTAL_CENTS, transactionCount: 2, byCategory },
        };
        const plan = generateExorcismPlan(houseState, snapshot);
        // U+FF5E (code point 65374) is smaller than U+1F600 (code point 128512).
        expect(plan.some((a) => a.id === `${REDUCE_PREFIX}\uFF5E`)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("is present with exact figures when it is the only real candidate", () => {
    // Feature: app-screens, Property 20: The Poltergeist action is precise and optional
    // With no subscriptions and no debts nothing outranks it, so it must be in the plan.
    fc.assert(
      fc.property(scenarioArb({ allowOthers: false }), (scenario) => {
        const plan = generateExorcismPlan(scenario.houseState, scenario.snapshot);
        const reductions = plan.filter((a) => a.kind === "reduce_small_expenses");
        const expected = expectedReduction(scenario);
        if (expected === null) {
          expect(reductions).toHaveLength(0);
          return;
        }
        expect(reductions).toHaveLength(1);
        const [action] = reductions;
        expect(action.id).toBe(`${REDUCE_PREFIX}${expected.category}`);
        expect(action.priorityCents).toBe(expected.excessCents);
        expect(action.monthlyAmountCents).toBe(expected.excessCents);
        expect(action.subtitle).toBe("Open Transactions to review it. Tick it when you are done.");
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
