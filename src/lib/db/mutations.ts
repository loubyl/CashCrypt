// One function per user action. Each validates first (no transaction opens on
// invalid input) and then writes inside exactly one Dexie "rw" transaction.
import { assertRealDb } from "@/lib/db/crypt";
import { DbNotFoundError, DbValidationError } from "@/lib/db/errors";
import { cancelRefKey } from "@/lib/db/refKeys";
import { PROFILE_ID, type CryptDb, type ProfileRecord } from "@/lib/db/schema";
import type { ExorcismActionKind } from "@/lib/exorcism/types";
import { normalizeSubscription } from "@/lib/haunting";
import { getPlanWeekStart, type LocalDate } from "@/lib/utils/calendar";
import {
  validateDebtInput,
  validateIncome,
  validatePaymentAmount,
  validateSubscriptionInput,
  validateTransactionInput,
  type ValidationResult,
} from "@/lib/validation/inputs";
import type {
  DebtInput,
  DebtRow,
  StoredPlanAction,
  SubscriptionInput,
  SubscriptionRow,
  TransactionInput,
  TransactionRow,
  WeeklyPlanRow,
} from "@/types/finance";

export type MutationContext = {
  now: LocalDate;
  /** Id generator. Defaults to crypto.randomUUID; tests inject a stable one. */
  newId?: () => string;
};

// ---------------------------------------------------------------------------
// Shared helpers (reused by the plan, payment and cancellation mutations)
// ---------------------------------------------------------------------------

/** Returns the validated value or throws DbValidationError. */
function unwrap<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new DbValidationError(result.errors);
  return result.value;
}

function createId(ctx: MutationContext): string {
  return (ctx.newId ?? (() => crypto.randomUUID()))();
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/** Creates or updates the single profile row, keeping its other fields. */
export async function setMonthlyIncome(db: CryptDb, cents: number): Promise<void> {
  const monthlyIncomeCents = unwrap(validateIncome(cents));
  await db.transaction("rw", [db.profile], async () => {
    const existing = await db.profile.get(PROFILE_ID);
    const record: ProfileRecord = { ...existing, monthlyIncomeCents, id: PROFILE_ID };
    await db.profile.put(record);
  });
}

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

export async function addDebt(
  db: CryptDb,
  input: DebtInput,
  ctx: MutationContext,
): Promise<DebtRow> {
  const value = unwrap(validateDebtInput(input));
  const row: DebtRow = { id: createId(ctx), ...value };
  await db.transaction("rw", [db.debts], async () => {
    await db.debts.add(row);
  });
  return row;
}

export async function editDebt(
  db: CryptDb,
  id: string,
  input: DebtInput,
): Promise<DebtRow> {
  const value = unwrap(validateDebtInput(input));
  return db.transaction("rw", [db.debts], async () => {
    const existing = await db.debts.get(id);
    if (!existing) throw new DbNotFoundError(id);
    const row: DebtRow = { ...existing, ...value, id };
    await db.debts.put(row);
    return row;
  });
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/** New subscriptions are always stored active. */
export async function addSubscription(
  db: CryptDb,
  input: SubscriptionInput,
  ctx: MutationContext,
): Promise<SubscriptionRow> {
  const value = unwrap(validateSubscriptionInput(input));
  const row: SubscriptionRow = { id: createId(ctx), ...value, active: true };
  await db.transaction("rw", [db.subscriptions], async () => {
    await db.subscriptions.add(row);
  });
  return row;
}

/** Edits details only. `active` and `canceledOn` keep their stored values. */
export async function editSubscription(
  db: CryptDb,
  id: string,
  input: SubscriptionInput,
): Promise<SubscriptionRow> {
  const value = unwrap(validateSubscriptionInput(input));
  return db.transaction("rw", [db.subscriptions], async () => {
    const existing = await db.subscriptions.get(id);
    if (!existing) throw new DbNotFoundError(id);
    const row: SubscriptionRow = {
      ...existing,
      name: value.name,
      amountCents: value.amountCents,
      cadence: value.cadence,
      usage: value.usage,
    };
    await db.subscriptions.put(row);
    return row;
  });
}

/**
 * Removes a Debt row. Its `debt_payment` Events stay, so past effort keeps counting for momentum.
 * Weekly_Plans are never touched; a plan action that targets it simply loses its "Do it" button.
 */
export async function deleteDebt(db: CryptDb, id: string): Promise<void> {
  await db.transaction("rw", [db.debts], async () => {
    const existing = await db.debts.get(id);
    if (!existing) throw new DbNotFoundError(id);
    await db.debts.delete(id);
  });
}

/**
 * Removes a Subscription row. For an active one (never canceled, or brought back) the
 * cancellation Event is deleted too, because that cancellation was undone. A graveyard
 * Subscription keeps its Event and its momentum. Weekly_Plans and other Events are never touched.
 */
export async function deleteSubscription(db: CryptDb, id: string): Promise<void> {
  await db.transaction("rw", [db.subscriptions, db.events], async () => {
    const existing = await db.subscriptions.get(id);
    if (!existing) throw new DbNotFoundError(id);
    await db.subscriptions.delete(id);
    if (existing.active) {
      await db.events.where("refKey").equals(cancelRefKey(id)).delete();
    }
  });
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export async function addTransaction(
  db: CryptDb,
  input: TransactionInput,
  ctx: MutationContext,
): Promise<TransactionRow> {
  const value = unwrap(validateTransactionInput(input, ctx.now));
  const row: TransactionRow = { id: createId(ctx), ...value };
  await db.transaction("rw", [db.transactions], async () => {
    await db.transactions.add(row);
  });
  return row;
}

/**
 * Removes a Transaction row, for example an expense entered by mistake. Transactions have no
 * Event, so nothing else changes; ghosts and the Poltergeist follow from the remaining rows.
 */
export async function deleteTransaction(db: CryptDb, id: string): Promise<void> {
  await db.transaction("rw", [db.transactions], async () => {
    const existing = await db.transactions.get(id);
    if (!existing) throw new DbNotFoundError(id);
    await db.transactions.delete(id);
  });
}

// ---------------------------------------------------------------------------
// Payments, cancellations and plan actions
// ---------------------------------------------------------------------------

export type LogPaymentOutcome = {
  debt: DebtRow;
  extraPrincipalCents: number;
  completedActionId: string | null;
};

export type CancelOutcome =
  | { changed: false }
  | { changed: true; monthlySavedCents: number; completedActionId: string | null };

const PLAN_REF_PREFIX = "plan:";

function planRefKey(weekKey: LocalDate, actionId: string): string {
  return `${PLAN_REF_PREFIX}${weekKey}:${actionId}`;
}

/**
 * Shared completion body. Marks the action done (keeping an earlier completedOn)
 * and adds the single `exorcism_action_completed` Event unless one exists.
 * Must run inside a transaction that includes `events` and `weeklyPlans`.
 */
async function completeStoredAction(
  db: CryptDb,
  plan: WeeklyPlanRow,
  actionId: string,
  ctx: MutationContext,
): Promise<void> {
  const action = plan.actions.find((candidate) => candidate.id === actionId);
  if (!action) throw new DbNotFoundError(actionId);

  const completed: StoredPlanAction = {
    ...action,
    done: true,
    completedOn: action.done && action.completedOn ? action.completedOn : ctx.now,
  };
  const actions = plan.actions.map((candidate) =>
    candidate.id === actionId ? completed : candidate,
  );
  await db.weeklyPlans.put({ ...plan, actions });

  const refKey = planRefKey(plan.weekKey, actionId);
  const existing = await db.events.where("refKey").equals(refKey).first();
  if (!existing) {
    await db.events.add({
      id: createId(ctx),
      type: "exorcism_action_completed",
      date: ctx.now,
      refKey,
    });
  }
}

/**
 * Internal. Completes the current-week plan action of `kind` that targets
 * `targetId`, inside the caller's transaction. Never generates a plan.
 * Returns the completed action id, or null when nothing applies.
 */
async function autoCompletePlanAction(
  db: CryptDb,
  kind: ExorcismActionKind,
  targetId: string,
  ctx: MutationContext,
): Promise<string | null> {
  const plan = await db.weeklyPlans.get(getPlanWeekStart(ctx.now));
  if (!plan) return null;
  const action = plan.actions.find(
    (candidate) => candidate.kind === kind && candidate.targetId === targetId,
  );
  if (!action) return null;
  await completeStoredAction(db, plan, action.id, ctx);
  return action.id;
}

export async function logPayment(
  db: CryptDb,
  debtId: string,
  amountCents: number,
  ctx: MutationContext,
): Promise<LogPaymentOutcome> {
  return db.transaction("rw", [db.debts, db.events, db.weeklyPlans], async () => {
    const existing = await db.debts.get(debtId);
    if (!existing) throw new DbNotFoundError(debtId);
    const amount = unwrap(validatePaymentAmount(amountCents, existing));

    const debt: DebtRow = { ...existing, balanceCents: existing.balanceCents - amount };
    await db.debts.put(debt);

    const extraPrincipalCents = Math.max(0, amount - existing.minimumPaymentCents);
    await db.events.add({
      id: createId(ctx),
      type: "debt_payment",
      date: ctx.now,
      extraPrincipalCents,
    });

    const completedActionId =
      extraPrincipalCents > 0
        ? await autoCompletePlanAction(db, "extra_payment", debtId, ctx)
        : null;
    return { debt, extraPrincipalCents, completedActionId };
  });
}

export async function cancelSubscription(
  db: CryptDb,
  id: string,
  ctx: MutationContext,
): Promise<CancelOutcome> {
  return db.transaction("rw", [db.subscriptions, db.events, db.weeklyPlans], async () => {
    const existing = await db.subscriptions.get(id);
    if (!existing) throw new DbNotFoundError(id);
    if (!existing.active) return { changed: false } as const;

    const monthlySavedCents = normalizeSubscription({
      subscriptionId: existing.id,
      name: existing.name,
      amountCents: existing.amountCents,
      cadence: existing.cadence,
      usage: existing.usage,
      active: existing.active,
    }).monthlyCostCents;

    await db.subscriptions.put({ ...existing, active: false, canceledOn: ctx.now });

    const refKey = cancelRefKey(id);
    const previous = await db.events.where("refKey").equals(refKey).first();
    if (!previous) {
      await db.events.add({
        id: createId(ctx),
        type: "subscription_canceled",
        date: ctx.now,
        amountCents: monthlySavedCents,
        refKey,
      });
    }

    const completedActionId = await autoCompletePlanAction(db, "cancel_subscription", id, ctx);
    return { changed: true, monthlySavedCents, completedActionId } as const;
  });
}

/**
 * Shared uncomplete body: sets `done` to false and clears `completedOn`. The completion Event
 * stays (Requirement 8.3). Must run inside a transaction that includes `weeklyPlans`.
 */
async function resetStoredAction(db: CryptDb, plan: WeeklyPlanRow, actionId: string): Promise<void> {
  const actions = plan.actions.map((action) => {
    if (action.id !== actionId) return action;
    const { completedOn: _cleared, ...rest } = action;
    void _cleared;
    return { ...rest, done: false };
  });
  await db.weeklyPlans.put({ ...plan, actions });
}

/**
 * Makes a Subscription active again and creates no Event (Requirement 7.6). Its cancellation
 * no longer counts for momentum (the snapshot adapter drops it while the Subscription is active),
 * so the current week's matching cancel action is uncompleted in the same transaction and offers
 * "Do it" again. Its completion Event stays (Requirement 8.3).
 */
export async function reactivateSubscription(
  db: CryptDb,
  id: string,
  ctx: MutationContext,
): Promise<SubscriptionRow> {
  return db.transaction("rw", [db.subscriptions, db.weeklyPlans], async () => {
    const existing = await db.subscriptions.get(id);
    if (!existing) throw new DbNotFoundError(id);
    const row: SubscriptionRow = { ...existing, active: true, canceledOn: undefined };
    delete row.canceledOn;
    await db.subscriptions.put(row);
    const plan = await db.weeklyPlans.get(getPlanWeekStart(ctx.now));
    const action = plan?.actions.find(
      (candidate) => candidate.kind === "cancel_subscription" && candidate.targetId === id,
    );
    if (plan && action?.done) await resetStoredAction(db, plan, action.id);
    return row;
  });
}

export async function completePlanAction(
  db: CryptDb,
  weekKey: LocalDate,
  actionId: string,
  ctx: MutationContext,
): Promise<void> {
  await db.transaction("rw", [db.events, db.weeklyPlans], async () => {
    const plan = await db.weeklyPlans.get(weekKey);
    if (!plan) throw new DbNotFoundError(weekKey);
    await completeStoredAction(db, plan, actionId, ctx);
  });
}

export async function uncompletePlanAction(
  db: CryptDb,
  weekKey: LocalDate,
  actionId: string,
): Promise<void> {
  await db.transaction("rw", [db.events, db.weeklyPlans], async () => {
    const plan = await db.weeklyPlans.get(weekKey);
    if (!plan) throw new DbNotFoundError(weekKey);
    if (!plan.actions.some((action) => action.id === actionId)) {
      throw new DbNotFoundError(actionId);
    }
    await resetStoredAction(db, plan, actionId);
  });
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

/** Deletes every row of the real crypt. Throws for any other database. */
export async function clearAllData(db: CryptDb): Promise<void> {
  assertRealDb(db);
  const tables = [
    db.profile,
    db.debts,
    db.subscriptions,
    db.transactions,
    db.events,
    db.weeklyPlans,
  ];
  await db.transaction("rw", tables, async () => {
    await Promise.all(tables.map((table) => table.clear()));
  });
}
