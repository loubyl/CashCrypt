// Debts screen against a fake-indexeddb Real_Crypt: sorted rows, total card,
// empty state, add and edit forms, Log payment from a debt and paid-off debts.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DebtsScreen } from "@/components/screens/DebtsScreen";
import type { DebtRow } from "@/types/finance";
import { expectNoAxeViolations } from "./helpers/axe";
import { renderWithCrypt, type RealSeed } from "./helpers/crypt";

const AXE_TIMEOUT_MS = 30000;
const ADD_LABEL = "Add debt";
const DIALOG_ROLE = "dialog";
const SAVE_DEBT_LABEL = "Save debt";
const PAID_OFF_TEXT = "Paid off";

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
const SETTLED: DebtRow = {
  id: "debt-settled",
  name: "Old Candle Tab",
  balanceCents: 0,
  apr: 0,
  minimumPaymentCents: 2_000,
};

async function renderScreen(seed: RealSeed = {}) {
  const ctx = await renderWithCrypt(<DebtsScreen />, { mode: "real", seed });
  await screen.findByRole("button", { name: ADD_LABEL });
  return ctx;
}

async function openAddSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: ADD_LABEL }));
  return screen.findByRole(DIALOG_ROLE);
}

afterEach(() => cleanup());

describe("Debts screen lists", () => {
  it("lists debts sorted by balance with APR and minimum subtitles", async () => {
    await renderScreen({ debts: [LOAN, SCARLET] });
    const rows = screen.getAllByRole("button", { name: /, balance / });
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Scarlet Moth Card");
    expect(rows[1].textContent).toContain("Lantern Loan");
    expect(screen.getByText("APR 24% · Minimum $55/mo")).toBeTruthy();
    expect(screen.getByText("APR 5% · Minimum $120/mo")).toBeTruthy();
    expect(screen.getByText("$1,800.00")).toBeTruthy();
    expect(screen.getByText("$900.00")).toBeTruthy();
  });

  it("shows the total debt card with the sum of all balances and the debt count", async () => {
    await renderScreen({ debts: [SCARLET, LOAN, SETTLED] });
    expect(screen.getByText("Total debt")).toBeTruthy();
    expect(screen.getByText("$2,700.00")).toBeTruthy();
    expect(screen.getByText("3 debts")).toBeTruthy();
  });

  it("shows the empty state and a zero total when there are no debts", async () => {
    await renderScreen();
    expect(screen.getByText("No debts. The walls are holding.")).toBeTruthy();
    expect(screen.getByText("$0.00")).toBeTruthy();
    expect(screen.getByText("0 debts")).toBeTruthy();
  });
});

describe("Debts screen add flow", () => {
  it("adds a debt, closes the sheet, shows a toast and stores the APR as a fraction", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen();
    const dialog = await openAddSheet(user);
    await user.type(within(dialog).getByLabelText("Name"), "Gloom Mortgage");
    await user.type(within(dialog).getByLabelText("Current balance"), "2500");
    await user.type(within(dialog).getByLabelText("APR (%)"), "7.5");
    await user.type(within(dialog).getByLabelText("Minimum monthly payment"), "150");
    await user.click(within(dialog).getByRole("button", { name: SAVE_DEBT_LABEL }));
    expect(await screen.findByText("Debt added: Gloom Mortgage, $2,500")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect(await screen.findByText("APR 7.5% · Minimum $150/mo")).toBeTruthy();
    const rows = await ctx.realDb.debts.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Gloom Mortgage",
      balanceCents: 250_000,
      minimumPaymentCents: 15_000,
    });
    expect(rows[0].apr).toBeCloseTo(0.075, 10);
  });

  it("shows errors and creates no row when every field is empty", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen();
    const dialog = await openAddSheet(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE_DEBT_LABEL }));
    expect(await within(dialog).findByText("Enter the current balance.")).toBeTruthy();
    expect(within(dialog).getByText("Enter the interest rate.")).toBeTruthy();
    expect(within(dialog).getByText("Enter the minimum monthly payment.")).toBeTruthy();
    expect(within(dialog).getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole(DIALOG_ROLE)).toBeTruthy();
    expect(await ctx.realDb.debts.count()).toBe(0);
  });

  it("shows an error on the balance field and creates no row when the balance is missing", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen();
    const dialog = await openAddSheet(user);
    await user.type(within(dialog).getByLabelText("Name"), "No Balance");
    await user.type(within(dialog).getByLabelText("APR (%)"), "10");
    await user.type(within(dialog).getByLabelText("Minimum monthly payment"), "25");
    await user.click(within(dialog).getByRole("button", { name: SAVE_DEBT_LABEL }));
    expect(await within(dialog).findByText("Enter the current balance.")).toBeTruthy();
    expect(within(dialog).getByLabelText("Current balance").getAttribute("aria-invalid")).toBe("true");
    expect(await ctx.realDb.debts.count()).toBe(0);
  });

  it("never saves a negative balance because the money input drops the minus sign", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen();
    const dialog = await openAddSheet(user);
    await user.type(within(dialog).getByLabelText("Name"), "Minus Sign");
    await user.type(within(dialog).getByLabelText("Current balance"), "-50");
    expect((within(dialog).getByLabelText("Current balance") as HTMLInputElement).value).not.toContain("-");
    await user.type(within(dialog).getByLabelText("APR (%)"), "10");
    await user.type(within(dialog).getByLabelText("Minimum monthly payment"), "25");
    await user.click(within(dialog).getByRole("button", { name: SAVE_DEBT_LABEL }));
    await waitFor(async () => expect(await ctx.realDb.debts.count()).toBe(1));
    expect((await ctx.realDb.debts.toArray())[0].balanceCents).toBe(5_000);
  });

  it("shows an error on the APR field and creates no row for an APR of 101%", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen();
    const dialog = await openAddSheet(user);
    await user.type(within(dialog).getByLabelText("Name"), "Too Hungry");
    await user.type(within(dialog).getByLabelText("Current balance"), "500");
    await user.type(within(dialog).getByLabelText("APR (%)"), "101");
    await user.type(within(dialog).getByLabelText("Minimum monthly payment"), "25");
    await user.click(within(dialog).getByRole("button", { name: SAVE_DEBT_LABEL }));
    await waitFor(() => expect(within(dialog).getByLabelText("APR (%)").getAttribute("aria-invalid")).toBe("true"));
    expect(within(dialog).getByLabelText("Current balance").getAttribute("aria-invalid")).not.toBe("true");
    expect(await ctx.realDb.debts.count()).toBe(0);
  });

  it("shows an error on the minimum field and creates no row when the minimum is missing", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen();
    const dialog = await openAddSheet(user);
    await user.type(within(dialog).getByLabelText("Name"), "No Minimum");
    await user.type(within(dialog).getByLabelText("Current balance"), "500");
    await user.type(within(dialog).getByLabelText("APR (%)"), "10");
    await user.click(within(dialog).getByRole("button", { name: SAVE_DEBT_LABEL }));
    expect(await within(dialog).findByText("Enter the minimum monthly payment.")).toBeTruthy();
    expect(await ctx.realDb.debts.count()).toBe(0);
  });
});

describe("Debts screen edit flow", () => {
  it("edits a debt and keeps the Event count unchanged", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen({ debts: [SCARLET] });
    const eventsBefore = await ctx.realDb.events.count();
    await user.click(screen.getByRole("button", { name: /^Scarlet Moth Card, balance/ }));
    const dialog = await screen.findByRole(DIALOG_ROLE, { name: "Scarlet Moth Card" });
    const nameInput = within(dialog).getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Crimson Moth Card");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Debt updated: Crimson Moth Card")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect((await ctx.realDb.debts.get(SCARLET.id))?.name).toBe("Crimson Moth Card");
    expect(await ctx.realDb.events.count()).toBe(eventsBefore);
  });
});

describe("Debts screen log payment", () => {
  it("pre-fills the minimum payment and shows the balance drop after saving", async () => {
    const user = userEvent.setup();
    const ctx = await renderScreen({ debts: [SCARLET, LOAN] });
    await user.click(screen.getByRole("button", { name: /^Scarlet Moth Card, balance/ }));
    const details = await screen.findByRole(DIALOG_ROLE, { name: "Scarlet Moth Card" });
    await user.click(within(details).getByRole("button", { name: "Log payment" }));
    const payment = await screen.findByRole(DIALOG_ROLE, { name: "Log payment" });
    const amount = within(payment).getByLabelText("Payment amount") as HTMLInputElement;
    expect(Number(amount.value.replace(/[^0-9.]/g, ""))).toBe(55);
    await user.click(within(payment).getByRole("button", { name: "Save payment" }));
    expect(await screen.findByText("Payment saved. $55 off your balance.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect(await screen.findByText("$1,745.00")).toBeTruthy();
    expect((await ctx.realDb.debts.get(SCARLET.id))?.balanceCents).toBe(174_500);
    expect(await ctx.realDb.events.where("type").equals("debt_payment").count()).toBe(1);
  });
});

describe("Debts screen paid-off debts", () => {
  it("shows a Paid off chip in the list and disables Log payment at balance 0", async () => {
    const user = userEvent.setup();
    await renderScreen({ debts: [SCARLET, SETTLED] });
    expect(screen.getAllByText(PAID_OFF_TEXT)).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /^Old Candle Tab, balance/ }));
    const dialog = await screen.findByRole(DIALOG_ROLE, { name: "Old Candle Tab" });
    expect(within(dialog).getByText(PAID_OFF_TEXT)).toBeTruthy();
    const logButton = within(dialog).getByRole("button", { name: "Log payment" }) as HTMLButtonElement;
    expect(logButton.disabled).toBe(true);
  });
});

describe("Debts screen accessibility", () => {
  it(
    "has no axe violations with debts and a paid-off debt",
    async () => {
      await renderScreen({ debts: [SCARLET, LOAN, SETTLED] });
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
