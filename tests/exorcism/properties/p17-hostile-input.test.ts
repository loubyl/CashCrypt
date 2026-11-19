import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { generateExorcismPlan } from "@/lib/exorcism";
import type { ExorcismAction } from "@/lib/exorcism";
import type { FinancialSnapshot, HouseState } from "@/lib/haunting";

const NUM_RUNS = 200;
const PLAN_LENGTH = 3;

// Hostile numbers: NaN, +/-Infinity, negatives, zero, extremes, plus ordinary values.
const hostileNumber = fc.oneof(
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
  fc.constant(-0),
  fc.constant(0),
  fc.constant(Number.MAX_VALUE),
  fc.constant(-Number.MAX_VALUE),
  fc.double({ noNaN: false }),
  fc.integer({ min: -1_000_000, max: 1_000_000 }),
  fc.double({ min: 0, max: 100_000, noNaN: true }),
);

// Values that are not numbers at all.
const nonNumber = fc.constantFrom<unknown>(undefined, null, "12", "abc", {}, [], true);
const looseNumber = fc.oneof(hostileNumber, hostileNumber, nonNumber);

// Values that are not arrays.
const nonArray = fc.constantFrom<unknown>(undefined, null, 0, "debts", {}, true, 42);
const looseText = fc.oneof(fc.string(), fc.constantFrom<unknown>(undefined, null, 5));
const usage = fc.constantFrom("often", "rarely", "never");

const zombie = fc.record({
  subscriptionId: looseText,
  name: looseText,
  monthlyCost: looseNumber,
  usage,
});

const debt = fc.record({
  debtId: looseText,
  name: looseText,
  balance: looseNumber,
  minimumMonthlyPayment: looseNumber,
  apr: looseNumber,
});

const poltergeist = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.record({
    totalAmount: looseNumber,
    transactionCount: looseNumber,
    byCategory: fc.oneof(
      fc.dictionary(fc.string(), looseNumber),
      fc.constant(undefined),
      fc.constant(null),
    ),
  }),
);

const hostileHouseState = fc
  .record({
    zombies: fc.oneof(fc.array(zombie, { maxLength: 8 }), nonArray),
    poltergeist,
    lightScore: looseNumber,
  })
  .map((parts) => parts as unknown as HouseState);

const hostileSnapshot = fc
  .record({
    monthlyIncome: looseNumber,
    debts: fc.oneof(fc.array(debt, { maxLength: 6 }), nonArray),
    subscriptions: fc.oneof(fc.constant<never[]>([]), nonArray),
    transactions: fc.oneof(fc.constant<never[]>([]), nonArray),
    events: fc.oneof(fc.constant<never[]>([]), nonArray),
    now: fc.constant("2025-01-15"),
  })
  .map((parts) => parts as unknown as FinancialSnapshot);

function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function numericFieldsAreValid(action: ExorcismAction): boolean {
  const optionalOk =
    action.suggestedAmountCents === undefined || isNonNegativeInteger(action.suggestedAmountCents);
  return (
    isNonNegativeInteger(action.monthlyAmountCents) &&
    isNonNegativeInteger(action.priorityCents) &&
    optionalOk
  );
}

describe("exorcism planner: hostile input", () => {
  // Feature: app-screens, Property 17: The planner tolerates hostile input
  // **Validates: Requirements 11.8, 15.7**
  it("never throws and returns three actions with finite non-negative integer cents", () => {
    fc.assert(
      fc.property(hostileHouseState, hostileSnapshot, (houseState, snapshot) => {
        const plan = generateExorcismPlan(houseState, snapshot);
        expect(plan).toHaveLength(PLAN_LENGTH);
        for (const action of plan) {
          expect(numericFieldsAreValid(action)).toBe(true);
          expect(typeof action.id).toBe("string");
          expect(typeof action.title).toBe("string");
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("returns three fallbacks for empty arrays and a zero-income snapshot", () => {
    const houseState = { zombies: [], ghosts: [], poltergeist: null } as unknown as HouseState;
    const snapshot = {
      monthlyIncome: 0,
      debts: [],
      subscriptions: [],
      transactions: [],
      events: [],
      now: "2025-01-15",
    } as FinancialSnapshot;
    const plan = generateExorcismPlan(houseState, snapshot);
    expect(plan).toHaveLength(PLAN_LENGTH);
    expect(plan.every((action) => action.kind === "fallback")).toBe(true);
  });
});
