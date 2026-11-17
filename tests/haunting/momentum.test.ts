import { describe, expect, it } from "vitest";
import { MOMENTUM_MAX } from "@/lib/haunting/config";
import { computeMomentum, filterInWindowEvents } from "@/lib/haunting/momentum";
import type { FinancialEvent } from "@/lib/haunting/types";

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
