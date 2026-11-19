// Dexie schema for the crypt database. Only src/lib/db imports dexie.
import Dexie, { type DexieOptions, type Table } from "dexie";
import type {
  DebtRow,
  EventRow,
  ProfileRow,
  SubscriptionRow,
  TransactionRow,
  WeeklyPlanRow,
} from "@/types/finance";

export { MAX_MONEY_CENTS } from "@/lib/validation/limits";

export const CRYPT_DB_NAME = "cashcrypt";
export const DEMO_DB_NAME = "cashcrypt-demo";

/** ProfileRow has no key of its own, so the single profile row uses this fixed id. */
export const PROFILE_ID = "profile";

export type ProfileRecord = ProfileRow & { id: typeof PROFILE_ID };

const SCHEMA_VERSION = 1;

const STORES_V1 = {
  profile: "id",
  debts: "id",
  subscriptions: "id",
  transactions: "id, date",
  // refKey is unique; rows with an undefined refKey are not indexed.
  events: "id, date, type, &refKey",
  weeklyPlans: "weekKey",
} as const;

export class CryptDb extends Dexie {
  profile!: Table<ProfileRecord, string>;
  debts!: Table<DebtRow, string>;
  subscriptions!: Table<SubscriptionRow, string>;
  transactions!: Table<TransactionRow, string>;
  events!: Table<EventRow, string>;
  weeklyPlans!: Table<WeeklyPlanRow, string>;

  constructor(name: string, options?: DexieOptions) {
    super(name, options);
    this.version(SCHEMA_VERSION).stores(STORES_V1);
  }
}
