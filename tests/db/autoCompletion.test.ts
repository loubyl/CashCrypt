// Auto-completion of plan actions by cancel and payment (Requirement 31.7).
// Each test opens a fresh fake-indexeddb crypt.
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import { cancelSubscription, completePlanAction, logPayment } from "@/lib/db/mutations";
import { PROFILE_ID, type CryptDb } from "@/lib/db/schema";
import type { DebtRow, StoredPlanAction, SubscriptionRow, WeeklyPlanRow } from "@/types/finance";

const idb = new IDBFactory();
const opened: CryptDb[] = [];
let counter = 0;

const NOW = "2025-01-08"; // a Wednesday
const WEEK_KEY = "2025-01-06"; // its Monday
const OTHER_WEEK_KEY = "2024-12-30";
const DEBT_ID = "debt-1";
const SUB_ID = "sub-1";
const MINIMUM_CENTS = 5000;
const BALANCE_CENTS = 100000;

function freshDb(): CryptDb {
  counter += 1;
  const db = openCrypt(`autocomplete-test-${counter}-${Math.random().toString(36).slice(2)}`, {
    indexedDB: idb,
    IDBKeyRange,
  });
  opened.push(db);
  return db;
}

afterEach(async () => {
  vi.restoreAllMocks();
  while (opened.length > 0) {
    await opened.pop()!.delete();
  }
});

function idGen(): () => string {
  let n = 0;
  return () => `id-${(n += 1)}`;
}

const debt: DebtRow = {
  id: DEBT_ID,
  name: "Card",
  balanceCents: BALANCE_CENTS,
  apr: 0.2,
  minimumPaymentCents: MINIMUM_CENTS,
};

const subscription: SubscriptionRow = {
  id: SUB_ID,
  name: "StreamMax",
  amountCents: 2299,
  cadence: "monthly",
  usage: "never",
  active: true,
};

function action(id: string, kind: StoredPlanAction["kind"], targetId: string): StoredPlanAction {
  return {
    id,
    kind,
    title: id,
    subtitle: "",
    targetId,
    monthlyAmountCents: 1000,
    priorityCents: 1000,
    done: false,
  };
}

function plan(weekKey: string): WeeklyPlanRow {
  return {
    weekKey,
    actions: [
      action("cancel-action", "cancel_subscription", SUB_ID),
      action("pay-action", "extra_payment", DEBT_ID),
    ],
    startLightScore: 40,
    generatedOn: weekKey,
  };
}

async function seed(planWeekKey?: string): Promise<CryptDb> {
  const db = freshDb();
  await db.profile.put({ id: PROFILE_ID, monthlyIncomeCents: 500000 });
  await db.debts.add(debt);
  await db.subscriptions.add(subscription);
  if (planWeekKey) await db.weeklyPlans.add(plan(planWeekKey));
  return db;
}

async function snapshot(db: CryptDb): Promise<unknown[]> {
  return Promise.all(db.tables.map((table) => table.toArray()));
}

async function completionEvents(db: CryptDb) {
  return db.events.where("type").equals("exorcism_action_completed").toArray();
}

describe("plan action auto-completion", () => {
  it("completes the cancel action when its subscription is canceled", async () => {
    const db = await seed(WEEK_KEY);
    const outcome = await cancelSubscription(db, SUB_ID, { now: NOW, newId: idGen() });

    expect(outcome).toMatchObject({ changed: true, completedActionId: "cancel-action" });
    const stored = (await db.weeklyPlans.get(WEEK_KEY))!;
    expect(stored.actions.find((a) => a.id === "cancel-action")).toMatchObject({
      done: true,
      completedOn: NOW,
    });
    expect(stored.actions.find((a) => a.id === "pay-action")?.done).toBe(false);
    const events = await completionEvents(db);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ date: NOW, refKey: `plan:${WEEK_KEY}:cancel-action` });
  });

  it("completes the extra payment action when the payment has extra principal", async () => {
    const db = await seed(WEEK_KEY);
    const outcome = await logPayment(db, DEBT_ID, MINIMUM_CENTS + 1, {
      now: NOW,
      newId: idGen(),
    });

    expect(outcome).toMatchObject({ extraPrincipalCents: 1, completedActionId: "pay-action" });
    const stored = (await db.weeklyPlans.get(WEEK_KEY))!;
    expect(stored.actions.find((a) => a.id === "pay-action")?.done).toBe(true);
    const events = await completionEvents(db);
    expect(events).toHaveLength(1);
    expect(events[0]?.refKey).toBe(`plan:${WEEK_KEY}:pay-action`);
  });

  it("does not complete the extra payment action when extra principal is 0", async () => {
    const db = await seed(WEEK_KEY);
    const outcome = await logPayment(db, DEBT_ID, MINIMUM_CENTS, { now: NOW, newId: idGen() });

    expect(outcome).toMatchObject({ extraPrincipalCents: 0, completedActionId: null });
    const stored = (await db.weeklyPlans.get(WEEK_KEY))!;
    expect(stored.actions.every((a) => !a.done)).toBe(true);
    expect(await completionEvents(db)).toHaveLength(0);
    expect(await db.events.where("type").equals("debt_payment").count()).toBe(1);
  });

  it("adds no second completion Event when the action was ticked first", async () => {
    const db = await seed(WEEK_KEY);
    const earlier = "2025-01-07";
    await completePlanAction(db, WEEK_KEY, "cancel-action", { now: earlier, newId: idGen() });
    await cancelSubscription(db, SUB_ID, { now: NOW, newId: () => "late-id" });

    const events = await completionEvents(db);
    expect(events).toHaveLength(1);
    expect(events[0]?.date).toBe(earlier);
    const stored = (await db.weeklyPlans.get(WEEK_KEY))!;
    expect(stored.actions.find((a) => a.id === "cancel-action")).toMatchObject({
      done: true,
      completedOn: earlier,
    });
  });

  it("completes nothing and generates no plan when no plan exists", async () => {
    const db = await seed();
    const newId = idGen();
    const cancel = await cancelSubscription(db, SUB_ID, { now: NOW, newId });
    const payment = await logPayment(db, DEBT_ID, MINIMUM_CENTS + 500, { now: NOW, newId });

    expect(cancel).toMatchObject({ changed: true, completedActionId: null });
    expect(payment.completedActionId).toBeNull();
    expect(await db.weeklyPlans.count()).toBe(0);
    expect(await completionEvents(db)).toHaveLength(0);
  });

  it("completes nothing for a plan of another week", async () => {
    const db = await seed(OTHER_WEEK_KEY);
    const before = await db.weeklyPlans.toArray();
    const newId = idGen();
    const cancel = await cancelSubscription(db, SUB_ID, { now: NOW, newId });
    const payment = await logPayment(db, DEBT_ID, MINIMUM_CENTS + 500, { now: NOW, newId });

    expect(cancel).toMatchObject({ changed: true, completedActionId: null });
    expect(payment.completedActionId).toBeNull();
    expect(await db.weeklyPlans.toArray()).toEqual(before);
    expect(await completionEvents(db)).toHaveLength(0);
  });

  it.each([
    ["cancelSubscription", (db: CryptDb) => cancelSubscription(db, SUB_ID, { now: NOW, newId: idGen() })],
    [
      "logPayment",
      (db: CryptDb) =>
        logPayment(db, DEBT_ID, MINIMUM_CENTS + 500, { now: NOW, newId: idGen() }),
    ],
  ])("rolls everything back when the completion Event write fails in %s", async (_name, run) => {
    const db = await seed(WEEK_KEY);
    const before = await snapshot(db);

    // The mutation's own Event is written first; only the completion Event fails.
    const originalAdd = db.events.add.bind(db.events);
    let calls = 0;
    vi.spyOn(db.events, "add").mockImplementation(((...args: Parameters<typeof originalAdd>) => {
      calls += 1;
      return calls === 1 ? originalAdd(...args) : Promise.reject(new Error("event write failed"));
    }) as typeof originalAdd);

    await expect(run(db)).rejects.toThrow("event write failed");
    expect(calls).toBe(2);
    expect(await snapshot(db)).toEqual(before);
  });
});
