// Schema tests against fake-indexeddb. Each test uses a fresh database name.
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { assertDemoDb, assertRealDb, openCrypt } from "@/lib/db/crypt";
import {
  CRYPT_DB_NAME,
  DEMO_DB_NAME,
  PROFILE_ID,
  type CryptDb,
} from "@/lib/db/schema";
import type { WeeklyPlanRow } from "@/types/finance";

const idb = new IDBFactory();
const opened: CryptDb[] = [];
let counter = 0;

function freshDb(): CryptDb {
  counter += 1;
  const db = openCrypt(`schema-test-${counter}-${Math.random().toString(36).slice(2)}`, {
    indexedDB: idb,
    IDBKeyRange,
  });
  opened.push(db);
  return db;
}

afterEach(async () => {
  while (opened.length > 0) {
    const db = opened.pop()!;
    await db.delete();
  }
});

function plan(weekKey: string): WeeklyPlanRow {
  return { weekKey, actions: [], startLightScore: 50, generatedOn: "2025-01-06" };
}

describe("crypt database schema", () => {
  it("creates every expected table", async () => {
    const db = freshDb();
    await db.open();
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      ["debts", "events", "profile", "subscriptions", "transactions", "weeklyPlans"],
    );
  });

  it("indexes transactions by date", async () => {
    const db = freshDb();
    await db.open();
    expect(db.transactions.schema.idxByName.date).toBeDefined();
  });

  it("indexes events by date and by a unique refKey", async () => {
    const db = freshDb();
    await db.open();
    expect(db.events.schema.idxByName.date).toBeDefined();
    expect(db.events.schema.idxByName.refKey?.unique).toBe(true);
  });

  it("uses weekKey as the primary key of weeklyPlans", async () => {
    const db = freshDb();
    await db.open();
    expect(db.weeklyPlans.schema.primKey.keyPath).toBe("weekKey");
  });

  it("stores the single profile row under PROFILE_ID", async () => {
    const db = freshDb();
    await db.profile.put({ id: PROFILE_ID, monthlyIncomeCents: 500000 });
    expect((await db.profile.get(PROFILE_ID))?.monthlyIncomeCents).toBe(500000);
  });

  it("rejects a second weekly plan with the same weekKey", async () => {
    const db = freshDb();
    await db.weeklyPlans.add(plan("2025-W02"));
    await expect(db.weeklyPlans.add(plan("2025-W02"))).rejects.toThrow();
    expect(await db.weeklyPlans.count()).toBe(1);
  });

  it("rejects a second event with the same refKey", async () => {
    const db = freshDb();
    await db.events.add({ id: "e1", type: "subscription_canceled", date: "2025-01-06", refKey: "sub-1" });
    await expect(
      db.events.add({ id: "e2", type: "subscription_canceled", date: "2025-01-07", refKey: "sub-1" }),
    ).rejects.toThrow();
    expect(await db.events.count()).toBe(1);
  });

  it("allows many debt_payment events without a refKey", async () => {
    const db = freshDb();
    for (let i = 0; i < 5; i += 1) {
      await db.events.add({ id: `p${i}`, type: "debt_payment", date: "2025-01-06", extraPrincipalCents: 100 });
    }
    expect(await db.events.count()).toBe(5);
  });
});

describe("database names", () => {
  it("uses different names for the real and demo databases", () => {
    expect(CRYPT_DB_NAME).toBe("cashcrypt");
    expect(DEMO_DB_NAME).toBe("cashcrypt-demo");
    expect(CRYPT_DB_NAME).not.toBe(DEMO_DB_NAME);
  });

  it("assertDemoDb accepts the demo database and rejects the real one", () => {
    const demo = openCrypt(DEMO_DB_NAME, { indexedDB: idb, IDBKeyRange });
    const real = openCrypt(CRYPT_DB_NAME, { indexedDB: idb, IDBKeyRange });
    expect(() => assertDemoDb(demo)).not.toThrow();
    expect(() => assertDemoDb(real)).toThrow();
  });

  it("assertRealDb accepts the real database and rejects the demo one", () => {
    const demo = openCrypt(DEMO_DB_NAME, { indexedDB: idb, IDBKeyRange });
    const real = openCrypt(CRYPT_DB_NAME, { indexedDB: idb, IDBKeyRange });
    expect(() => assertRealDb(real)).not.toThrow();
    expect(() => assertRealDb(demo)).toThrow();
  });
});
