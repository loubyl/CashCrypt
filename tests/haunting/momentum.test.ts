import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeHouseState } from "@/lib/haunting";
import { MIN_INCOME_CENTS, MOMENTUM_MAX } from "@/lib/haunting/config";
import { computeMomentum, filterInWindowEvents } from "@/lib/haunting/momentum";
import type { FinancialEvent, FinancialSnapshot, InputSubscription } from "@/lib/haunting/types";

const NOW = "2025-06-30";
const IN_WINDOW_DATE = "2025-06-25";
const OLDEST_IN_WINDOW_DATE = "2025-06-01"; // now - 29 days
const JUST_OUTSIDE_DATE = "2025-05-31"; // now - 30 days
const FUTURE_DATE = "2025-07-01";
const INCOME_CENTS = 300_000; // $3,000
const EXTRA_PRINCIPAL_CENTS = 30_000; // $300
const CANCELED_CENTS = 1_549; // $15.49
const ACTION_COUNT = 3;
const PRECISION_DIGITS = 2;

const principal = (cents: number, date = IN_WINDOW_DATE): FinancialEvent => ({
  type: "debt_payment",
  date,
  extraPrincipalCents: cents,
});
const canceled = (cents: number, date = IN_WINDOW_DATE): FinancialEvent => ({
  type: "subscription_canceled",
  date,
  amountCents: cents,
});
const action = (date = IN_WINDOW_DATE): FinancialEvent => ({
  type: "exorcism_action_completed",
  date,
});

describe("computeMomentum contributions", () => {
  it("returns 3.00 for $300 extra principal on $3,000 income", () => {
    expect(computeMomentum([principal(EXTRA_PRINCIPAL_CENTS)], INCOME_CENTS, NOW)).toBeCloseTo(3, PRECISION_DIGITS);
  });

  it("returns about 0.52 for a $15.49 subscription cancellation on $3,000 income", () => {
    expect(computeMomentum([canceled(CANCELED_CENTS)], INCOME_CENTS, NOW)).toBeCloseTo(0.5163, PRECISION_DIGITS);
  });

  it("returns 3.00 for three completed exorcism actions", () => {
    const events = Array.from({ length: ACTION_COUNT }, () => action());
    expect(computeMomentum(events, INCOME_CENTS, NOW)).toBeCloseTo(3, PRECISION_DIGITS);
  });

  it("sums the three contributions together", () => {
    const events = [principal(EXTRA_PRINCIPAL_CENTS), canceled(CANCELED_CENTS), action(), action(), action()];
    expect(computeMomentum(events, INCOME_CENTS, NOW)).toBeCloseTo(3 + 0.5163 + 3, PRECISION_DIGITS);
  });

  it("clamps the result at MOMENTUM_MAX", () => {
    const events = [principal(INCOME_CENTS * 10), canceled(INCOME_CENTS * 10)];
    expect(computeMomentum(events, INCOME_CENTS, NOW)).toBe(MOMENTUM_MAX);
  });
});

describe("computeMomentum edge cases", () => {
  it("returns 0 when there are no events", () => {
    expect(computeMomentum([], INCOME_CENTS, NOW)).toBe(0);
  });

  it("returns 0 when income is below 100 cents", () => {
    expect(computeMomentum([principal(EXTRA_PRINCIPAL_CENTS), action()], 99, NOW)).toBe(0);
    expect(computeMomentum([action()], 0, NOW)).toBe(0);
  });

  it("returns 0 for events outside the window, including future dates and now minus 30 days", () => {
    const events = [
      principal(EXTRA_PRINCIPAL_CENTS, JUST_OUTSIDE_DATE),
      canceled(CANCELED_CENTS, FUTURE_DATE),
      action(JUST_OUTSIDE_DATE),
      action(FUTURE_DATE),
    ];
    expect(computeMomentum(events, INCOME_CENTS, NOW)).toBe(0);
  });

  it("counts events dated on now and on the oldest in-window day", () => {
    const events = [action(NOW), action(OLDEST_IN_WINDOW_DATE)];
    expect(computeMomentum(events, INCOME_CENTS, NOW)).toBeCloseTo(2, PRECISION_DIGITS);
  });

  it("treats negative and non-finite amounts as 0", () => {
    const events = [
      principal(-EXTRA_PRINCIPAL_CENTS),
      principal(Number.NaN),
      principal(Number.POSITIVE_INFINITY),
      canceled(-CANCELED_CENTS),
      canceled(Number.NaN),
      canceled(Number.POSITIVE_INFINITY),
    ];
    expect(computeMomentum(events, INCOME_CENTS, NOW)).toBe(0);
  });

  it("does not mutate the input events array", () => {
    const events = [principal(EXTRA_PRINCIPAL_CENTS), canceled(CANCELED_CENTS, FUTURE_DATE), action()];
    const copy = structuredClone(events);
    computeMomentum(events, INCOME_CENTS, NOW);
    expect(events).toEqual(copy);
  });
});

describe("filterInWindowEvents", () => {
  it("keeps only events within the window and preserves order", () => {
    const keepA = action(NOW);
    const keepB = principal(1, OLDEST_IN_WINDOW_DATE);
    const events = [action(FUTURE_DATE), keepA, canceled(1, JUST_OUTSIDE_DATE), keepB];
    expect(filterInWindowEvents(events, NOW)).toEqual([keepA, keepB]);
  });

  it("returns an empty array for empty input and does not mutate it", () => {
    expect(filterInWindowEvents([], NOW)).toEqual([]);
    const events = [action(FUTURE_DATE), action()];
    const copy = structuredClone(events);
    filterInWindowEvents(events, NOW);
    expect(events).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// L4 weekly-plan trajectory
// ---------------------------------------------------------------------------

const PLAN_NOW = "2026-01-31";
const PLAN_DATE = "2026-01-20";
const MONTHLY_INCOME_DOLLARS = 3000;
const CANCELED_SUBSCRIPTION_ID = "sub-cancel";
const MAX_PLAN_WEEKS = 4;
const LARGE_DEBT_DOLLARS = 18000;
const EXTRA_PRINCIPAL_DOLLARS = 300; // each plan week also lowers the balance by this amount
const START_SCORE = 32.74;
const MIN_WEEK1_DELTA = 5;
const MAX_WEEK1_DELTA = 8;
const WEEK1_MOMENTUM = 6.52;
const WEEK1_BASE_SCORE = 32.99;
const WEEK1_LEVEL_PROGRESS = 0.98;

const debt = (debtId: string, balance: number, minimumMonthlyPayment: number) => ({
  debtId,
  name: debtId,
  balance,
  minimumMonthlyPayment,
  apr: 0.2,
});
const subscription = (
  subscriptionId: string,
  amount: number,
  usage: InputSubscription["usage"],
): InputSubscription => ({
  subscriptionId,
  name: subscriptionId,
  amount,
  cadence: "monthly",
  usage,
  active: true,
});

const ALL_SUBSCRIPTIONS: InputSubscription[] = [
  subscription("sub-120", 120, "never"),
  subscription("sub-60", 60, "rarely"),
  subscription("sub-50", 50, "often"),
  subscription("sub-30", 30, "often"),
  subscription(CANCELED_SUBSCRIPTION_ID, 15.49, "never"),
];

// A subscription can only be canceled once, so the cancellation event is added in week 1 only.
const planWeek = (): FinancialEvent[] => [
  principal(EXTRA_PRINCIPAL_CENTS, PLAN_DATE),
  ...Array.from({ length: ACTION_COUNT }, () => action(PLAN_DATE)),
];

function snapshotAfterWeeks(weeks: number): FinancialSnapshot {
  const cancellation = weeks > 0 ? [canceled(CANCELED_CENTS, PLAN_DATE)] : [];
  const events = [...cancellation, ...Array.from({ length: weeks }, planWeek).flat()];
  const subscriptions =
    weeks === 0 ? ALL_SUBSCRIPTIONS : ALL_SUBSCRIPTIONS.filter((s) => s.subscriptionId !== CANCELED_SUBSCRIPTION_ID);
  return {
    monthlyIncome: MONTHLY_INCOME_DOLLARS,
    debts: [debt("d1", LARGE_DEBT_DOLLARS - weeks * EXTRA_PRINCIPAL_DOLLARS, 400), debt("d2", 6000, 150), debt("d3", 2000, 60)],
    subscriptions,
    transactions: [],
    events,
    now: PLAN_NOW,
  };
}

describe("L4 weekly-plan trajectory", () => {
  it("starts at about 32.74 in decay level 4", () => {
    const state = computeHouseState(snapshotAfterWeeks(0));
    expect(state.lightScore).toBeCloseTo(START_SCORE, PRECISION_DIGITS);
    expect(state.decayLevel).toBe(4);
  });

  it.each([
    [1, 39.5, 4],
    [2, 45.73, 3],
    [3, 48.45, 3],
    [4, 48.68, 3],
  ])("week %i scores %f at decay level %i", (weeks, score, level) => {
    const state = computeHouseState(snapshotAfterWeeks(weeks));
    expect(state.lightScore).toBeCloseTo(score, PRECISION_DIGITS);
    expect(state.decayLevel).toBe(level);
  });

  it("reports the week-1 breakdown of momentum, base score and level progress", () => {
    const state = computeHouseState(snapshotAfterWeeks(1));
    expect(state.momentum).toBeCloseTo(WEEK1_MOMENTUM, PRECISION_DIGITS);
    expect(state.baseScore).toBeCloseTo(WEEK1_BASE_SCORE, PRECISION_DIGITS);
    expect(state.levelProgress).toBeCloseTo(WEEK1_LEVEL_PROGRESS, PRECISION_DIGITS);
  });

  it("lifts the score in week 1 by between 5 and 8 points over the start", () => {
    const start = computeHouseState(snapshotAfterWeeks(0)).lightScore;
    const delta = computeHouseState(snapshotAfterWeeks(1)).lightScore - start;
    expect(delta).toBeGreaterThan(MIN_WEEK1_DELTA);
    expect(delta).toBeLessThan(MAX_WEEK1_DELTA);
  });

  it("caps momentum at MOMENTUM_MAX in weeks 3 and 4", () => {
    for (let weeks = 3; weeks <= MAX_PLAN_WEEKS; weeks += 1) {
      expect(computeHouseState(snapshotAfterWeeks(weeks)).momentum).toBe(MOMENTUM_MAX);
    }
  });
});

// ---------------------------------------------------------------------------
// Module-level properties and robustness
// ---------------------------------------------------------------------------

const NUM_RUNS = 100;
const MAX_CENTS = 10_000_000;
const MAX_EVENTS = 15;
const DAY_MS = 86_400_000;
const WINDOW_SPAN_DAYS = 29;
const OUTSIDE_SPAN_DAYS = 400;
const PROPERTY_NOW = NOW;
const PROPERTY_NOW_MS = Date.UTC(2025, 5, 30);

const dayString = (offsetDays: number): string =>
  new Date(PROPERTY_NOW_MS + offsetDays * DAY_MS).toISOString().slice(0, 10);

const eventTypeArb = fc.constantFrom<FinancialEvent["type"]>(
  "debt_payment",
  "subscription_canceled",
  "exorcism_action_completed",
);
const eventOnDaysArb = (daysArb: fc.Arbitrary<number>): fc.Arbitrary<FinancialEvent> =>
  fc.record({
    type: eventTypeArb,
    date: daysArb.map(dayString),
    amountCents: fc.integer({ min: 0, max: MAX_CENTS }),
    extraPrincipalCents: fc.integer({ min: 0, max: MAX_CENTS }),
  });

const inWindowEventArb = eventOnDaysArb(fc.integer({ min: -WINDOW_SPAN_DAYS, max: 0 }));
const outOfWindowEventArb = eventOnDaysArb(
  fc.oneof(
    fc.integer({ min: -OUTSIDE_SPAN_DAYS, max: -(WINDOW_SPAN_DAYS + 1) }),
    fc.integer({ min: 1, max: OUTSIDE_SPAN_DAYS }),
  ),
);
const anyEventArb = fc.oneof(inWindowEventArb, outOfWindowEventArb);
const eventsArb = (item: fc.Arbitrary<FinancialEvent>) => fc.array(item, { maxLength: MAX_EVENTS });
const incomeArb = fc.integer({ min: MIN_INCOME_CENTS, max: MAX_CENTS });

describe("computeMomentum properties", () => {
  // Feature: haunting-engine, Property 10: Momentum bounds
  it("always returns a value in [0, MOMENTUM_MAX]", () => {
    fc.assert(
      fc.property(eventsArb(anyEventArb), fc.integer({ min: -MAX_CENTS, max: MAX_CENTS }), (events, income) => {
        const result = computeMomentum(events, income, PROPERTY_NOW);
        return result >= 0 && result <= MOMENTUM_MAX;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 10: Momentum bounds
  it("returns 0 when income is below MIN_INCOME_CENTS", () => {
    fc.assert(
      fc.property(eventsArb(inWindowEventArb), fc.integer({ min: -MAX_CENTS, max: MIN_INCOME_CENTS - 1 }), (events, income) => {
        return computeMomentum(events, income, PROPERTY_NOW) === 0;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 11: Event window and monotonicity
  it("is unchanged by adding events outside the window, including future dates", () => {
    fc.assert(
      fc.property(eventsArb(anyEventArb), eventsArb(outOfWindowEventArb), incomeArb, (events, extra, income) => {
        const before = computeMomentum(events, income, PROPERTY_NOW);
        const after = computeMomentum([...events, ...extra], income, PROPERTY_NOW);
        return before === after;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 11: Event window and monotonicity
  it("never decreases when an in-window event with non-negative amounts is added", () => {
    fc.assert(
      fc.property(eventsArb(anyEventArb), inWindowEventArb, incomeArb, (events, added, income) => {
        const before = computeMomentum(events, income, PROPERTY_NOW);
        const after = computeMomentum([...events, added], income, PROPERTY_NOW);
        return after >= before;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 10: Momentum bounds
  it("treats NaN, Infinity and negative amounts as 0 and never throws", () => {
    const badAmountArb = fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, -MAX_CENTS);
    const badEventArb = fc.record({
      type: fc.constantFrom<FinancialEvent["type"]>("debt_payment", "subscription_canceled"),
      date: fc.constant(PROPERTY_NOW),
      amountCents: badAmountArb,
      extraPrincipalCents: badAmountArb,
    });
    fc.assert(
      fc.property(eventsArb(badEventArb), incomeArb, (events, income) => {
        return computeMomentum(events, income, PROPERTY_NOW) === 0;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 10: Momentum bounds
  it("does not mutate deep-frozen event arrays", () => {
    fc.assert(
      fc.property(eventsArb(anyEventArb), incomeArb, (events, income) => {
        const copy = structuredClone(events);
        for (const event of events) Object.freeze(event);
        Object.freeze(events);
        computeMomentum(events, income, PROPERTY_NOW);
        return JSON.stringify(events) === JSON.stringify(copy);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
