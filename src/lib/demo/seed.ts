// Pure demo scenario seeds (one per decay level). Fictional names only.
// No React, Dexie or Next.js imports; money is integer cents.
import type {
  CryptRows,
  DebtRow,
  LocalDate,
  ProfileRow,
  ScenarioId,
  SubscriptionRow,
  TransactionRow,
  Usage,
} from "@/types/finance";
import { addDays } from "@/lib/utils/calendar";

export type SeedData = Omit<CryptRows, "plans"> & { profile: ProfileRow };

const CENTS = 100;
const ID_PREFIX = "demo";
/** Transaction dates spread over the 23 days ending on demoNow (Requirement 17.4). */
const TRANSACTION_SPREAD_DAYS = 23;
const COFFEE_L4_COUNT = 30;
const COFFEE_L4_AMOUNT_CENTS = 1200;
const L5_TRANSACTION_COUNT = 30;
const L5_AMOUNT_CENTS = 1000;

/** Cents from a dollar figure written with at most two decimals. */
function usd(dollars: number): number {
  return Math.round(dollars * CENTS);
}

type DebtSeed = {
  name: string;
  balance: number;
  apr: number;
  minimum: number;
};
type SubscriptionSeed = { name: string; amount: number; usage: Usage };
type TransactionSeed = {
  description: string;
  category: string;
  amountCents: number;
  offset: number;
};
type ScenarioSeed = {
  monthlyIncome: number;
  debts: DebtSeed[];
  subscriptions: SubscriptionSeed[];
  transactions: TransactionSeed[];
};

const COFFEE = "Coffee";
const SNACK = "Snack";
const BUS_FARE = "Bus fare";
const LUNCH = "Lunch";
const VENDING = "Vending machine";
const CATEGORY_COFFEE = "Coffee";
const CATEGORY_FOOD = "Food";
const CATEGORY_TRANSPORT = "Transport";

function tx(
  description: string,
  category: string,
  dollars: number,
  offset: number,
): TransactionSeed {
  return { description, category, amountCents: usd(dollars), offset };
}

const COFFEE_TX = (dollars: number, offset: number): TransactionSeed =>
  tx(COFFEE, CATEGORY_COFFEE, dollars, offset);
const SNACK_TX = (dollars: number, offset: number): TransactionSeed =>
  tx(SNACK, CATEGORY_FOOD, dollars, offset);
const BUS_TX = (dollars: number, offset: number): TransactionSeed =>
  tx(BUS_FARE, CATEGORY_TRANSPORT, dollars, offset);

/** Level 4: 30 × $12.00 "Coffee", offsets cycling through 0..22. */
function level4Transactions(): TransactionSeed[] {
  return Array.from({ length: COFFEE_L4_COUNT }, (_, i) => ({
    description: COFFEE,
    category: CATEGORY_COFFEE,
    amountCents: COFFEE_L4_AMOUNT_CENTS,
    offset: i % TRANSACTION_SPREAD_DAYS,
  }));
}

/** Level 5: 30 × $10.00 cycling through five kinds of small expense. */
function level5Transactions(): TransactionSeed[] {
  const kinds: Array<[string, string]> = [
    [COFFEE, CATEGORY_COFFEE],
    [SNACK, CATEGORY_FOOD],
    [BUS_FARE, CATEGORY_TRANSPORT],
    [LUNCH, CATEGORY_FOOD],
    [VENDING, CATEGORY_FOOD],
  ];
  return Array.from({ length: L5_TRANSACTION_COUNT }, (_, i) => {
    const [description, category] = kinds[i % kinds.length];
    return {
      description,
      category,
      amountCents: L5_AMOUNT_CENTS,
      offset: i % TRANSACTION_SPREAD_DAYS,
    };
  });
}

const SCENARIOS: Record<ScenarioId, ScenarioSeed> = {
  "level-1": {
    monthlyIncome: 5000,
    debts: [{ name: "Personal loan", balance: 3000, apr: 0.08, minimum: 100 }],
    subscriptions: [{ name: "Music streaming", amount: 15, usage: "often" }],
    transactions: [COFFEE_TX(4.5, 0), SNACK_TX(6, 1), BUS_TX(3.25, 2)],
  },
  "level-2": {
    monthlyIncome: 4000,
    debts: [
      { name: "Furniture loan", balance: 8000, apr: 0.12, minimum: 200 },
      { name: "Laptop loan", balance: 2000, apr: 0.1, minimum: 60 },
    ],
    subscriptions: [
      { name: "Movie streaming", amount: 50, usage: "rarely" },
      { name: "Music streaming", amount: 15, usage: "often" },
    ],
    transactions: [
      COFFEE_TX(4.5, 0),
      COFFEE_TX(4.5, 1),
      SNACK_TX(6, 2),
      BUS_TX(3.25, 3),
    ],
  },
  "level-3": {
    monthlyIncome: 3500,
    debts: [
      { name: "Home repair loan", balance: 15000, apr: 0.14, minimum: 350 },
      { name: "Store card", balance: 5000, apr: 0.19, minimum: 100 },
    ],
    subscriptions: [
      { name: "Movie streaming", amount: 80, usage: "rarely" },
      { name: "Gym membership", amount: 50, usage: "often" },
      { name: "News digest", amount: 15, usage: "never" },
    ],
    transactions: [
      COFFEE_TX(5, 0),
      SNACK_TX(7.5, 1),
      BUS_TX(3.25, 2),
      COFFEE_TX(4.5, 3),
      SNACK_TX(9, 4),
    ],
  },
  "level-4": {
    monthlyIncome: 3000,
    debts: [
      { name: "Scarlet Moth Card", balance: 18000, apr: 0.22, minimum: 400 },
      { name: "Car loan", balance: 6000, apr: 0.18, minimum: 150 },
      { name: "Student loan", balance: 2000, apr: 0.12, minimum: 60 },
    ],
    subscriptions: [
      { name: "Wraithcast", amount: 120, usage: "never" },
      { name: "Dirgebox", amount: 60, usage: "rarely" },
      { name: "Gravelift Gym", amount: 50, usage: "often" },
      { name: "Mistlocker", amount: 30, usage: "often" },
      { name: "Gloom Gazette", amount: 15.49, usage: "never" },
    ],
    transactions: level4Transactions(),
  },
  "level-5": {
    monthlyIncome: 2500,
    debts: [
      { name: "Family loan", balance: 35000, apr: 0.15, minimum: 700 },
      { name: "Card balance", balance: 12000, apr: 0.24, minimum: 250 },
      { name: "Tuition loan", balance: 5000, apr: 0.09, minimum: 120 },
    ],
    subscriptions: [
      { name: "Cable bundle", amount: 200, usage: "rarely" },
      { name: "Movie streaming", amount: 100, usage: "never" },
      { name: "Gym membership", amount: 80, usage: "never" },
      { name: "Meal kit", amount: 60, usage: "rarely" },
      { name: "Cloud storage", amount: 30, usage: "often" },
      { name: "News digest", amount: 15, usage: "never" },
    ],
    transactions: level5Transactions(),
  },
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function rowId(scenario: ScenarioId, kind: string, key: string | number): string {
  return `${ID_PREFIX}:${scenario}:${kind}:${key}`;
}

/** Builds the rows of one scenario. Pure and deterministic: same input, same output. */
export function buildScenario(id: ScenarioId, demoNow: LocalDate): SeedData {
  const seed = SCENARIOS[id];
  const debts: DebtRow[] = seed.debts.map((d) => ({
    id: rowId(id, "debt", slugify(d.name)),
    name: d.name,
    balanceCents: usd(d.balance),
    apr: d.apr,
    minimumPaymentCents: usd(d.minimum),
  }));
  const subscriptions: SubscriptionRow[] = seed.subscriptions.map((s) => ({
    id: rowId(id, "sub", slugify(s.name)),
    name: s.name,
    amountCents: usd(s.amount),
    cadence: "monthly",
    usage: s.usage,
    active: true,
  }));
  const transactions: TransactionRow[] = seed.transactions.map((t, index) => ({
    id: rowId(id, "tx", index),
    amountCents: t.amountCents,
    description: t.description,
    category: t.category,
    date: addDays(demoNow, -t.offset),
  }));
  return {
    profile: { monthlyIncomeCents: usd(seed.monthlyIncome) },
    debts,
    subscriptions,
    transactions,
    events: [],
  };
}
