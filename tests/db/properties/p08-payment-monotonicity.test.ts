import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import { logPayment } from "@/lib/db/mutations";
import { readAllRows } from "@/lib/db/queries";
import { PROFILE_ID, type CryptDb } from "@/lib/db/schema";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { computeHouseState } from "@/lib/haunting";
import { MAX_MONEY_CENTS } from "@/lib/validation/limits";
import type {
  DebtRow,
  EventRow,
  SubscriptionRow,
  TransactionRow,
} from "@/types/finance";

const NUM_RUNS = 100;
const MAX_ROWS = 5;
const NOW = "2025-06-15";
const MIN_DATE = "2025-04-15";
const MAX_DATE = NOW;

const idb = new IDBFactory();
let counter = 0;

const centsArb = fc.integer({ min: 0, max: MAX_MONEY_CENTS });
const dateArb = fc
  .date({ min: new Date(MIN_DATE), max: new Date(MAX_DATE), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));

const debtArb: fc.Arbitrary<DebtRow> = fc.record({
  id: fc.uuid(),
  name: fc.constant("Debt"),
  balanceCents: fc.integer({ min: 1, max: MAX_MONEY_CENTS }),
  apr: fc.double({ min: 0, max: 1, noNaN: true }),
  minimumPaymentCents: centsArb,
});

const subscriptionArb: fc.Arbitrary<SubscriptionRow> = fc.record({
  id: fc.uuid(),
  name: fc.constant("Sub"),
  amountCents: fc.integer({ min: 1, max: MAX_MONEY_CENTS }),
  cadence: fc.constantFrom("weekly" as const, "monthly" as const, "yearly" as const),
  usage: fc.constantFrom("often" as const, "rarely" as const, "never" as const),
  active: fc.boolean(),
});

const transactionArb: fc.Arbitrary<TransactionRow> = fc.record({
  id: fc.uuid(),
  amountCents: fc.integer({ min: 1, max: MAX_MONEY_CENTS }),
  description: fc.constant("Tx"),
  category: fc.constant("Misc"),
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
  },
  { requiredKeys: ["id", "type", "date"] },
);

const scenarioArb = fc
  .record({
    income: centsArb,
    debts: fc.array(debtArb, { minLength: 1, maxLength: MAX_ROWS }),
    subscriptions: fc.array(subscriptionArb, { maxLength: MAX_ROWS }),
    transactions: fc.array(transactionArb, { maxLength: MAX_ROWS }),
    events: fc.array(eventArb, { maxLength: MAX_ROWS }),
    debtPick: fc.nat(),
    amountPick: fc.double({ min: 0, max: 1, noNaN: true }),
  })
  .map((s) => {
    const debt = s.debts[s.debtPick % s.debts.length];
    const amount = Math.min(
      debt.balanceCents,
      Math.max(1, Math.round(s.amountPick * debt.balanceCents)),
    );
    return { ...s, debt, amount };
  });

async function lightScore(db: CryptDb): Promise<number> {
  const rows = await readAllRows(db);
  return computeHouseState(toFinancialSnapshot(rows, NOW)).lightScore;
}

// Feature: app-screens, Property 8: A payment never lowers the light score
// **Validates: Requirements 6.6**
describe("Property 8: A payment never lowers the light score", () => {
  it("light score after logPayment is greater than or equal to the score before", async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async (s) => {
        counter += 1;
        const db = openCrypt(`test-${counter}`, { indexedDB: idb, IDBKeyRange });
        try {
          await db.profile.put({ id: PROFILE_ID, monthlyIncomeCents: s.income });
          await db.debts.bulkAdd(s.debts);
          await db.subscriptions.bulkAdd(s.subscriptions);
          await db.transactions.bulkAdd(s.transactions);
          await db.events.bulkAdd(s.events);

          const before = await lightScore(db);
          await logPayment(db, s.debt.id, s.amount, { now: NOW });
          const after = await lightScore(db);

          expect(after).toBeGreaterThanOrEqual(before);
        } finally {
          db.close();
          await db.delete();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
