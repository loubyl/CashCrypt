import { describe, expect, it } from "vitest";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import type { CryptRows } from "@/types/finance";

const NOW = "2025-01-08";
const EMPTY: CryptRows = {
  profile: null,
  debts: [],
  subscriptions: [],
  transactions: [],
  events: [],
  plans: [],
};

describe("toFinancialSnapshot profile", () => {
  it("maps a null profile to monthly income 0", () => {
    expect(toFinancialSnapshot(EMPTY, NOW).monthlyIncome).toBe(0);
  });

  it("maps a stored profile's income from cents to dollars", () => {
    const rows: CryptRows = { ...EMPTY, profile: { monthlyIncomeCents: 312_345 } };
    expect(toFinancialSnapshot(rows, NOW).monthlyIncome).toBe(3123.45);
  });
});
