import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { openCrypt } from "@/lib/db/crypt";
import {
  CRYPT_DB_NAME,
  DEMO_DB_NAME,
  PROFILE_ID,
  type CryptDb,
} from "@/lib/db/schema";
import { loadScenario, resetDemo, skipWeek } from "@/lib/demo/service";
import { addDays } from "@/lib/utils/calendar";
import type { LocalDate, ScenarioId, StoredPlanAction } from "@/types/finance";

const NUM_RUNS = 100;
const BASE_DATE: LocalDate = "2000-01-01";
const MAX_DAY_OFFSET = 36_500;
const MAX_CENTS = 1_000_000_00;
const MAX_ROWS = 4;
const MAX_OPS = 6;

const SCENARIO_IDS: ScenarioId[] = [
  "level-1",
  "level-2",
  "level-3",
  "level-4",
  "level-5",
];

const dateArb: fc.Arbitrary<LocalDate> = fc
  .integer({ min: 0, max: MAX_DAY_OFFSET })
  .map((days) => addDays(BASE_DATE, days));
const centsArb = fc.integer({ min: 0, max: MAX_CENTS });
const textArb = fc.string({ maxLength: 12 });

const realRowsArb = fc.record({
  profile: fc.option(
    fc.record({
      id: fc.constant(PROFILE_ID),
      monthlyIncomeCents: centsArb,
      demoNow: fc.option(dateArb, { nil: undefined }),
      scenarioId: fc.option(fc.constantFrom(...SCENARIO_IDS), { nil: undefined }),
    }),
    { nil: null },
  ),
  debts: fc.uniqueArray(
    fc.record({
      id: fc.uuid(),
      name: textArb,
      balanceCents: centsArb,
      apr: fc.double({ min: 0, max: 1, noNaN: true }),
      minimumPaymentCents: centsArb,
    }),
    { maxLength: MAX_ROWS, selector: (row) => row.id },
  ),
  subscriptions: fc.uniqueArray(
    fc.record({
      id: fc.uuid(),
      name: textArb,
      amountCents: centsArb,
      cadence: fc.constantFrom("weekly", "monthly", "yearly") as fc.Arbitrary<
        "weekly" | "monthly" | "yearly"
      >,
      usage: fc.constantFrom("often", "rarely", "never") as fc.Arbitrary<
        "often" | "rarely" | "never"
      >,
      active: fc.boolean(),
    }),
    { maxLength: MAX_ROWS, selector: (row) => row.id },
  ),
  transactions: fc.uniqueArray(
    fc.record({
      id: fc.uuid(),
      amountCents: centsArb,
      description: textArb,
      category: textArb,
      date: dateArb,
    }),
    { maxLength: MAX_ROWS, selector: (row) => row.id },
  ),
  events: fc.uniqueArray(
    fc.record({
      id: fc.uuid(),
      type: fc.constant("debt_payment" as const),
      date: dateArb,
      amountCents: centsArb,
      extraPrincipalCents: centsArb,
    }),
    { maxLength: MAX_ROWS, selector: (row) => row.id },
  ),
  weeklyPlans: fc.uniqueArray(
    fc.record({
      weekKey: dateArb,
      actions: fc.constant([] as StoredPlanAction[]),
      startLightScore: fc.double({ min: 0, max: 100, noNaN: true }),
      generatedOn: dateArb,
    }),
    { maxLength: MAX_ROWS, selector: (row) => row.weekKey },
  ),
});

type RealRows = typeof realRowsArb extends fc.Arbitrary<infer T> ? T : never;

type DemoOp =
  | { kind: "load"; id: ScenarioId; date: LocalDate }
  | { kind: "skip" }
  | { kind: "reset"; date: LocalDate };

const opArb: fc.Arbitrary<DemoOp> = fc.oneof(
  fc.record({
    kind: fc.constant("load" as const),
    id: fc.constantFrom(...SCENARIO_IDS),
    date: dateArb,
  }),
  fc.record({ kind: fc.constant("skip" as const) }),
  fc.record({ kind: fc.constant("reset" as const), date: dateArb }),
);

async function seedReal(db: CryptDb, rows: RealRows): Promise<void> {
  if (rows.profile) await db.profile.add(rows.profile);
  await db.debts.bulkAdd(rows.debts);
  await db.subscriptions.bulkAdd(rows.subscriptions);
  await db.transactions.bulkAdd(rows.transactions);
  await db.events.bulkAdd(rows.events);
  await db.weeklyPlans.bulkAdd(rows.weeklyPlans);
}

async function snapshot(db: CryptDb): Promise<string> {
  const tables = {
    profile: await db.profile.toArray(),
    debts: await db.debts.toArray(),
    subscriptions: await db.subscriptions.toArray(),
    transactions: await db.transactions.toArray(),
    events: await db.events.toArray(),
    weeklyPlans: await db.weeklyPlans.toArray(),
  };
  return JSON.stringify(tables);
}

async function runOp(db: CryptDb, op: DemoOp): Promise<void> {
  if (op.kind === "load") await loadScenario(db, op.id, op.date);
  else if (op.kind === "skip") await skipWeek(db);
  else await resetDemo(db, op.date);
}

async function withFreshCrypts(
  body: (real: CryptDb, demo: CryptDb) => Promise<void>,
): Promise<void> {
  const options = { indexedDB: new IDBFactory(), IDBKeyRange };
  const real = openCrypt(CRYPT_DB_NAME, options);
  const demo = openCrypt(DEMO_DB_NAME, options);
  try {
    await body(real, demo);
  } finally {
    real.close();
    demo.close();
    await real.delete();
    await demo.delete();
  }
}

describe("Property 29: demo operations never touch the real crypt", () => {
  // Feature: app-screens, Property 29: Demo operations never touch the real crypt
  // **Validates: Requirements 16.1, 16.3, 16.5, 16.6**
  it("leaves every real table identical after any demo operation sequence", async () => {
    await fc.assert(
      fc.asyncProperty(
        realRowsArb,
        fc.array(opArb, { maxLength: MAX_OPS }),
        async (rows, ops) => {
          await withFreshCrypts(async (real, demo) => {
            await seedReal(real, rows);
            const before = await snapshot(real);
            for (const op of ops) {
              // skip and reset reject while no scenario is loaded; that is fine here.
              await runOp(demo, op).catch(() => undefined);
            }
            expect(await snapshot(real)).toBe(before);
          });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: app-screens, Property 29: Demo operations never touch the real crypt
  // **Validates: Requirements 16.1, 16.3, 16.4, 16.5, 16.6**
  it("rejects demo operations called with the real db and writes nothing", async () => {
    await fc.assert(
      fc.asyncProperty(
        realRowsArb,
        fc.array(opArb, { minLength: 1, maxLength: MAX_OPS }),
        async (rows, ops) => {
          await withFreshCrypts(async (real, demo) => {
            await seedReal(real, rows);
            const realBefore = await snapshot(real);
            const demoBefore = await snapshot(demo);
            for (const op of ops) {
              await expect(runOp(real, op)).rejects.toThrow();
            }
            expect(await snapshot(real)).toBe(realBefore);
            expect(await snapshot(demo)).toBe(demoBefore);
          });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
