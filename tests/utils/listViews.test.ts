import { describe, expect, it } from "vitest";
import { sortDebtsByBalance, sortSubscriptionsByMonthlyCost } from "@/lib/utils/listViews";
import type { DebtRow, SubscriptionRow } from "@/types/finance";

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
