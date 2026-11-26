import { getPoltergeistStage } from "@/lib/utils/lightClause";
import type { DecayLevel } from "@/lib/haunting/config";
import type { ActionContext, ActionOutcome, MomentRequest } from "./types";

/** Number of done plan actions that completes the weekly plan. */
const PLAN_COMPLETE_COUNT = 3;
const REDUCE_SMALL_EXPENSES_KIND = "reduce_small_expenses";
const FALLBACK_KIND = "fallback";

function ownRequest(outcome: ActionOutcome, ctx: ActionContext): MomentRequest | null {
  switch (outcome.kind) {
    case "cancel":
      if (!outcome.changed) return null;
      return {
        kind: "cancel",
        subscriptionId: outcome.subscriptionId,
        name: ctx.subscriptionNames[outcome.subscriptionId] ?? "",
        monthlyCents: outcome.monthlySavedCents,
        target: ctx.drawnZombieIds.includes(outcome.subscriptionId) ? "zombie" : "overflow",
      };
    case "payment":
      if (!(outcome.extraPrincipalCents > 0)) return null;
      return { kind: "payment", origin: outcome.origin, hasCrack: ctx.crackCount > 0 };
    case "planToggle":
      return planToggleRequest(outcome, ctx);
    case "expense":
      return expenseRequest(outcome, ctx);
  }
}

function expenseRequest(
  outcome: Extract<ActionOutcome, { kind: "expense" }>,
  ctx: ActionContext,
): MomentRequest | null {
  if (!outcome.small) return null;
  const stage = getPoltergeistStage(ctx.poltergeistPresent, outcome.poltergeistAfter);
  if (stage === "asleep") return { kind: "ghostArrival", transactionId: outcome.transactionId };
  return { kind: "poltergeistFeed", appeared: stage === "woke" };
}

function planToggleRequest(
  outcome: Extract<ActionOutcome, { kind: "planToggle" }>,
  ctx: ActionContext,
): MomentRequest | null {
  if (!outcome.next) return null;
  const action = ctx.planActions.find((a) => a.id === outcome.actionId);
  if (!action || action.done) return null;
  const reducesSmallExpenses = action.kind === REDUCE_SMALL_EXPENSES_KIND;
  if (reducesSmallExpenses && ctx.poltergeistPresent) return { kind: "sigil" };
  if ((reducesSmallExpenses || action.kind === FALLBACK_KIND) && outcome.lightDelta > 0) {
    return { kind: "candleFlicker", litWindows: ctx.litWindowCount > 0 };
  }
  return null;
}

/** The plan action the outcome newly marks as done, if any. */
function newlyCompletedId(outcome: ActionOutcome): string | null {
  if (outcome.kind === "expense") return null;
  if (outcome.kind === "planToggle") return outcome.next ? outcome.actionId : null;
  return outcome.completedActionId;
}

function completesPlan(outcome: ActionOutcome, ctx: ActionContext): boolean {
  const id = newlyCompletedId(outcome);
  if (id === null) return false;
  const action = ctx.planActions.find((a) => a.id === id);
  if (!action || action.done) return false;
  const before = ctx.planActions.filter((a) => a.done).length;
  return before < PLAN_COMPLETE_COUNT && before + 1 >= PLAN_COMPLETE_COUNT;
}

/**
 * Moments caused by one action, in order: its own Moment, then `exorcismComplete`.
 * The `level` request is added later by `planLevelMoment` once live data settles.
 */
export function planMoments(outcome: ActionOutcome, ctx: ActionContext): MomentRequest[] {
  const requests: MomentRequest[] = [];
  const own = ownRequest(outcome, ctx);
  if (own) requests.push(own);
  if (completesPlan(outcome, ctx)) requests.push({ kind: "exorcismComplete" });
  return requests;
}

/** One `level` request when the cursor level differs from the live level, else null. */
export function planLevelMoment(cursor: DecayLevel, live: DecayLevel): MomentRequest | null {
  return cursor === live ? null : { kind: "level", from: cursor, to: live };
}
