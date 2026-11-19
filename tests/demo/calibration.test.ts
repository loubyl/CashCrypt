// Feature: app-screens, Calibration_Path integration test (Requirements 17.8, 17.9, 17.10, 31.6).
// Runs level-4 through the real mutations and reports the engine numbers.
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import {
  cancelSubscription,
  completePlanAction,
  logPayment,
} from "@/lib/db/mutations";
import { ensureWeeklyPlan } from "@/lib/db/plans";
import { getPlan, readAllRows } from "@/lib/db/queries";
import { DEMO_DB_NAME, PROFILE_ID, type CryptDb } from "@/lib/db/schema";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { loadScenario, skipWeek } from "@/lib/demo/service";
import { computeHouseState } from "@/lib/haunting";
import type { LocalDate, WeeklyPlanRow } from "@/types/finance";

const START: LocalDate = "2025-06-02";
const ACTIONS_PER_WEEK = 3;
const REPORT_DECIMALS = 2;

const opened: CryptDb[] = [];
afterEach(() => {
  while (opened.length > 0) opened.pop()?.close();
});

type Reading = { light: number; base: number; momentum: number; level: number };

async function readHouse(db: CryptDb): Promise<Reading> {
  const rows = await readAllRows(db);
  const profile = await db.profile.get(PROFILE_ID);
  const now = profile?.demoNow ?? START;
  const house = computeHouseState(toFinancialSnapshot(rows, now));
  return {
    light: house.lightScore,
    base: house.baseScore,
    momentum: house.momentum,
    level: house.decayLevel,
  };
}

function format(label: string, r: Reading): string {
  const n = (x: number) => x.toFixed(REPORT_DECIMALS);
  return `${label}: light ${n(r.light)} / base ${n(r.base)} / momentum ${n(r.momentum)} / L${r.level}`;
}

async function playWeek(db: CryptDb, now: LocalDate): Promise<WeeklyPlanRow> {
  const plan = await ensureWeeklyPlan(db, now);
  const ctx = { now };
  for (const action of plan.actions) {
    if (action.kind === "cancel_subscription" && action.targetId) {
      await cancelSubscription(db, action.targetId, ctx);
    } else if (action.kind === "extra_payment" && action.targetId) {
      const debt = await db.debts.get(action.targetId);
      if (!debt) throw new Error(`Debt ${action.targetId} is missing.`);
      await logPayment(
        db,
        debt.id,
        debt.minimumPaymentCents + (action.suggestedAmountCents ?? 0),
        ctx,
      );
    }
  }
  const afterMutations = await getPlan(db, plan.weekKey);
  for (const action of afterMutations?.actions ?? []) {
    if (!action.done) await completePlanAction(db, plan.weekKey, action.id, ctx);
  }
  const final = await getPlan(db, plan.weekKey);
  if (!final) throw new Error("The weekly plan disappeared.");
  return final;
}

describe("Calibration_Path on level-4", () => {
  it("improves the decay level over two weeks and completes three actions per week", async () => {
    const db = openCrypt(DEMO_DB_NAME, { indexedDB: new IDBFactory(), IDBKeyRange });
    opened.push(db);
    await db.open();
    await loadScenario(db, "level-4", START);

    const start = await readHouse(db);

    const week1 = await playWeek(db, START);
    const afterWeek1 = await readHouse(db);

    const week2Start = await skipWeek(db);
    const week2 = await playWeek(db, week2Start);
    const afterWeek2 = await readHouse(db);

    console.log(
      [
        "Calibration_Path report (level-4)",
        format("start      ", start),
        format("after wk 1 ", afterWeek1),
        format("after wk 2 ", afterWeek2),
      ].join("\n"),
    );

    for (const plan of [week1, week2]) {
      expect(plan.actions).toHaveLength(ACTIONS_PER_WEEK);
      expect(plan.actions.every((a) => a.done)).toBe(true);
      const events = await db.events
        .filter((e) => e.type === "exorcism_action_completed")
        .toArray();
      const forWeek = events.filter((e) => e.refKey?.startsWith(`plan:${plan.weekKey}:`));
      expect(forWeek).toHaveLength(ACTIONS_PER_WEEK);
    }
    expect(week2.weekKey).not.toBe(week1.weekKey);

    expect(afterWeek2.level).toBeLessThan(start.level);
  });
});
