import { describe, expect, it } from "vitest";
import { generateExorcismPlan } from "@/lib/exorcism";
import { computeHouseState } from "@/lib/haunting";
import type { FinancialSnapshot, HouseState } from "@/lib/haunting";
import type { Usage } from "@/lib/haunting/types";

const NOW = "2025-06-16";
const COFFEE_COUNT = 30;
const COFFEE_AMOUNT = 12;

function emptySnapshot(overrides: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  return {
    monthlyIncome: 0,
    debts: [],
    subscriptions: [],
    transactions: [],
    events: [],
    now: NOW,
    ...overrides,
  };
}

function subscription(id: string, name: string, amount: number, usage: Usage) {
  return {
    subscriptionId: id,
    name,
    amount,
    cadence: "monthly" as const,
    usage,
    active: true,
  };
}

function coffeeTransactions(): FinancialSnapshot["transactions"] {
  return Array.from({ length: COFFEE_COUNT }, (_, index) => ({
    transactionId: `tx-${index}`,
    amount: COFFEE_AMOUNT,
    description: "Coffee",
    category: "Coffee",
    date: `2025-06-${String(16 - (index % 16)).padStart(2, "0")}`,
  }));
}

function levelFourSnapshot(): FinancialSnapshot {
  return emptySnapshot({
    monthlyIncome: 3000,
    debts: [
      { debtId: "scarlet", name: "Scarlet Moth Card", balance: 18000, minimumMonthlyPayment: 400, apr: 0.22 },
      { debtId: "car", name: "Car loan", balance: 6000, minimumMonthlyPayment: 150, apr: 0.18 },
      { debtId: "student", name: "Student loan", balance: 2000, minimumMonthlyPayment: 60, apr: 0.12 },
    ],
    subscriptions: [
      subscription("wraithcast", "Wraithcast", 120, "never"),
      subscription("dirgebox", "Dirgebox", 60, "rarely"),
      subscription("gym", "Gravelift Gym", 50, "often"),
      subscription("mistlocker", "Mistlocker", 30, "often"),
      subscription("gazette", "Gloom Gazette", 15.49, "never"),
    ],
    transactions: coffeeTransactions(),
  });
}

function withPoltergeist(
  state: HouseState,
  poltergeist: HouseState["poltergeist"],
): HouseState {
  return { ...state, poltergeist };
}

describe("generateExorcismPlan: L4 persona week 1", () => {
  const snapshot = levelFourSnapshot();
  const houseState = computeHouseState(snapshot);
  const plan = generateExorcismPlan(houseState, snapshot);

  it("has an active Poltergeist in the Coffee category", () => {
    expect(houseState.poltergeist).not.toBeNull();
    expect(houseState.poltergeist?.byCategory).toEqual({ Coffee: COFFEE_COUNT * COFFEE_AMOUNT * 100 });
  });

  it("returns exactly three actions in the order of Requirement 15.9", () => {
    expect(plan.map((action) => action.id)).toEqual([
      "cancel:wraithcast",
      "reduce:Coffee",
      "pay:scarlet",
    ]);
  });

  it("puts the $120 never-used cancellation first", () => {
    expect(plan[0]).toMatchObject({
      kind: "cancel_subscription",
      title: "Cancel Wraithcast — saves $120/mo",
      targetId: "wraithcast",
      monthlyAmountCents: 12000,
      priorityCents: 12000,
      done: false,
    });
  });

  it("puts the Coffee reduction second with a $60 excess", () => {
    expect(plan[1]).toMatchObject({
      kind: "reduce_small_expenses",
      title: "Cut Coffee by $60 this month to dispel the Poltergeist",
      targetId: "Coffee",
      monthlyAmountCents: 6000,
      priorityCents: 6000,
      subtitle: "Open Transactions to review it. Tick it when you are done.",
    });
  });

  it("forces the extra payment on Scarlet Moth Card into the third slot", () => {
    expect(plan[2]).toMatchObject({
      kind: "extra_payment",
      title: "Pay $300 extra on Scarlet Moth Card — saves $5.50/mo in interest",
      targetId: "scarlet",
      suggestedAmountCents: 30000,
      monthlyAmountCents: 550,
      priorityCents: 550,
    });
  });

  it("leaves out Dirgebox, which ranks above the extra payment", () => {
    expect(plan.some((action) => action.id === "cancel:dirgebox")).toBe(false);
    const dirgeboxOnly = {
      ...snapshot,
      subscriptions: [subscription("dirgebox", "Dirgebox", 60, "rarely")],
    };
    const dirgebox = generateExorcismPlan(computeHouseState(dirgeboxOnly), dirgeboxOnly);
    expect(dirgebox.find((action) => action.id === "cancel:dirgebox")).toMatchObject({
      title: "Cancel Dirgebox — saves $60/mo",
      priorityCents: 3600,
    });
  });
});

describe("generateExorcismPlan: extra payment already in the top three", () => {
  it("returns the plain top three and drops no candidate", () => {
    const snapshot = emptySnapshot({
      monthlyIncome: 3000,
      debts: [
        { debtId: "scarlet", name: "Scarlet Moth Card", balance: 18000, minimumMonthlyPayment: 400, apr: 0.22 },
      ],
      subscriptions: [subscription("lowcost", "Lowcost", 5, "rarely")],
    });
    const plan = generateExorcismPlan(computeHouseState(snapshot), snapshot);
    expect(plan.map((action) => action.id)).toEqual([
      "pay:scarlet",
      "cancel:lowcost",
      "fallback:emergency-fund",
    ]);
    expect(plan.map((action) => action.priorityCents)).toEqual([550, 300, 0]);
  });
});

describe("generateExorcismPlan: empty snapshot", () => {
  it("returns the three fallbacks in their fixed order", () => {
    const snapshot = emptySnapshot();
    const plan = generateExorcismPlan(computeHouseState(snapshot), snapshot);
    expect(plan).toHaveLength(3);
    expect(plan.map((action) => action.id)).toEqual([
      "fallback:emergency-fund",
      "fallback:review-small-expenses",
      "fallback:review-subscriptions",
    ]);
    expect(plan.every((action) => action.kind === "fallback")).toBe(true);
    expect(plan.every((action) => action.priorityCents === 0 && action.monthlyAmountCents === 0)).toBe(true);
    expect(plan[0].title).toBe("Set aside a small amount for an emergency fund");
  });

  it("gives each fallback its exact subtitle", () => {
    const snapshot = emptySnapshot();
    const plan = generateExorcismPlan(computeHouseState(snapshot), snapshot);
    expect(plan.map((action) => action.subtitle)).toEqual([
      "Move it to savings, then mark it done",
      "Open Transactions to review it",
      "Open Subscriptions to review it",
    ]);
  });
});

describe("generateExorcismPlan: no reduce_small_expenses candidate", () => {
  const snapshot = emptySnapshot({ monthlyIncome: 3000 });
  const base = computeHouseState(snapshot);
  const hasReduction = (state: HouseState) =>
    generateExorcismPlan(state, snapshot).some((action) => action.kind === "reduce_small_expenses");

  it("creates none without a Poltergeist", () => {
    expect(hasReduction(withPoltergeist(base, null))).toBe(false);
  });

  it("creates none when byCategory is empty", () => {
    expect(
      hasReduction(withPoltergeist(base, { totalAmount: 50000, transactionCount: 5, byCategory: {} })),
    ).toBe(false);
  });

  it("creates none when the excess is 0", () => {
    const threshold = 30000;
    expect(
      hasReduction(
        withPoltergeist(base, {
          totalAmount: threshold,
          transactionCount: 3,
          byCategory: { Coffee: threshold },
        }),
      ),
    ).toBe(false);
  });
});

describe("generateExorcismPlan: Poltergeist category tie", () => {
  // Regression for the compareText fix. U+FF5E "～" (code point 65374) is smaller than
  // U+1F600 "😀" (code point 128512), but in UTF-16 order "😀" (0xD83D…) sorts first.
  it('picks "～" over "😀" for {"😀":1,"～":1}, using code-point order', () => {
    const snapshot = emptySnapshot();
    const state = withPoltergeist(computeHouseState(snapshot), {
      totalAmount: 2,
      transactionCount: 2,
      byCategory: { "\u{1F600}": 1, "\uFF5E": 1 },
    });
    const reductions = generateExorcismPlan(state, snapshot).filter(
      (action) => action.kind === "reduce_small_expenses",
    );
    expect(reductions.map((action) => action.id)).toEqual(["reduce:\uFF5E"]);
  });
});
