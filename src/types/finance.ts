// Shared persisted-domain types. All money is integer cents.

import type { ExorcismAction } from "@/lib/exorcism/types";
import type { Cadence, FinancialEventType, Usage } from "@/lib/haunting/types";

export type { Cadence, Usage };

/** Calendar date, YYYY-MM-DD. */
export type LocalDate = string;

export type ScenarioId =
  | "level-1"
  | "level-2"
  | "level-3"
  | "level-4"
  | "level-5";

export type ProfileRow = {
  monthlyIncomeCents: number;
  demoNow?: LocalDate;
  scenarioId?: ScenarioId;
};

export type DebtRow = {
  id: string;
  name: string;
  balanceCents: number;
  apr: number; // fraction 0..1
  minimumPaymentCents: number;
};

export type SubscriptionRow = {
  id: string;
  name: string;
  amountCents: number; // per cadence period
  cadence: Cadence;
  usage: Usage;
  active: boolean;
  canceledOn?: LocalDate;
};

export type TransactionRow = {
  id: string;
  amountCents: number;
  description: string;
  category: string;
  date: LocalDate;
};

export type EventType = FinancialEventType;

export type EventRow = {
  id: string;
  type: EventType;
  date: LocalDate;
  amountCents?: number;
  extraPrincipalCents?: number;
  refKey?: string; // dedupe key (e.g. subscription id or plan action key)
};

export type StoredPlanAction = ExorcismAction & {
  done: boolean;
  completedOn?: LocalDate;
};

export type WeeklyPlanRow = {
  weekKey: string;
  actions: StoredPlanAction[];
  startLightScore: number;
  generatedOn: LocalDate;
};

export type CryptRows = {
  /** Null when no profile row exists yet (Requirement 4.8: income is then 0). */
  profile: ProfileRow | null;
  debts: DebtRow[];
  subscriptions: SubscriptionRow[];
  transactions: TransactionRow[];
  events: EventRow[];
  plans: WeeklyPlanRow[];
};

export type DebtInput = Omit<DebtRow, "id">;
export type SubscriptionInput = Omit<SubscriptionRow, "id" | "canceledOn">;
export type TransactionInput = Omit<TransactionRow, "id">;
