import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { openCrypt } from "@/lib/db/crypt";
import { readAllRows } from "@/lib/db/queries";
import { CRYPT_DB_NAME, DEMO_DB_NAME, PROFILE_ID } from "@/lib/db/schema";
import { loadScenario, skipWeek } from "@/lib/demo/service";
import { addDays } from "@/lib/utils/calendar";
import type { LocalDate, ScenarioId } from "@/types/finance";

const NUM_RUNS = 100;
const BASE_DATE: LocalDate = "2000-01-01";
const MAX_DAY_OFFSET = 36_500;
const WEEK_DAYS = 7;

const SCENARIO_IDS: ScenarioId[] = ["level-1", "level-2", "level-3", "level-4", "level-5"];

const scenarioIdArb = fc.constantFrom(...SCENARIO_IDS);
const demoNowArb: fc.Arbitrary<LocalDate> = fc
  .integer({ min: 0, max: MAX_DAY_OFFSET })
  .map((days) => addDays(BASE_DATE, days));

function freshDb(name: string) {
  return openCrypt(name, { indexedDB: new IDBFactory(), IDBKeyRange });
}

describe("Property 31: Skipping a week only moves the date", () => {
  // Feature: app-screens, Property 31: Skipping a week only moves the date
  // **Validates: Requirements 18.6, 18.10**
  it("changes only the Profile demoNow, to seven days later", async () => {
    await fc.assert(
      fc.asyncProperty(scenarioIdArb, demoNowArb, async (id, demoNow) => {
        const db = freshDb(DEMO_DB_NAME);
        try {
          await db.open();
          await loadScenario(db, id, demoNow);
          const before = await readAllRows(db);
          expect(before.plans.length).toBeGreaterThan(0);

          const returned = await skipWeek(db);
          const expected = addDays(demoNow, WEEK_DAYS);
          expect(returned).toBe(expected);

          const after = await readAllRows(db);
          expect(after.profile).toEqual({ ...before.profile, demoNow: expected });
          expect(after.profile?.scenarioId).toBe(id);
          expect(after.debts).toEqual(before.debts);
          expect(after.subscriptions).toEqual(before.subscriptions);
          expect(after.transactions).toEqual(before.transactions);
          expect(after.events).toEqual(before.events);
          expect(after.plans).toEqual(before.plans);
          expect(await db.weeklyPlans.count()).toBe(before.plans.length);
          expect((await db.profile.get(PROFILE_ID))?.demoNow).toBe(expected);
        } finally {
          db.close();
          await db.delete();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: app-screens, Property 31: Skipping a week only moves the date
  // **Validates: Requirements 18.8**
  it("rejects on the Real_Crypt and writes nothing", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100_000_000 }),
        demoNowArb,
        async (income, demoNow) => {
          const db = freshDb(CRYPT_DB_NAME);
          try {
            await db.open();
            await db.profile.put({
              id: PROFILE_ID,
              monthlyIncomeCents: income,
              demoNow,
            } as never);
            const before = await readAllRows(db);

            await expect(skipWeek(db)).rejects.toThrow();

            expect(await readAllRows(db)).toEqual(before);
          } finally {
            db.close();
            await db.delete();
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
