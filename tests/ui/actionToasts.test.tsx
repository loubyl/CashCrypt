// Action toasts and the row highlight, end to end (action-feedback Requirements 1.2-1.11, 3.1-3.9, 14.3).
// Real RowHighlightProvider and ToastRegion; only next/navigation is mocked.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { RowHighlightProvider } from "@/components/feedback/RowHighlightProvider";
import { DebtsScreen } from "@/components/screens/DebtsScreen";
import { TransactionsScreen } from "@/components/screens/TransactionsScreen";
import { getRowDomId } from "@/lib/utils/destinations";
import type { DebtRow } from "@/types/finance";
import {
  navigationSpies,
  renderWithCrypt,
  resetNavigationMock,
  setMockPathname,
  type CryptTestContext,
} from "./helpers/crypt";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const DIALOG_ROLE = "dialog";
const DO_IT_NAME = /^Do it: /;
const DASHBOARD_WAIT = { timeout: 5000 };
const CANCEL_LABEL = "Cancel subscription";
const SAVE_EXPENSE_LABEL = "Save expense";
const VIEW_TRANSACTIONS_NAME = "View in Transactions";
const TRANSACTIONS_LIST_LABEL = "Last 30 days";
const DEBTS_LIST_LABEL = "Your debts";

const SCARLET: DebtRow = {
  id: "debt-scarlet",
  name: "Scarlet Moth Card",
  balanceCents: 180_000,
  apr: 0.24,
  minimumPaymentCents: 5_500,
};

type User = ReturnType<typeof userEvent.setup>;

function withHighlight(node: ReactNode) {
  return <RowHighlightProvider>{node}</RowHighlightProvider>;
}

async function renderDemoDashboard(): Promise<CryptTestContext> {
  const ctx = await renderWithCrypt(withHighlight(<Dashboard />), { mode: "demo", seed: "level-4" });
  await screen.findAllByRole("button", { name: DO_IT_NAME }, DASHBOARD_WAIT);
  return ctx;
}

async function renderDebts(seed: { debts?: DebtRow[] } = {}): Promise<CryptTestContext> {
  const ctx = await renderWithCrypt(withHighlight(<DebtsScreen />), {
    mode: "real",
    seed,
    pathname: "/debts",
  });
  await screen.findByRole("button", { name: "Add debt" });
  return ctx;
}

async function addExpenseFromDashboard(user: User, amount: string, description: string) {
  await user.click(screen.getByRole("button", { name: "Add expense" }));
  const dialog = await screen.findByRole(DIALOG_ROLE);
  await user.type(within(dialog).getByLabelText("Amount"), amount);
  await user.type(within(dialog).getByLabelText("What was it?"), description);
  await user.click(within(dialog).getByRole("button", { name: SAVE_EXPENSE_LABEL }));
}

function politeAnnouncements(): string[] {
  return screen.getAllByRole("status").map((region) => region.textContent ?? "");
}

beforeEach(() => {
  resetNavigationMock();
  // jsdom does not implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

describe("measured toast of a cancellation", () => {
  it("reads +$120/mo saved with the measured light change when Wraithcast is canceled", async () => {
    const user = userEvent.setup();
    await renderDemoDashboard();
    const doIt = screen.getAllByRole("button", { name: DO_IT_NAME }).find((button) =>
      button.getAttribute("aria-label")?.includes("Wraithcast"),
    );
    expect(doIt).toBeTruthy();
    await user.click(doIt as HTMLElement);
    const dialog = await screen.findByRole(DIALOG_ROLE);
    await user.click(within(dialog).getByRole("button", { name: CANCEL_LABEL }));
    expect(await screen.findByText("+$120/mo saved \u00b7 Light +5.2")).toBeTruthy();
  });
});

describe("expense toasts", () => {
  it("reads the ghost text for an expense under the small-expense threshold", async () => {
    const user = userEvent.setup();
    await renderDemoDashboard();
    await addExpenseFromDashboard(user, "8", "Black coffee");
    expect(
      await screen.findByText("Ghost added: $8 \u00b7 feeds the Poltergeist, doesn't dim the light"),
    ).toBeTruthy();
  });

  it("reads the plain expense text for a larger expense", async () => {
    const user = userEvent.setup();
    await renderDemoDashboard();
    await addExpenseFromDashboard(user, "40", "Crypt keeper dinner");
    expect(await screen.findByText("Expense added: $40 \u00b7 doesn't change the light")).toBeTruthy();
  });

  it("reads Expense deleted with the neutral clause after deleting an expense", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(withHighlight(<TransactionsScreen />), {
      mode: "demo",
      seed: "level-4",
      pathname: "/transactions",
    });
    await screen.findByRole("button", { name: "Add expense" });
    await user.click((await screen.findAllByRole("button", { name: /, spent \$/ }))[0]);
    const sheet = await screen.findByRole(DIALOG_ROLE);
    await user.click(within(sheet).getByRole("button", { name: "Delete expense" }));
    const confirm = await screen.findByRole(DIALOG_ROLE, { name: /^Delete / });
    await user.click(within(confirm).getByRole("button", { name: "Delete expense" }));
    expect(await screen.findByText("Expense deleted \u00b7 doesn't change the light")).toBeTruthy();
  });

  it("reads Debt deleted with a measured light clause after deleting a debt", async () => {
    const user = userEvent.setup();
    await renderDebts({ debts: [SCARLET] });
    await user.click(screen.getByRole("button", { name: /^Scarlet Moth Card, balance/ }));
    const sheet = await screen.findByRole(DIALOG_ROLE, { name: SCARLET.name });
    await user.click(within(sheet).getByRole("button", { name: "Delete debt" }));
    const confirm = await screen.findByRole(DIALOG_ROLE, { name: `Delete ${SCARLET.name}?` });
    await user.click(within(confirm).getByRole("button", { name: "Delete debt" }));
    expect(await screen.findByText(/^Debt deleted \u00b7 Light [+\u2212]\d+\.\d$/)).toBeTruthy();
  });
});

describe("View in Transactions", () => {
  it("navigates, then focuses the new row and announces it once the destination renders", async () => {
    const user = userEvent.setup();
    const ctx = await renderDemoDashboard();
    const description = "Midnight espresso";
    await addExpenseFromDashboard(user, "8", description);
    await screen.findByText(/^Ghost added: /);

    await user.click(await screen.findByRole("button", { name: VIEW_TRANSACTIONS_NAME }));
    expect(navigationSpies.push).toHaveBeenCalledWith("/transactions");

    const stored = (await ctx.demoDb.transactions.toArray()).find((row) => row.description === description);
    expect(stored).toBeTruthy();
    // The router is mocked, so render the destination in the same providers by hand.
    setMockPathname("/transactions");
    ctx.rerenderWithCrypt(withHighlight(<TransactionsScreen />));

    const rowId = getRowDomId("transactions", (stored as { id: string }).id);
    await waitFor(() => {
      const row = document.getElementById(rowId);
      expect(row).not.toBeNull();
      expect(document.activeElement).toBe(row);
    });
    await waitFor(() =>
      expect(politeAnnouncements()).toContain(`${description} highlighted in ${TRANSACTIONS_LIST_LABEL}`),
    );
    expect(within(document.getElementById(rowId) as HTMLElement).getByText("New")).toBeTruthy();
  });
});

describe("adding a debt on /debts", () => {
  it("highlights the new row in place, keeps focus where it was and offers no View action", async () => {
    const user = userEvent.setup();
    const ctx = await renderDebts();
    await user.click(screen.getByRole("button", { name: "Add debt" }));
    const dialog = await screen.findByRole(DIALOG_ROLE);
    await user.type(within(dialog).getByLabelText("Name"), "Gloom Mortgage");
    await user.type(within(dialog).getByLabelText("Current balance"), "2500");
    await user.type(within(dialog).getByLabelText("APR (%)"), "7.5");
    await user.type(within(dialog).getByLabelText("Minimum monthly payment"), "150");
    await user.click(within(dialog).getByRole("button", { name: "Save debt" }));

    expect(await screen.findByText(/^Debt added: Gloom Mortgage, \$2,500/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    const stored = (await ctx.realDb.debts.toArray())[0];
    const row = await waitFor(() => {
      const found = document.getElementById(getRowDomId("debts", stored.id));
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    await waitFor(() => expect(within(row).getByText("New")).toBeTruthy());
    await waitFor(() =>
      expect(politeAnnouncements()).toContain(`Gloom Mortgage highlighted in ${DEBTS_LIST_LABEL}`),
    );
    expect(document.activeElement).not.toBe(row);
    expect(screen.queryByRole("button", { name: /^View/ })).toBeNull();
    expect(navigationSpies.push).not.toHaveBeenCalled();
  });
});

describe("demo control toasts", () => {
  it("keeps the Demo reset toast", async () => {
    const user = userEvent.setup();
    await renderDemoDashboard();
    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(await screen.findByText("Demo reset")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^View/ })).toBeNull();
  });

  it("keeps the Skipped to <date> toast", async () => {
    const user = userEvent.setup();
    await renderDemoDashboard();
    await user.click(screen.getByRole("button", { name: "Skip to next week" }));
    expect(await screen.findByText(/^Skipped to \d{4}-\d{2}-\d{2}$/)).toBeTruthy();
  });

  it("announces a scenario switch without a toast", async () => {
    const user = userEvent.setup();
    await renderDemoDashboard();
    await user.click(screen.getByRole("radio", { name: "Level 2" }));
    await waitFor(() => expect(politeAnnouncements()).toContain("Loaded demo level 2"));
    expect(screen.queryByText("Demo reset")).toBeNull();
    expect(screen.queryByText(/^Skipped to /)).toBeNull();
  });
});
