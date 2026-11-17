import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MIN_INCOME_CENTS } from "@/lib/haunting/config";
import {
  computeFactorC,
  computeZombies,
  isValidSubscription,
  normalizeSubscription,
} from "@/lib/haunting/zombies";
import type {
  Cadence,
  InternalSubscription,
  SubscriptionInCents,
  Usage,
} from "@/lib/haunting/types";

const NUM_RUNS = 100;
const WEEKLY_TEN_DOLLARS_CENTS = 1_000;
const WEEKLY_TEN_DOLLARS_MONTHLY = 4_333; // round(1000 * 52 / 12)
const YEARLY_120_DOLLARS_CENTS = 12_000;
const YEARLY_120_DOLLARS_MONTHLY = 1_000;
const MONTHLY_AMOUNT_CENTS = 1_549;
const INCOME_CENTS = 300_000;
const MAX_AMOUNT_CENTS = 10_000_000;
const MAX_INCOME_CENTS = 100_000_000;

const makeSub = (overrides: Partial<SubscriptionInCents> = {}): SubscriptionInCents => ({
  subscriptionId: "sub-1",
  name: "StreamMax",
  amountCents: MONTHLY_AMOUNT_CENTS,
  cadence: "monthly",
  usage: "never",
  active: true,
  ...overrides,
});

const makeInternal = (overrides: Partial<InternalSubscription> = {}): InternalSubscription => ({
  subscriptionId: "sub-1",
  name: "StreamMax",
  monthlyCostCents: MONTHLY_AMOUNT_CENTS,
  usage: "never",
  active: true,
  valid: true,
  ...overrides,
});

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

describe("normalizeSubscription cadence factors", () => {
  it("keeps a monthly amount unchanged", () => {
    expect(normalizeSubscription(makeSub()).monthlyCostCents).toBe(MONTHLY_AMOUNT_CENTS);
  });

  it("converts $10 weekly to 4333 cents per month", () => {
    const result = normalizeSubscription(
      makeSub({ cadence: "weekly", amountCents: WEEKLY_TEN_DOLLARS_CENTS }),
    );
    expect(result.monthlyCostCents).toBe(WEEKLY_TEN_DOLLARS_MONTHLY);
  });

  it("converts $120 yearly to 1000 cents per month", () => {
    const result = normalizeSubscription(
      makeSub({ cadence: "yearly", amountCents: YEARLY_120_DOLLARS_CENTS }),
    );
    expect(result.monthlyCostCents).toBe(YEARLY_120_DOLLARS_MONTHLY);
  });

  it("marks a well-formed subscription as valid and keeps its fields", () => {
    expect(normalizeSubscription(makeSub())).toEqual(makeInternal());
  });
});

describe("validity filter", () => {
  const invalidCases: Array<[string, SubscriptionInCents]> = [
    ["an empty id", makeSub({ subscriptionId: "" })],
    ["an empty name", makeSub({ name: "" })],
    ["a zero amount", makeSub({ amountCents: 0 })],
    ["a negative amount", makeSub({ amountCents: -500 })],
    ["an invalid cadence", makeSub({ cadence: "daily" as Cadence })],
    ["an invalid usage", makeSub({ usage: "always" as Usage })],
  ];

  it.each(invalidCases)("marks a subscription with %s as invalid", (_label, sub) => {
    expect(normalizeSubscription(sub).valid).toBe(false);
  });

  it.each(invalidCases)("excludes a subscription with %s from zombies and Factor C", (_label, sub) => {
    const good = normalizeSubscription(makeSub({ subscriptionId: "good" }));
    const bad = normalizeSubscription(sub);
    expect(computeZombies([good, bad]).map((z) => z.subscriptionId)).toEqual(["good"]);
    expect(computeFactorC([good, bad], INCOME_CENTS)).toBe(computeFactorC([good], INCOME_CENTS));
  });

  it("keeps a canceled subscription valid but excludes it from zombies and Factor C", () => {
    const good = normalizeSubscription(makeSub({ subscriptionId: "good" }));
    const canceled = normalizeSubscription(makeSub({ subscriptionId: "canceled", active: false }));
    expect(canceled.valid).toBe(true);
    expect(canceled.active).toBe(false);
    expect(canceled.monthlyCostCents).toBe(MONTHLY_AMOUNT_CENTS);
    expect(computeZombies([canceled])).toEqual([]);
    expect(computeZombies([good, canceled]).map((z) => z.subscriptionId)).toEqual(["good"]);
    expect(computeFactorC([canceled], INCOME_CENTS)).toBe(0);
    expect(computeFactorC([good, canceled], INCOME_CENTS)).toBe(computeFactorC([good], INCOME_CENTS));
  });

  it("does not use the active flag in isValidSubscription", () => {
    expect(isValidSubscription(makeInternal({ active: false }))).toBe(true);
  });

  it("rejects a hand-built subscription with an empty id in isValidSubscription", () => {
    expect(isValidSubscription(makeInternal({ subscriptionId: "" }))).toBe(false);
    expect(isValidSubscription(makeInternal())).toBe(true);
  });
});

describe("computeZombies", () => {
  it("returns an empty list for empty input", () => {
    expect(computeZombies([])).toEqual([]);
  });

  it("returns one zombie with the expected shape per valid active subscription", () => {
    const subs = [
      makeInternal({ subscriptionId: "a", name: "A", monthlyCostCents: 1_000, usage: "often" }),
      makeInternal({ subscriptionId: "b", name: "B", monthlyCostCents: 2_000, usage: "rarely" }),
    ];
    expect(computeZombies(subs)).toEqual([
      { subscriptionId: "a", name: "A", monthlyCost: 1_000, usage: "often" },
      { subscriptionId: "b", name: "B", monthlyCost: 2_000, usage: "rarely" },
    ]);
  });
});

describe("computeFactorC", () => {
  it("returns 0 when income is 0", () => {
    expect(computeFactorC([makeInternal()], 0)).toBe(0);
  });

  it("returns the exact ratio of total monthly cost to income", () => {
    const subs = [makeInternal({ monthlyCostCents: 1_000 }), makeInternal({ subscriptionId: "b", monthlyCostCents: 500 })];
    expect(computeFactorC(subs, INCOME_CENTS)).toBe(1_500 / INCOME_CENTS);
  });

  it("returns 0 for an empty subscription list", () => {
    expect(computeFactorC([], INCOME_CENTS)).toBe(0);
  });
});

const cadenceArb = fc.constantFrom<Cadence>("weekly", "monthly", "yearly");
const usageArb = fc.constantFrom<Usage>("often", "rarely", "never");
const hostileAmountArb = fc.oneof(
  fc.integer({ min: 0, max: MAX_AMOUNT_CENTS }),
  fc.integer({ min: -MAX_AMOUNT_CENTS, max: -1 }),
  fc.double({ noNaN: false }),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
);
const subscriptionArb: fc.Arbitrary<SubscriptionInCents> = fc.record({
  subscriptionId: fc.oneof(fc.constant(""), fc.string({ minLength: 1, maxLength: 8 })),
  name: fc.oneof(fc.constant(""), fc.string({ minLength: 1, maxLength: 8 })),
  amountCents: hostileAmountArb,
  cadence: cadenceArb,
  usage: usageArb,
  active: fc.boolean(),
});
const subscriptionsArb = fc.array(subscriptionArb, { maxLength: 12 }).map((subs) => subs.map(normalizeSubscription));
const incomeArb = fc.oneof(
  fc.integer({ min: 0, max: MAX_INCOME_CENTS }),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
);
const isValidActive = (sub: InternalSubscription): boolean => sub.valid && sub.active;

describe("zombies properties", () => {
  // Feature: haunting-engine, Property 15: Subscription normalisation is total and non-negative
  it("always returns a non-negative integer monthly cost and never throws", () => {
    fc.assert(
      fc.property(subscriptionArb, (sub) => {
        const result = normalizeSubscription(sub);
        expect(Number.isInteger(result.monthlyCostCents)).toBe(true);
        expect(result.monthlyCostCents).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 15: Subscription normalisation is total and non-negative
  it("marks NaN, Infinity and negative amounts as invalid", () => {
    const badAmountArb = fc.oneof(
      fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
      fc.double({ max: -Number.MIN_VALUE, noNaN: true }),
    );
    fc.assert(
      fc.property(subscriptionArb, badAmountArb, (sub, amountCents) => {
        const result = normalizeSubscription({ ...sub, amountCents });
        expect(result.valid).toBe(false);
        expect(result.monthlyCostCents).toBe(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 15: Subscription normalisation is total and non-negative
  it("decides validity from the data alone, independent of the active flag", () => {
    fc.assert(
      fc.property(subscriptionArb, (sub) => {
        const asActive = normalizeSubscription({ ...sub, active: true });
        const asInactive = normalizeSubscription({ ...sub, active: false });
        expect(asInactive.valid).toBe(asActive.valid);
        expect(asInactive.monthlyCostCents).toBe(asActive.monthlyCostCents);
        expect(computeZombies([asInactive])).toEqual([]);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 16: Zombie conservation
  it("returns exactly one zombie per valid active subscription and none for the rest", () => {
    fc.assert(
      fc.property(subscriptionsArb, (subs) => {
        const zombies = computeZombies(subs);
        const expectedIds = subs.filter(isValidActive).map((s) => s.subscriptionId);
        expect(zombies.map((z) => z.subscriptionId)).toEqual(expectedIds);
        zombies.forEach((zombie, index) => {
          const source = subs.filter(isValidActive)[index];
          expect(zombie).toEqual({
            subscriptionId: source.subscriptionId,
            name: source.name,
            monthlyCost: source.monthlyCostCents,
            usage: source.usage,
          });
        });
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 17: Factor C bounds and invariance
  it("keeps Factor C finite and non-negative, and 0 for unusable income", () => {
    fc.assert(
      fc.property(subscriptionsArb, incomeArb, (subs, income) => {
        const factor = computeFactorC(subs, income);
        expect(Number.isFinite(factor)).toBe(true);
        expect(factor).toBeGreaterThanOrEqual(0);
        if (!(income >= MIN_INCOME_CENTS)) expect(factor).toBe(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 17: Factor C bounds and invariance
  it("leaves Factor C unchanged when invalid or inactive subscriptions are added", () => {
    fc.assert(
      fc.property(
        subscriptionsArb,
        subscriptionsArb,
        fc.integer({ min: MIN_INCOME_CENTS, max: MAX_INCOME_CENTS }),
        (subs, extras, income) => {
          const excluded = extras.map((s, i) => (i % 2 === 0 ? { ...s, valid: false } : { ...s, active: false }));
          expect(computeFactorC([...subs, ...excluded], income)).toBe(computeFactorC(subs, income));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 18: Subscription functions do not mutate their inputs
  it("does not throw on deep-frozen inputs and leaves them unchanged", () => {
    fc.assert(
      fc.property(fc.array(subscriptionArb, { maxLength: 12 }), incomeArb, (rawSubs, income) => {
        const frozenRaw = deepFreeze(structuredClone(rawSubs));
        const snapshotRaw = structuredClone(rawSubs);
        const normalized = deepFreeze(frozenRaw.map(normalizeSubscription));
        const snapshotNormalized = structuredClone(normalized);
        computeZombies(normalized);
        computeFactorC(normalized, income);
        normalized.forEach(isValidSubscription);
        expect(normalized).toEqual(snapshotNormalized);
        expect(frozenRaw).toEqual(snapshotRaw);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
