// Fallback plan actions add no momentum (action-feedback Requirement 17.1 and 17.2).
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import { completePlanAction, setMonthlyIncome } from "@/lib/db/mutations";
import { ensureWeeklyPlan } from "@/lib/db/plans";
import { readAllRows, readHouseReading } from "@/lib/db/queries";
import type { CryptDb } from "@/lib/db/schema";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { computeHouseState } from "@/lib/haunting";

const idb = new IDBFactory();
const opened: CryptDb[] = [];
let counter = 0;
const NOW = "2025-01-08";
const WEEK_KEY = "2025-01-06";
const INCOME_CENTS = 300_000;

afterEach(async () => {
  while (opened.length > 0) await opened.pop()!.delete();
});

async function newCrypt(): Promise<CryptDb> {
  counter += 1;
  const db = openCrypt(`fallback-${counter}`, { indexedDB: idb, IDBKeyRange });
  opened.push(db);
  await setMonthlyIncome(db, INCOME_CENTS);
  await ensureWeeklyPlan(db, NOW);
  return db;
}

describe("completing a fallback plan action", () => {
  it("marks it done and stores its Event, but the light score and momentum do not change", async () => {
    const db = await newCrypt();
    const before = await readHouseReading(db, NOW);
    const plan = (await db.weeklyPlans.get(WEEK_KEY))!;
    const fallbackIds = plan.actions.filter((a) => a.kind === "fallback").map((a) => a.id);
    expect(fallbackIds).toHaveLength(3);
    for (const [index, id] of fallbackIds.entries()) {
      await completePlanAction(db, WEEK_KEY, id, { now: NOW, newId: () => `ev-${index}` });
    }
    const stored = (await db.weeklyPlans.get(WEEK_KEY))!;
    expect(stored.actions.every((a) => a.done)).toBe(true);
    expect(await db.events.where("type").equals("exorcism_action_completed").count()).toBe(3);
    expect((await readHouseReading(db, NOW)).lightScore).toBe(before.lightScore);
    const state = computeHouseState(toFinancialSnapshot(await readAllRows(db), NOW));
    expect(state.momentum).toBe(0);
  });

  it("still counts a completed real action", async () => {
    const db = await newCrypt();
    await db.events.add({
      id: "real",
      type: "exorcism_action_completed",
      date: NOW,
      refKey: `plan:${WEEK_KEY}:cancel:sub-1`,
    });
    const state = computeHouseState(toFinancialSnapshot(await readAllRows(db), NOW));
    expect(state.momentum).toBeGreaterThan(0);
  });
});
