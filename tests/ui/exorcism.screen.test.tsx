// Exorcism screen against a fake-indexeddb Real_Crypt: progress, money freed,
// completion message, toggle failures and the Do it flows.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExorcismScreen } from "@/components/screens/ExorcismScreen";
import type { DebtRow, StoredPlanAction, SubscriptionRow, WeeklyPlanRow } from "@/types/finance";
import { readAllRows } from "@/lib/db/queries";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { computeHouseState } from "@/lib/haunting";
import { renderWithCrypt, type RealSeed } from "./helpers/crypt";

// Test control for completePlanAction: fail it, or hold it until released.
const control = vi.hoisted(() => ({
  fail: false,
  gate: null as Promise<void> | null,
}));

vi.mock("@/lib/db/mutations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/mutations")>();
  return {
    ...actual,
    completePlanAction: vi.fn(async (...args: Parameters<typeof actual.completePlanAction>) => {
      if (control.gate) await control.gate;
      if (control.fail) throw new Error("boom");
      return actual.completePlanAction(...args);
    }),
  };
});

const NOW = "2025-06-02";
const COMPLETE_MESSAGE = "Exorcism complete. The lights flicker back on.";
const ERROR_MESSAGE = "Could not save that action. Try again.";
const DO_IT_NAME = /^Do it:/;
const EXPLANATION = "Tap Do it to make the change here, or tick an action you did somewhere else.";
const LEVEL_NAMES = ["", "Pristine", "Uneasy", "Haunted", "Crumbling", "Condemned"];

const SUB: SubscriptionRow = {
  id: "sub-1",
  name: "Wraithcast",
  amountCents: 1_200,
  cadence: "monthly",
  usage: "never",
  active: true,
};
const DEBT: DebtRow = {
  id: "debt-card",
  name: "Gloom Card",
  balanceCents: 200_000,
  apr: 0.2,
  minimumPaymentCents: 5_000,
};

const CANCEL: StoredPlanAction = {
  id: "cancel:sub-1",
  kind: "cancel_subscription",
  title: "Cancel Wraithcast — saves $12/mo",
  subtitle: "Never used",
  targetId: SUB.id,
  monthlyAmountCents: 1_200,
  priorityCents: 1_200,
  done: false,
};
const PAY: StoredPlanAction = {
  id: "extra:debt-card",
  kind: "extra_payment",
  title: "Pay $100 extra on Gloom Card",
  subtitle: "Saves interest",
  targetId: DEBT.id,
  suggestedAmountCents: 10_000,
  monthlyAmountCents: 1_000,
  priorityCents: 1_000,
  done: false,
};
const REDUCE: StoredPlanAction = {
  id: "reduce:coffee",
  kind: "reduce_small_expenses",
  title: "Cut back on coffee runs",
  subtitle: "Small expenses",
  targetId: "coffee",
  monthlyAmountCents: 800,
  priorityCents: 800,
  done: false,
};
const FALLBACK: StoredPlanAction = {
  id: "fallback:review",
  kind: "fallback",
  title: "Review last week's small expenses",
  subtitle: "",
  monthlyAmountCents: 0,
  priorityCents: 0,
  done: false,
};

function plan(actions: StoredPlanAction[]): WeeklyPlanRow {
  return { weekKey: NOW, actions, startLightScore: 50, generatedOn: NOW };
}

async function renderScreen(actions: StoredPlanAction[], extra: RealSeed = {}) {
  const ctx = await renderWithCrypt(<ExorcismScreen />, {
    mode: "real",
    seed: { subscriptions: [SUB], debts: [DEBT], plans: [plan(actions)], ...extra },
    now: NOW,
  });
  await screen.findByText(/of 3 done/);
  await screen.findAllByRole("checkbox");
  return ctx;
}

const checkboxFor = (title: string) => screen.getByRole("checkbox", { name: `Mark "${title}" as done` });

beforeEach(() => {
  control.fail = false;
  control.gate = null;
});
afterEach(() => cleanup());

describe("Exorcism screen completion", () => {
  it("shows the result Card with the score change and level, announced politely, and hides the hint", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen([CANCEL, PAY, FALLBACK]);
    expect(screen.getByText(EXPLANATION)).toBeTruthy();
    // The polite live region exists before the Card appears, so its content is announced.
    const regions = Array.from(document.querySelectorAll('[role="status"][aria-live="polite"]'));
    const region = regions.find((el) => el.closest("main") !== null && el.textContent === "");
    expect(region).toBeTruthy();

    for (const action of [CANCEL, PAY, FALLBACK]) {
      await user.click(checkboxFor(action.title));
    }
    const message = await screen.findByText(COMPLETE_MESSAGE);
    expect(region?.contains(message)).toBe(true);
    const house = computeHouseState(toFinancialSnapshot(await readAllRows(ctx.realDb), NOW));
    const expected = `Light score 50 → ${Math.floor(house.lightScore)} · Level ${house.decayLevel} — ${LEVEL_NAMES[house.decayLevel]}`;
    expect(await within(region as HTMLElement).findByText(expected)).toBeTruthy();
    expect(screen.queryByText(EXPLANATION)).toBeNull();
  });

  it("replaces a done action's instruction with its completion date", async () => {
    const user = userEvent.setup();
    await renderScreen([CANCEL, PAY, FALLBACK]);
    expect(screen.getByText(CANCEL.subtitle)).toBeTruthy();
    await user.click(checkboxFor(CANCEL.title));
    await waitFor(() => expect(screen.queryByText(CANCEL.subtitle)).toBeNull());
    expect(screen.getByText("Done Jun 2")).toBeTruthy();
    // Pending actions keep their instruction.
    expect(screen.getByText(PAY.subtitle)).toBeTruthy();
  });
});

describe("Exorcism screen", () => {
  it("shows a skeleton while the plan is loading", async () => {
    await renderWithCrypt(<ExorcismScreen />, { now: NOW });
    expect(screen.getByText("Loading")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("updates the progress line and money freed after ticking an action", async () => {
    const user = userEvent.setup();
    await renderScreen([CANCEL, PAY, FALLBACK]);
    expect(screen.getByText(/0 of 3 done/)).toBeTruthy();
    expect(screen.getByText("$0/mo")).toBeTruthy();
    expect(screen.getByText("of $22/mo possible")).toBeTruthy();

    await user.click(checkboxFor(CANCEL.title));
    await screen.findByText(/1 of 3 done/);
    expect(screen.getByText("$12/mo")).toBeTruthy();
    expect(screen.queryByText(COMPLETE_MESSAGE)).toBeNull();
    expect(await screen.findByText("+$12/mo freed")).toBeTruthy();
  });

  it("shows the completion message when all three actions are done", async () => {
    const user = userEvent.setup();
    await renderScreen([CANCEL, PAY, FALLBACK]);
    for (const action of [CANCEL, PAY, FALLBACK]) {
      await user.click(checkboxFor(action.title));
    }
    expect(await screen.findByText(/3 of 3 done/)).toBeTruthy();
    expect(screen.getByText(COMPLETE_MESSAGE)).toBeTruthy();
    expect(screen.getByText("$22/mo")).toBeTruthy();
  });

  it("shows an error toast and leaves the row unchanged when saving fails", async () => {
    const user = userEvent.setup();
    await renderScreen([CANCEL, PAY, FALLBACK]);
    control.fail = true;
    await user.click(checkboxFor(CANCEL.title));
    expect(await screen.findByText(ERROR_MESSAGE)).toBeTruthy();
    const box = checkboxFor(CANCEL.title) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.disabled).toBe(false);
    expect(screen.getByText(/0 of 3 done/)).toBeTruthy();
  });

  it("disables the row while the action is saving", async () => {
    const user = userEvent.setup();
    await renderScreen([CANCEL, PAY, FALLBACK]);
    let release: () => void = () => undefined;
    control.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await user.click(checkboxFor(CANCEL.title));
    await waitFor(() => expect((checkboxFor(CANCEL.title) as HTMLInputElement).disabled).toBe(true));
    const row = document.querySelector(`[data-plan-action="${CANCEL.id}"]`) as HTMLElement;
    expect((within(row).getByRole("button", { name: DO_IT_NAME }) as HTMLButtonElement).disabled).toBe(true);
    release();
    await screen.findByText(/1 of 3 done/);
    expect((checkboxFor(CANCEL.title) as HTMLInputElement).disabled).toBe(false);
  });

  it("offers Do it only on cancellation and extra payment actions", async () => {
    await renderScreen([CANCEL, PAY, FALLBACK]);
    expect(screen.getAllByRole("button", { name: DO_IT_NAME })).toHaveLength(2);
    cleanup();
    await renderScreen([REDUCE, FALLBACK, { ...FALLBACK, id: "fallback:two", title: "Set aside $50" }]);
    expect(screen.queryByRole("button", { name: DO_IT_NAME })).toBeNull();
  });

  it("keeps the checkbox usable on an action that has Do it", async () => {
    const user = userEvent.setup();
    await renderScreen([CANCEL, PAY, FALLBACK]);
    expect(screen.getByRole("button", { name: `Do it: ${PAY.title}` })).toBeTruthy();
    await user.click(checkboxFor(PAY.title));
    await screen.findByText(/1 of 3 done/);
    expect((checkboxFor(PAY.title) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole("button", { name: `Do it: ${PAY.title}` })).toBeNull();
  });

  it("cancels a subscription from Do it, completes the action and shows one toast", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen([CANCEL, PAY, FALLBACK]);
    await user.click(screen.getByRole("button", { name: `Do it: ${CANCEL.title}` }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Cancel Wraithcast — saves $12/mo")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Cancel subscription" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText(/1 of 3 done/)).toBeTruthy();
    expect(screen.getAllByText(/\/mo (saved|freed)$/)).toHaveLength(1);
    expect(screen.getByText("+$12/mo saved")).toBeTruthy();
    expect((await ctx.realDb.subscriptions.get(SUB.id))?.active).toBe(false);
    expect((checkboxFor(CANCEL.title) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole("button", { name: `Do it: ${CANCEL.title}` })).toBeNull();
  });

  it("opens the payment sheet pre-filled, completes the action and shows one toast", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen([CANCEL, PAY, FALLBACK]);
    await user.click(screen.getByRole("button", { name: `Do it: ${PAY.title}` }));
    const dialog = await screen.findByRole("dialog");
    const input = (await within(dialog).findByLabelText("Payment amount")) as HTMLInputElement;
    expect(input.value).toBe("150.00");
    expect(within(dialog).getByText("Gloom Card")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Save payment" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText(/1 of 3 done/)).toBeTruthy();
    expect(screen.getAllByText(/^Payment saved|\/mo freed$/)).toHaveLength(1);
    expect((await ctx.realDb.debts.get(DEBT.id))?.balanceCents).toBe(185_000);
    expect((checkboxFor(PAY.title) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole("button", { name: `Do it: ${PAY.title}` })).toBeNull();
  });
});
