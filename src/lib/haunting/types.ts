// Shared types for the haunting engine. Input types use decimal dollars;
// internal and output types use integer cents.

export type Cadence = "weekly" | "monthly" | "yearly";
export type Usage = "often" | "rarely" | "never";

export type InputDebt = {
  debtId: string;
  name: string;
  balance: number; // dollars (decimal) at input boundary
  minimumMonthlyPayment: number; // dollars (decimal) at input boundary
  apr: number; // 0–1
};

export type InputSubscription = {
  subscriptionId: string;
  name: string;
  amount: number; // dollars (decimal) at input boundary
  cadence: Cadence;
  usage: Usage;
  active: boolean;
};

export type InputTransaction = {
  transactionId: string;
  amount: number; // dollars (decimal) at input boundary
  description: string;
  category: string;
  date: string; // YYYY-MM-DD
};

export type FinancialEventType =
  | "debt_payment"
  | "subscription_canceled"
  | "exorcism_action_completed";

export type FinancialEvent = {
  // Money fields are already integer cents in the public input; convertToCents
  // passes them through, sanitising non-finite or negative values to 0.
  type: FinancialEventType;
  date: string; // YYYY-MM-DD
  amountCents?: number; // integer cents; used for subscription_canceled
  extraPrincipalCents?: number; // integer cents; used for debt_payment
};

export type FinancialSnapshot = {
  monthlyIncome: number; // dollars (decimal)
  debts: InputDebt[];
  subscriptions: InputSubscription[];
  transactions: InputTransaction[];
  events: FinancialEvent[]; // in-window events contribute to momentum
  now: string; // YYYY-MM-DD
};

// Internal representation: all amounts in integer cents.
export type InternalDebt = {
  debtId: string;
  name: string;
  balanceCents: number;
  minimumMonthlyPaymentCents: number;
  apr: number;
};

export type InternalSubscription = {
  subscriptionId: string;
  name: string;
  monthlyCostCents: number;
  usage: Usage;
  active: boolean;
  valid: boolean;
};

export type InternalTransaction = {
  transactionId: string;
  amountCents: number;
  description: string;
  category: string;
  date: string;
};

export type InternalSnapshot = {
  monthlyIncomeCents: number;
  debts: InternalDebt[];
  subscriptions: InternalSubscription[];
  transactions: InternalTransaction[];
  events: FinancialEvent[];
  now: string;
};

// Output of the Cents_Boundary: dollars already converted to integer cents,
// subscriptions not yet normalised to a monthly cost.
export type SubscriptionInCents = {
  subscriptionId: string;
  name: string;
  amountCents: number; // integer cents, per cadence period
  cadence: Cadence;
  usage: Usage;
  active: boolean;
};

export type CentsSnapshot = {
  monthlyIncomeCents: number;
  debts: InternalDebt[];
  subscriptions: SubscriptionInCents[];
  transactions: InternalTransaction[];
  events: FinancialEvent[];
  now: string;
};

// Output types: all amounts in integer cents.
export type Zombie = {
  subscriptionId: string;
  name: string;
  monthlyCost: number; // integer cents
  usage: Usage;
};

export type Ghost = {
  transactionId: string;
  amount: number; // integer cents
  description: string;
  category: string;
  date: string;
};

export type Poltergeist = {
  totalAmount: number; // integer cents
  transactionCount: number;
  byCategory: Record<string, number>; // integer cents; values sum to totalAmount
};

export type DecayLevel = 1 | 2 | 3 | 4 | 5;

export type HouseState = {
  lightScore: number; // real number [0, 100]; = min(100, baseScore + momentum)
  baseScore: number; // 100 / (1 + S), or exactly 0/100 on the zero-income path
  momentum: number; // bonus from in-window events; in [0, MOMENTUM_MAX]
  decayLevel: 1 | 2 | 3 | 4 | 5;
  windowBrightness: number; // lightScore / 100, in [0.0, 1.0]
  levelProgress: number; // position in current band, [0.0, 1.0]
  zombies: Zombie[];
  ghosts: Ghost[];
  poltergeist: Poltergeist | null;
};
