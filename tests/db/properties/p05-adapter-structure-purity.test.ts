import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import type {
  CryptRows,
  DebtRow,
  EventRow,
  SubscriptionRow,
  TransactionRow,
} from "@/types/finance";

const NUM_RUNS = 100;
const MAX_CENTS = 100_000_000;
const MAX_ITEMS = 8;

const dateArb = fc
  .date({ min: new Date("2020-01-01"), max: new Date("2030-12-31"), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));
const centsArb = fc.integer({ min: 0, max: MAX_CENTS });

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
  amountCents: centsArb,
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

// Feature: app-screens, Property 5: The snapshot adapter preserves structure and purity
// **Validates: Requirements 4.1, 4.3, 4.4, 4.5, 4.6, 4.8**
describe("Property 5: The snapshot adapter preserves structure and purity", () => {
  it("preserves now, counts, order, flags and event fields without mutating inputs", () => {
    fc.assert(
      fc.property(rowsArb, dateArb, (rows, now) => {
        const before = structuredClone(rows);
        const snapshot = toFinancialSnapshot(rows, now);

        expect(snapshot.now).toBe(now);
        expect(snapshot.debts.map((d) => d.debtId)).toEqual(rows.debts.map((d) => d.id));
        expect(snapshot.subscriptions.map((s) => s.subscriptionId)).toEqual(
          rows.subscriptions.map((s) => s.id),
        );
        expect(snapshot.transactions.map((t) => t.transactionId)).toEqual(
          rows.transactions.map((t) => t.id),
        );
        expect(snapshot.events).toHaveLength(rows.events.length);

        snapshot.subscriptions.forEach((s, i) => {
          expect(s.active).toBe(rows.subscriptions[i].active);
        });
        snapshot.debts.forEach((d, i) => {
          expect(Math.round(d.balance * 100)).toBe(rows.debts[i].balanceCents);
        });
        snapshot.events.forEach((e, i) => {
          const row = rows.events[i];
          expect(e.type).toBe(row.type);
          expect(e.date).toBe(row.date);
          expect(e.amountCents).toBe(row.amountCents);
          expect(e.extraPrincipalCents).toBe(row.extraPrincipalCents);
        });

        expect(rows).toEqual(before);
        expect(snapshot).not.toBe(rows);
        expect(snapshot.debts).not.toBe(rows.debts);
        expect(snapshot.subscriptions).not.toBe(rows.subscriptions);
        expect(snapshot.transactions).not.toBe(rows.transactions);
        expect(snapshot.events).not.toBe(rows.events);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("uses income 0 when the profile is null", () => {
    fc.assert(
      fc.property(rowsArb, dateArb, (rows, now) => {
        const withoutProfile = { ...rows, profile: null } as unknown as CryptRows;
        expect(toFinancialSnapshot(withoutProfile, now).monthlyIncome).toBe(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
