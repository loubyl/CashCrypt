"use client";

import { createContext, useContext } from "react";
import type { CancelOutcome, LogPaymentOutcome } from "@/lib/db/mutations";
import type { HouseChange } from "@/hooks/useCryptActions";
import { isSmallExpense } from "@/lib/haunting/ghosts";
import type { ActionOutcome } from "@/lib/moments/types";
import type { TransactionRow } from "@/types/finance";

/** The user action about to run, as reported to the observer at `begin`. */
export type ObservedAction =
  | { kind: "expense" }
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

/** Maps a created transaction to an ActionOutcome. */
export function mapExpenseOutcome(
  transaction: TransactionRow,
  change: HouseChange | null | undefined,
): ActionOutcome {
  return {
    kind: "expense",
    transactionId: transaction.id,
    small: isSmallExpense(transaction.amountCents),
    poltergeistAfter: change?.poltergeistAfter ?? false,
  };
}

type ObservedResult<T, E> =
  | { ok: true; value: T; change?: HouseChange | null }
  | { ok: false; error: E };

/**
 * Calls `begin` synchronously, then runs `task` (which may wait in the action
 * chain) and ends with `resolve` or `fail`. With no observer it only runs the
 * task.
 */
export async function observeAction<T, E>(
  observer: ActionObserver | null,
  action: ObservedAction,
  task: () => Promise<ObservedResult<T, E>>,
  map: (value: T, change: HouseChange | null | undefined) => ActionOutcome,
): Promise<ObservedResult<T, E>> {
  const ticket = observer ? observer.begin(action) : null;
  let result: ObservedResult<T, E>;
  try {
    result = await task();
  } catch (error) {
    if (observer && ticket) observer.fail(ticket);
    throw error;
  }
  if (observer && ticket) {
    if (result.ok) observer.resolve(ticket, map(result.value, result.change));
    else observer.fail(ticket);
  }
  return result;
}
