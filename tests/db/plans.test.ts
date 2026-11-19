// Weekly plan service: generation, storage once per week, completion toggles.
// Each test opens a fresh fake-indexeddb crypt.
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import { completePlanAction, uncompletePlanAction } from "@/lib/db/mutations";
import { ensureWeeklyPlan } from "@/lib/db/plans";
import { readAllRows } from "@/lib/db/queries";
import { PROFILE_ID, type CryptDb } from "@/lib/db/schema";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { generateExorcismPlan } from "@/lib/exorcism";
import { computeHouseState } from "@/lib/haunting";
import type { DebtRow, SubscriptionRow } from "@/types/finance";

vi.mock("@/lib/exorcism", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/exorcism")>();
  return { ...original, generateExorcismPlan: vi.fn(original.generateExorcismPlan) };
});

const idb = new IDBFactory();
const opened: CryptDb[] = [];
let counter = 0;

const NOW = "2025-01-08"; // a Wednesday
const WEEK_KEY = "2025-01-06"; // its Monday
const NEXT_NOW = "2025-01-15"; // Wednesday of the next week
const NEXT_WEEK_KEY = "2025-01-13";
const PLAN_SIZE = 3;

const debt: DebtRow = {
  id: "debt-1",
  name: "Card",
  balanceCents: 400000,
  apr: 0.2,
  minimumPaymentCents: 10000,
};

const subscription: SubscriptionRow = {
  id: "sub-1",
  name: "StreamMax",
  amountCents: 2299,
  cadence: "monthly",
  usage: "never",
  active: true,
};

async function seededDb(): Promise<CryptDb> {
  counter += 1;
  const db = openCrypt(`plans-test-${counter}-${Math.random().toString(36).slice(2)}`, {
    indexedDB: idb,
    IDBKeyRange,
  });
  opened.push(db);
  await db.profile.put({ id: PROFILE_ID, monthlyIncomeCents: 500000 });
  await db.debts.add(debt);
  await db.subscriptions.add(subscription);
  return db;
}

afterEach(async () => {
  vi.mocked(generateExorcismPlan).mockClear();
  while (opened.length > 0) {
    await opened.pop()!.delete();
  }
});

describe("ensureWeeklyPlan", () => {
  it("generates three actions with the current light score as startLightScore", async () => {
    const db = await seededDb();
    const expected = computeHouseState(
      toFinancialSnapshot(await readAllRows(db), NOW),
    ).lightScore;

    const row = await ensureWeeklyPlan(db, NOW);

    expect(row.weekKey).toBe(WEEK_KEY);
    expect(row.generatedOn).toBe(NOW);
    expect(row.actions).toHaveLength(PLAN_SIZE);
    expect(row.actions.every((a) => a.done === false)).toBe(true);
    expect(row.startLightScore).toBe(expected);
    expect(await db.weeklyPlans.get(WEEK_KEY)).toEqual(row);
  });

  it("returns the same stored row on a second read without calling the planner", async () => {
    const db = await seededDb();
    const first = await ensureWeeklyPlan(db, NOW);
    expect(generateExorcismPlan).toHaveBeenCalledTimes(1);

    const second = await ensureWeeklyPlan(db, "2025-01-10");

    expect(second).toEqual(first);
    expect(generateExorcismPlan).toHaveBeenCalledTimes(1);
    expect(await db.weeklyPlans.count()).toBe(1);
  });

  it("keeps the creation-time startLightScore after data changes mid-week", async () => {
    const db = await seededDb();
    const first = await ensureWeeklyPlan(db, NOW);
    const lightScoreAt = async (date: string) =>
      computeHouseState(toFinancialSnapshot(await readAllRows(db), date)).lightScore;
    expect(first.startLightScore).toBe(await lightScoreAt(NOW));

    await db.debts.update(debt.id, { balanceCents: 100000 });
    await db.subscriptions.update(subscription.id, { active: false, canceledOn: "2025-01-09" });
    const changedScore = await lightScoreAt("2025-01-10");
    expect(changedScore).not.toBe(first.startLightScore);

    const second = await ensureWeeklyPlan(db, "2025-01-10");

    expect(second).toEqual(first);
    expect(second.startLightScore).toBe(first.startLightScore);
    expect(await db.weeklyPlans.get(WEEK_KEY)).toEqual(first);
    expect(generateExorcismPlan).toHaveBeenCalledTimes(1);
  });

  it("generates a new row on a new Monday and keeps the old one", async () => {
    const db = await seededDb();
    const first = await ensureWeeklyPlan(db, NOW);

    const next = await ensureWeeklyPlan(db, NEXT_NOW);

    expect(next.weekKey).toBe(NEXT_WEEK_KEY);
    expect(await db.weeklyPlans.count()).toBe(2);
    expect(await db.weeklyPlans.get(WEEK_KEY)).toEqual(first);
    expect(generateExorcismPlan).toHaveBeenCalledTimes(2);
  });
});

describe("plan action completion", () => {
  it("completing and unchecking change only that action", async () => {
    const db = await seededDb();
    const before = await ensureWeeklyPlan(db, NOW);
    const [target, ...others] = before.actions;

    await completePlanAction(db, WEEK_KEY, target.id, { now: NOW, newId: () => "event-1" });
    const completed = (await db.weeklyPlans.get(WEEK_KEY))!;
    expect(completed.actions[0]).toEqual({ ...target, done: true, completedOn: NOW });
    expect(completed.actions.slice(1)).toEqual(others);
    expect({ ...completed, actions: [] }).toEqual({ ...before, actions: [] });

    await uncompletePlanAction(db, WEEK_KEY, target.id);
    const unchecked = (await db.weeklyPlans.get(WEEK_KEY))!;
    expect(unchecked.actions[0].done).toBe(false);
    expect(unchecked.actions[0]).toEqual({ ...target, done: false });
    expect("completedOn" in unchecked.actions[0]).toBe(false);
    expect(unchecked.actions.slice(1)).toEqual(others);
    expect({ ...unchecked, actions: [] }).toEqual({ ...before, actions: [] });
  });
});
