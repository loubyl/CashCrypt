import { describe, expect, it } from "vitest";
import { getPlanActionSubtitle } from "@/lib/utils/planView";

describe("getPlanActionSubtitle", () => {
  it("keeps the instruction while the action is pending", () => {
    expect(getPlanActionSubtitle({ done: false, subtitle: "Open Subscriptions to cancel it" })).toBe(
      "Open Subscriptions to cancel it",
    );
  });

  it("shows Done with the completion date once the action is done", () => {
    expect(
      getPlanActionSubtitle({ done: true, subtitle: "Open Subscriptions to cancel it", completedOn: "2026-11-19" }),
    ).toBe("Done Nov 19");
  });

  it("shows just Done when the completion date is missing", () => {
    expect(getPlanActionSubtitle({ done: true, subtitle: "Open Debts to log the payment" })).toBe("Done");
  });
});
