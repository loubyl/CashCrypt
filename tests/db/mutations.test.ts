// Mutation tests against fake-indexeddb. Each test uses a fresh database name.
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import { DbNotFoundError, DbValidationError } from "@/lib/db/errors";
import {
  addDebt,
  addSubscription,
  addTransaction,
  cancelSubscription,
  completePlanAction,
  editDebt,
  editSubscription,
  logPayment,
  reactivateSubscription,
  setMonthlyIncome,
  uncompletePlanAction,
  type MutationContext,
} from "@/lib/db/mutations";
import { PROFILE_ID, type CryptDb } from "@/lib/db/schema";
import type {
  DebtInput,
  StoredPlanAction,
  SubscriptionInput,
  TransactionInput,
  WeeklyPlanRow,
} from "@/types/finance";

const idb = new IDBFactory();
const opened: CryptDb[] = [];
let counter = 0;

const NOW = "2025-01-08"; // Wednesday
const WEEK_KEY = "2025-01-06"; // Monday of that week
const INCOME_CENTS = 500_000;

function freshDb(): CryptDb {
  counter += 1;
  const db = openCrypt(`test-${counter}`, { indexedDB: idb, IDBKeyRange });
  opened.push(db);
  return db;
}

afterEach(async () => {
  vi.restoreAllMocks();
  while (opened.length > 0) {
    await opened.pop()!.delete();
  }
});

/** Returns a stable id generator: id-1, id-2, ... */
function ids(): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `id-${next}`;
  };
}

function ctx(): MutationContext {
  return { now: NOW, newId: ids() };
}

async function dump(db: CryptDb) {
  return {
    profile: await db.profile.toArray(),
    debts: await db.debts.toArray(),
    subscriptions: await db.subscriptions.toArray(),
    transactions: await db.transactions.toArray(),
    events: await db.events.toArray(),
    weeklyPlans: await db.weeklyPlans.toArray(),
  };
}

const DEBT_INPUT: DebtInput = {
  name: "Card",
  balanceCents: 100_000,
  apr: 0.2,
  minimumPaymentCents: 5_000,
};

const SUB_INPUT: SubscriptionInput = {
  name: "StreamMax",
  amountCents: 2_299,
  cadence: "monthly",
  usage: "never",
  active: true,
};

const TX_INPUT: TransactionInput = {
  amountCents: 450,
  description: "Coffee",
  category: "Food",
  date: "2025-01-07",
};

function planAction(overrides: Partial<StoredPlanAction>): StoredPlanAction {
  return {
    id: "action-1",
    kind: "fallback",
    title: "Do something",
    subtitle: "Details",
    monthlyAmountCents: 0,
    priorityCents: 0,
    done: false,
    ...overrides,
  };
}

async function seedPlan(db: CryptDb, actions: StoredPlanAction[]): Promise<WeeklyPlanRow> {
  const plan: WeeklyPlanRow = {
    weekKey: WEEK_KEY,
    actions,
    startLightScore: 40,
    generatedOn: WEEK_KEY,
  };
  await db.weeklyPlans.add(plan);
  return plan;
}

describe("setMonthlyIncome", () => {
  it("creates the single profile row", async () => {
    const db = freshDb();
    await setMonthlyIncome(db, INCOME_CENTS);
    expect(await db.profile.toArray()).toEqual([
      { id: PROFILE_ID, monthlyIncomeCents: INCOME_CENTS },
    ]);
  });

  it("updates the income and keeps the other profile fields", async () => {
    const db = freshDb();
    await db.profile.put({
      id: PROFILE_ID,
      monthlyIncomeCents: 1_000,
      demoNow: "2025-02-01",
      scenarioId: "level-4",
    });
    await setMonthlyIncome(db, INCOME_CENTS);
    expect(await db.profile.toArray()).toEqual([
      {
        id: PROFILE_ID,
        monthlyIncomeCents: INCOME_CENTS,
        demoNow: "2025-02-01",
        scenarioId: "level-4",
      },
    ]);
  });

  it("rejects an invalid income and leaves every table unchanged", async () => {
    const db = freshDb();
    const before = await dump(db);
    await expect(setMonthlyIncome(db, -1)).rejects.toBeInstanceOf(DbValidationError);
    expect(await dump(db)).toEqual(before);
  });
});

describe("addDebt and editDebt", () => {
  it("stores exactly one debt row with the injected id", async () => {
    const db = freshDb();
    const row = await addDebt(db, DEBT_INPUT, ctx());
    expect(row).toEqual({ id: "id-1", ...DEBT_INPUT });
    expect(await dump(db)).toEqual({
      profile: [],
      debts: [{ id: "id-1", ...DEBT_INPUT }],
      subscriptions: [],
      transactions: [],
      events: [],
      weeklyPlans: [],
    });
  });

  it("gives stable ids in order when the same generator is reused", async () => {
    const db = freshDb();
    const context = ctx();
    const first = await addDebt(db, DEBT_INPUT, context);
    const second = await addDebt(db, DEBT_INPUT, context);
    expect([first.id, second.id]).toEqual(["id-1", "id-2"]);
  });

  it("trims the name before storing", async () => {
    const db = freshDb();
    const row = await addDebt(db, { ...DEBT_INPUT, name: "  Card  " }, ctx());
    expect(row.name).toBe("Card");
  });

  it("rejects invalid debt input and leaves every table unchanged", async () => {
    const db = freshDb();
    const before = await dump(db);
    await expect(addDebt(db, { ...DEBT_INPUT, name: " " }, ctx())).rejects.toBeInstanceOf(
      DbValidationError,
    );
    await expect(addDebt(db, { ...DEBT_INPUT, apr: 2 }, ctx())).rejects.toBeInstanceOf(
      DbValidationError,
    );
    expect(await dump(db)).toEqual(before);
  });

  it("edits a debt in place and keeps its id", async () => {
    const db = freshDb();
    await addDebt(db, DEBT_INPUT, ctx());
    const edited = await editDebt(db, "id-1", { ...DEBT_INPUT, balanceCents: 90_000 });
    expect(edited).toEqual({ id: "id-1", ...DEBT_INPUT, balanceCents: 90_000 });
    expect(await db.debts.toArray()).toEqual([edited]);
  });

  it("rejects editing a missing debt and leaves every table unchanged", async () => {
    const db = freshDb();
    await addDebt(db, DEBT_INPUT, ctx());
    const before = await dump(db);
    await expect(editDebt(db, "missing", DEBT_INPUT)).rejects.toBeInstanceOf(DbNotFoundError);
    expect(await dump(db)).toEqual(before);
  });
});

describe("addSubscription, editSubscription and reactivateSubscription", () => {
  it("stores a new subscription as active with the injected id", async () => {
    const db = freshDb();
    const row = await addSubscription(db, { ...SUB_INPUT, active: false }, ctx());
    expect(row).toEqual({ id: "id-1", ...SUB_INPUT, active: true });
    expect(await db.subscriptions.toArray()).toEqual([row]);
  });

  it("rejects invalid subscription input and leaves every table unchanged", async () => {
    const db = freshDb();
    const before = await dump(db);
    await expect(
      addSubscription(db, { ...SUB_INPUT, amountCents: 0 }, ctx()),
    ).rejects.toBeInstanceOf(DbValidationError);
    expect(await dump(db)).toEqual(before);
  });

  it("edits details but keeps active and canceledOn", async () => {
    const db = freshDb();
    await db.subscriptions.add({
      id: "s1",
      ...SUB_INPUT,
      active: false,
      canceledOn: "2025-01-02",
    });
    const edited = await editSubscription(db, "s1", {
      ...SUB_INPUT,
      name: "Renamed",
      active: true,
    });
    expect(edited).toEqual({
      id: "s1",
      ...SUB_INPUT,
      name: "Renamed",
      active: false,
      canceledOn: "2025-01-02",
    });
    expect(await db.subscriptions.toArray()).toEqual([edited]);
  });

  it("rejects editing a missing subscription and leaves every table unchanged", async () => {
    const db = freshDb();
    const before = await dump(db);
    await expect(editSubscription(db, "missing", SUB_INPUT)).rejects.toBeInstanceOf(
      DbNotFoundError,
    );
    expect(await dump(db)).toEqual(before);
  });

  it("reactivates a canceled subscription and removes canceledOn", async () => {
    const db = freshDb();
    await db.subscriptions.add({
      id: "s1",
      ...SUB_INPUT,
      active: false,
      canceledOn: "2025-01-02",
    });
    const row = await reactivateSubscription(db, "s1");
    expect(row).toEqual({ id: "s1", ...SUB_INPUT, active: true });
    expect("canceledOn" in row).toBe(false);
    expect(await db.events.count()).toBe(0);
  });

  it("rejects reactivating a missing subscription", async () => {
    const db = freshDb();
    await expect(reactivateSubscription(db, "missing")).rejects.toBeInstanceOf(DbNotFoundError);
  });
});

describe("addTransaction", () => {
  it("stores exactly one transaction with the injected id", async () => {
    const db = freshDb();
    const row = await addTransaction(db, TX_INPUT, ctx());
    expect(row).toEqual({ id: "id-1", ...TX_INPUT });
    expect(await dump(db)).toEqual({
      profile: [],
      debts: [],
      subscriptions: [],
      transactions: [row],
      events: [],
      weeklyPlans: [],
    });
  });

  it("rejects a future date and leaves every table unchanged", async () => {
    const db = freshDb();
    const before = await dump(db);
    await expect(
      addTransaction(db, { ...TX_INPUT, date: "2025-01-09" }, ctx()),
    ).rejects.toBeInstanceOf(DbValidationError);
    expect(await dump(db)).toEqual(before);
  });
});

describe("logPayment", () => {
  async function seedDebt(db: CryptDb) {
    await db.debts.add({ id: "d1", ...DEBT_INPUT });
  }

  it("reduces the balance and adds one debt_payment event with the extra principal", async () => {
    const db = freshDb();
    await seedDebt(db);
    const outcome = await logPayment(db, "d1", 20_000, ctx());
    expect(outcome).toEqual({
      debt: { id: "d1", ...DEBT_INPUT, balanceCents: 80_000 },
      extraPrincipalCents: 15_000,
      completedActionId: null,
    });
    expect(await db.debts.toArray()).toEqual([outcome.debt]);
    expect(await db.events.toArray()).toEqual([
      { id: "id-1", type: "debt_payment", date: NOW, extraPrincipalCents: 15_000 },
    ]);
  });

  it("records zero extra principal when the payment is at or below the minimum", async () => {
    const db = freshDb();
    await seedDebt(db);
    const outcome = await logPayment(db, "d1", DEBT_INPUT.minimumPaymentCents, ctx());
    expect(outcome.extraPrincipalCents).toBe(0);
    expect(outcome.completedActionId).toBeNull();
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0].extraPrincipalCents).toBe(0);
  });

  it("completes the matching extra_payment plan action once, with one event", async () => {
    const db = freshDb();
    await seedDebt(db);
    await seedPlan(db, [
      planAction({ id: "a-extra", kind: "extra_payment", targetId: "d1" }),
      planAction({ id: "a-other", kind: "fallback" }),
    ]);
    const outcome = await logPayment(db, "d1", 20_000, ctx());
    expect(outcome.completedActionId).toBe("a-extra");
    const plan = await db.weeklyPlans.get(WEEK_KEY);
    expect(plan?.actions.map((a) => [a.id, a.done, a.completedOn])).toEqual([
      ["a-extra", true, NOW],
      ["a-other", false, undefined],
    ]);
    expect(await db.events.orderBy("type").keys()).toEqual([
      "debt_payment",
      "exorcism_action_completed",
    ]);
    const completed = await db.events.where("refKey").equals(`plan:${WEEK_KEY}:a-extra`).first();
    expect(completed).toEqual({
      id: "id-2",
      type: "exorcism_action_completed",
      date: NOW,
      refKey: `plan:${WEEK_KEY}:a-extra`,
    });
  });

  it("does not complete a plan action when the payment adds no extra principal", async () => {
    const db = freshDb();
    await seedDebt(db);
    const plan = await seedPlan(db, [
      planAction({ id: "a-extra", kind: "extra_payment", targetId: "d1" }),
    ]);
    await logPayment(db, "d1", 1_000, ctx());
    expect(await db.weeklyPlans.toArray()).toEqual([plan]);
    expect(await db.events.count()).toBe(1);
  });

  it("rejects an amount above the balance and leaves every table unchanged", async () => {
    const db = freshDb();
    await seedDebt(db);
    const before = await dump(db);
    await expect(logPayment(db, "d1", 100_001, ctx())).rejects.toBeInstanceOf(DbValidationError);
    await expect(logPayment(db, "d1", 0, ctx())).rejects.toBeInstanceOf(DbValidationError);
    expect(await dump(db)).toEqual(before);
  });

  it("rejects a missing debt and leaves every table unchanged", async () => {
    const db = freshDb();
    await seedDebt(db);
    const before = await dump(db);
    await expect(logPayment(db, "missing", 100, ctx())).rejects.toBeInstanceOf(DbNotFoundError);
    expect(await dump(db)).toEqual(before);
  });

  it("rolls back the balance and plan when the event write fails", async () => {
    const db = freshDb();
    await seedDebt(db);
    await seedPlan(db, [planAction({ id: "a-extra", kind: "extra_payment", targetId: "d1" })]);
    const before = await dump(db);
    vi.spyOn(db.events, "add").mockRejectedValueOnce(new Error("forced failure"));
    await expect(logPayment(db, "d1", 20_000, ctx())).rejects.toThrow();
    expect(await dump(db)).toEqual(before);
  });
});

describe("cancelSubscription", () => {
  async function seedSub(db: CryptDb, overrides: Partial<SubscriptionInput> = {}) {
    await db.subscriptions.add({ id: "s1", ...SUB_INPUT, ...overrides });
  }

  it("marks the subscription inactive and adds one subscription_canceled event", async () => {
    const db = freshDb();
    await seedSub(db);
    const outcome = await cancelSubscription(db, "s1", ctx());
    expect(outcome).toEqual({ changed: true, monthlySavedCents: 2_299, completedActionId: null });
    expect(await db.subscriptions.toArray()).toEqual([
      { id: "s1", ...SUB_INPUT, active: false, canceledOn: NOW },
    ]);
    expect(await db.events.toArray()).toEqual([
      {
        id: "id-1",
        type: "subscription_canceled",
        date: NOW,
        amountCents: 2_299,
        refKey: "cancel:s1",
      },
    ]);
  });

  it("stores the normalized monthly cost for a yearly subscription", async () => {
    const db = freshDb();
    await seedSub(db, { cadence: "yearly", amountCents: 12_000 });
    const outcome = await cancelSubscription(db, "s1", ctx());
    expect(outcome).toMatchObject({ changed: true, monthlySavedCents: 1_000 });
    const events = await db.events.toArray();
    expect(events[0].amountCents).toBe(1_000);
  });

  it("changes nothing when the subscription is already canceled", async () => {
    const db = freshDb();
    await seedSub(db);
    await cancelSubscription(db, "s1", ctx());
    const before = await dump(db);
    const outcome = await cancelSubscription(db, "s1", ctx());
    expect(outcome).toEqual({ changed: false });
    expect(await dump(db)).toEqual(before);
  });

  it("never creates a second cancel event after reactivating and canceling again", async () => {
    const db = freshDb();
    await seedSub(db);
    await cancelSubscription(db, "s1", ctx());
    await reactivateSubscription(db, "s1");
    const outcome = await cancelSubscription(db, "s1", { now: "2025-01-09", newId: ids() });
    expect(outcome).toMatchObject({ changed: true });
    expect(await db.events.where("type").equals("subscription_canceled").count()).toBe(1);
    const sub = await db.subscriptions.get("s1");
    expect(sub).toMatchObject({ active: false, canceledOn: "2025-01-09" });
  });

  it("completes the matching cancel_subscription plan action with one event", async () => {
    const db = freshDb();
    await seedSub(db);
    await seedPlan(db, [
      planAction({ id: "a-cancel", kind: "cancel_subscription", targetId: "s1" }),
    ]);
    const outcome = await cancelSubscription(db, "s1", ctx());
    expect(outcome).toMatchObject({ changed: true, completedActionId: "a-cancel" });
    const plan = await db.weeklyPlans.get(WEEK_KEY);
    expect(plan?.actions[0]).toMatchObject({ done: true, completedOn: NOW });
    expect((await db.events.toArray()).map((e) => e.type).sort()).toEqual([
      "exorcism_action_completed",
      "subscription_canceled",
    ]);
  });

  it("rejects a missing subscription and leaves every table unchanged", async () => {
    const db = freshDb();
    await seedSub(db);
    const before = await dump(db);
    await expect(cancelSubscription(db, "missing", ctx())).rejects.toBeInstanceOf(
      DbNotFoundError,
    );
    expect(await dump(db)).toEqual(before);
  });

  it("rolls back the subscription and plan when the event write fails", async () => {
    const db = freshDb();
    await seedSub(db);
    await seedPlan(db, [
      planAction({ id: "a-cancel", kind: "cancel_subscription", targetId: "s1" }),
    ]);
    const before = await dump(db);
    vi.spyOn(db.events, "add").mockRejectedValueOnce(new Error("forced failure"));
    await expect(cancelSubscription(db, "s1", ctx())).rejects.toThrow();
    expect(await dump(db)).toEqual(before);
  });
});

describe("completePlanAction and uncompletePlanAction", () => {
  it("marks the action done and adds one exorcism_action_completed event", async () => {
    const db = freshDb();
    await seedPlan(db, [planAction({ id: "a1" })]);
    await completePlanAction(db, WEEK_KEY, "a1", ctx());
    const plan = await db.weeklyPlans.get(WEEK_KEY);
    expect(plan?.actions).toEqual([planAction({ id: "a1", done: true, completedOn: NOW })]);
    expect(await db.events.toArray()).toEqual([
      {
        id: "id-1",
        type: "exorcism_action_completed",
        date: NOW,
        refKey: `plan:${WEEK_KEY}:a1`,
      },
    ]);
  });

  it("does not add another event or change completedOn when completed again", async () => {
    const db = freshDb();
    await seedPlan(db, [planAction({ id: "a1" })]);
    await completePlanAction(db, WEEK_KEY, "a1", ctx());
    const before = await dump(db);
    await completePlanAction(db, WEEK_KEY, "a1", { now: "2025-01-09", newId: ids() });
    expect(await dump(db)).toEqual(before);
  });

  it("keeps the event when an action is unchecked and checked again", async () => {
    const db = freshDb();
    await seedPlan(db, [planAction({ id: "a1" })]);
    await completePlanAction(db, WEEK_KEY, "a1", ctx());
    await uncompletePlanAction(db, WEEK_KEY, "a1");
    expect((await db.weeklyPlans.get(WEEK_KEY))?.actions[0].done).toBe(false);
    expect(await db.events.count()).toBe(1);
    await completePlanAction(db, WEEK_KEY, "a1", ctx());
    expect((await db.weeklyPlans.get(WEEK_KEY))?.actions[0].done).toBe(true);
    expect(await db.events.count()).toBe(1);
  });

  it("rejects a missing plan or action and leaves every table unchanged", async () => {
    const db = freshDb();
    await seedPlan(db, [planAction({ id: "a1" })]);
    const before = await dump(db);
    await expect(completePlanAction(db, "2024-12-30", "a1", ctx())).rejects.toBeInstanceOf(
      DbNotFoundError,
    );
    await expect(completePlanAction(db, WEEK_KEY, "nope", ctx())).rejects.toBeInstanceOf(
      DbNotFoundError,
    );
    await expect(uncompletePlanAction(db, WEEK_KEY, "nope")).rejects.toBeInstanceOf(
      DbNotFoundError,
    );
    await expect(uncompletePlanAction(db, "2024-12-30", "a1")).rejects.toBeInstanceOf(
      DbNotFoundError,
    );
    expect(await dump(db)).toEqual(before);
  });

  it("rolls back the plan when the event write fails", async () => {
    const db = freshDb();
    await seedPlan(db, [planAction({ id: "a1" })]);
    const before = await dump(db);
    vi.spyOn(db.events, "add").mockRejectedValueOnce(new Error("forced failure"));
    await expect(completePlanAction(db, WEEK_KEY, "a1", ctx())).rejects.toThrow();
    expect(await dump(db)).toEqual(before);
  });
});

describe("default id generation", () => {
  it("uses crypto.randomUUID when no newId is injected", async () => {
    const db = freshDb();
    const row = await addDebt(db, DEBT_INPUT, { now: NOW });
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
