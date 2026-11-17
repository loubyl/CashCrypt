// Base light score: snapshot -> baseScore = 100 / (1 + S), where
// S = WEIGHT_FACTOR_A·A + WEIGHT_FACTOR_B·B + WEIGHT_FACTOR_C·C.
// Pure functions, integer-cents inputs, no mutation of arguments.

import {
  MIN_INCOME_CENTS,
  MONTHS_PER_YEAR,
  SCORE_MAX,
  SCORE_MIN,
  WEIGHT_FACTOR_A,
  WEIGHT_FACTOR_B,
  WEIGHT_FACTOR_C,
} from "./config";
import type { InternalDebt, InternalSnapshot, InternalSubscription } from "./types";

/** Treats negative and non-finite values as 0. */
function nonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function sumNonNegative(values: number[]): number {
  return values.reduce((total, value) => total + nonNegative(value), 0);
}

/** A subscription contributes to Factor_C only when it is both valid and active. */
function isValidActive(subscription: InternalSubscription): boolean {
  return subscription.valid && subscription.active;
}

/**
 * Computes S = Wa·A + Wb·B + Wc·C.
 * Returns 0 when the income is not a positive finite number (no division by zero).
 */
export function computeWeightedSum(
  monthlyIncomeCents: number,
  debts: InternalDebt[],
  validActiveSubs: InternalSubscription[],
): number {
  if (!Number.isFinite(monthlyIncomeCents) || monthlyIncomeCents <= 0) return 0;

  const annualIncomeCents = monthlyIncomeCents * MONTHS_PER_YEAR;
  const minPayments = sumNonNegative(debts.map((debt) => debt.minimumMonthlyPaymentCents));
  const balances = sumNonNegative(debts.map((debt) => debt.balanceCents));
  const subscriptionCosts = sumNonNegative(validActiveSubs.map((sub) => sub.monthlyCostCents));

  const factorA = minPayments / monthlyIncomeCents;
  const factorB = balances / annualIncomeCents;
  const factorC = subscriptionCosts / monthlyIncomeCents;

  return WEIGHT_FACTOR_A * factorA + WEIGHT_FACTOR_B * factorB + WEIGHT_FACTOR_C * factorC;
}

function clampScore(score: number): number {
  if (Number.isNaN(score)) return SCORE_MIN;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
}

/**
 * Computes baseScore in [SCORE_MIN, SCORE_MAX].
 * Incomes below MIN_INCOME_CENTS take the zero-income path: SCORE_MIN when any
 * debt balance is positive or any valid active subscription exists, otherwise SCORE_MAX.
 */
export function computeBaseScore(internal: InternalSnapshot): number {
  const validActiveSubs = internal.subscriptions.filter(isValidActive);

  if (!(internal.monthlyIncomeCents >= MIN_INCOME_CENTS)) {
    const hasDebt = internal.debts.some((debt) => debt.balanceCents > 0);
    return hasDebt || validActiveSubs.length > 0 ? SCORE_MIN : SCORE_MAX;
  }

  const weightedSum = computeWeightedSum(internal.monthlyIncomeCents, internal.debts, validActiveSubs);
  return clampScore(SCORE_MAX / (1 + weightedSum));
}
