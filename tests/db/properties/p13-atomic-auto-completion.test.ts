import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { openCrypt } from "@/lib/db/crypt";
import { cancelSubscription, logPayment } from "@/lib/db/mutations";
import type { CryptDb } from "@/lib/db/schema";
import type {
  DebtRow,
  EventRow,
  StoredPlanAction,
  SubscriptionRow,
  WeeklyPlanRow,
} from "@/types/finance";

const NUM_RUNS = 100;
const NOW = "2025-03-14"; // a Friday
const WEEK_KEY = "2025-03-10"; // the Monday on or before NOW
const OTHER_WEEK_KEY = "2025-03-03";
const MAX_CENTS = 10_000_000;
const DEBT_ID = "debt-1";
const SUB_ID = "sub-1";
const COMPLETION_TYPE = "exorcism_action_completed";

type Call = "payment" | "cancel";
type PlanState = "none" | "otherWeek" | "noMatch" | "match" | "matchDone";

let counter = 0;

const rawScenarioArb = fc.record({
  call: fc.constantFrom<Call>("payment", "cancel"),
  planState: fc.constantFrom<PlanState>("none", "otherWeek", "noMatch", "match", "matchDone"),
  balance: fc.integer({ min: 1, max: MAX_CENTS }),
  minimum: fc.integer({ min: 0, max: MAX_CENTS }),
  amountFraction: fc.double({ min: 0, max: 1, noNaN: true }),
  zeroExtra: fc.boolean(),
  subActive: fc.boolean(),
  subAmount: fc.integer({ min: 1, max: 1_000_000 }),
  usage: fc.constantFrom("often", "rarely", "never"),
  completedOn: fc.constantFrom("2025-03-10", "2025-03-11", "2025-03-12"),
});
// Keep the minimum strictly below the balance so an extra payment is possible.
const scenarioArb = rawScenarioArb.map((s) => {
  const balance = Math.max(2, s.balance);
  return { ...s, balance, minimum: Math.min(s.minimum, balance - 1) };
});
type Scenario = ScenarioOf<typeof scenarioArb>;
type ScenarioOf<A> = A extends fc.Arbitrary<infer T> ? T : never;

function buildDebt(s: Scenario): DebtRow {
  return {
    id: DEBT_ID,
    name: "Card",
    balanceCents: s.balance,
    apr: 0.2,
    minimumPaymentCents: s.minimum,
  };
}

function buildSub(s: Scenario): SubscriptionRow {
  return {
    id: SUB_ID,
    name: "Stream",
    amountCents: s.subAmount,
    cadence: "monthly",
    usage: s.usage,
    active: s.subActive,
  } as SubscriptionRow;
}

/** Payment amount in [1, balance]; when zeroExtra, at most the minimum. */
function paymentAmount(s: Scenario): number {
  const raw = Math.max(1, Math.round(s.amountFraction * s.balance));
  if (!s.zeroExtra) return Math.min(s.balance, Math.max(raw, s.minimum + 1));
  return Math.max(1, Math.min(raw, s.minimum, s.balance));
}

function filler(id: string): StoredPlanAction {
  return {
    id,
    kind: "fallback",
    title: id,
    subtitle: "",
    monthlyAmountCents: 0,
    priorityCents: 0,
    done: false,
  };
}

function buildPlan(s: Scenario, weekKey: string): WeeklyPlanRow {
  const kind = s.call === "payment" ? "extra_payment" : "cancel_subscription";
  const matchTarget = s.call === "payment" ? DEBT_ID : SUB_ID;
  const target = s.planState === "noMatch" ? "somebody-else" : matchTarget;
  const done = s.planState === "matchDone";
  const matching: StoredPlanAction = {
    id: "act-match",
    kind,
    title: "match",
    subtitle: "",
    targetId: target,
    monthlyAmountCents: 100,
    priorityCents: 100,
    done,
    ...(done ? { completedOn: s.completedOn } : {}),
  };
  return {
    weekKey,
    actions: [matching, filler("fb-1"), filler("fb-2")],
    startLightScore: 30,
    generatedOn: weekKey,
  };
}

async function seed(db: CryptDb, s: Scenario): Promise<void> {
  await db.debts.put(buildDebt(s));
  await db.subscriptions.put(buildSub(s));
  if (s.planState === "none") return;
  const weekKey = s.planState === "otherWeek" ? OTHER_WEEK_KEY : WEEK_KEY;
  await db.weeklyPlans.put(buildPlan(s, weekKey));
  if (s.planState === "matchDone") {
    await db.events.put({
      id: "ev-prior-completion",
      type: COMPLETION_TYPE,
      date: s.completedOn,
      refKey: `plan:${WEEK_KEY}:act-match`,
    } as EventRow);
  }
}

async function snapshot(db: CryptDb) {
  return {
    profile: await db.profile.toArray(),
    debts: await db.debts.toArray(),
    subscriptions: await db.subscriptions.toArray(),
    transactions: await db.transactions.toArray(),
    events: await db.events.toArray(),
    weeklyPlans: await db.weeklyPlans.toArray(),
  };
}

/** True when the call changes something and a not-done matching action exists this week. */
function shouldComplete(s: Scenario): boolean {
  if (s.planState !== "match") return false;
  return s.call === "payment" ? paymentAmount(s) > s.minimum : s.subActive;
}

function runCall(db: CryptDb, s: Scenario) {
  const ctx = { now: NOW, newId: (() => {
    let n = 0;
    return () => `new-${(n += 1)}`;
  })() };
  return s.call === "payment"
    ? logPayment(db, DEBT_ID, paymentAmount(s), ctx)
    : cancelSubscription(db, SUB_ID, ctx);
}

async function withDb(body: (db: CryptDb) => Promise<void>): Promise<void> {
  const db = openCrypt(`test-${(counter += 1)}`, { indexedDB, IDBKeyRange });
  try {
    await db.open();
    await body(db);
  } finally {
    vi.restoreAllMocks();
    db.close();
    await db.delete();
  }
}

describe("atomic auto-completion", () => {
  // Feature: app-screens, Property 13: Auto-completion happens together with the change, or not at all
  // **Validates: Requirements 6.8, 7.9, 8.8, 8.9, 8.10, 8.11, 8.12**
  it("completes the matching plan action together with the change, and never otherwise", async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async (s) => {
        await withDb(async (db) => {
          await seed(db, s);
          const before = await snapshot(db);

          const outcome = await runCall(db, s);
          const after = await snapshot(db);
          const completes = shouldComplete(s);

          // Plans table
          if (completes) {
            const planBefore = before.weeklyPlans[0];
            expect(after.weeklyPlans).toHaveLength(1);
            expect(after.weeklyPlans[0].actions).toEqual(
              planBefore.actions.map((a) =>
                a.id === "act-match" ? { ...a, done: true, completedOn: NOW } : a,
              ),
            );
            expect(outcome).toMatchObject({ completedActionId: "act-match" });
          } else {
            expect(after.weeklyPlans).toEqual(before.weeklyPlans);
          }

          // Completion events
          const completionEvents = after.events.filter((e) => e.type === COMPLETION_TYPE);
          const priorCompletions = before.events.filter((e) => e.type === COMPLETION_TYPE);
          if (completes) {
            expect(completionEvents).toHaveLength(1);
            expect(completionEvents[0]).toMatchObject({
              date: NOW,
              refKey: `plan:${WEEK_KEY}:act-match`,
            });
          } else {
            expect(completionEvents).toEqual(priorCompletions);
          }

          // The change itself and its Event
          const changeEvents = after.events.filter((e) => e.type !== COMPLETION_TYPE);
          const priorChange = before.events.filter((e) => e.type !== COMPLETION_TYPE);
          if (s.call === "payment") {
            expect(after.debts[0].balanceCents).toBe(s.balance - paymentAmount(s));
            expect(changeEvents).toHaveLength(priorChange.length + 1);
          } else if (s.subActive) {
            expect(after.subscriptions[0].active).toBe(false);
            expect(changeEvents).toHaveLength(priorChange.length + 1);
          } else {
            expect(after.subscriptions).toEqual(before.subscriptions);
            expect(changeEvents).toHaveLength(priorChange.length);
          }

          // Already done actions keep their completedOn
          if (s.planState === "matchDone") {
            expect(after.weeklyPlans[0].actions[0].completedOn).toBe(s.completedOn);
          }
          // No plan is ever generated
          expect(after.weeklyPlans).toHaveLength(before.weeklyPlans.length);
        });
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: app-screens, Property 13: Auto-completion happens together with the change, or not at all
  // **Validates: Requirements 6.8, 7.9, 8.8, 8.9, 8.10, 8.11, 8.12**
  it("rolls back the change and its Event when the completion write fails", async () => {
    const applicable = scenarioArb
      .map((s) => ({ ...s, planState: "match" as const, subActive: true, zeroExtra: false }));
    await fc.assert(
      fc.asyncProperty(applicable, async (s) => {
        await withDb(async (db) => {
          await seed(db, s);
          const before = await snapshot(db);

          const realAdd = db.events.add.bind(db.events);
          vi.spyOn(db.events, "add").mockImplementation(((event: EventRow) =>
            event.type === COMPLETION_TYPE
              ? Promise.reject(new Error("forced completion failure"))
              : realAdd(event)) as typeof db.events.add);

          await expect(runCall(db, s)).rejects.toThrow("forced completion failure");

          vi.restoreAllMocks();
          expect(await snapshot(db)).toEqual(before);
        });
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
