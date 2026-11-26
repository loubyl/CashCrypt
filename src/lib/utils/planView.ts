// Pure view-model helpers for the exorcism plan and the payment sheet. No React, no Dexie.

import type { ExorcismAction } from "@/lib/exorcism/types";
import type { DebtRow, LocalDate, SubscriptionRow } from "@/types/finance";
import { formatMonthDay } from "./calendar";
import { formatCentsShort } from "./cents";

const PER_MONTH_SUFFIX = "/mo";
const IMPACT_PREFIX = "+";
const FREED_SUFFIX = "freed";
const NO_AMOUNT_TOAST = "Action completed";
const DONE_PREFIX = "Done";
const TITLE_SEPARATOR = " — ";
const GUIDE_PRESS_PREFIX = "Press Do it on ";
const GUIDE_CANCEL_OUTCOME = " and watch the zombie get buried";
const GUIDE_PAY_OUTCOME = " and watch the windows light up";
const GUIDE_TICK_PREFIX = "Tick ";
const GUIDE_TICK_SUFFIX = " in This week's exorcism once you've done it";
const GUIDE_DONE_TEXT =
  "This week's exorcism is done. Use Skip to next week in Demo controls for a new plan.";

export type PlanSummary = {
  doneCount: number;
  total: number;
  freedCents: number;
  possibleCents: number;
  allDone: boolean;
};

export type DoItTarget =
  | { kind: "cancel"; subscriptionId: string }
  | { kind: "pay"; debtId: string; prefillCents: number };

export type DoItRows = {
  subscriptions: readonly Pick<SubscriptionRow, "id" | "active">[];
  debts: readonly Pick<DebtRow, "id" | "balanceCents" | "minimumPaymentCents">[];
};

function safeCents(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function summarizePlan(actions: readonly ExorcismAction[]): PlanSummary {
  let doneCount = 0;
  let freedCents = 0;
  let possibleCents = 0;
  for (const action of actions) {
    const monthly = safeCents(action.monthlyAmountCents);
    possibleCents += monthly;
    if (action.done) {
      doneCount += 1;
      freedCents += monthly;
    }
  }
  const total = actions.length;
  return { doneCount, total, freedCents, possibleCents, allDone: total > 0 && doneCount === total };
}

/** Payment above the minimum; 0 when the payment is at or below it. */
export function getExtraAboveMinimum(amountCents: number, minimumCents: number): number {
  return Math.max(0, safeCents(amountCents) - safeCents(minimumCents));
}

/**
 * Pre-filled payment: the minimum, plus the action's suggested amount when given,
 * limited to the balance.
 */
export function getPaymentPrefill(
  debt: Pick<DebtRow, "balanceCents" | "minimumPaymentCents">,
  action?: Pick<ExorcismAction, "suggestedAmountCents">,
): number {
  const wanted = safeCents(debt.minimumPaymentCents) + safeCents(action?.suggestedAmountCents);
  return Math.min(wanted, safeCents(debt.balanceCents));
}

/**
 * Null for fallback and reduce actions, done actions and targets that no longer qualify.
 * This includes a target row that is missing because the Debt or Subscription was deleted;
 * the action itself can still be completed with `completePlanAction`.
 */
export function getDoItTarget(action: ExorcismAction, rows: DoItRows): DoItTarget | null {
  if (action.done || action.targetId === undefined) {
    return null;
  }
  if (action.kind === "cancel_subscription") {
    const subscription = rows.subscriptions.find((row) => row.id === action.targetId);
    return subscription !== undefined && subscription.active
      ? { kind: "cancel", subscriptionId: subscription.id }
      : null;
  }
  if (action.kind === "extra_payment") {
    const debt = rows.debts.find((row) => row.id === action.targetId);
    return debt !== undefined && debt.balanceCents > 0
      ? { kind: "pay", debtId: debt.id, prefillCents: getPaymentPrefill(debt, action) }
      : null;
  }
  return null;
}

/** The part of an action title before " — " (the whole title when there is no separator). */
export function getShortTitle(title: string): string {
  const index = title.indexOf(TITLE_SEPARATOR);
  return (index >= 0 ? title.slice(0, index) : title).trim();
}

/**
 * Guide first-step line: the first not-done action with a Do it button, else the first
 * not-done action to tick, else the done text.
 */
export function getGuideStep(actions: readonly ExorcismAction[], rows: DoItRows): string {
  for (const action of actions) {
    const target = getDoItTarget(action, rows);
    if (target !== null) {
      const outcome = target.kind === "cancel" ? GUIDE_CANCEL_OUTCOME : GUIDE_PAY_OUTCOME;
      return `${GUIDE_PRESS_PREFIX}${getShortTitle(action.title)}${outcome}`;
    }
  }
  const pending = actions.find((action) => !action.done);
  if (pending !== undefined) {
    return `${GUIDE_TICK_PREFIX}${getShortTitle(pending.title)}${GUIDE_TICK_SUFFIX}`;
  }
  return GUIDE_DONE_TEXT;
}

/** "+$120/mo" when the action frees money, otherwise undefined. */
export function getActionImpactText(action: ExorcismAction): string | undefined {
  const monthly = safeCents(action.monthlyAmountCents);
  return monthly > 0 ? `${IMPACT_PREFIX}${formatCentsShort(monthly)}${PER_MONTH_SUFFIX}` : undefined;
}

/** "+$120/mo freed", or "Action completed" for an action with no amount. */
export function getToastForCompletion(action: ExorcismAction): string {
  const impact = getActionImpactText(action);
  return impact === undefined ? NO_AMOUNT_TOAST : `${impact} ${FREED_SUFFIX}`;
}

/**
 * Row subtitle: the instruction while the action is pending, "Done Nov 19" once
 * it is done (just "Done" if the completion date is missing).
 */
export function getPlanActionSubtitle(
  action: Pick<ExorcismAction, "done" | "subtitle"> & { completedOn?: LocalDate },
): string {
  if (!action.done) return action.subtitle;
  return action.completedOn ? `${DONE_PREFIX} ${formatMonthDay(action.completedOn)}` : DONE_PREFIX;
}
