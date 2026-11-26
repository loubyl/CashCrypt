import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { openCrypt } from "@/lib/db/crypt";
import { addTransaction, deleteTransaction } from "@/lib/db/mutations";
import { readHouseReading } from "@/lib/db/queries";
import { DEMO_DB_NAME, PROFILE_ID } from "@/lib/db/schema";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { loadScenario } from "@/lib/demo/service";
import { computeHouseState } from "@/lib/haunting";
import type {
  CryptRows,
  DebtRow,
  EventRow,
  SubscriptionRow,
  TransactionRow,
} from "@/types/finance";

const NUM_RUNS = 100;
const MAX_CENTS = 100_000_000;
const MAX_ITEMS = 6;
const NOW = "2025-06-02";

const dateArb = fc
  .date({ min: new Date("2020-01-01"), max: new Date("2030-12-31"), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));
const centsArb = fc.integer({ min: 0, max: MAX_CENTS });
const positiveCentsArb = fc.integer({ min: 1, max: MAX_CENTS });

const debtArb: fc.Arbitrary<DebtRow> = fc.record({
  id: fc.uuid(),
  name: fc.string(),
  balanceCents: fc.oneof(fc.constant(0), centsArb),
  apr: fc.double({ min: 0, max: 1, noNaN: true }),
  minimumPaymentCents: centsArb,
});

const subscriptionArb: fc.Arbitrary<SubscriptionRow> = fc.record({
  id: fc.uuid(),
  name: fc.string(),
  amountCents: centsArb,
  cadence: fc.constantFrom("weekly" as const, "monthly" as const, "yearly" as const),
  usage: fc.constantFrom("often" as const, "rarely" as const, "never" as const),
  active: fc.boolean(),
});

const transactionArb: fc.Arbitrary<TransactionRow> = fc.record({
  id: fc.uuid(),
  amountCents: positiveCentsArb,
  description: fc.string(),
  category: fc.string(),
  date: dateArb,
});

const eventArb: fc.Arbitrary<EventRow> = fc.record(
  {
    id: fc.uuid(),
    type: fc.constantFrom(
      "debt_payment" as const,
      "subscription_canceled" as const,
      "exorcism_action_completed" as const,
    ),
    date: dateArb,
    amountCents: centsArb,
    extraPrincipalCents: centsArb,
    refKey: fc.string(),
  },
  { requiredKeys: ["id", "type", "date"] },
);

const rowsArb: fc.Arbitrary<CryptRows> = fc.record({
  profile: fc.record({ monthlyIncomeCents: centsArb }),
  debts: fc.array(debtArb, { maxLength: MAX_ITEMS }),
  subscriptions: fc.array(subscriptionArb, { maxLength: MAX_ITEMS }),
  transactions: fc.array(transactionArb, { maxLength: MAX_ITEMS }),
  events: fc.array(eventArb, { maxLength: MAX_ITEMS }),
  plans: fc.constant([]),
});

function lightOf(rows: CryptRows, now: string): number {
  return computeHouseState(toFinancialSnapshot(rows, now)).lightScore;
}

// Feature: action-feedback, Property 3: Expenses never move the light
// **Validates: Requirements 2.10**
describe("Property 3: Expenses never move the light", () => {
  it("keeps the light score when a transaction is added or an existing one is removed", () => {
    fc.assert(
      fc.property(rowsArb, transactionArb, dateArb, (rows, extra, now) => {
        const before = lightOf(rows, now);

        const added: CryptRows = { ...rows, transactions: [...rows.transactions, extra] };
        expect(lightOf(added, now)).toBe(before);

        if (added.transactions.length > 0) {
          const removedOne: CryptRows = { ...added, transactions: added.transactions.slice(1) };
          expect(lightOf(removedOne, now)).toBe(before);
          const removedAll: CryptRows = { ...rows, transactions: [] };
          expect(lightOf(removedAll, now)).toBe(before);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("keeps readHouseReading's light through the real addTransaction and deleteTransaction", async () => {
    const db = openCrypt(DEMO_DB_NAME, { indexedDB: new IDBFactory(), IDBKeyRange });
    try {
      await loadScenario(db, "level-4", NOW);
      expect(await db.profile.get(PROFILE_ID)).toBeDefined();
      const before = (await readHouseReading(db, NOW)).lightScore;

      const added = await addTransaction(
        db,
        { description: "Coffee", category: "Coffee", amountCents: 800, date: NOW },
        { now: NOW },
      );
      expect((await readHouseReading(db, NOW)).lightScore).toBe(before);

      const id = typeof added === "string" ? added : added.id;
      await deleteTransaction(db, id);
      expect((await readHouseReading(db, NOW)).lightScore).toBe(before);
    } finally {
      db.close();
      await db.delete();
    }
  });
});
