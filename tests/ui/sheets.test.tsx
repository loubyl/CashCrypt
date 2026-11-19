// Sheet behavior against a fake-indexeddb Real_Crypt: LogPaymentSheet,
// CancelSubscriptionSheet and AddExpenseSheet.
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AddExpenseSheet } from "@/components/sheets/AddExpenseSheet";
import { CancelSubscriptionSheet } from "@/components/sheets/CancelSubscriptionSheet";
import { LogPaymentSheet } from "@/components/sheets/LogPaymentSheet";
import { useCryptData } from "@/hooks/useCryptData";
import type { DebtRow, SubscriptionRow } from "@/types/finance";
import { renderWithCrypt, type RealSeed } from "./helpers/crypt";

const OPENER_LABEL = "Open sheet";
const PAYMENT_LABEL = "Payment amount";
const SAVE_PAYMENT_LABEL = "Save payment";
const AMOUNT_LABEL = "Amount";
const DESCRIPTION_LABEL = "What was it?";
const SAVE_EXPENSE_LABEL = "Save expense";
const CANCEL_LABEL = "Cancel subscription";
const KEEP_LABEL = "Keep it";
const DIALOG_ROLE = "dialog";

const CARD: DebtRow = {
  id: "debt-card",
  name: "Gloom Card",
  balanceCents: 200_000,
  apr: 0.2,
  minimumPaymentCents: 5_000,
};
const LOAN: DebtRow = {
  id: "debt-loan",
  name: "Crypt Loan",
  balanceCents: 100_000,
  apr: 0.1,
  minimumPaymentCents: 3_000,
};
const SMALL: DebtRow = {
  id: "debt-small",
  name: "Tiny Debt",
  balanceCents: 2_000,
  apr: 0.1,
  minimumPaymentCents: 5_000,
};
const SUB: SubscriptionRow = {
  id: "sub-1",
  name: "Wraithcast",
  amountCents: 12_000,
  cadence: "monthly",
  usage: "never",
  active: true,
};

function realSeed(extra: RealSeed = {}) {
  return { mode: "real" as const, seed: extra };
}

type HostProps = { children: (props: { open: boolean; onClose: () => void }) => React.ReactNode };

function Host({ children }: HostProps) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        {OPENER_LABEL}
      </button>
      {children({ open, onClose: () => setOpen(false) })}
    </div>
  );
}

function PaymentHost({ initialDebtId, prefillCents }: { initialDebtId?: string; prefillCents?: number }) {
  const data = useCryptData();
  const debts = data.status === "ready" ? data.rows.debts : [];
  return (
    <Host>
      {(sheet) => (
        <LogPaymentSheet
          {...sheet}
          debts={debts}
          initialDebtId={initialDebtId}
          prefillCents={prefillCents}
        />
      )}
    </Host>
  );
}

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  const opener = await screen.findByRole("button", { name: OPENER_LABEL });
  await user.click(opener);
  await screen.findByRole(DIALOG_ROLE);
  return opener;
}

afterEach(() => cleanup());

describe("LogPaymentSheet", () => {
  it("lists payable debts in a picker and skips the picker with one debt", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(<PaymentHost />, realSeed({ debts: [CARD, LOAN, { ...SMALL, balanceCents: 0 }] }));
    await openSheet(user);
    expect(await screen.findByText("Gloom Card")).toBeTruthy();
    expect(screen.getByText("Crypt Loan")).toBeTruthy();
    expect(screen.queryByText("Tiny Debt")).toBeNull();
    expect(screen.queryByLabelText(PAYMENT_LABEL)).toBeNull();
    await user.click(screen.getByText("Crypt Loan"));
    expect(await screen.findByLabelText(PAYMENT_LABEL)).toBeTruthy();
  });

  it("shows the debt facts and pre-fills the minimum payment", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(<PaymentHost />, realSeed({ debts: [CARD] }));
    await openSheet(user);
    const input = (await screen.findByLabelText(PAYMENT_LABEL)) as HTMLInputElement;
    expect(input.value).toBe("50.00");
    expect(screen.getByText("Gloom Card")).toBeTruthy();
    expect(screen.getByText("Balance $2,000. Minimum $50/mo.")).toBeTruthy();
    expect(screen.queryByText(/goes above your minimum/)).toBeNull();
  });

  it("keeps cents in the debt facts sentence when the amount has them", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(
      <PaymentHost />,
      realSeed({ debts: [{ ...CARD, balanceCents: 200_050, minimumPaymentCents: 4_999 }] }),
    );
    await openSheet(user);
    expect(await screen.findByText("Balance $2,000.50. Minimum $49.99/mo.")).toBeTruthy();
  });

  it("limits the pre-fill to the balance", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(<PaymentHost />, realSeed({ debts: [SMALL] }));
    await openSheet(user);
    const input = (await screen.findByLabelText(PAYMENT_LABEL)) as HTMLInputElement;
    expect(input.value).toBe("20.00");
  });

  it("pre-fills a given amount for a given debt and shows the above-minimum text", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(
      <PaymentHost initialDebtId={CARD.id} prefillCents={35_000} />,
      realSeed({ debts: [CARD, LOAN] }),
    );
    await openSheet(user);
    const input = (await screen.findByLabelText(PAYMENT_LABEL)) as HTMLInputElement;
    expect(input.value).toBe("350.00");
    expect(screen.getByText("$300 goes above your minimum")).toBeTruthy();
  });

  it("saves a valid payment, closes, toasts and writes the balance and event", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<PaymentHost />, realSeed({ debts: [CARD] }));
    await openSheet(user);
    const input = await screen.findByLabelText(PAYMENT_LABEL);
    await user.clear(input);
    await user.type(input, "80");
    expect(await screen.findByText("$30 goes above your minimum")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: SAVE_PAYMENT_LABEL }));
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect(await screen.findByText("Payment saved. $80 off your balance.")).toBeTruthy();
    const debt = await ctx.realDb.debts.get(CARD.id);
    expect(debt?.balanceCents).toBe(192_000);
    const events = await ctx.realDb.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]?.extraPrincipalCents).toBe(3_000);
  });

  it.each([
    ["empty", "", "Enter the payment amount."],
    ["0", "0", "Enter an amount of at least $0.01."],
    ["above the balance", "99999", "The payment cannot be more than the balance. The balance is $2,000."],
  ])("keeps the sheet open and writes nothing when the amount is %s", async (_name, text, message) => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<PaymentHost />, realSeed({ debts: [CARD] }));
    await openSheet(user);
    const input = await screen.findByLabelText(PAYMENT_LABEL);
    await user.clear(input);
    if (text !== "") await user.type(input, text);
    await user.click(screen.getByRole("button", { name: SAVE_PAYMENT_LABEL }));
    expect(screen.getByRole(DIALOG_ROLE)).toBeTruthy();
    expect(await screen.findByText(message)).toBeTruthy();
    expect((await ctx.realDb.debts.get(CARD.id))?.balanceCents).toBe(CARD.balanceCents);
    expect(await ctx.realDb.events.count()).toBe(0);
  });

  it("returns focus to the opener on Escape", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(<PaymentHost />, realSeed({ debts: [CARD] }));
    const opener = await openSheet(user);
    await screen.findByLabelText(PAYMENT_LABEL);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

function CancelHost() {
  return (
    <Host>
      {(sheet) => (
        <CancelSubscriptionSheet
          {...sheet}
          subscriptionId={SUB.id}
          name={SUB.name}
          monthlyCents={SUB.amountCents}
        />
      )}
    </Host>
  );
}

describe("CancelSubscriptionSheet", () => {
  it("states the saving and writes nothing on Keep it", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<CancelHost />, realSeed({ subscriptions: [SUB] }));
    await openSheet(user);
    expect(screen.getByText("Cancel Wraithcast — saves $120/mo")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: KEEP_LABEL }));
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect((await ctx.realDb.subscriptions.get(SUB.id))?.active).toBe(true);
    expect(await ctx.realDb.events.count()).toBe(0);
    expect(screen.queryByText(/saved/)).toBeNull();
  });

  it("cancels on confirm, writes the event and toasts the saving", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<CancelHost />, realSeed({ subscriptions: [SUB] }));
    await openSheet(user);
    const dialog = screen.getByRole(DIALOG_ROLE);
    const confirm = Array.from(dialog.querySelectorAll("button")).find(
      (button) => button.textContent?.includes(CANCEL_LABEL) && !button.textContent.includes(KEEP_LABEL),
    );
    expect(confirm).toBeTruthy();
    // Canceling a zombie is the good action: primary pill, with "Keep it" as secondary.
    expect(confirm?.getAttribute("data-variant")).toBe("primary");
    expect(screen.getByRole("button", { name: KEEP_LABEL }).getAttribute("data-variant")).toBe("secondary");
    expect(dialog.querySelector('button[data-variant="danger"]')).toBeNull();
    await user.click(confirm as HTMLButtonElement);
    expect(await screen.findByText("+$120/mo saved")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect((await ctx.realDb.subscriptions.get(SUB.id))?.active).toBe(false);
    const events = await ctx.realDb.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("subscription_canceled");
    expect(events[0]?.amountCents).toBe(12_000);
  });
});

function ExpenseHost() {
  return <Host>{(sheet) => <AddExpenseSheet {...sheet} />}</Host>;
}

describe("AddExpenseSheet", () => {
  it("saves a small expense, closes and shows the Ghost toast", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<ExpenseHost />, realSeed());
    await openSheet(user);
    await user.type(await screen.findByLabelText(AMOUNT_LABEL), "4.50");
    await user.type(screen.getByLabelText(DESCRIPTION_LABEL), "Latte");
    await user.click(screen.getByRole("button", { name: SAVE_EXPENSE_LABEL }));
    expect(await screen.findByText("Ghost added: $4.50")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    const rows = await ctx.realDb.transactions.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amountCents: 450, description: "Latte", category: "Coffee" });
  });

  it("shows an error on each invalid field and writes nothing", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<ExpenseHost />, realSeed());
    await openSheet(user);
    await screen.findByLabelText(AMOUNT_LABEL);
    await user.click(screen.getByRole("button", { name: SAVE_EXPENSE_LABEL }));
    expect(screen.getByRole(DIALOG_ROLE)).toBeTruthy();
    expect(await screen.findByText("Enter the amount.")).toBeTruthy();
    expect(screen.queryByText("Enter an amount above $0.")).toBeNull();
    expect(screen.getByText("Describe what it was.")).toBeTruthy();
    expect(await ctx.realDb.transactions.count()).toBe(0);
  });

  it("rejects an amount of 0", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<ExpenseHost />, realSeed());
    await openSheet(user);
    await user.type(await screen.findByLabelText(AMOUNT_LABEL), "0");
    await user.type(screen.getByLabelText(DESCRIPTION_LABEL), "Nothing");
    await user.click(screen.getByRole("button", { name: SAVE_EXPENSE_LABEL }));
    expect(await screen.findByText("Enter an amount above $0.")).toBeTruthy();
    expect(screen.queryByText("Describe what it was.")).toBeNull();
    expect(await ctx.realDb.transactions.count()).toBe(0);
  });
});

describe("Cents formatting in the Cancel sheet", () => {
  it("shows cents on a non-round amount in the heading and the toast", async () => {
    const user = userEvent.setup();
    const gazette: SubscriptionRow = { ...SUB, id: "sub-gazette", name: "Gloom Gazette", amountCents: 1_549 };
    await renderWithCrypt(
      <Host>
        {(sheet) => (
          <CancelSubscriptionSheet {...sheet} subscriptionId={gazette.id} name={gazette.name} monthlyCents={1_549} />
        )}
      </Host>,
      realSeed({ subscriptions: [gazette] }),
    );
    await openSheet(user);
    expect(await screen.findByText("Cancel Gloom Gazette — saves $15.49/mo")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: CANCEL_LABEL }));
    expect(await screen.findByText("+$15.49/mo saved")).toBeTruthy();
  });
});
