// Cancellation momentum only counts while the subscription stays canceled
// (Requirements 4.4, 4.5, 7.6), with the level-4 demo numbers: Dirgebox costs
// $60/mo on $3,000/mo income, so its cancellation adds 100 × 6000 / 300000 = 2.
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import { cancelSubscription, reactivateSubscription } from "@/lib/db/mutations";
import { readAllRows } from "@/lib/db/queries";
import { DEMO_DB_NAME, type CryptDb } from "@/lib/db/schema";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { loadScenario } from "@/lib/demo/service";
import { computeHouseState } from "@/lib/haunting";
import { addDays } from "@/lib/utils/calendar";

const START = "2025-06-02";
const REVIVED_ON = addDays(START, 1);
const RECANCELED_ON = addDays(START, 3);
// One evaluation date for every reading: all three dates are inside its 30-day window.
const EVALUATED_ON = RECANCELED_ON;
const DIRGEBOX_MOMENTUM = 2;
const DECIMALS = 6;

const opened: CryptDb[] = [];
afterEach(() => {
  while (opened.length > 0) opened.pop()?.close();
});

async function momentum(db: CryptDb): Promise<number> {
  return computeHouseState(toFinancialSnapshot(await readAllRows(db), EVALUATED_ON)).momentum;
}

describe("Dirgebox on the level-4 demo", () => {
  it("adds +2 momentum when canceled, loses it when brought back, and regains it with the original event", async () => {
    const db = openCrypt(DEMO_DB_NAME, { indexedDB: new IDBFactory(), IDBKeyRange });
    opened.push(db);
    await db.open();
    await loadScenario(db, "level-4", START);
    const dirgebox = (await db.subscriptions.toArray()).find((s) => s.name === "Dirgebox");
    if (!dirgebox) throw new Error("Dirgebox is missing from the level-4 seed.");
    const before = await momentum(db);

    await cancelSubscription(db, dirgebox.id, { now: START });
    expect((await momentum(db)) - before).toBeCloseTo(DIRGEBOX_MOMENTUM, DECIMALS);

    await reactivateSubscription(db, dirgebox.id, { now: REVIVED_ON });
    expect(await momentum(db)).toBeCloseTo(before, DECIMALS);
    const afterRevive = await db.events.where("type").equals("subscription_canceled").toArray();
    expect(afterRevive).toHaveLength(1);

    await cancelSubscription(db, dirgebox.id, { now: RECANCELED_ON });
    expect((await momentum(db)) - before).toBeCloseTo(DIRGEBOX_MOMENTUM, DECIMALS);
    const events = await db.events.where("type").equals("subscription_canceled").toArray();
    expect(events).toHaveLength(1);
    expect(events[0]?.date).toBe(START);
  });
});
