// Weekly plan service. The only place that generates a plan (Requirement 14).
// The clock is never read here: `now` is always passed in.
import { readAllRows } from "@/lib/db/queries";
import type { CryptDb } from "@/lib/db/schema";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { generateExorcismPlan } from "@/lib/exorcism";
import { computeHouseState } from "@/lib/haunting";
import { getPlanWeekStart, type LocalDate } from "@/lib/utils/calendar";
import type { StoredPlanAction, WeeklyPlanRow } from "@/types/finance";

const CONSTRAINT_ERROR_NAME = "ConstraintError";

function isConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === CONSTRAINT_ERROR_NAME
  );
}

function generateRow(
  rows: Awaited<ReturnType<typeof readAllRows>>,
  weekKey: LocalDate,
  now: LocalDate,
): WeeklyPlanRow {
  const snapshot = toFinancialSnapshot(rows, now);
  const houseState = computeHouseState(snapshot);
  const actions: StoredPlanAction[] = generateExorcismPlan(
    houseState,
    snapshot,
  ).map((action) => ({ ...action, done: false }));
  return {
    weekKey,
    actions,
    startLightScore: houseState.lightScore,
    generatedOn: now,
  };
}

/**
 * Returns the stored plan for the week of `now`, generating and storing it
 * when none exists. Runs in one rw transaction over every table. A concurrent
 * duplicate insert (primary-key ConstraintError) is answered with a fresh read.
 */
export async function ensureWeeklyPlan(
  db: CryptDb,
  now: LocalDate,
): Promise<WeeklyPlanRow> {
  const weekKey = getPlanWeekStart(now);
  const tables = [
    db.profile,
    db.debts,
    db.subscriptions,
    db.transactions,
    db.events,
    db.weeklyPlans,
  ];
  try {
    return await db.transaction("rw", tables, async () => {
      const existing = await db.weeklyPlans.get(weekKey);
      if (existing) return existing;
      const row = generateRow(await readAllRows(db), weekKey, now);
      await db.weeklyPlans.add(row);
      return row;
    });
  } catch (error) {
    if (!isConstraintError(error)) throw error;
    const stored = await db.weeklyPlans.get(weekKey);
    if (!stored) throw error;
    return stored;
  }
}
