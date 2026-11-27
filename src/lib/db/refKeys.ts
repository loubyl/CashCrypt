// Reference keys of idempotent Events. Pure: shared by the mutations and the snapshot adapter.
import { FALLBACK_ID_PREFIX } from "@/lib/exorcism/config";

const CANCEL_REF_PREFIX = "cancel:";
const PLAN_REF_PREFIX = "plan:";
const PLAN_REF_SEPARATOR = ":";

/** Reference key of the single `subscription_canceled` Event of a Subscription. */
export function cancelRefKey(subscriptionId: string): string {
  return `${CANCEL_REF_PREFIX}${subscriptionId}`;
}

/** Reference key of the single `exorcism_action_completed` Event of a plan action: `plan:<weekKey>:<actionId>`. */
export function planRefKey(weekKey: string, actionId: string): string {
  return `${PLAN_REF_PREFIX}${weekKey}${PLAN_REF_SEPARATOR}${actionId}`;
}

/**
 * True when `refKey` belongs to a fallback plan action ("welcome suggestions"). Week keys are
 * calendar dates and contain no ":", so the action id is everything after the second ":".
 */
export function isFallbackPlanRefKey(refKey: string): boolean {
  if (!refKey.startsWith(PLAN_REF_PREFIX)) return false;
  const actionStart = refKey.indexOf(PLAN_REF_SEPARATOR, PLAN_REF_PREFIX.length);
  if (actionStart === -1) return false;
  return refKey.slice(actionStart + PLAN_REF_SEPARATOR.length).startsWith(FALLBACK_ID_PREFIX);
}
