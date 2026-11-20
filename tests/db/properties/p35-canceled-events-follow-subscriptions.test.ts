import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import type { CryptRows, EventRow, SubscriptionRow } from "@/types/finance";

const NUM_RUNS = 200;
const NOW = "2025-06-15";
const MAX_SUBS = 6;
const MAX_EVENTS = 12;
const MISSING_SUB = "sub-missing";

const subsArb: fc.Arbitrary<SubscriptionRow[]> = fc
  .array(fc.boolean(), { minLength: 1, maxLength: MAX_SUBS })
  .map((flags) =>
    flags.map((active, i) => ({
      id: `sub-${i}`,
      name: `Sub ${i}`,
      amountCents: 1_000 * (i + 1),
      cadence: "monthly" as const,
      usage: "never" as const,
      active,
      ...(active ? {} : { canceledOn: NOW }),
    })),
  );

/** Events of every type; cancellation events point at a generated or a missing subscription. */
function eventsArb(subs: SubscriptionRow[]): fc.Arbitrary<EventRow[]> {
  const subIdArb = fc.constantFrom(...subs.map((s) => s.id), MISSING_SUB);
  const eventArb: fc.Arbitrary<Omit<EventRow, "id">> = fc.oneof(
    subIdArb.map((subId) => ({
      type: "subscription_canceled" as const,
      date: NOW,
      amountCents: 1_000,
      refKey: `cancel:${subId}`,
    })),
    fc.constant({ type: "debt_payment" as const, date: NOW, extraPrincipalCents: 500 }),
    fc.constant({ type: "exorcism_action_completed" as const, date: NOW, refKey: "plan:2025-06-09:x" }),
  );
  return fc
    .array(eventArb, { maxLength: MAX_EVENTS })
    .map((events) => events.map((e, i) => ({ ...e, id: `ev-${i}` }) as EventRow));
}

const rowsArb: fc.Arbitrary<CryptRows> = subsArb.chain((subscriptions) =>
  eventsArb(subscriptions).map((events) => ({
    profile: { monthlyIncomeCents: 300_000 },
    debts: [],
    subscriptions,
    transactions: [],
    events,
    plans: [],
  })),
);

describe("Property 35: Cancellation momentum follows the subscription's state", () => {
  // Feature: app-screens, Property 35: Cancellation momentum follows the subscription's state
  // **Validates: Requirements 4.4, 4.5, 7.6**
  it("keeps exactly the subscription_canceled events whose subscription is not active, and every other event, in order", () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const active = new Set(rows.subscriptions.filter((s) => s.active).map((s) => s.id));
        const expected = rows.events.filter((e) => {
          if (e.type !== "subscription_canceled") return true;
          const subId = (e.refKey ?? "").slice("cancel:".length);
          return !active.has(subId);
        });
        const snapshot = toFinancialSnapshot(rows, NOW);
        expect(snapshot.events).toEqual(
          expected.map((e) => {
            const out: Record<string, unknown> = { type: e.type, date: e.date };
            if (e.amountCents !== undefined) out.amountCents = e.amountCents;
            if (e.extraPrincipalCents !== undefined) out.extraPrincipalCents = e.extraPrincipalCents;
            return out;
          }),
        );
        const kept = snapshot.events.filter((e) => e.type === "subscription_canceled").length;
        const inactiveOrMissing = rows.events.filter(
          (e) => e.type === "subscription_canceled" && !active.has((e.refKey ?? "").slice("cancel:".length)),
        ).length;
        expect(kept).toBe(inactiveOrMissing);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
