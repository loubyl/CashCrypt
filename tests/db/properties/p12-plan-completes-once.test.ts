import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { openCrypt } from "@/lib/db/crypt";
import {
  cancelSubscription,
  completePlanAction,
  logPayment,
  uncompletePlanAction,
} from "@/lib/db/mutations";
import { getPlanWeekStart } from "@/lib/utils/calendar";
import type {
  DebtRow,
  StoredPlanAction,
  SubscriptionRow,
  TransactionRow,
  WeeklyPlanRow,
} from "@/types/finance";

const NUM_RUNS = 100;
const NOW = "2025-03-14";
const WEEK_KEY = getPlanWeekStart(NOW);
const DEBT_ID = "debt-1";
const SUB_ID = "sub-1";
const MINIMUM_CENTS = 1_000;
const BALANCE_CENTS = 1_000_000;
const EXTRA_PAYMENT_CENTS = 5_000;
const SMALL_PAYMENT_CENTS = 500;

let counter = 0;

const ACTION_IDS = ["a-cancel", "a-extra", "a-fallback"] as const;

type Op =
  | { kind: "complete"; actionId: string }
  | { kind: "uncomplete"; actionId: string }
  | { kind: "payExtra" }
  | { kind: "paySmall" }
  | { kind: "cancel" };

const actionIdArb = fc.constantFrom(...ACTION_IDS);

const opArb: fc.Arbitrary<Op> = fc.oneof(
  actionIdArb.map((actionId): Op => ({ kind: "complete", actionId })),
  actionIdArb.map((actionId): Op => ({ kind: "uncomplete", actionId })),
  fc.constant<Op>({ kind: "payExtra" }),
  fc.constant<Op>({ kind: "paySmall" }),
  fc.constant<Op>({ kind: "cancel" }),
);

const opsArb = fc.array(opArb, { minLength: 0, maxLength: 25 });

function storedAction(
  id: string,
  kind: StoredPlanAction["kind"],
  targetId?: string,
): StoredPlanAction {
  return {
    id,
    kind,
    title: id,
    subtitle: id,
    targetId,
    monthlyAmountCents: 1_000,
    priorityCents: 1_000,
    done: false,
  };
}

const debt: DebtRow = {
  id: DEBT_ID,
  name: "Card",
  balanceCents: BALANCE_CENTS,
  apr: 0.2,
  minimumPaymentCents: MINIMUM_CENTS,
};
const subscription: SubscriptionRow = {
  id: SUB_ID,
  name: "StreamMax",
  amountCents: 2_299,
  cadence: "monthly",
  usage: "never",
  active: true,
};
const transaction: TransactionRow = {
  id: "tx-1",
  amountCents: 450,
  description: "Coffee",
  category: "food",
  date: "2025-03-12",
};

const plan: WeeklyPlanRow = {
  weekKey: WEEK_KEY,
  actions: [
    storedAction("a-cancel", "cancel_subscription", SUB_ID),
    storedAction("a-extra", "extra_payment", DEBT_ID),
    storedAction("a-fallback", "fallback"),
  ],
  startLightScore: 30,
  generatedOn: NOW,
};

describe("plan action completion", () => {
  // Feature: app-screens, Property 12: Plan actions complete at most once
  // **Validates: Requirements 8.1, 8.2, 8.3, 8.5, 8.6, 8.7, 8.13**
  it("creates at most one exorcism_action_completed event per plan action, however it is completed", async () => {
    await fc.assert(
      fc.asyncProperty(opsArb, async (ops) => {
        const db = openCrypt(`test-${(counter += 1)}`, { indexedDB, IDBKeyRange });
        try {
          await db.open();
          await db.debts.put(debt);
          await db.subscriptions.put(subscription);
          await db.transactions.put(transaction);
          await db.weeklyPlans.put(plan);

          let eventCounter = 0;
          const ctx = { now: NOW, newId: () => `ev-${(eventCounter += 1)}` };
          const everCompleted = new Set<string>();
          let canceled = false;

          for (const op of ops) {
            const rowsBefore = {
              debts: await db.debts.toArray(),
              subscriptions: await db.subscriptions.toArray(),
              transactions: await db.transactions.toArray(),
            };
            switch (op.kind) {
              case "complete":
                await completePlanAction(db, WEEK_KEY, op.actionId, ctx);
                everCompleted.add(op.actionId);
                break;
              case "uncomplete":
                await uncompletePlanAction(db, WEEK_KEY, op.actionId);
                break;
              case "payExtra":
                await logPayment(db, DEBT_ID, EXTRA_PAYMENT_CENTS, ctx);
                everCompleted.add("a-extra");
                break;
              case "paySmall":
                await logPayment(db, DEBT_ID, SMALL_PAYMENT_CENTS, ctx);
                break;
              case "cancel":
                await cancelSubscription(db, SUB_ID, ctx);
                if (!canceled) everCompleted.add("a-cancel");
                canceled = true;
                break;
            }
            if (op.kind === "complete" || op.kind === "uncomplete") {
              expect(await db.debts.toArray()).toEqual(rowsBefore.debts);
              expect(await db.subscriptions.toArray()).toEqual(rowsBefore.subscriptions);
              expect(await db.transactions.toArray()).toEqual(rowsBefore.transactions);
            }
          }

          const completions = (await db.events.toArray()).filter(
            (event) => event.type === "exorcism_action_completed",
          );
          for (const actionId of ACTION_IDS) {
            const refKey = `plan:${WEEK_KEY}:${actionId}`;
            const matching = completions.filter((event) => event.refKey === refKey);
            expect(matching.length).toBe(everCompleted.has(actionId) ? 1 : 0);
          }
          // No completion event refers to anything but this week's actions.
          expect(completions.length).toBe(everCompleted.size);
        } finally {
          db.close();
          await db.delete();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
