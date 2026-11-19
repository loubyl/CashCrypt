import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { openCrypt } from "@/lib/db/crypt";
import { getTransactionsInWindow } from "@/lib/db/queries";
import { isInWindow } from "@/lib/haunting/dates";
import type { TransactionRow } from "@/types/finance";

const NUM_RUNS = 100;
const MS_PER_DAY = 86_400_000;
const MIN_OFFSET_DAYS = -40;
const MAX_OFFSET_DAYS = 5;
const MAX_TRANSACTIONS = 25;
const MAX_CENTS = 1_000_000;

// "now" values around year, leap-day and month boundaries.
const NOW_ANCHORS = [
  "2024-01-15",
  "2024-02-29",
  "2024-03-01",
  "2024-03-30",
  "2025-01-01",
  "2025-01-20",
  "2025-03-01",
  "2025-12-31",
  "2100-03-01",
  "2000-03-01",
];

let counter = 0;

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

const idArb = fc.stringMatching(/^[A-Za-z0-9_-]{1,4}$/);

const scenarioArb = fc
  .record({
    now: fc.constantFrom(...NOW_ANCHORS),
    offsets: fc.array(
      fc.record({
        offset: fc.integer({ min: MIN_OFFSET_DAYS, max: MAX_OFFSET_DAYS }),
        id: idArb,
        amountCents: fc.integer({ min: 1, max: MAX_CENTS }),
      }),
      { maxLength: MAX_TRANSACTIONS },
    ),
  })
  .map(({ now, offsets }) => {
    const seen = new Set<string>();
    const transactions: TransactionRow[] = [];
    for (const o of offsets) {
      if (seen.has(o.id)) continue; // ids are primary keys
      seen.add(o.id);
      transactions.push({
        id: o.id,
        amountCents: o.amountCents,
        description: "tx",
        category: "other",
        date: shiftDate(now, o.offset),
      });
    }
    return { now, transactions };
  });

function expectedOrder(a: TransactionRow, b: TransactionRow): number {
  if (a.date !== b.date) return a.date > b.date ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

describe("transaction window query", () => {
  // Feature: app-screens, Property 14: The 30-day transaction query matches the engine window
  // **Validates: Requirements 9.7**
  it("returns exactly the transactions inside the engine window, sorted by date descending then id ascending", async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ now, transactions }) => {
        const db = openCrypt(`test-${(counter += 1)}`, { indexedDB, IDBKeyRange });
        try {
          await db.open();
          await db.transactions.bulkPut(transactions);

          const result = await getTransactionsInWindow(db, now);

          const expected = transactions
            .filter((t) => isInWindow(t.date, now))
            .sort(expectedOrder);
          expect(result).toEqual(expected);
        } finally {
          db.close();
          await db.delete();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
