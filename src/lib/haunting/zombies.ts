// Subscriptions: cadence normalisation, validity checks, zombie generation and
// Factor_C. Pure and deterministic; never throws and never mutates its inputs.

import { CADENCE_WEEKLY_FACTOR, CADENCE_YEARLY_FACTOR, MIN_INCOME_CENTS } from "./config";
import type {
  Cadence,
  InternalSubscription,
  SubscriptionInCents,
  Usage,
  Zombie,
} from "./types";

const MONTHLY_CADENCE_FACTOR = 1;

const CADENCE_FACTORS: Record<Cadence, number> = {
  weekly: CADENCE_WEEKLY_FACTOR,
  monthly: MONTHLY_CADENCE_FACTOR,
  yearly: CADENCE_YEARLY_FACTOR,
};

const VALID_USAGES: readonly Usage[] = ["often", "rarely", "never"];

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

function isValidUsage(value: unknown): boolean {
  return typeof value === "string" && (VALID_USAGES as readonly string[]).includes(value);
}

function isValidCadence(value: unknown): value is Cadence {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CADENCE_FACTORS, value);
}

/**
 * True when the data is well formed: non-empty id and name, a finite positive monthly cost
 * (which also requires a known cadence) and a known usage.
 * Validity says nothing about `active`: a canceled subscription stays valid, so the UI can show
 * it as a graveyard tombstone. Zombies and Factor C exclude it because it is inactive.
 */
export function isValidSubscription(sub: InternalSubscription): boolean {
  return (
    isNonEmptyString(sub.subscriptionId) &&
    isNonEmptyString(sub.name) &&
    Number.isFinite(sub.monthlyCostCents) &&
    sub.monthlyCostCents > 0 &&
    isValidUsage(sub.usage)
  );
}

/** Converts a per-period amount in cents to a rounded monthly cost; 0 for invalid amounts or cadences. */
function toMonthlyCostCents(sub: SubscriptionInCents): number {
  if (!Number.isFinite(sub.amountCents) || sub.amountCents < 0) return 0;
  if (!isValidCadence(sub.cadence)) return 0;
  const monthly = Math.round(sub.amountCents * CADENCE_FACTORS[sub.cadence]);
  return Number.isFinite(monthly) && monthly > 0 ? monthly : 0;
}

/** Normalises a subscription (already in cents) to a monthly cost and sets its `valid` flag. */
export function normalizeSubscription(sub: SubscriptionInCents): InternalSubscription {
  const normalized: InternalSubscription = {
    subscriptionId: sub.subscriptionId,
    name: sub.name,
    monthlyCostCents: toMonthlyCostCents(sub),
    usage: sub.usage,
    active: sub.active,
    valid: false,
  };
  return { ...normalized, valid: isValidSubscription(normalized) };
}

function isValidActive(sub: InternalSubscription): boolean {
  return sub.valid === true && sub.active === true;
}

/** One zombie per valid, active subscription. */
export function computeZombies(subs: InternalSubscription[]): Zombie[] {
  return subs.filter(isValidActive).map((sub) => ({
    subscriptionId: sub.subscriptionId,
    name: sub.name,
    monthlyCost: sub.monthlyCostCents,
    usage: sub.usage,
  }));
}

/** Factor C: monthly cost of valid active subscriptions divided by monthly income; 0 when income is unusable. */
export function computeFactorC(subs: InternalSubscription[], monthlyIncomeCents: number): number {
  if (!Number.isFinite(monthlyIncomeCents) || monthlyIncomeCents < MIN_INCOME_CENTS) return 0;
  const totalCents = subs
    .filter(isValidActive)
    .reduce((total, sub) => total + sub.monthlyCostCents, 0);
  return totalCents / monthlyIncomeCents;
}
