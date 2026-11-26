import { describe, expect, it } from "vitest";
import {
  getSmallExpenseSummary,
  sortDebtsByBalance,
  sortSubscriptionsByMonthlyCost,
} from "@/lib/utils/listViews";
import type { DebtRow, SubscriptionRow, TransactionRow } from "@/types/finance";

const sub = (id: string, amountCents: number, cadence: SubscriptionRow["cadence"]): SubscriptionRow => ({
  id,
  name: `Sub ${id}`,
  amountCents,
  cadence,
  usage: "often",
  active: true,
});

const debt = (id: string, balanceCents: number): DebtRow => ({
  id,
  name: `Debt ${id}`,
  balanceCents,
  apr: 0.1,
  minimumPaymentCents: 1000,
});

describe("sortSubscriptionsByMonthlyCost", () => {
  it("sorts by normalized monthly cost, highest first", () => {
    const rows = [sub("a", 1000, "monthly"), sub("b", 12000, "yearly"), sub("c", 500, "weekly")];
    const ids = sortSubscriptionsByMonthlyCost(rows).map((r) => r.id);
    expect(ids).toEqual(["c", "a", "b"]);
  });

  it("breaks ties by id ascending", () => {
    const rows = [sub("z", 1000, "monthly"), sub("m", 1000, "monthly")];
    expect(sortSubscriptionsByMonthlyCost(rows).map((r) => r.id)).toEqual(["m", "z"]);
  });

  it("does not mutate the input", () => {
    const rows = [sub("a", 100, "monthly"), sub("b", 900, "monthly")];
    const copy = [...rows];
    sortSubscriptionsByMonthlyCost(rows);
    expect(rows).toEqual(copy);
  });
});

describe("sortDebtsByBalance", () => {
  it("sorts by balance descending with id ascending tie-break", () => {
    const rows = [debt("b", 500), debt("a", 500), debt("c", 900)];
    expect(sortDebtsByBalance(rows).map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate the input", () => {
    const rows = [debt("a", 1), debt("b", 2)];
    const copy = [...rows];
    sortDebtsByBalance(rows);
    expect(rows).toEqual(copy);
  });
});

describe("getSmallExpenseSummary centsToWake", () => {
  const NOW = "2025-06-02";
  const tx = (id: string, amountCents: number, date = NOW): TransactionRow => ({
    id,
    amountCents,
    description: id,
    category: "Coffee",
    date,
  });
  it("is the threshold minus the total plus one cent for an income of $5,000", () => {
    const summary = getSmallExpenseSummary([tx("a", 300)], NOW, 500_000);
    expect(summary).toMatchObject({ totalCents: 300, thresholdCents: 50_000, awake: false, centsToWake: 49_701 });
  });
  it("needs one cent when the total equals the threshold, because the engine needs a strict excess", () => {
    const parts = [...Array.from({ length: 33 }, (_, i) => tx(`t${i}`, 1_499)), tx("last", 533)];
    const exact = getSmallExpenseSummary(parts, NOW, 500_000);
    expect(exact.totalCents).toBe(50_000);
    expect(exact.awake).toBe(false);
    expect(exact.centsToWake).toBe(1);
  });
  it("is null when awake, and null when the income is too low to wake it", () => {
    expect(getSmallExpenseSummary([tx("a", 1_400)], NOW, 10_000)).toMatchObject({ awake: true, centsToWake: null });
    expect(getSmallExpenseSummary([tx("a", 300)], NOW, 0)).toMatchObject({ awake: false, centsToWake: null });
  });
  it("ignores expenses outside the 30-day window and expenses at or above the threshold", () => {
    const summary = getSmallExpenseSummary([tx("old", 900, "2024-01-01"), tx("big", 4_000)], NOW, 500_000);
    expect(summary).toMatchObject({ totalCents: 0, centsToWake: 50_001 });
  });
});
