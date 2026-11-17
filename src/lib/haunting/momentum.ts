// Momentum: a bounded bonus that rewards recent effort (extra principal,
// canceled subscriptions, completed exorcism actions) from in-window events.
// Pure and deterministic; never reads the clock and never mutates its inputs.

import {
  COEFF_ACTIONS_COMPLETED,
  COEFF_EXTRA_PRINCIPAL,
  COEFF_SUB_CANCEL_COST,
  MIN_INCOME_CENTS,
  MOMENTUM_MAX,
} from "./config";
import { isInWindow } from "./dates";
import type { FinancialEvent } from "./types";

/** Returns a non-negative finite amount, or 0 for missing, negative or non-finite values. */
function sanitizeCents(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

/** Keeps only events dated within the WINDOW_DAYS calendar days ending on `now`, inclusive. */
export function filterInWindowEvents(events: FinancialEvent[], now: string): FinancialEvent[] {
  return events.filter((event) => isInWindow(event.date, now));
}

function sumCents(
  events: FinancialEvent[],
  type: FinancialEvent["type"],
  field: "amountCents" | "extraPrincipalCents",
): number {
  return events
    .filter((event) => event.type === type)
    .reduce((total, event) => total + sanitizeCents(event[field]), 0);
}

/** Computes the momentum bonus in [0, MOMENTUM_MAX]; 0 when income is below MIN_INCOME_CENTS. */
export function computeMomentum(
  events: FinancialEvent[],
  monthlyIncomeCents: number,
  now: string,
): number {
  if (!Number.isFinite(monthlyIncomeCents) || monthlyIncomeCents < MIN_INCOME_CENTS) return 0;

  const inWindow = filterInWindowEvents(events, now);
  const totalExtraPrincipal = sumCents(inWindow, "debt_payment", "extraPrincipalCents");
  const totalCanceledCost = sumCents(inWindow, "subscription_canceled", "amountCents");
  const actionsCount = inWindow.filter((event) => event.type === "exorcism_action_completed").length;

  const raw =
    COEFF_EXTRA_PRINCIPAL * (totalExtraPrincipal / monthlyIncomeCents) +
    COEFF_SUB_CANCEL_COST * (totalCanceledCost / monthlyIncomeCents) +
    COEFF_ACTIONS_COMPLETED * actionsCount;

  if (Number.isNaN(raw)) return 0;
  return Math.min(MOMENTUM_MAX, Math.max(0, raw));
}
