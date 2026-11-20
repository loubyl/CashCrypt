import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { openCrypt } from "@/lib/db/crypt";
import { DbNotFoundError } from "@/lib/db/errors";
import { completePlanAction, deleteDebt, deleteSubscription } from "@/lib/db/mutations";
import { readAllRows } from "@/lib/db/queries";
import { PROFILE_ID } from "@/lib/db/schema";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { computeHouseState } from "@/lib/haunting";
import { getPlanWeekStart } from "@/lib/utils/calendar";
import { getDoItTarget } from "@/lib/utils/planView";
import type {
  DebtRow,
  EventRow,
  StoredPlanAction,
  SubscriptionRow,
  WeeklyPlanRow,
} from "@/types/finance";

const NUM_RUNS = 100;
const NOW = "2025-06-15";
const WEEK_KEY = getPlanWeekStart(NOW);
const MAX_ROWS = 4;
const INCOME_CENTS = 400_000;
const UNKNOWN_ID = "does-not-exist";
const SUB_AMOUNT_STEP_CENTS = 1_000;
const DEBT_BALANCE_STEP_CENTS = 50_000;
const DEBT_MINIMUM_CENTS = 2_500;
const EXTRA_PRINCIPAL_CENTS = 1_500;
const PLAN_START_SCORE = 30;
const ACTION_AMOUNT_CENTS = 1_000;

let counter = 0;

type SubSpec = { active: boolean; hasCancelEvent: boolean };
type Scenario = {
  subs: SubSpec[];
  debtsPaidOff: boolean[];
  extraEvents: number;
  withCompletionEvent: boolean;
  targetPick: number;
  targetKind: "debt" | "subscription" | "unknown-debt" | "unknown-subscription";
};

const scenarioArb: fc.Arbitrary<Scenario> = fc.record({
  subs: fc.array(fc.record({ active: fc.boolean(), hasCancelEvent: fc.boolean() }), {
    minLength: 1,
    maxLength: MAX_ROWS,
  }),
  debtsPaidOff: fc.array(fc.boolean(), { minLength: 1, maxLength: MAX_ROWS }),
  extraEvents: fc.integer({ min: 0, max: 3 }),
  withCompletionEvent: fc.boolean(),
  targetPick: fc.nat({ max: MAX_ROWS - 1 }),
  targetKind: fc.constantFrom(
    "debt" as const,
    "subscription" as const,
    "unknown-debt" as const,
    "unknown-subscription" as const,
  ),
});

function buildRows(scenario: Scenario) {
  const subscriptions: SubscriptionRow[] = scenario.subs.map((spec, i) => ({
    id: `sub-${i}`,
    name: `Sub ${i}`,
    amountCents: SUB_AMOUNT_STEP_CENTS * (i + 1),
    cadence: "monthly",
    usage: "never",
    active: spec.active,
    ...(spec.active ? {} : { canceledOn: NOW }),
  }));
  const debts: DebtRow[] = scenario.debtsPaidOff.map((paidOff, i) => ({
    id: `debt-${i}`,
    name: `Debt ${i}`,
    balanceCents: paidOff ? 0 : DEBT_BALANCE_STEP_CENTS * (i + 1),
    apr: 0.2,
    minimumPaymentCents: DEBT_MINIMUM_CENTS,
  }));
  const events: EventRow[] = [];
  scenario.subs.forEach((spec, i) => {
    if (spec.hasCancelEvent) {
      events.push({
        id: `ev-cancel-${i}`,
        type: "subscription_canceled",
        date: NOW,
        amountCents: SUB_AMOUNT_STEP_CENTS * (i + 1),
        refKey: `cancel:sub-${i}`,
      });
    }
  });
  for (let i = 0; i < scenario.extraEvents; i += 1) {
    events.push({
      id: `ev-pay-${i}`,
      type: "debt_payment",
      date: NOW,
      extraPrincipalCents: EXTRA_PRINCIPAL_CENTS,
    });
  }
  if (scenario.withCompletionEvent) {
    events.push({
      id: "ev-done",
      type: "exorcism_action_completed",
      date: NOW,
      refKey: `plan:${WEEK_KEY}:a-fallback`,
    });
  }
  const actions: StoredPlanAction[] = [
    ...subscriptions.map((s) => storedAction(`a-cancel-${s.id}`, "cancel_subscription", s.id)),
    ...debts.map((d) => storedAction(`a-pay-${d.id}`, "extra_payment", d.id)),
    storedAction("a-fallback", "fallback"),
  ];
  const plan: WeeklyPlanRow = {
    weekKey: WEEK_KEY,
    actions,
    startLightScore: PLAN_START_SCORE,
    generatedOn: NOW,
  };
  return { subscriptions, debts, events, plan };
}

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
    monthlyAmountCents: ACTION_AMOUNT_CENTS,
    priorityCents: ACTION_AMOUNT_CENTS,
    done: false,
  };
}

function byId<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

describe("deleting a row", () => {
  // Feature: app-screens, Property 37: Deleting a row removes only that row
  // **Validates: Requirements 9.8, 9.9, 9.10, 9.11, 14.6, 22.9**
  it("removes only that row (and an active subscription's cancel event), or rejects an unknown id and changes nothing", async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async (scenario) => {
        const db = openCrypt(`test-${(counter += 1)}`, { indexedDB, IDBKeyRange });
        try {
          await db.open();
          const { subscriptions, debts, events, plan } = buildRows(scenario);
          await db.profile.put({ id: PROFILE_ID, monthlyIncomeCents: INCOME_CENTS });
          await db.debts.bulkPut(debts);
          await db.subscriptions.bulkPut(subscriptions);
          await db.events.bulkPut(events);
          await db.weeklyPlans.put(plan);

          const before = await readAllRows(db);
          const momentumBefore = computeHouseState(toFinancialSnapshot(before, NOW)).momentum;

          const isDebt = scenario.targetKind === "debt" || scenario.targetKind === "unknown-debt";
          const unknown = scenario.targetKind.startsWith("unknown");
          const pool = isDebt ? debts : subscriptions;
          const existing = pool[scenario.targetPick % pool.length];
          const id = unknown ? UNKNOWN_ID : existing.id;
          const run = isDebt ? deleteDebt : deleteSubscription;

          if (unknown) {
            await expect(run(db, id)).rejects.toBeInstanceOf(DbNotFoundError);
            expect(await readAllRows(db)).toEqual(before);
            return;
          }

          await run(db, id);
          const after = await readAllRows(db);

          const removesCancelEvent =
            !isDebt && subscriptions.find((s) => s.id === id)?.active === true;
          expect(byId(after.debts)).toEqual(byId(before.debts.filter((d) => !(isDebt && d.id === id))));
          expect(byId(after.subscriptions)).toEqual(
            byId(before.subscriptions.filter((s) => !(!isDebt && s.id === id))),
          );
          expect(byId(after.events)).toEqual(
            byId(
              before.events.filter(
                (e) => !(removesCancelEvent && e.refKey === `cancel:${id}`),
              ),
            ),
          );
          expect(after.transactions).toEqual(before.transactions);
          expect(after.profile).toEqual(before.profile);
          expect(after.plans).toEqual(before.plans);

          if (removesCancelEvent) {
            const momentumAfter = computeHouseState(toFinancialSnapshot(after, NOW)).momentum;
            expect(momentumAfter).toBe(momentumBefore);
          }

          const targeting = plan.actions.filter((a) => a.targetId === id);
          expect(targeting.length).toBe(1);
          for (const action of targeting) {
            expect(getDoItTarget(action, after)).toBeNull();
            const eventsBefore = (await db.events.toArray()).length;
            await completePlanAction(db, WEEK_KEY, action.id, { now: NOW, newId: () => "ev-new" });
            expect((await db.events.toArray()).length).toBe(eventsBefore + 1);
          }
        } finally {
          db.close();
          await db.delete();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
