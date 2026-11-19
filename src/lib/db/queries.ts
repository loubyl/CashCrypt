// Read-only queries over the crypt database. Only src/lib/db imports dexie.
import { isInWindow } from "@/lib/haunting/dates";
import type {
  CryptRows,
  LocalDate,
  TransactionRow,
  WeeklyPlanRow,
} from "@/types/finance";
import { DbNotFoundError } from "./errors";
import { PROFILE_ID, type CryptDb } from "./schema";

/** Date descending, then id ascending (code-point order, not locale order). */
function compareTransactions(a: TransactionRow, b: TransactionRow): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** Reads every table in one read-only transaction so the rows are consistent. */
export function readAllRows(db: CryptDb): Promise<CryptRows> {
  return db.transaction(
    "r",
    [
      db.profile,
      db.debts,
      db.subscriptions,
      db.transactions,
      db.events,
      db.weeklyPlans,
    ],
    async (): Promise<CryptRows> => {
      const [record, debts, subscriptions, transactions, events, plans] =
        await Promise.all([
          db.profile.get(PROFILE_ID),
          db.debts.toArray(),
          db.subscriptions.toArray(),
          db.transactions.toArray(),
          db.events.toArray(),
          db.weeklyPlans.toArray(),
        ]);
      if (record === undefined) throw new DbNotFoundError(PROFILE_ID);
      const { id: _id, ...profile } = record;
      void _id;
      return { profile, debts, subscriptions, transactions, events, plans };
    },
  );
}

/**
 * Transactions inside the engine's 30-day window ending on `now`, using the
 * same boundaries as `isInWindow`. Sorted by date descending, then id ascending.
 */
export async function getTransactionsInWindow(
  db: CryptDb,
  now: LocalDate,
): Promise<TransactionRow[]> {
  const all = await db.transactions.toArray();
  return all.filter((t) => isInWindow(t.date, now)).sort(compareTransactions);
}

/** The stored plan for a Monday-based week key, or null when none exists. */
export async function getPlan(
  db: CryptDb,
  weekKey: LocalDate,
): Promise<WeeklyPlanRow | null> {
  const plan = await db.weeklyPlans.get(weekKey);
  return plan ?? null;
}
