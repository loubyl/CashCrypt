// Reference keys of idempotent Events. Pure: shared by the mutations and the snapshot adapter.

const CANCEL_REF_PREFIX = "cancel:";

/** Reference key of the single `subscription_canceled` Event of a Subscription. */
export function cancelRefKey(subscriptionId: string): string {
  return `${CANCEL_REF_PREFIX}${subscriptionId}`;
}
