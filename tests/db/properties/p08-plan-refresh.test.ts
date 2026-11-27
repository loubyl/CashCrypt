// Feature: action-feedback, Property 8: Only a fallback-only plan with nothing done is refreshed
// Validates: Requirements 17.3, 17.4, 17.5
import fc from "fast-check";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import {
  addDebt,
  addSubscription,
  addTransaction,
  completePlanAction,
  editDebt,
  setMonthlyIncome,
} from "@/lib/db/mutations";
import { ensureWeeklyPlan } from "@/lib/db/plans";
import type { CryptDb } from "@/lib/db/schema";
import type { WeeklyPlanRow } from "@/types/finance";

const NUM_RUNS = 100;
const NOW = "2025-01-08";
const WEEK_KEY = "2025-01-06";
const INCOME_CENTS = 300_000;
const MAX_OPS = 8;
const idb = new IDBFactory();
let dbCounter = 0;
let idCounter = 0;

type Op = "addDebt" | "addSubscription" | "addTransaction" | "editDebt" | "tickFallback" | "tickReal";
const opArb = fc.constantFrom<Op>("addDebt", "addSubscription", "addTransaction", "editDebt", "tickFallback", "tickReal");

const isFallbackOnly = (plan: WeeklyPlanRow): boolean => plan.actions.every((a) => a.kind === "fallback");
const anyDone = (plan: WeeklyPlanRow): boolean => plan.actions.some((a) => a.done);

async function applyOp(db: CryptDb, op: Op, plan: WeeklyPlanRow): Promise<void> {
  const ctx = { now: NOW, newId: () => `id-${(idCounter += 1)}` };
  switch (op) {
    case "addDebt":
      await addDebt(db, { name: "Card", balanceCents: 100_000, apr: 0.2, minimumPaymentCents: 4_000 }, ctx);
      return;
    case "addSubscription":
      await addSubscription(
        db,
        { name: "Stream", amountCents: 1_500, cadence: "monthly", usage: "never", active: true },
        ctx,
      );
      return;
    case "addTransaction":
      await addTransaction(db, { amountCents: 800, description: "Snack", category: "Food", date: NOW }, ctx);
      return;
    case "editDebt": {
      const debt = (await db.debts.toArray())[0];
      if (debt) await editDebt(db, debt.id, { ...debt, balanceCents: debt.balanceCents + 1_000 }, ctx);
      return;
    }
    case "tickFallback": {
      const target = plan.actions.find((a) => a.kind === "fallback");
      if (target) await completePlanAction(db, WEEK_KEY, target.id, ctx);
      return;
    }
    case "tickReal": {
      const target = plan.actions.find((a) => a.kind !== "fallback");
      if (target) await completePlanAction(db, WEEK_KEY, target.id, ctx);
      return;
    }
  }
}

describe("plan refresh", () => {
  // Feature: action-feedback, Property 8: Only a fallback-only plan with nothing done is refreshed
  it("never changes a plan that has a real action or a done action, and keeps one plan with three actions", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { maxLength: MAX_OPS }), async (ops) => {
        dbCounter += 1;
        const db = openCrypt(`p08-${dbCounter}`, { indexedDB: idb, IDBKeyRange });
        try {
          await setMonthlyIncome(db, INCOME_CENTS);
          await ensureWeeklyPlan(db, NOW);
          for (const op of ops) {
            const before = (await db.weeklyPlans.get(WEEK_KEY)) as WeeklyPlanRow;
            await applyOp(db, op, before);
            const after = (await db.weeklyPlans.get(WEEK_KEY)) as WeeklyPlanRow;
            const mayRefresh = isFallbackOnly(before) && !anyDone(before);
            const isDataOp = op !== "tickFallback" && op !== "tickReal";
            if (isDataOp && !mayRefresh) expect(after).toEqual(before);
            expect(after.actions).toHaveLength(3);
            expect(await db.weeklyPlans.count()).toBe(1);
          }
        } finally {
          await db.delete();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  }, 120_000);
});
