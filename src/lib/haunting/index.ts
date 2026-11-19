// Public API of the haunting engine: the Cents_Boundary and computeHouseState.
// Pure and deterministic: no I/O, no clock, no randomness.

import {
  CENTS_PER_DOLLAR,
  MIN_INCOME_CENTS,
  SCORE_MAX,
  SCORE_MIN,
} from "./config";
import { computeDecayLevel, computeLevelProgress, computeWindowBrightness } from "./decay";
import { computeGhostsAndPoltergeist } from "./ghosts";
import { computeBaseScore } from "./lightScore";
import { computeMomentum } from "./momentum";
import { computeZombies, normalizeSubscription } from "./zombies";
import type {
  CentsSnapshot,
  FinancialEvent,
  FinancialSnapshot,
  HouseState,
} from "./types";

export { validateConfig } from "./config";
export type {
  FinancialEvent,
  FinancialSnapshot,
  Ghost,
  HouseState,
  Poltergeist,
  SubscriptionInCents,
  Zombie,
} from "./types";
export { normalizeSubscription };

/** Sanitises a value that must be a non-negative finite number; anything else becomes 0. */
function sanitize(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Converts decimal dollars to integer cents. The only Math.round(x * CENTS_PER_DOLLAR) in the engine. */
export function dollarsToCents(dollars: number): number {
  return sanitize(Math.round(sanitize(dollars) * CENTS_PER_DOLLAR));
}

function sanitizeEvent(event: FinancialEvent): FinancialEvent {
  const result: FinancialEvent = { type: event.type, date: event.date };
  if (event.amountCents !== undefined) result.amountCents = sanitize(event.amountCents);
  if (event.extraPrincipalCents !== undefined) {
    result.extraPrincipalCents = sanitize(event.extraPrincipalCents);
  }
  return result;
}

/** Cents_Boundary: builds a new snapshot in integer cents without mutating the input. */
function convertToCents(snapshot: FinancialSnapshot): CentsSnapshot {
  const incomeCents = dollarsToCents(snapshot.monthlyIncome);
  return {
    monthlyIncomeCents: incomeCents < MIN_INCOME_CENTS ? 0 : incomeCents,
    debts: snapshot.debts.map((debt) => ({
      debtId: debt.debtId,
      name: debt.name,
      balanceCents: dollarsToCents(debt.balance),
      minimumMonthlyPaymentCents: dollarsToCents(debt.minimumMonthlyPayment),
      apr: debt.apr,
    })),
    subscriptions: snapshot.subscriptions.map((sub) => ({
      subscriptionId: sub.subscriptionId,
      name: sub.name,
      amountCents: dollarsToCents(sub.amount),
      cadence: sub.cadence,
      usage: sub.usage,
      active: sub.active,
    })),
    transactions: snapshot.transactions.map((tx) => ({
      transactionId: tx.transactionId,
      amountCents: dollarsToCents(tx.amount),
      description: tx.description,
      category: tx.category,
      date: tx.date,
    })),
    events: snapshot.events.map(sanitizeEvent),
    now: snapshot.now,
  };
}

/** Computes the full house state from a financial snapshot. */
export function computeHouseState(snapshot: FinancialSnapshot): HouseState {
  const internal = convertToCents(snapshot);
  const subscriptions = internal.subscriptions.map(normalizeSubscription);
  const baseScore = computeBaseScore({ ...internal, subscriptions });
  const momentum = computeMomentum(internal.events, internal.monthlyIncomeCents, internal.now);
  const lightScore = Math.max(SCORE_MIN, Math.min(SCORE_MAX, baseScore + momentum));
  const decayLevel = computeDecayLevel(lightScore);
  const { ghosts, poltergeist } = computeGhostsAndPoltergeist(
    internal.transactions,
    internal.monthlyIncomeCents,
    internal.now,
  );
  return {
    lightScore,
    baseScore,
    momentum,
    decayLevel,
    windowBrightness: computeWindowBrightness(lightScore),
    levelProgress: computeLevelProgress(lightScore, decayLevel),
    zombies: computeZombies(subscriptions),
    ghosts,
    poltergeist,
  };
}
