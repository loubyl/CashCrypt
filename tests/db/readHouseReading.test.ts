// readHouseReading on the level-4 demo seed (fake-indexeddb).
// Measured table: action-feedback design.md, "Measured light".
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import {
  addTransaction,
  cancelSubscription,
  completePlanAction,
  logPayment,
  type MutationContext,
} from "@/lib/db/mutations";
import { readAllRows, readHouseReading } from "@/lib/db/queries";
import { DEMO_DB_NAME, type CryptDb } from "@/lib/db/schema";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { loadScenario } from "@/lib/demo/service";
import { computeHouseState } from "@/lib/haunting";

const NOW = "2025-06-02";
const DECIMALS = 3;
const ctx: MutationContext = { now: NOW };

let db: CryptDb;

beforeEach(async () => {
  db = openCrypt(DEMO_DB_NAME, { indexedDB: new IDBFactory(), IDBKeyRange });
  await loadScenario(db, "level-4", NOW);
});

afterEach(async () => {
  await db.delete();
});

async function light(): Promise<number> {
  return (await readHouseReading(db, NOW)).lightScore;
}

describe("readHouseReading", () => {
  it("equals the useHouseState path on the level-4 seed", async () => {
    const rows = await readAllRows(db);
    const state = computeHouseState(toFinancialSnapshot(rows, NOW));
    const reading = await readHouseReading(db, NOW);
    expect(reading.lightScore).toBe(state.lightScore);
    expect(reading.poltergeist).toBe(state.poltergeist !== null);
    expect(reading.poltergeist).toBe(true);
  });

  it("follows the measured level-4 table to 3 decimals", async () => {
    expect(await light()).toBeCloseTo(32.735, DECIMALS);

    await addTransaction(
      db,
      { description: "Coffee", category: "Coffee", amountCents: 800, date: NOW },
      ctx,
    );
    expect(await light()).toBeCloseTo(32.735, DECIMALS);

    const debts = await db.debts.toArray();
    const car = debts.find((d) => d.name === "Car loan")!;
    const card = debts.find((d) => d.name === "Scarlet Moth Card")!;
    await logPayment(db, car.id, car.minimumPaymentCents, ctx);
    expect(await light()).toBeCloseTo(32.847, DECIMALS);

    const wraithcast = (await db.subscriptions.toArray()).find((s) => s.name === "Wraithcast")!;
    await cancelSubscription(db, wraithcast.id, ctx);
    expect(await light()).toBeCloseTo(38.065, DECIMALS);

    const [plan] = await db.weeklyPlans.toArray();
    const coffee = plan.actions.find((a) => a.title.includes("Cut Coffee"))!;
    await completePlanAction(db, plan.weekKey, coffee.id, ctx);
    expect(await light()).toBeCloseTo(39.065, DECIMALS);

    const extraCents = 30000;
    await logPayment(db, card.id, card.minimumPaymentCents + extraCents, ctx);
    expect(await light()).toBeCloseTo(43.605, DECIMALS);
  });
});
