import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { openCrypt } from "@/lib/db/crypt";
import { cancelSubscription, reactivateSubscription } from "@/lib/db/mutations";
import type { SubscriptionRow } from "@/types/finance";

const NUM_RUNS = 100;
const NOW = "2025-03-14";
const MAX_SEQUENCE = 12;

let counter = 0;

type Step = "cancel" | "reactivate";

const scenarioArb = fc.record({
  subscription: fc.record({
    id: fc.constant("sub-1"),
    name: fc.string({ minLength: 1, maxLength: 12 }),
    amountCents: fc.integer({ min: 1, max: 100_000 }),
    cadence: fc.constantFrom("weekly", "monthly", "yearly"),
    usage: fc.constantFrom("often", "rarely", "never"),
    active: fc.boolean(),
  }) as fc.Arbitrary<SubscriptionRow>,
  steps: fc.array(fc.constantFrom<Step>("cancel", "reactivate"), {
    minLength: 1,
    maxLength: MAX_SEQUENCE,
  }),
});

describe("cancel and reactivate sequences", () => {
  // Feature: app-screens, Property 10: Cancel and reactivate sequences never farm momentum
  // **Validates: Requirements 7.4, 7.5, 7.6, 7.7**
  it("writes at most one subscription_canceled event, nothing for an inactive cancel, and no event on reactivate", async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ subscription, steps }) => {
        const db = openCrypt(`test-${(counter += 1)}`, { indexedDB, IDBKeyRange });
        try {
          await db.open();
          await db.subscriptions.put(subscription);

          let eventSeq = 0;
          const ctx = { now: NOW, newId: () => `ev-${(eventSeq += 1)}` };
          let active = subscription.active;
          let everCanceled = false;

          for (const step of steps) {
            const rowBefore = await db.subscriptions.get("sub-1");
            const eventsBefore = await db.events.toArray();

            if (step === "cancel") {
              const outcome = await cancelSubscription(db, "sub-1", ctx);
              if (!active) {
                // Canceling an inactive subscription writes nothing.
                expect(outcome.changed).toBe(false);
                expect(await db.subscriptions.get("sub-1")).toEqual(rowBefore);
                expect(await db.events.toArray()).toEqual(eventsBefore);
              } else {
                expect(outcome.changed).toBe(true);
                const row = await db.subscriptions.get("sub-1");
                expect(row!.active).toBe(false);
                expect(row!.canceledOn).toBe(NOW);
                active = false;
                everCanceled = true;
              }
            } else {
              await reactivateSubscription(db, "sub-1");
              const row = await db.subscriptions.get("sub-1");
              expect(row!.active).toBe(true);
              expect(row!.canceledOn).toBeUndefined();
              expect("canceledOn" in row!).toBe(false);
              expect(await db.events.toArray()).toEqual(eventsBefore);
              active = true;
            }

            const canceled = (await db.events.toArray()).filter(
              (e) => e.type === "subscription_canceled",
            );
            expect(canceled.length).toBe(everCanceled ? 1 : 0);
          }

          const all = await db.events.toArray();
          expect(all.every((e) => e.type === "subscription_canceled")).toBe(true);
          expect(all.length).toBe(everCanceled ? 1 : 0);
        } finally {
          db.close();
          await db.delete();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
