import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { generateExorcismPlan } from "@/lib/exorcism";
import type { FinancialSnapshot, HouseState } from "@/lib/haunting";

const NUM_RUNS = 100;
const MAX_ITEMS = 6;
const MAX_CENTS = 1_000_000;
const MAX_DOLLARS = 20_000;
const CATEGORIES = ["Coffee", "Snacks", "Rides", "Apps"] as const;
const USAGES = ["often", "rarely", "never"] as const;
const CADENCES = ["weekly", "monthly", "yearly"] as const;
const DECAY_LEVELS = [1, 2, 3, 4, 5] as const;
const DATE = "2025-03-15";

const idArb = fc.string({ minLength: 1, maxLength: 6 });
const nameArb = fc.string({ maxLength: 12 });
const dollarsArb = fc.double({ min: 0, max: MAX_DOLLARS, noNaN: true });

const zombieArb = fc.record({
  subscriptionId: idArb,
  name: nameArb,
  monthlyCost: fc.integer({ min: 0, max: MAX_CENTS }),
  usage: fc.constantFrom(...USAGES),
});

const poltergeistArb = fc.option(
  fc.record({
    totalAmount: fc.integer({ min: 0, max: MAX_CENTS }),
    transactionCount: fc.integer({ min: 0, max: 50 }),
    byCategory: fc.dictionary(
      fc.constantFrom(...CATEGORIES),
      fc.integer({ min: 0, max: MAX_CENTS }),
    ),
  }),
  { nil: null },
);

const houseStateArb: fc.Arbitrary<HouseState> = fc.record({
  lightScore: fc.double({ min: 0, max: 100, noNaN: true }),
  baseScore: fc.double({ min: 0, max: 100, noNaN: true }),
  momentum: fc.double({ min: 0, max: 20, noNaN: true }),
  decayLevel: fc.constantFrom(...DECAY_LEVELS),
  windowBrightness: fc.double({ min: 0, max: 1, noNaN: true }),
  levelProgress: fc.double({ min: 0, max: 1, noNaN: true }),
  zombies: fc.array(zombieArb, { maxLength: MAX_ITEMS }),
  ghosts: fc.constant<never[]>([]),
  poltergeist: poltergeistArb,
});

const snapshotArb: fc.Arbitrary<FinancialSnapshot> = fc.record({
  monthlyIncome: dollarsArb,
  debts: fc.array(
    fc.record({
      debtId: idArb,
      name: nameArb,
      balance: dollarsArb,
      minimumMonthlyPayment: dollarsArb,
      apr: fc.double({ min: 0, max: 1, noNaN: true }),
    }),
    { maxLength: MAX_ITEMS },
  ),
  subscriptions: fc.array(
    fc.record({
      subscriptionId: idArb,
      name: nameArb,
      amount: dollarsArb,
      cadence: fc.constantFrom(...CADENCES),
      usage: fc.constantFrom(...USAGES),
      active: fc.boolean(),
    }),
    { maxLength: MAX_ITEMS },
  ),
  transactions: fc.constant<never[]>([]),
  events: fc.constant<never[]>([]),
  now: fc.constant(DATE),
});

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

describe("generateExorcismPlan determinism and purity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Feature: app-screens, Property 16: The planner is deterministic and pure
  // **Validates: Requirements 11.4, 11.5, 15.4, 15.7**
  it("returns deeply equal output for identical input and leaves inputs unchanged", () => {
    fc.assert(
      fc.property(houseStateArb, snapshotArb, (houseState, snapshot) => {
        const houseBefore = deepClone(houseState);
        const snapshotBefore = deepClone(snapshot);

        const first = generateExorcismPlan(houseState, snapshot);
        const second = generateExorcismPlan(houseState, snapshot);
        expect(second).toEqual(first);
        expect(houseState).toEqual(houseBefore);
        expect(snapshot).toEqual(snapshotBefore);

        // A call on deeply frozen clones must not throw (no mutation) and must match.
        const frozenResult = generateExorcismPlan(
          deepFreeze(deepClone(houseState)),
          deepFreeze(deepClone(snapshot)),
        );
        expect(frozenResult).toEqual(first);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: app-screens, Property 16: The planner is deterministic and pure
  // **Validates: Requirements 11.4, 11.5, 15.4, 15.7**
  it("never reads the clock or a random source", () => {
    const now = vi.spyOn(Date, "now");
    const random = vi.spyOn(Math, "random");
    fc.assert(
      fc.property(houseStateArb, snapshotArb, (houseState, snapshot) => {
        now.mockClear();
        random.mockClear();
        generateExorcismPlan(houseState, snapshot);
        expect(now).not.toHaveBeenCalled();
        expect(random).not.toHaveBeenCalled();
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
