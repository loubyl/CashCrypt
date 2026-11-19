import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generateExorcismPlan } from "@/lib/exorcism";
import { computeHouseState } from "@/lib/haunting";
import type {
  FinancialSnapshot,
  HouseState,
  InputDebt,
  InputSubscription,
  InputTransaction,
} from "@/lib/haunting/types";

const NUM_RUNS = 300;
const NOW = "2025-06-02";
const PLAN_SIZE = 3;
const CENTS_PER_DOLLAR = 100;
const MAX_ITEMS = 7;
const MAX_INCOME_DOLLARS = 6000;
const MAX_DEBT_DOLLARS = 20000;
const CATEGORIES = ["coffee", "snacks", "rides", "apps"] as const;
const USAGE_WEIGHT = { never: 1, rarely: 0.6, often: 0.2 } as const;
const EXTRA_PAYMENT_TENTH = 10; // 10% of income
const MONTHS = 12;
const RATIO_DENOMINATOR = 10; // POLTERGEIST_RATIO = 1/10, kept in exact integers

// Reference model: a second, simple implementation of Requirement 12 (criteria 1-17) and
// Requirement 13 fallbacks. Only ids and priorities are modelled.
type RefItem = { id: string; priority: number; fallback: boolean; extra: boolean };

function refCompare(a: RefItem, b: RefItem): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.fallback !== b.fallback) return a.fallback ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function refCandidates(house: HouseState, snapshot: FinancialSnapshot): RefItem[] {
  const items: RefItem[] = [];
  for (const z of house.zombies) {
    items.push({
      id: `cancel:${z.subscriptionId}`,
      priority: Math.round(z.monthlyCost * USAGE_WEIGHT[z.usage]),
      fallback: false,
      extra: false,
    });
  }
  const incomeCents = Math.round(snapshot.monthlyIncome * CENTS_PER_DOLLAR);
  const debts = snapshot.debts
    .map((d) => ({ id: d.debtId, apr: d.apr, cents: Math.round(d.balance * CENTS_PER_DOLLAR) }))
    .filter((d) => d.cents > 0)
    .sort((a, b) => b.apr - a.apr || b.cents - a.cents || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (debts.length > 0) {
    const target = debts[0];
    const tenPercentWholeDollars =
      Math.floor(incomeCents / EXTRA_PAYMENT_TENTH / CENTS_PER_DOLLAR) * CENTS_PER_DOLLAR;
    const suggested = Math.min(target.cents, tenPercentWholeDollars);
    if (suggested > 0) {
      items.push({
        id: `pay:${target.id}`,
        priority: Math.round((suggested * target.apr) / MONTHS),
        fallback: false,
        extra: true,
      });
    }
  }
  const p = house.poltergeist;
  if (p) {
    let best: string | null = null;
    for (const [cat, value] of Object.entries(p.byCategory)) {
      if (!(value > 0)) continue;
      if (best === null || value > p.byCategory[best] || (value === p.byCategory[best] && cat < best)) {
        best = cat;
      }
    }
    // Smallest whole-dollar amount (in cents) not below total - incomeCents / 10, in exact integers.
    const numerator = RATIO_DENOMINATOR * p.totalAmount - incomeCents;
    const excessDollars = Math.ceil(numerator / (RATIO_DENOMINATOR * CENTS_PER_DOLLAR));
    if (best !== null && excessDollars > 0) {
      items.push({
        id: `reduce:${best}`,
        priority: excessDollars * CENTS_PER_DOLLAR,
        fallback: false,
        extra: false,
      });
    }
  }
  return items;
}

const FALLBACK_ITEMS: RefItem[] = [
  "fallback:emergency-fund",
  "fallback:review-small-expenses",
  "fallback:review-subscriptions",
].map((id) => ({ id, priority: 0, fallback: true, extra: false }));

function referenceSelection(house: HouseState, snapshot: FinancialSnapshot): string[] {
  const ranking = [...refCandidates(house, snapshot), ...FALLBACK_ITEMS].sort(refCompare);
  const extra = ranking.find((item) => item.extra);
  const topThree = ranking.slice(0, PLAN_SIZE);
  if (extra === undefined || topThree.includes(extra)) return topThree.map((i) => i.id);
  const twoBest = ranking.filter((item) => !item.extra).slice(0, PLAN_SIZE - 1);
  return [...twoBest, extra].sort(refCompare).map((i) => i.id);
}

const debtArb = (index: number): fc.Arbitrary<InputDebt> =>
  fc.record({
    debtId: fc.constant(`debt-${index}`),
    name: fc.constantFrom("Visa", "Loan", "Car"),
    balance: fc
      .integer({ min: 0, max: MAX_DEBT_DOLLARS * CENTS_PER_DOLLAR })
      .map((c) => c / CENTS_PER_DOLLAR),
    minimumMonthlyPayment: fc.integer({ min: 0, max: 30000 }).map((c) => c / CENTS_PER_DOLLAR),
    apr: fc.constantFrom(0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.6, 1),
  });

const subArb = (index: number): fc.Arbitrary<InputSubscription> =>
  fc.record({
    subscriptionId: fc.constant(`sub-${index}`),
    name: fc.constantFrom("Stream", "Music", "Cloud"),
    amount: fc.integer({ min: 0, max: 40 }).map((n) => (n * 5) / 1),
    cadence: fc.constantFrom("weekly", "monthly", "yearly"),
    usage: fc.constantFrom("often", "rarely", "never"),
    active: fc.boolean(),
  });

const txArb = (index: number): fc.Arbitrary<InputTransaction> =>
  fc.record({
    transactionId: fc.constant(`tx-${index}`),
    amount: fc.integer({ min: 1, max: 1499 }).map((c) => c / CENTS_PER_DOLLAR),
    description: fc.constant("small"),
    category: fc.constantFrom(...CATEGORIES),
    date: fc.constant(NOW),
  });

function listArb<T>(make: (i: number) => fc.Arbitrary<T>, max: number): fc.Arbitrary<T[]> {
  return fc
    .integer({ min: 0, max })
    .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => make(i))) as fc.Arbitrary<T[]>);
}

const snapshotArb: fc.Arbitrary<FinancialSnapshot> = fc.record({
  monthlyIncome: fc.integer({ min: 0, max: MAX_INCOME_DOLLARS }),
  debts: listArb(debtArb, 4),
  subscriptions: listArb(subArb, MAX_ITEMS),
  transactions: listArb(txArb, 40),
  events: fc.constant<never[]>([]),
  now: fc.constant(NOW),
});

describe("exorcism plan selection against the reference rule", () => {
  it("returns the same ids in the same order as the reference selection", () => {
    // Feature: app-screens, Property 21: Selection matches the reference rule
    // **Validates: Requirements 12.16, 12.17, 13.1, 13.6, 13.9, 15.10**
    fc.assert(
      fc.property(snapshotArb, (snapshot) => {
        const house = computeHouseState(snapshot);
        const plan = generateExorcismPlan(house, snapshot);
        expect(plan.map((a) => a.id)).toEqual(referenceSelection(house, snapshot));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("keeps the extra payment and fills with the best two others when it ranks low", () => {
    // Feature: app-screens, Property 21: Selection matches the reference rule
    // **Validates: Requirements 12.16, 12.17, 13.6, 13.9**
    const lowExtraArb: fc.Arbitrary<FinancialSnapshot> = fc.record({
      monthlyIncome: fc.integer({ min: 2000, max: MAX_INCOME_DOLLARS }),
      debts: fc.constant<InputDebt[]>([
        { debtId: "debt-0", name: "Visa", balance: 5000, minimumMonthlyPayment: 50, apr: 0.01 },
      ]),
      subscriptions: listArb(subArb, MAX_ITEMS),
      transactions: listArb(txArb, 40),
      events: fc.constant<never[]>([]),
      now: fc.constant(NOW),
    });
    fc.assert(
      fc.property(lowExtraArb, (snapshot) => {
        const house = computeHouseState(snapshot);
        const plan = generateExorcismPlan(house, snapshot);
        expect(plan.map((a) => a.id)).toEqual(referenceSelection(house, snapshot));
        expect(plan.some((a) => a.id === "pay:debt-0")).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
