import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { openCrypt } from "@/lib/db/crypt";
import { logPayment } from "@/lib/db/mutations";
import type { DebtRow, EventRow, SubscriptionRow, TransactionRow } from "@/types/finance";

const NUM_RUNS = 100;
const NOW = "2025-03-14";
const MAX_CENTS = 100_000_000;

let counter = 0;

const debtArb = (id: string): fc.Arbitrary<DebtRow> =>
  fc.record({
    id: fc.constant(id),
    name: fc.string({ minLength: 1, maxLength: 12 }),
    balanceCents: fc.integer({ min: 1, max: MAX_CENTS }),
    apr: fc.double({ min: 0, max: 1, noNaN: true }),
    minimumPaymentCents: fc.integer({ min: 0, max: MAX_CENTS }),
  });

const otherDebtsArb = fc
  .array(fc.integer({ min: 0, max: 100 }), { maxLength: 3 })
  .chain((ids) =>
    fc.tuple(...ids.map((n, i) => debtArb(`other-${i}-${n}`))),
  );

const subscriptionArb: fc.Arbitrary<SubscriptionRow> = fc.record({
  id: fc.constant("sub-1"),
  name: fc.string({ minLength: 1, maxLength: 12 }),
  amountCents: fc.integer({ min: 1, max: 100_000 }),
  cadence: fc.constantFrom("weekly", "monthly", "yearly"),
  usage: fc.constantFrom("often", "rarely", "never"),
  active: fc.boolean(),
}) as fc.Arbitrary<SubscriptionRow>;

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

const scenarioArb = fc
  .tuple(debtArb("target"), fc.double({ min: 0, max: 1, noNaN: true }))
  .chain(([target, fraction]) => {
    // Pick an amount in [1, balance], with the minimum boundary well represented.
    const amountArb = fc.oneof(
      fc.integer({ min: 1, max: target.balanceCents }),
      fc.constantFrom(
        1,
        target.balanceCents,
        Math.min(Math.max(target.minimumPaymentCents, 1), target.balanceCents),
        Math.min(target.minimumPaymentCents + 1, target.balanceCents),
      ),
      fc.constant(Math.max(1, Math.round(fraction * target.balanceCents))),
    );
    return fc.record({
      target: fc.constant(target),
      amount: amountArb,
      others: otherDebtsArb,
      subscription: subscriptionArb,
      transaction: transactionArb,
      priorEvent: priorEventArb,
      income: fc.integer({ min: 0, max: MAX_CENTS }),
    });
  });

describe("log payment", () => {
  // Feature: app-screens, Property 7: Logging a payment moves exactly the right rows
  // **Validates: Requirements 6.1, 6.2, 6.3, 6.7**
  it("reduces the balance, adds one dated debt_payment event and leaves every other row unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async (s) => {
        const db = openCrypt(`test-${(counter += 1)}`, { indexedDB, IDBKeyRange });
        try {
          await db.open();
          await db.profile.put({ id: "profile", monthlyIncomeCents: s.income } as never);
          await db.debts.bulkPut([s.target, ...s.others]);
          await db.subscriptions.put(s.subscription);
          await db.transactions.put(s.transaction);
          await db.events.put(s.priorEvent);

          const before = {
            profile: await db.profile.toArray(),
            others: await db.debts.where("id").notEqual("target").toArray(),
            subscriptions: await db.subscriptions.toArray(),
            transactions: await db.transactions.toArray(),
          };
          const debtBefore = await db.debts.get("target");

          const outcome = await logPayment(db, "target", s.amount, {
            now: NOW,
            newId: () => "new-event",
          });

          const debtAfter = await db.debts.get("target");
          expect(debtAfter).toBeDefined();
          expect(debtAfter!.balanceCents + s.amount).toBe(debtBefore!.balanceCents);
          expect({ ...debtAfter, balanceCents: 0 }).toEqual({ ...debtBefore, balanceCents: 0 });

          const expectedExtra = Math.max(0, s.amount - s.target.minimumPaymentCents);
          expect(outcome.extraPrincipalCents).toBe(expectedExtra);

          const events = await db.events.toArray();
          expect(events).toHaveLength(2);
          expect(events).toContainEqual(s.priorEvent);
          const added = events.filter((e) => e.id !== s.priorEvent.id);
          expect(added).toHaveLength(1);
          expect(added[0].type).toBe("debt_payment");
          expect(added[0].date).toBe(NOW);
          expect(added[0].extraPrincipalCents).toBe(expectedExtra);

          expect(await db.profile.toArray()).toEqual(before.profile);
          expect(await db.debts.where("id").notEqual("target").toArray()).toEqual(before.others);
          expect(await db.subscriptions.toArray()).toEqual(before.subscriptions);
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
