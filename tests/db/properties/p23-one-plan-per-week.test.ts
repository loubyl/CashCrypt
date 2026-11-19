import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { generateExorcismPlan } from "@/lib/exorcism";
import { openCrypt } from "@/lib/db/crypt";
import { ensureWeeklyPlan } from "@/lib/db/plans";
import { readAllRows } from "@/lib/db/queries";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { computeHouseState } from "@/lib/haunting";
import { addDays, getPlanWeekStart, type LocalDate } from "@/lib/utils/calendar";
import type { DebtRow, SubscriptionRow, WeeklyPlanRow } from "@/types/finance";

// Pass-through wrapper so the test can count planner calls: an existing row
// must be returned without regenerating (a ConstraintError fallback would hide it).
vi.mock("@/lib/exorcism", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exorcism")>();
  return { ...actual, generateExorcismPlan: vi.fn(actual.generateExorcismPlan) };
});

const NUM_RUNS = 100;
const BASE_DATE: LocalDate = "2025-03-03";
const MAX_DAY_OFFSET = 27;
const MAX_STEPS = 8;
const MAX_CONCURRENT = 4;
const PLAN_ACTION_COUNT = 3;
const MONTHLY_INCOME_CENTS = 400_000;
const MAX_BALANCE_CENTS = 2_000_000;

let counter = 0;

type Step = { dayOffset: number; concurrent: number; balanceCents: number };

const stepArb: fc.Arbitrary<Step> = fc.record({
  dayOffset: fc.integer({ min: 0, max: MAX_DAY_OFFSET }),
  concurrent: fc.integer({ min: 1, max: MAX_CONCURRENT }),
  balanceCents: fc.integer({ min: 0, max: MAX_BALANCE_CENTS }),
});
const stepsArb = fc.array(stepArb, { minLength: 1, maxLength: MAX_STEPS });

const subscription: SubscriptionRow = {
  id: "sub-1",
  name: "StreamMax",
  amountCents: 2_299,
  cadence: "monthly",
  usage: "never",
  active: true,
};

function debtWithBalance(balanceCents: number): DebtRow {
  return {
    id: "debt-1",
    name: "Card",
    balanceCents,
    apr: 0.2,
    minimumPaymentCents: 5_000,
  };
}

// Feature: app-screens, Property 23: One plan per week, unchanged once stored
describe("Property 23: One plan per week, unchanged once stored", () => {
  it("stores exactly one unchanged plan per Monday, whatever the dates and concurrency", async () => {
    await fc.assert(
      fc.asyncProperty(stepsArb, async (steps) => {
        const db = openCrypt(`test-${(counter += 1)}`, { indexedDB, IDBKeyRange });
        try {
          await db.profile.put({ id: "profile", monthlyIncomeCents: MONTHLY_INCOME_CENTS });
          await db.subscriptions.put(subscription);

          vi.mocked(generateExorcismPlan).mockClear();
          const firstRows = new Map<LocalDate, WeeklyPlanRow>();
          const expectedStart = new Map<LocalDate, number>();

          for (const step of steps) {
            const now = addDays(BASE_DATE, step.dayOffset);
            const weekKey = getPlanWeekStart(now);
            // Change the Crypt between steps so a regenerated plan would differ.
            await db.debts.put(debtWithBalance(step.balanceCents));

            if (!firstRows.has(weekKey)) {
              const snapshot = toFinancialSnapshot(await readAllRows(db), now);
              expectedStart.set(weekKey, computeHouseState(snapshot).lightScore);
            }

            const results = await Promise.all(
              Array.from({ length: step.concurrent }, () => ensureWeeklyPlan(db, now)),
            );
            const first = firstRows.get(weekKey);
            for (const result of results) {
              expect(result.weekKey).toBe(weekKey);
              expect(result).toEqual(first ?? results[0]);
            }
            if (!first) firstRows.set(weekKey, results[0]);
          }

          expect(vi.mocked(generateExorcismPlan)).toHaveBeenCalledTimes(firstRows.size);
          const stored = await db.weeklyPlans.toArray();
          expect(stored).toHaveLength(firstRows.size);
          expect(new Set(stored.map((row) => row.weekKey))).toEqual(
            new Set(firstRows.keys()),
          );
          for (const row of stored) {
            expect(row).toEqual(firstRows.get(row.weekKey));
            expect(row.actions).toHaveLength(PLAN_ACTION_COUNT);
            expect(row.startLightScore).toBe(expectedStart.get(row.weekKey));
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
