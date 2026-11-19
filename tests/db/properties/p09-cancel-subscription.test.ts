import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { openCrypt } from "@/lib/db/crypt";
import { cancelSubscription } from "@/lib/db/mutations";
import { normalizeSubscription } from "@/lib/haunting";
import type { DebtRow, EventRow, SubscriptionRow, TransactionRow } from "@/types/finance";

const NUM_RUNS = 100;
const NOW = "2025-03-14";
const MAX_CENTS = 100_000_000;
const TARGET_ID = "target";

let counter = 0;

const targetArb: fc.Arbitrary<SubscriptionRow> = fc.record({
  id: fc.constant(TARGET_ID),
  name: fc.string({ minLength: 1, maxLength: 12 }),
  amountCents: fc.integer({ min: 1, max: 1_000_000 }),
  cadence: fc.constantFrom("weekly", "monthly", "yearly"),
  usage: fc.constantFrom("often", "rarely", "never"),
  active: fc.constant(true),
}) as fc.Arbitrary<SubscriptionRow>;

const otherSubsArb: fc.Arbitrary<SubscriptionRow[]> = fc
  .array(
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 12 }),
      amountCents: fc.integer({ min: 1, max: 1_000_000 }),
      cadence: fc.constantFrom("weekly", "monthly", "yearly"),
      usage: fc.constantFrom("often", "rarely", "never"),
      active: fc.boolean(),
    }),
    { maxLength: 3 },
  )
  .map((rows) =>
    rows.map((r, i) => ({ ...r, id: `other-${i}` }) as SubscriptionRow),
  );

const debtArb: fc.Arbitrary<DebtRow> = fc.record({
  id: fc.constant("debt-1"),
  name: fc.string({ minLength: 1, maxLength: 12 }),
  balanceCents: fc.integer({ min: 1, max: MAX_CENTS }),
  apr: fc.double({ min: 0, max: 1, noNaN: true }),
  minimumPaymentCents: fc.integer({ min: 0, max: MAX_CENTS }),
});

const transactionArb: fc.Arbitrary<TransactionRow> = fc.record({
  id: fc.constant("tx-1"),
  amountCents: fc.integer({ min: 1, max: 100_000 }),
  description: fc.string({ maxLength: 12 }),
  category: fc.string({ maxLength: 12 }),
  date: fc.constant("2025-03-01"),
});

const priorEventArb: fc.Arbitrary<EventRow> = fc.record({
  id: fc.constant("ev-prior"),
  type: fc.constant("debt_payment" as const),
  date: fc.constant("2025-03-02"),
  extraPrincipalCents: fc.integer({ min: 0, max: 100_000 }),
});

const scenarioArb = fc.record({
  target: targetArb,
  others: otherSubsArb,
  debt: debtArb,
  transaction: transactionArb,
  priorEvent: priorEventArb,
  income: fc.integer({ min: 0, max: MAX_CENTS }),
});

describe("cancel subscription", () => {
  // Feature: app-screens, Property 9: Canceling a subscription changes only that subscription and records one event
  // **Validates: Requirements 7.1, 7.2, 7.3, 7.7**
  it("deactivates only that subscription, records one cancel event and leaves every other row unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async (s) => {
        const db = openCrypt(`test-${(counter += 1)}`, { indexedDB, IDBKeyRange });
        try {
          await db.open();
          await db.profile.put({ id: "profile", monthlyIncomeCents: s.income } as never);
          await db.subscriptions.bulkPut([s.target, ...s.others]);
          await db.debts.put(s.debt);
          await db.transactions.put(s.transaction);
          await db.events.put(s.priorEvent);

          const before = {
            profile: await db.profile.toArray(),
            others: await db.subscriptions.where("id").notEqual(TARGET_ID).toArray(),
            debts: await db.debts.toArray(),
            transactions: await db.transactions.toArray(),
          };

          const outcome = await cancelSubscription(db, TARGET_ID, {
            now: NOW,
            newId: () => "new-event",
          });

          const expectedMonthly = normalizeSubscription({
            subscriptionId: s.target.id,
            name: s.target.name,
            amountCents: s.target.amountCents,
            cadence: s.target.cadence,
            usage: s.target.usage,
            active: true,
          }).monthlyCostCents;
          expect(outcome).toMatchObject({ changed: true, monthlySavedCents: expectedMonthly });

          const after = await db.subscriptions.get(TARGET_ID);
          expect(after).toEqual({ ...s.target, active: false, canceledOn: NOW });

          const events = await db.events.toArray();
          expect(events).toHaveLength(2);
          expect(events).toContainEqual(s.priorEvent);
          const added = events.filter((e) => e.id !== s.priorEvent.id);
          expect(added).toHaveLength(1);
          expect(added[0].type).toBe("subscription_canceled");
          expect(added[0].refKey).toBe(`cancel:${TARGET_ID}`);
          expect(added[0].amountCents).toBe(expectedMonthly);

          expect(await db.profile.toArray()).toEqual(before.profile);
          expect(await db.subscriptions.where("id").notEqual(TARGET_ID).toArray()).toEqual(
            before.others,
          );
          expect(await db.debts.toArray()).toEqual(before.debts);
          expect(await db.transactions.toArray()).toEqual(before.transactions);
          expect(await db.weeklyPlans.count()).toBe(0);
        } finally {
          db.close();
          await db.delete();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
