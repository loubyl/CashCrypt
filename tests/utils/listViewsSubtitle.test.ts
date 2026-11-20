import { describe, expect, it } from "vitest";
import { getTransactionSubtitle } from "@/lib/utils/listViews";

const base = { description: "Lunch", category: "Food", date: "2026-11-19", isGhost: false };

describe("getTransactionSubtitle", () => {
  it("shows the category and the date", () => {
    expect(getTransactionSubtitle(base)).toBe("Food · Nov 19");
  });

  it("drops the category when the description equals it", () => {
    expect(getTransactionSubtitle({ ...base, description: "Food" })).toBe("Nov 19");
  });

  it("ends with Ghost for a small expense", () => {
    expect(getTransactionSubtitle({ ...base, isGhost: true })).toBe("Food · Nov 19 · Ghost");
    expect(getTransactionSubtitle({ ...base, description: "Food", isGhost: true })).toBe("Nov 19 · Ghost");
  });
});
