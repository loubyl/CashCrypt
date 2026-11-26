// Transactions screen against a fake-indexeddb Real_Crypt: window and order, Ghost chip,
// summary Card, Poltergeist text, empty state and the add expense flow.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { TransactionsScreen } from "@/components/screens/TransactionsScreen";
import type { TransactionRow } from "@/types/finance";
import { expectNoAxeViolations } from "./helpers/axe";
import { renderWithCrypt, type RealSeed } from "./helpers/crypt";

const AXE_TIMEOUT_MS = 30000;
const ADD_LABEL = "Add expense";
const DIALOG_ROLE = "dialog";
const GHOST_CHIP = "Ghost";
const POLTERGEIST_TEXT = "The Poltergeist is awake.";
const EMPTY_TEXT = "No ghosts this month. The house is quiet.";
// Default test income is $5,000/mo, so the Poltergeist threshold is $500.00.
const MANY_SMALL_COUNT = 40;
const MANY_SMALL_CENTS = 1_400;

function tx(id: string, description: string, amountCents: number, date: string): TransactionRow {
  return { id, description, amountCents, category: "Coffee", date };
}

const NEWEST = tx("t-newest", "Midnight latte", 450, "2025-06-15");
const MIDDLE = tx("t-middle", "Crypt lunch", 2_500, "2025-06-10");
const OLDEST_IN_WINDOW = tx("t-oldest", "Bat snack", 800, "2025-05-20");
const OUTSIDE = tx("t-outside", "Ancient receipt", 600, "2025-04-01");

async function renderScreen(seed: RealSeed = {}) {
  const ctx = await renderWithCrypt(<TransactionsScreen />, { mode: "real", seed });
  await screen.findByRole("button", { name: ADD_LABEL });
  return ctx;
}

function rowOf(description: string): HTMLElement {
  return screen.getByText(description).closest("li") as HTMLElement;
}

afterEach(() => cleanup());

describe("Transactions screen list", () => {
  it("lists only the last 30 days, newest first", async () => {
    await renderScreen({ transactions: [OLDEST_IN_WINDOW, OUTSIDE, NEWEST, MIDDLE] });
    expect(screen.queryByText("Ancient receipt")).toBeNull();
    const items = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    const order = ["Midnight latte", "Crypt lunch", "Bat snack"].map((name) =>
      items.findIndex((text) => text.includes(name)),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows a category and date subtitle and the outflow amount", async () => {
    await renderScreen({ transactions: [NEWEST] });
    const row = rowOf("Midnight latte");
    expect(within(row).getByText("Coffee · Jun 15 · Ghost")).toBeTruthy();
    expect(within(row).getByText(/\$4\.50/)).toBeTruthy();
  });

  it("marks small expenses as ghosts in the subtitle and the accessible name, without a Ghost chip", async () => {
    await renderScreen({ transactions: [NEWEST, MIDDLE] });
    // "Ghost" is visible text in the subtitle; there is no separate chip.
    expect(screen.queryByText(GHOST_CHIP)).toBeNull();
    expect(within(rowOf("Midnight latte")).getByText("Coffee · Jun 15 · Ghost")).toBeTruthy();
    expect(within(rowOf("Crypt lunch")).getByText("Coffee · Jun 10")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Midnight latte, .*, ghost$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Crypt lunch, / }).getAttribute("aria-label")).not.toMatch(/ghost/);
  });

  it("shows only the date, plus Ghost for a small expense, when the description equals the category", async () => {
    await renderScreen({
      transactions: [tx("t-coffee", "Coffee", 450, "2025-06-14"), tx("t-big", "Coffee", 2_500, "2025-06-13")],
    });
    const ghost = screen.getByRole("button", { name: /^Coffee, Coffee, Jun 14/ });
    expect(within(ghost).getByText("Jun 14 · Ghost")).toBeTruthy();
    const regular = screen.getByRole("button", { name: /^Coffee, Coffee, Jun 13/ });
    expect(within(regular).getByText("Jun 13")).toBeTruthy();
  });

  it("shows the empty state when no transaction is in the window", async () => {
    await renderScreen({ transactions: [OUTSIDE] });
    expect(screen.getByText(EMPTY_TEXT)).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("Transactions screen summary", () => {
  it("shows the small-expense total and the Poltergeist threshold without the awake text", async () => {
    await renderScreen({ transactions: [NEWEST, MIDDLE, OUTSIDE] });
    expect(screen.getByText("Small expenses, last 30 days")).toBeTruthy();
    expect(screen.getByText("$4.50")).toBeTruthy();
    expect(screen.getByText("Poltergeist threshold: $500.00")).toBeTruthy();
    expect(screen.queryByText(POLTERGEIST_TEXT)).toBeNull();
  });

  it("shows The Poltergeist is awake. when small expenses pass the threshold", async () => {
    const many = Array.from({ length: MANY_SMALL_COUNT }, (_, index) =>
      tx(`t-many-${index}`, `Ghost snack ${index}`, MANY_SMALL_CENTS, "2025-06-12"),
    );
    await renderScreen({ transactions: many });
    expect(screen.getByText(POLTERGEIST_TEXT)).toBeTruthy();
    expect(screen.getByText("$560.00")).toBeTruthy();
  });
});

describe("Transactions screen delete", () => {
  it("opens the expense sheet from a row and deletes the expense after confirmation", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen({ transactions: [NEWEST, MIDDLE] });
    await user.click(screen.getByRole("button", { name: /^Crypt lunch, / }));
    const sheet = await screen.findByRole(DIALOG_ROLE, { name: "Crypt lunch" });
    expect(within(sheet).getByText("$25")).toBeTruthy();
    expect(within(sheet).getByText("Coffee · Jun 10")).toBeTruthy();
    const deleteButton = within(sheet).getByRole("button", { name: "Delete expense" });
    expect(deleteButton.getAttribute("data-variant")).toBe("danger-ghost");
    await user.click(deleteButton);
    const confirm = await screen.findByRole(DIALOG_ROLE, { name: "Delete Crypt lunch?" });
    expect(within(confirm).getByText("This can't be undone.")).toBeTruthy();
    expect(within(confirm).getByRole("button", { name: "Delete expense" }).getAttribute("data-variant")).toBe("danger");
    await user.click(within(confirm).getByRole("button", { name: "Delete expense" }));
    expect(await screen.findByText("Expense deleted · doesn't change the light")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Last 30 days" })));
    expect(screen.queryByText("Crypt lunch")).toBeNull();
    expect((await ctx.realDb.transactions.toArray()).map((t) => t.id)).toEqual([NEWEST.id]);
  });

  it("writes nothing when the delete is kept", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen({ transactions: [NEWEST] });
    await user.click(screen.getByRole("button", { name: /^Midnight latte, / }));
    const sheet = await screen.findByRole(DIALOG_ROLE, { name: "Midnight latte" });
    await user.click(within(sheet).getByRole("button", { name: "Delete expense" }));
    const confirm = await screen.findByRole(DIALOG_ROLE, { name: "Delete Midnight latte?" });
    await user.click(within(confirm).getByRole("button", { name: "Keep it" }));
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect(await ctx.realDb.transactions.count()).toBe(1);
  });
});

describe("Transactions screen add flow", () => {
  it("adds a small expense, closes the sheet, toasts Ghost added and lists the row", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen();
    expect(screen.getByText(EMPTY_TEXT)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: ADD_LABEL }));
    const dialog = await screen.findByRole(DIALOG_ROLE);
    await user.type(within(dialog).getByLabelText("Amount"), "6.25");
    await user.type(within(dialog).getByLabelText("What was it?"), "Haunted espresso");
    await user.click(within(dialog).getByRole("button", { name: "Save expense" }));
    expect(
      await screen.findByText("Ghost added: $6.25 · doesn't dim the light · $493.76 more wakes the Poltergeist"),
    ).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    await waitFor(() => rowOf("Haunted espresso"));
    expect(screen.getByRole("button", { name: /^Haunted espresso, .*, ghost$/ })).toBeTruthy();
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull();
    const rows = await ctx.realDb.transactions.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      amountCents: 625,
      description: "Haunted espresso",
      category: "Coffee",
      date: "2025-06-15",
    });
  });

  it("keeps the sheet open, shows errors and writes nothing for an empty amount and description", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen();
    await user.click(screen.getByRole("button", { name: ADD_LABEL }));
    const dialog = await screen.findByRole(DIALOG_ROLE);
    await user.click(within(dialog).getByRole("button", { name: "Save expense" }));
    expect(await within(dialog).findByText("Enter the amount.")).toBeTruthy();
    expect(within(dialog).getByText("Describe what it was.")).toBeTruthy();
    expect(screen.getByRole(DIALOG_ROLE)).toBeTruthy();
    expect(await ctx.realDb.transactions.count()).toBe(0);
  });

  it("keeps the sheet open and writes nothing when the amount is 0", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen();
    await user.click(screen.getByRole("button", { name: ADD_LABEL }));
    const dialog = await screen.findByRole(DIALOG_ROLE);
    await user.type(within(dialog).getByLabelText("Amount"), "0");
    await user.type(within(dialog).getByLabelText("What was it?"), "Nothing");
    await user.click(within(dialog).getByRole("button", { name: "Save expense" }));
    expect(await within(dialog).findByText("Enter an amount above $0.")).toBeTruthy();
    expect(screen.getByRole(DIALOG_ROLE)).toBeTruthy();
    expect(await ctx.realDb.transactions.count()).toBe(0);
  });
});

describe("Transactions screen accessibility", () => {
  it(
    "has no axe violations with transactions",
    async () => {
      await renderScreen({ transactions: [NEWEST, MIDDLE] });
      await expectNoAxeViolations(document.body);
    },
    AXE_TIMEOUT_MS,
  );

  it(
    "has no axe violations when empty",
    async () => {
      await renderScreen();
      await expectNoAxeViolations(document.body);
    },
    AXE_TIMEOUT_MS,
  );
});
