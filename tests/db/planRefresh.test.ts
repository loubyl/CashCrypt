// Plan refresh for new crypts (action-feedback Requirement 17.3 to 17.5), against fake-indexeddb.
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import {
  addDebt,
  addSubscription,
  addTransaction,
  completePlanAction,
  editDebt,
  editSubscription,
  setMonthlyIncome,
  type MutationContext,
} from "@/lib/db/mutations";
import { ensureWeeklyPlan } from "@/lib/db/plans";
import type { CryptDb } from "@/lib/db/schema";
import type { DebtInput, SubscriptionInput, TransactionInput, WeeklyPlanRow } from "@/types/finance";

const idb = new IDBFactory();
const opened: CryptDb[] = [];
let counter = 0;
const NOW = "2025-01-08"; // Wednesday
const WEEK_KEY = "2025-01-06";
const INCOME_CENTS = 300_000;
const FALLBACK_ID = "fallback:emergency-fund";

const DEBT_INPUT: DebtInput = { name: "Card", balanceCents: 120_000, apr: 0.2, minimumPaymentCents: 5_000 };
const PAID_OFF_DEBT: DebtInput = { ...DEBT_INPUT, balanceCents: 0 };
const SUB_INPUT: SubscriptionInput = {
  name: "StreamMax",
  amountCents: 2_299,
  cadence: "monthly",
  usage: "never",
  active: true,
};

let idCounter = 0;
function ctx(): MutationContext {
  return { now: NOW, newId: () => `id-${(idCounter += 1)}` };
}

async function freshCrypt(): Promise<CryptDb> {
  counter += 1;
  const db = openCrypt(`refresh-${counter}`, { indexedDB: idb, IDBKeyRange });
  opened.push(db);
  await setMonthlyIncome(db, INCOME_CENTS);
  return db;
}

const kindsOf = (plan: WeeklyPlanRow | undefined): string[] => (plan?.actions ?? []).map((a) => a.kind);
const planOf = (db: CryptDb): Promise<WeeklyPlanRow | undefined> => db.weeklyPlans.get(WEEK_KEY);

afterEach(async () => {
  while (opened.length > 0) await opened.pop()!.delete();
});

describe("plan refresh for new crypts", () => {
  it("starts with fallback actions only", async () => {
    const db = await freshCrypt();
    await ensureWeeklyPlan(db, NOW);
    expect(kindsOf(await planOf(db))).toEqual(["fallback", "fallback", "fallback"]);
  });

  it("regenerates the plan when a debt is added", async () => {
    const db = await freshCrypt();
    await ensureWeeklyPlan(db, NOW);
    const debt = await addDebt(db, DEBT_INPUT, ctx());
    const plan = await planOf(db);
    expect(kindsOf(plan)).toContain("extra_payment");
    expect(plan?.actions.find((a) => a.kind === "extra_payment")?.targetId).toBe(debt.id);
    expect(plan?.actions).toHaveLength(3);
    expect(plan?.actions.every((a) => !a.done)).toBe(true);
    expect(await db.weeklyPlans.count()).toBe(1);
  });

  it("regenerates the plan when a subscription is added", async () => {
    const db = await freshCrypt();
    await ensureWeeklyPlan(db, NOW);
    await addSubscription(db, SUB_INPUT, ctx());
    expect(kindsOf(await planOf(db))).toContain("cancel_subscription");
  });

  it("regenerates the plan when a transaction makes a Poltergeist", async () => {
    const db = await freshCrypt();
    await ensureWeeklyPlan(db, NOW);
    for (let index = 0; index < 25; index += 1) {
      await addTransaction(
        db,
        { amountCents: 1_400, description: `Coffee ${index}`, category: "Coffee", date: NOW } as TransactionInput,
        ctx(),
      );
    }
    expect(kindsOf(await planOf(db))).toContain("reduce_small_expenses");
  });

  it("regenerates the plan when an edit gives a paid-off debt a balance", async () => {
    const db = await freshCrypt();
    const debt = await addDebt(db, PAID_OFF_DEBT, ctx());
    await ensureWeeklyPlan(db, NOW);
    expect(kindsOf(await planOf(db))).not.toContain("extra_payment");
    await editDebt(db, debt.id, DEBT_INPUT, ctx());
    expect(kindsOf(await planOf(db))).toContain("extra_payment");
  });

  it("regenerates the plan when an edit makes a subscription worth canceling", async () => {
    const db = await freshCrypt();
    const sub = await addSubscription(db, { ...SUB_INPUT, active: false }, ctx());
    await db.subscriptions.put({ ...sub, active: false, canceledOn: NOW });
    await ensureWeeklyPlan(db, NOW);
    expect(kindsOf(await planOf(db))).not.toContain("cancel_subscription");
    await db.subscriptions.put({ ...sub, active: true });
    await editSubscription(db, sub.id, { ...SUB_INPUT, amountCents: 3_000 }, ctx());
    expect(kindsOf(await planOf(db))).toContain("cancel_subscription");
  });

  it("does not regenerate a plan that already has a real action", async () => {
    const db = await freshCrypt();
    await ensureWeeklyPlan(db, NOW);
    await addDebt(db, DEBT_INPUT, ctx());
    const before = await planOf(db);
    await addSubscription(db, SUB_INPUT, ctx());
    await addDebt(db, { ...DEBT_INPUT, name: "Second", balanceCents: 900_000 }, ctx());
    expect(await planOf(db)).toEqual(before);
  });

  it("does not regenerate a fallback-only plan when any action is done", async () => {
    const db = await freshCrypt();
    await ensureWeeklyPlan(db, NOW);
    await completePlanAction(db, WEEK_KEY, FALLBACK_ID, ctx());
    const before = await planOf(db);
    await addDebt(db, DEBT_INPUT, ctx());
    await addSubscription(db, SUB_INPUT, ctx());
    expect(await planOf(db)).toEqual(before);
    expect(kindsOf(await planOf(db))).toEqual(["fallback", "fallback", "fallback"]);
  });

  it("never creates a plan and never touches another week's plan", async () => {
    const db = await freshCrypt();
    await addDebt(db, DEBT_INPUT, ctx());
    expect(await db.weeklyPlans.count()).toBe(0);
    const oldPlan: WeeklyPlanRow = {
      weekKey: "2024-12-30",
      actions: [],
      startLightScore: 50,
      generatedOn: "2024-12-30",
    };
    await db.weeklyPlans.put(oldPlan);
    await addSubscription(db, SUB_INPUT, ctx());
    expect(await db.weeklyPlans.get("2024-12-30")).toEqual(oldPlan);
  });

  it("leaves the plan as it was when the input is invalid", async () => {
    const db = await freshCrypt();
    await ensureWeeklyPlan(db, NOW);
    const before = await planOf(db);
    await expect(addDebt(db, { ...DEBT_INPUT, name: " " }, ctx())).rejects.toThrow();
    expect(await planOf(db)).toEqual(before);
  });
});
