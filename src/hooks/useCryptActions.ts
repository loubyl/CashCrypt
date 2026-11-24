"use client";
import { useCallback, useMemo } from "react";
import { useCrypt } from "@/hooks/useCrypt";
import {
  mapCancelOutcome,
  mapPaymentOutcome,
  observeAction,
  useActionObserver,
  type ActionObserver,
} from "@/hooks/useActionObserver";
import { useNow } from "@/hooks/useNow";
import { DbNotFoundError, DbValidationError } from "@/lib/db/errors";
import {
  addDebt,
  addSubscription,
  addTransaction,
  cancelSubscription,
  clearAllData,
  deleteDebt,
  deleteSubscription,
  deleteTransaction,
  editDebt,
  editSubscription,
  logPayment,
  reactivateSubscription,
  setMonthlyIncome,
  type CancelOutcome,
  type LogPaymentOutcome,
} from "@/lib/db/mutations";
import type { CryptDb } from "@/lib/db/schema";
import type {
  DebtInput,
  DebtRow,
  LocalDate,
  SubscriptionInput,
  SubscriptionRow,
  TransactionInput,
  TransactionRow,
} from "@/types/finance";

export type MutationError =
  | { kind: "validation"; errors: { field: string; message: string }[] }
  | { kind: "not-found"; message: string }
  | { kind: "unknown"; message: string };

export type MutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: MutationError };

export type CryptActions = {
  setIncome: (cents: number) => Promise<MutationResult<void>>;
  addDebt: (input: DebtInput) => Promise<MutationResult<DebtRow>>;
  editDebt: (id: string, input: DebtInput) => Promise<MutationResult<DebtRow>>;
  addSubscription: (input: SubscriptionInput) => Promise<MutationResult<SubscriptionRow>>;
  editSubscription: (
    id: string,
    input: SubscriptionInput,
  ) => Promise<MutationResult<SubscriptionRow>>;
  addTransaction: (input: TransactionInput) => Promise<MutationResult<TransactionRow>>;
  logPayment: (
    debtId: string,
    amountCents: number,
  ) => Promise<MutationResult<LogPaymentOutcome>>;
  cancelSubscription: (id: string) => Promise<MutationResult<CancelOutcome>>;
  reactivateSubscription: (id: string) => Promise<MutationResult<SubscriptionRow>>;
  deleteDebt: (id: string) => Promise<MutationResult<void>>;
  deleteSubscription: (id: string) => Promise<MutationResult<void>>;
  deleteTransaction: (id: string) => Promise<MutationResult<void>>;
  clearAll: () => Promise<MutationResult<void>>;
};

const NOT_READY_MESSAGE = "The crypt is not ready yet.";
const UNKNOWN_MESSAGE = "Something went wrong. Please try again.";

/** Maps anything thrown by a mutation to a MutationError. */
export function toMutationError(error: unknown): MutationError {
  if (error instanceof DbValidationError) {
    return { kind: "validation", errors: error.errors };
  }
  if (error instanceof DbNotFoundError) {
    return { kind: "not-found", message: error.message };
  }
  const message = error instanceof Error && error.message ? error.message : UNKNOWN_MESSAGE;
  return { kind: "unknown", message };
}

async function run<T>(task: () => Promise<T>): Promise<MutationResult<T>> {
  try {
    return { ok: true, value: await task() };
  } catch (error) {
    return { ok: false, error: toMutationError(error) };
  }
}

function notReady<T>(): Promise<MutationResult<T>> {
  return Promise.resolve({ ok: false, error: { kind: "unknown", message: NOT_READY_MESSAGE } });
}

function bindActions(
  db: CryptDb,
  now: LocalDate | null,
  observer: ActionObserver | null,
): CryptActions {
  const withNow = <T>(task: (today: LocalDate) => Promise<T>): Promise<MutationResult<T>> =>
    now === null ? notReady<T>() : run(() => task(now));
  return {
    setIncome: (cents) => run(() => setMonthlyIncome(db, cents)),
    addDebt: (input) => withNow((today) => addDebt(db, input, { now: today })),
    editDebt: (id, input) => run(() => editDebt(db, id, input)),
    addSubscription: (input) =>
      withNow((today) => addSubscription(db, input, { now: today })),
    editSubscription: (id, input) => run(() => editSubscription(db, id, input)),
    addTransaction: (input) =>
      withNow((today) => addTransaction(db, input, { now: today })),
    logPayment: (debtId, amountCents) =>
      observeAction(
        observer,
        { kind: "payment", debtId },
        () => withNow((today) => logPayment(db, debtId, amountCents, { now: today })),
        mapPaymentOutcome,
      ),
    cancelSubscription: (id) =>
      observeAction(
        observer,
        { kind: "cancel", subscriptionId: id },
        () => withNow((today) => cancelSubscription(db, id, { now: today })),
        (outcome) => mapCancelOutcome(id, outcome),
      ),
    reactivateSubscription: (id) =>
      withNow((today) => reactivateSubscription(db, id, { now: today })),
    deleteDebt: (id) => run(() => deleteDebt(db, id)),
    deleteSubscription: (id) => run(() => deleteSubscription(db, id)),
    deleteTransaction: (id) => run(() => deleteTransaction(db, id)),
    clearAll: () => run(() => clearAllData(db)),
  };
}

function createNotReadyActions(): CryptActions {
  return {
    setIncome: notReady,
    addDebt: notReady,
    editDebt: notReady,
    addSubscription: notReady,
    editSubscription: notReady,
    addTransaction: notReady,
    logPayment: notReady,
    cancelSubscription: notReady,
    reactivateSubscription: notReady,
    deleteDebt: notReady,
    deleteSubscription: notReady,
    deleteTransaction: notReady,
    clearAll: notReady,
  };
}

/** Actions bound to the Active_Crypt's database and today's date. */
export function useCryptActions(): CryptActions {
  const { db } = useCrypt();
  const now = useNow();
  const observer = useActionObserver();
  return useMemo(
    () => (db ? bindActions(db, now, observer) : createNotReadyActions()),
    [db, now, observer],
  );
}

/** Creates the Real_Crypt Profile from a monthly income, then sets the mode to real. Works before any crypt is active. */
export function useCreateCrypt(): (incomeCents: number) => Promise<MutationResult<void>> {
  const { openRealDb, setMode } = useCrypt();
  return useCallback(
    (incomeCents) =>
      run(async () => {
        const target = await openRealDb();
        await setMonthlyIncome(target, incomeCents);
        setMode("real");
      }),
    [openRealDb, setMode],
  );
}
