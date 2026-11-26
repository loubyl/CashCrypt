import { describe, expect, it } from "vitest";
import type { ExorcismAction } from "@/lib/exorcism/types";
import { getGuideStep, getShortTitle, type DoItRows } from "@/lib/utils/planView";

function action(overrides: Partial<ExorcismAction>): ExorcismAction {
  return {
    id: "a",
    kind: "fallback",
    title: "Review last week's small expenses",
    subtitle: "",
    monthlyAmountCents: 0,
    priorityCents: 0,
    done: false,
    ...overrides,
  };
}

const cancel = action({
  id: "c",
  kind: "cancel_subscription",
  title: "Cancel Wraithcast — saves $120/mo",
  targetId: "sub-1",
});
const pay = action({
  id: "p",
  kind: "extra_payment",
  title: "Pay $300 extra on Scarlet Moth Card — saves interest",
  targetId: "debt-1",
});
const fallback = action({ id: "f", title: "Set aside $50 for an emergency fund" });

const rows: DoItRows = {
  subscriptions: [{ id: "sub-1", active: true }],
  debts: [{ id: "debt-1", balanceCents: 100000, minimumPaymentCents: 5000 }],
};

describe("getShortTitle", () => {
  it("returns the part before the separator", () => {
    expect(getShortTitle("Cancel Wraithcast — saves $120/mo")).toBe("Cancel Wraithcast");
  });

  it("returns the whole title when there is no separator", () => {
    expect(getShortTitle("Review small expenses")).toBe("Review small expenses");
  });
});

describe("getGuideStep", () => {
  it("names the zombie burial for a cancel action first", () => {
    expect(getGuideStep([cancel, pay, fallback], rows)).toBe(
      "Press Do it on Cancel Wraithcast and watch the zombie get buried",
    );
  });

  it("names the windows lighting up for a payment action", () => {
    expect(getGuideStep([{ ...cancel, done: true }, pay, fallback], rows)).toBe(
      "Press Do it on Pay $300 extra on Scarlet Moth Card and watch the windows light up",
    );
  });

  it("asks to tick the first not-done action when none has a Do it button", () => {
    expect(getGuideStep([{ ...cancel, done: true }, { ...pay, done: true }, fallback], rows)).toBe(
      "Tick Set aside $50 for an emergency fund in This week's exorcism once you've done it",
    );
  });

  it("reads the done text when all actions are done", () => {
    const done = [cancel, pay, fallback].map((item) => ({ ...item, done: true }));
    expect(getGuideStep(done, rows)).toBe(
      "This week's exorcism is done. Use Skip to next week in Demo controls for a new plan.",
    );
  });
});
