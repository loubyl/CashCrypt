// TEST-ONLY: fast-check generators and snapshot builders for the haunting engine.
// Never import this file from app code. It is exempt from the static
// numeric-literal check (see tests/haunting/staticChecks.test.ts).
//
// Generators work in integer cents internally and convert once with
// `centsToSnapshot`, which divides by 100 so the engine's Cents_Boundary
// (Math.round(x * 100)) recovers the original cents exactly.

import * as fc from "fast-check";
import { dateToJulian } from "./dates";
import type {
  Cadence,
  FinancialEvent,
  FinancialEventType,
  FinancialSnapshot,
  Usage,
} from "./types";

// ---------------------------------------------------------------------------
// Cents-valued shapes (internal to the generators)
// ---------------------------------------------------------------------------

export type CentsDebt = {
  debtId: string;
  name: string;
  balanceCents: number;
  minimumMonthlyPaymentCents: number;
  apr: number;
};

export type CentsSubscription = {
  subscriptionId: string;
  name: string;
  amountCents: number;
  cadence: Cadence;
  usage: Usage;
  active: boolean;
};

export type CentsTransaction = {
  transactionId: string;
  amountCents: number;
  description: string;
  category: string;
  date: string;
};

export type CentsSnapshotInput = {
  monthlyIncomeCents: number;
  debts: CentsDebt[];
  subscriptions: CentsSubscription[];
  transactions: CentsTransaction[];
  events: FinancialEvent[];
  now: string;
};

// ---------------------------------------------------------------------------
// Pure Julian-to-date helpers (no Date object, no clock)
// ---------------------------------------------------------------------------

const CENTS_PER_DOLLAR_TEST = 100;

/** Converts a Julian Day Number to a YYYY-MM-DD string (inverse of `dateToJulian`). */
export function julianToDate(julian: number): string {
  // Richards' algorithm for the proleptic Gregorian calendar (integer arithmetic only).
  const f = julian + 1401 + Math.floor((Math.floor((4 * julian + 274277) / 146097) * 3) / 4) - 38;
  const e = 4 * f + 3;
  const g = Math.floor((e % 1461) / 4);
  const h = 5 * g + 2;
  const day = Math.floor((h % 153) / 5) + 1;
  const month = ((Math.floor(h / 153) + 2) % 12) + 1;
  const year = Math.floor(e / 1461) - 4716 + Math.floor((14 - month) / 12);
  const pad = (n: number, width: number): string => String(n).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Shifts a YYYY-MM-DD date by a whole number of days (negative = earlier). */
export function shiftDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return julianToDate(dateToJulian(y, m, d) + days);
}

// ---------------------------------------------------------------------------
// Conversion helper
// ---------------------------------------------------------------------------

/** Builds a dollar-valued FinancialSnapshot from integer-cent values (exact round trip). */
export function centsToSnapshot(input: CentsSnapshotInput): FinancialSnapshot {
  return {
    monthlyIncome: input.monthlyIncomeCents / CENTS_PER_DOLLAR_TEST,
    debts: input.debts.map((d) => ({
      debtId: d.debtId,
      name: d.name,
      balance: d.balanceCents / CENTS_PER_DOLLAR_TEST,
      minimumMonthlyPayment: d.minimumMonthlyPaymentCents / CENTS_PER_DOLLAR_TEST,
      apr: d.apr,
    })),
    subscriptions: input.subscriptions.map((s) => ({
      subscriptionId: s.subscriptionId,
      name: s.name,
      amount: s.amountCents / CENTS_PER_DOLLAR_TEST,
      cadence: s.cadence,
      usage: s.usage,
      active: s.active,
    })),
    transactions: input.transactions.map((t) => ({
      transactionId: t.transactionId,
      amount: t.amountCents / CENTS_PER_DOLLAR_TEST,
      description: t.description,
      category: t.category,
      date: t.date,
    })),
    events: input.events,
    now: input.now,
  };
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const EVENT_TYPES: FinancialEventType[] = [
  "debt_payment",
  "subscription_canceled",
  "exorcism_action_completed",
];
const CADENCES: Cadence[] = ["weekly", "monthly", "yearly"];
const USAGES: Usage[] = ["often", "rarely", "never"];

// `now` ranges over 2024-01-01 .. 2026-12-31 as Julian Day Numbers.
const NOW_JULIAN_MIN = dateToJulian(2024, 1, 1);
const NOW_JULIAN_MAX = dateToJulian(2026, 12, 31);

// Event/transaction date = now - offset, offset in [-5, 45]:
// -5..-1 are future dates, 0..29 in-window, 30..45 out of window.
const OFFSET_MIN = -5;
const OFFSET_MAX = 45;

type Limits = {
  incomeMaxCents: number;
  debtMaxCents: number;
  subAmountMaxCents: number;
  txAmountMaxCents: number;
  eventAmountMaxCents: number;
  maxDebts: number;
  maxSubs: number;
  maxTxs: number;
  maxEvents: number;
  aprMax: number;
};

const REALISTIC_APR_MAX = 0.4;

const REALISTIC_LIMITS: Limits = {
  incomeMaxCents: 1_000_000, // $10,000
  debtMaxCents: 100_000_000, // $1,000,000
  subAmountMaxCents: 1_000_000,
  txAmountMaxCents: 500_000,
  eventAmountMaxCents: 1_000_000,
  maxDebts: 10,
  maxSubs: 10,
  maxTxs: 50,
  maxEvents: 20,
  aprMax: REALISTIC_APR_MAX,
};

const EXTREME_LIMITS: Limits = {
  incomeMaxCents: 100_000_000_000_000, // $1e12
  debtMaxCents: 100_000_000_000_000,
  subAmountMaxCents: 100_000_000_000_000,
  txAmountMaxCents: 100_000_000_000_000,
  eventAmountMaxCents: 100_000_000_000_000,
  maxDebts: 20,
  maxSubs: 20,
  maxTxs: 100,
  maxEvents: 50,
  aprMax: 1,
};

// Money amounts with extra weight on 0 and 1 cent so edge cases show up often.
function moneyCents(min: number, max: number): fc.Arbitrary<number> {
  return fc.oneof(
    { arbitrary: fc.integer({ min, max }), weight: 6 },
    { arbitrary: fc.constantFrom(min, Math.min(max, min + 1), max), weight: 1 },
  );
}

// APR: zero is common, otherwise a finite value in [0, aprMax].
function aprArb(aprMax: number): fc.Arbitrary<number> {
  return fc.oneof(
    { arbitrary: fc.constant(0), weight: 1 },
    { arbitrary: fc.double({ min: 0, max: aprMax, noNaN: true, noDefaultInfinity: true }), weight: 3 },
  );
}

// ---------------------------------------------------------------------------
// Shared component arbitraries.
// The snapshot generators below are built from these, and module tests use them
// directly, so every test draws debts, events, cadences and usages the same way.
// Module tests keep their own hostile generators (NaN, Infinity, negatives,
// "__proto__" categories, malformed dates) on top of these.
// ---------------------------------------------------------------------------

/** One of the three subscription cadences. */
export const cadenceArb: fc.Arbitrary<Cadence> = fc.constantFrom(...CADENCES);

/** One of the three usage levels. */
export const usageArb: fc.Arbitrary<Usage> = fc.constantFrom(...USAGES);

/** One of the three FinancialEvent types. */
export const eventTypeArb: fc.Arbitrary<FinancialEventType> = fc.constantFrom(...EVENT_TYPES);

/** A well-formed debt in integer cents (same shape as InternalDebt). */
export function centsDebtArb(limits: {
  balanceMaxCents: number;
  minimumPaymentMaxCents: number;
  aprMax?: number;
}): fc.Arbitrary<CentsDebt> {
  return fc.record({
    debtId: fc.uuid(),
    name: fc.string({ minLength: 1 }),
    balanceCents: moneyCents(0, limits.balanceMaxCents),
    minimumMonthlyPaymentCents: moneyCents(0, limits.minimumPaymentMaxCents),
    apr: aprArb(limits.aprMax ?? REALISTIC_APR_MAX),
  });
}

/** A well-formed subscription in integer cents, per cadence period. */
export function centsSubscriptionArb(amountMaxCents: number): fc.Arbitrary<CentsSubscription> {
  return fc.record({
    subscriptionId: fc.uuid(),
    name: fc.string({ minLength: 1 }),
    amountCents: moneyCents(1, amountMaxCents),
    cadence: cadenceArb,
    usage: usageArb,
    active: fc.boolean(),
  });
}

/** Event type and non-negative optional amounts, without a date. */
export type EventPayload = {
  type: FinancialEventType;
  amountCents: number | undefined;
  extraPrincipalCents: number | undefined;
};

export function eventPayloadArb(amountMaxCents: number): fc.Arbitrary<EventPayload> {
  return fc.record({
    type: eventTypeArb,
    amountCents: fc.option(moneyCents(0, amountMaxCents), { nil: undefined }),
    extraPrincipalCents: fc.option(moneyCents(0, amountMaxCents), { nil: undefined }),
  });
}

/** Builds a FinancialEvent from a payload and a date, omitting undefined amounts. */
export function eventWithDate(payload: EventPayload, date: string): FinancialEvent {
  const built: FinancialEvent = { type: payload.type, date };
  if (payload.amountCents !== undefined) built.amountCents = payload.amountCents;
  if (payload.extraPrincipalCents !== undefined) built.extraPrincipalCents = payload.extraPrincipalCents;
  return built;
}

/**
 * Events dated `now + days` for `days` drawn from `daysFromNow`
 * (negative = in the past, 0 = today, positive = in the future).
 */
export function eventOnDayArb(
  now: string,
  daysFromNow: fc.Arbitrary<number>,
  amountMaxCents: number,
): fc.Arbitrary<FinancialEvent> {
  return fc
    .tuple(eventPayloadArb(amountMaxCents), daysFromNow)
    .map(([payload, days]) => eventWithDate(payload, shiftDays(now, days)));
}

function buildSnapshotArb(limits: Limits, incomeMinCents: number): fc.Arbitrary<FinancialSnapshot> {
  const debt = centsDebtArb({
    balanceMaxCents: limits.debtMaxCents,
    minimumPaymentMaxCents: limits.debtMaxCents,
    aprMax: limits.aprMax,
  });
  const subscription = centsSubscriptionArb(limits.subAmountMaxCents);
  const offset = fc.integer({ min: OFFSET_MIN, max: OFFSET_MAX });
  const transaction = fc.record({
    transactionId: fc.uuid(),
    amountCents: moneyCents(1, limits.txAmountMaxCents),
    description: fc.string(),
    category: fc.string({ minLength: 1 }),
    offset,
  });
  const event = fc.record({ payload: eventPayloadArb(limits.eventAmountMaxCents), offset });

  return fc
    .record({
      nowJulian: fc.integer({ min: NOW_JULIAN_MIN, max: NOW_JULIAN_MAX }),
      monthlyIncomeCents: fc.oneof(
        { arbitrary: fc.constant(0), weight: 1 },
        { arbitrary: moneyCents(incomeMinCents, limits.incomeMaxCents), weight: 6 },
      ),
      debts: fc.array(debt, { maxLength: limits.maxDebts }),
      subscriptions: fc.array(subscription, { maxLength: limits.maxSubs }),
      transactions: fc.array(transaction, { maxLength: limits.maxTxs }),
      events: fc.array(event, { maxLength: limits.maxEvents }),
    })
    .map((raw) => {
      const now = julianToDate(raw.nowJulian);
      const dateFor = (off: number): string => julianToDate(raw.nowJulian - off);
      const events: FinancialEvent[] = raw.events.map((e) => eventWithDate(e.payload, dateFor(e.offset)));
      return centsToSnapshot({
        monthlyIncomeCents: raw.monthlyIncomeCents,
        debts: raw.debts,
        subscriptions: raw.subscriptions,
        transactions: raw.transactions.map((t) => ({
          transactionId: t.transactionId,
          amountCents: t.amountCents,
          description: t.description,
          category: t.category,
          date: dateFor(t.offset),
        })),
        events,
        now,
      });
    });
}

const MIN_REALISTIC_INCOME_CENTS = 100; // $1.00
const MIN_EXTREME_INCOME_CENTS = 100;

/** Realistic dollar-valued snapshots: income 0 or $1-$10,000, bounded amounts. */
export const realisticSnapshot: fc.Arbitrary<FinancialSnapshot> = buildSnapshotArb(
  REALISTIC_LIMITS,
  MIN_REALISTIC_INCOME_CENTS,
);

/** Extreme snapshots: zero income, empty arrays, zero APRs, amounts up to $1e12. */
export const extremeSnapshot: fc.Arbitrary<FinancialSnapshot> = buildSnapshotArb(
  EXTREME_LIMITS,
  MIN_EXTREME_INCOME_CENTS,
);

// ---------------------------------------------------------------------------
// Derived-snapshot builders (pure; inputs are never mutated)
// ---------------------------------------------------------------------------

function toCents(dollars: number): number {
  return Math.round(dollars * CENTS_PER_DOLLAR_TEST);
}

/** Reduces a debt balance by `deltaCents`, clamped at 0. */
export function payDebt(
  snap: FinancialSnapshot,
  debtIndex: number,
  deltaCents: number,
): FinancialSnapshot {
  const debts = snap.debts.map((d, i) =>
    i === debtIndex
      ? { ...d, balance: Math.max(0, toCents(d.balance) - deltaCents) / CENTS_PER_DOLLAR_TEST }
      : d,
  );
  return { ...snap, debts };
}

/** Cancels a subscription by setting `active` to false. */
export function cancelSubscription(snap: FinancialSnapshot, subIndex: number): FinancialSnapshot {
  const subscriptions = snap.subscriptions.map((s, i) =>
    i === subIndex ? { ...s, active: false } : s,
  );
  return { ...snap, subscriptions };
}

/** Increases a debt balance by `deltaCents`. */
export function increaseDebtBalance(
  snap: FinancialSnapshot,
  debtIndex: number,
  deltaCents: number,
): FinancialSnapshot {
  const debts = snap.debts.map((d, i) =>
    i === debtIndex ? { ...d, balance: (toCents(d.balance) + deltaCents) / CENTS_PER_DOLLAR_TEST } : d,
  );
  return { ...snap, debts };
}

/** Increases a debt's minimum monthly payment by `deltaCents`. */
export function increaseMinimumPayment(
  snap: FinancialSnapshot,
  debtIndex: number,
  deltaCents: number,
): FinancialSnapshot {
  const debts = snap.debts.map((d, i) =>
    i === debtIndex
      ? {
          ...d,
          minimumMonthlyPayment:
            (toCents(d.minimumMonthlyPayment) + deltaCents) / CENTS_PER_DOLLAR_TEST,
        }
      : d,
  );
  return { ...snap, debts };
}
