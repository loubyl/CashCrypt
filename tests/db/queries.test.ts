// readAllRows against fake-indexeddb. Each test uses a fresh database name.
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import { setMonthlyIncome } from "@/lib/db/mutations";
import { readAllRows } from "@/lib/db/queries";
import type { CryptDb } from "@/lib/db/schema";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";

const idb = new IDBFactory();
const opened: CryptDb[] = [];
let counter = 0;
const NOW = "2025-01-08";
const INCOME_CENTS = 500_000;

function freshDb(): CryptDb {
  counter += 1;
  const db = openCrypt(`queries-test-${counter}`, { indexedDB: idb, IDBKeyRange });
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await db.delete();
  }
});

describe("readAllRows", () => {
  it("returns a null profile and empty tables, without throwing, when no profile row exists", async () => {
    const db = freshDb();
    await expect(readAllRows(db)).resolves.toEqual({
      profile: null,
      debts: [],
      subscriptions: [],
      transactions: [],
      events: [],
      plans: [],
    });
  });

  it("returns the stored profile without its fixed id", async () => {
    const db = freshDb();
    await setMonthlyIncome(db, INCOME_CENTS);
    const rows = await readAllRows(db);
    expect(rows.profile).toEqual({ monthlyIncomeCents: INCOME_CENTS });
  });

  it("feeds a crypt without a profile to the snapshot adapter as income 0", async () => {
    const db = freshDb();
    const snapshot = toFinancialSnapshot(await readAllRows(db), NOW);
    expect(snapshot.monthlyIncome).toBe(0);
  });
});
