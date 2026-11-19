// Demo_Crypt service: load a scenario, skip a week, reset. Every function
// rejects on the Real_Crypt before any write. The clock is never read here.
import { assertDemoDb } from "@/lib/db/crypt";
import { ensureWeeklyPlan } from "@/lib/db/plans";
import { PROFILE_ID, type CryptDb } from "@/lib/db/schema";
import { buildScenario } from "@/lib/demo/seed";
import { addDays } from "@/lib/utils/calendar";
import type { LocalDate, ScenarioId } from "@/types/finance";

const WEEK_DAYS = 7;

function allTables(db: CryptDb) {
  return [
    db.profile,
    db.debts,
    db.subscriptions,
    db.transactions,
    db.events,
    db.weeklyPlans,
  ];
}

/**
 * Replaces the whole Demo_Crypt with one scenario and generates its plan for
 * the week of `demoNow`, in one rw transaction (the nested transaction opened
 * by ensureWeeklyPlan joins this one, so a failure rolls everything back).
 */
export async function loadScenario(
  db: CryptDb,
  id: ScenarioId,
  demoNow: LocalDate,
): Promise<void> {
  assertDemoDb(db);
  const seed = buildScenario(id, demoNow);
  await db.transaction("rw", allTables(db), async () => {
    await Promise.all(allTables(db).map((table) => table.clear()));
    await db.debts.bulkAdd(seed.debts);
    await db.subscriptions.bulkAdd(seed.subscriptions);
    await db.transactions.bulkAdd(seed.transactions);
    await db.events.bulkAdd(seed.events);
    await db.profile.add({
      ...seed.profile,
      id: PROFILE_ID,
      demoNow,
      scenarioId: id,
    });
    await ensureWeeklyPlan(db, demoNow);
  });
}

/** Moves `demoNow` seven days ahead and changes nothing else. Returns the new date. */
export async function skipWeek(db: CryptDb): Promise<LocalDate> {
  assertDemoDb(db);
  return db.transaction("rw", db.profile, async () => {
    const profile = await db.profile.get(PROFILE_ID);
    if (!profile?.demoNow) {
      throw new Error("The demo crypt has no scenario loaded.");
    }
    const next = addDays(profile.demoNow, WEEK_DAYS);
    await db.profile.update(PROFILE_ID, { demoNow: next });
    return next;
  });
}

/** Reloads the current scenario with `today` as the demo date. */
export async function resetDemo(db: CryptDb, today: LocalDate): Promise<void> {
  assertDemoDb(db);
  const profile = await db.profile.get(PROFILE_ID);
  if (!profile?.scenarioId) {
    throw new Error("The demo crypt has no scenario loaded.");
  }
  await loadScenario(db, profile.scenarioId, today);
}
