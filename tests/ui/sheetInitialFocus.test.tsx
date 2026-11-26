// Initial focus in sheets (action-feedback Requirements 6.1 to 6.7, 14.3, 14.7).
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { Landing } from "@/components/landing/Landing";
import { DebtsScreen } from "@/components/screens/DebtsScreen";
import { SubscriptionsScreen } from "@/components/screens/SubscriptionsScreen";
import type { DebtRow, SubscriptionRow } from "@/types/finance";
import { expectNoAxeViolations } from "./helpers/axe";
import { renderWithCrypt, resetNavigationMock } from "./helpers/crypt";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const DIALOG_ROLE = "dialog";
const ADD_EXPENSE_LABEL = "Add expense";
const AMOUNT_LABEL = "Amount";
const DO_IT_NAME = /^Do it: /;
const TYPED_DIGIT = "8";
const LOAD_TIMEOUT_MS = 5000;
const AXE_TIMEOUT_MS = 30000;
const CLOSE_LABEL = "Close";
const PAYMENT_AMOUNT_LABEL = "Payment amount";
const SAVE_DEBT_LABEL = "Save debt";
const REPLACING_DIGIT = "9";

const SCARLET: DebtRow = {
  id: "debt-scarlet",
  name: "Scarlet Moth Card",
  balanceCents: 180_000,
  apr: 0.24,
  minimumPaymentCents: 5_500,
};
const LOAN: DebtRow = {
  id: "debt-loan",
  name: "Lantern Loan",
  balanceCents: 90_000,
  apr: 0.05,
  minimumPaymentCents: 12_000,
};
const WRAITHCAST: SubscriptionRow = {
  id: "sub-wraith",
  name: "Wraithcast",
  amountCents: 12_000,
  cadence: "monthly",
  usage: "never",
  active: true,
};

type User = ReturnType<typeof userEvent.setup>;

async function openDebtsAdd(user: User): Promise<HTMLElement> {
  await renderWithCrypt(<DebtsScreen />, { mode: "real", seed: { debts: [SCARLET, LOAN] } });
  await user.click(await screen.findByRole("button", { name: "Add debt" }));
  return screen.findByRole(DIALOG_ROLE, { name: "Add debt" });
}

async function openDebtDetails(user: User): Promise<HTMLElement> {
  await renderWithCrypt(<DebtsScreen />, { mode: "real", seed: { debts: [SCARLET, LOAN] } });
  await user.click(await screen.findByRole("button", { name: /^Scarlet Moth Card, balance/ }));
  return screen.findByRole(DIALOG_ROLE, { name: "Scarlet Moth Card" });
}

async function openSubscriptionDetails(user: User): Promise<HTMLElement> {
  await renderWithCrypt(<SubscriptionsScreen />, { mode: "real", seed: { subscriptions: [WRAITHCAST] } });
  await user.click(await screen.findByRole("button", { name: /^Wraithcast, Never used/ }));
  return screen.findByRole(DIALOG_ROLE, { name: "Wraithcast" });
}

async function openAddExpenseFromDashboard(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await renderWithCrypt(<Dashboard />, { mode: "demo", seed: "level-4" });
  await screen.findAllByRole("button", { name: DO_IT_NAME }, { timeout: LOAD_TIMEOUT_MS });
  await user.click(screen.getByRole("button", { name: ADD_EXPENSE_LABEL }));
  await screen.findByRole(DIALOG_ROLE);
}

beforeEach(() => resetNavigationMock());
afterEach(() => cleanup());

describe("Initial focus in the Add expense sheet", () => {
  it("puts the first keystrokes into the Amount field without a click", async () => {
    const user = userEvent.setup();
    await openAddExpenseFromDashboard(user);
    await user.keyboard(TYPED_DIGIT);
    const amount = screen.getByLabelText(AMOUNT_LABEL) as HTMLInputElement;
    expect(amount.value).toBe(TYPED_DIGIT);
    expect(document.activeElement).toBe(amount);
  });

  it("keeps the sheet open and focuses the Amount field when Enter submits the empty form", async () => {
    const user = userEvent.setup();
    await openAddExpenseFromDashboard(user);
    await user.keyboard("{Enter}");
    const amount = screen.getByLabelText(AMOUNT_LABEL);
    expect(screen.queryByRole(DIALOG_ROLE)).not.toBeNull();
    expect(amount.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(amount);
  });
});

describe("Typing right after open fills the first Field", () => {
  it("fills Monthly income in the Onboarding sheet", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(<Landing />);
    await user.click(await screen.findByRole("button", { name: "Start my own crypt" }));
    await screen.findByRole(DIALOG_ROLE);
    await user.keyboard(TYPED_DIGIT);
    const income = screen.getByLabelText("Monthly income") as HTMLInputElement;
    expect(income.value).toBe(TYPED_DIGIT);
    expect(document.activeElement).toBe(income);
  });

  it("fills Name in the Add debt sheet", async () => {
    const user = userEvent.setup();
    const dialog = await openDebtsAdd(user);
    await user.keyboard("Moth");
    const name = within(dialog).getByLabelText("Name") as HTMLInputElement;
    expect(name.value).toBe("Moth");
    expect(document.activeElement).toBe(name);
  });

  it("fills Name in the Edit debt form of the debt details sheet", async () => {
    const user = userEvent.setup();
    const dialog = await openDebtDetails(user);
    const name = within(dialog).getByLabelText("Name") as HTMLInputElement;
    expect(document.activeElement).toBe(name);
    await user.keyboard("X");
    expect(name.value).toBe("X");
  });

  it("fills Name in the Add subscription sheet", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(<SubscriptionsScreen />, { mode: "real", seed: { subscriptions: [WRAITHCAST] } });
    await user.click(await screen.findByRole("button", { name: "Add subscription" }));
    const dialog = await screen.findByRole(DIALOG_ROLE, { name: "Add subscription" });
    await user.keyboard("Bone");
    const name = within(dialog).getByLabelText("Name") as HTMLInputElement;
    expect(name.value).toBe("Bone");
    expect(document.activeElement).toBe(name);
  });
});

describe("Log payment sheet focus", () => {
  it("selects the pre-filled amount of a Debt so typing replaces it", async () => {
    const user = userEvent.setup();
    const details = await openDebtDetails(user);
    await user.click(within(details).getByRole("button", { name: "Log payment" }));
    const payment = await screen.findByRole(DIALOG_ROLE, { name: "Log payment" });
    const amount = within(payment).getByLabelText(PAYMENT_AMOUNT_LABEL) as HTMLInputElement;
    expect(document.activeElement).toBe(amount);
    expect(amount.value).not.toBe("");
    expect(amount.selectionStart).toBe(0);
    expect(amount.selectionEnd).toBe(amount.value.length);
    await user.keyboard(REPLACING_DIGIT);
    expect(amount.value).toBe(REPLACING_DIGIT);
  });

  it("focuses the first Debt of the picker, and picking one moves focus to the amount", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(<Dashboard />, { mode: "real", seed: { debts: [SCARLET, LOAN] } });
    await user.click(await screen.findByRole("button", { name: "Log payment" }));
    const picker = await screen.findByRole(DIALOG_ROLE, { name: "Choose a debt" });
    const debtButtons = within(picker)
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-label") !== CLOSE_LABEL);
    expect(debtButtons.length).toBe(2);
    expect(document.activeElement).toBe(debtButtons[0]);
    await user.click(debtButtons[1]);
    const payment = await screen.findByRole(DIALOG_ROLE, { name: "Log payment" });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(payment).getByLabelText(PAYMENT_AMOUNT_LABEL)),
    );
  });
});

describe("A submit with errors", () => {
  it("focuses the first invalid Field of the Add debt sheet", async () => {
    const user = userEvent.setup();
    const dialog = await openDebtsAdd(user);
    await user.keyboard("No Balance");
    await user.click(within(dialog).getByRole("button", { name: SAVE_DEBT_LABEL }));
    const balance = within(dialog).getByLabelText("Current balance");
    await waitFor(() => expect(balance.getAttribute("aria-invalid")).toBe("true"));
    expect(document.activeElement).toBe(balance);
  });
});

describe("Sheets without a Field keep their current focus", () => {
  it("keeps the Close button focused in the subscription details sheet", async () => {
    const user = userEvent.setup();
    const details = await openSubscriptionDetails(user);
    expect(document.activeElement).toBe(within(details).getByRole("button", { name: CLOSE_LABEL }));
  });

  it("keeps the Close button focused in the cancel sheet", async () => {
    const user = userEvent.setup();
    const details = await openSubscriptionDetails(user);
    await user.click(within(details).getByRole("button", { name: "Cancel subscription" }));
    const confirm = await screen.findByRole(DIALOG_ROLE, { name: "Cancel subscription" });
    expect(document.activeElement).toBe(within(confirm).getByRole("button", { name: CLOSE_LABEL }));
  });

  it("keeps the Close button focused in the delete sheet", async () => {
    const user = userEvent.setup();
    const details = await openSubscriptionDetails(user);
    await user.click(within(details).getByRole("button", { name: /^Delete/ }));
    const confirm = await screen.findByRole(DIALOG_ROLE, { name: /^Delete / });
    expect(document.activeElement).toBe(within(confirm).getByRole("button", { name: CLOSE_LABEL }));
  });
});

describe("Escape and focus return", () => {
  it("closes the Add expense sheet on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    await openAddExpenseFromDashboard(user);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: ADD_EXPENSE_LABEL })),
    );
  });
});

describe("Sheet accessibility with the new initial focus", () => {
  it(
    "has no axe violations in the open Add expense sheet",
    async () => {
      const user = userEvent.setup();
      await openAddExpenseFromDashboard(user);
      await expectNoAxeViolations(document.body);
    },
    AXE_TIMEOUT_MS,
  );
});
