"use client";

import { createContext, useContext } from "react";
import type { CancelOutcome, LogPaymentOutcome } from "@/lib/db/mutations";
import type { ActionOutcome } from "@/lib/moments/types";

/** The user action about to run, as reported to the observer at `begin`. */
export type ObservedAction =
  | { kind: "cancel"; subscriptionId: string }
  | { kind: "payment"; debtId: string }
  | { kind: "planToggle"; actionId: string; next: boolean };

export type ActionTicket = { id: number };

/** Receives the start and the end of an action. Provided by the Dashboard only. */
export type ActionObserver = {
  begin(action: ObservedAction): ActionTicket;
  resolve(ticket: ActionTicket, outcome: ActionOutcome): void;
  fail(ticket: ActionTicket): void;
};

export const ActionObserverContext = createContext<ActionObserver | null>(null);

/** The observer of the nearest provider, or null when there is none. */
export function useActionObserver(): ActionObserver | null {
  return useContext(ActionObserverContext);
}

/** Maps a cancel mutation result to an ActionOutcome. */
export function mapCancelOutcome(
  subscriptionId: string,
  outcome: CancelOutcome,
): ActionOutcome {
  if (!outcome.changed) {
    return {
      kind: "cancel",
      subscriptionId,
      changed: false,
      monthlySavedCents: 0,
      completedActionId: null,
    };
  }
  return {
    kind: "cancel",
    subscriptionId,
    changed: true,
    monthlySavedCents: outcome.monthlySavedCents,
    completedActionId: outcome.completedActionId,
  };
}

/** Maps a payment mutation result to an ActionOutcome. The host fills `origin` at `begin`. */
export function mapPaymentOutcome(outcome: LogPaymentOutcome): ActionOutcome {
  return {
    kind: "payment",
    extraPrincipalCents: outcome.extraPrincipalCents,
    completedActionId: outcome.completedActionId,
    origin: null,
  };
}

/**
 * Runs `task` between `begin` and `resolve` or `fail`. With no observer it
 * only runs the task.
 */
export async function observeAction<T, E>(
  observer: ActionObserver | null,
  action: ObservedAction,
  task: () => Promise<{ ok: true; value: T } | { ok: false; error: E }>,
  map: (value: T) => ActionOutcome,
): Promise<{ ok: true; value: T } | { ok: false; error: E }> {
  const ticket = observer ? observer.begin(action) : null;
  let result: { ok: true; value: T } | { ok: false; error: E };
  try {
    result = await task();
  } catch (error) {
    if (observer && ticket) observer.fail(ticket);
    throw error;
  }
  if (observer && ticket) {
    if (result.ok) observer.resolve(ticket, map(result.value));
    else observer.fail(ticket);
  }
  return result;
}
