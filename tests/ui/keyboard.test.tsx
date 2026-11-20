// Keyboard behavior of the app screens: navigation links, sheet focus trap,
// Escape and focus return, Enter submit, and the exorcism Do it and checkbox.
// Requirements 19.4, 30.5, 30.6.
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExorcismScreen } from "@/components/screens/ExorcismScreen";
import { AppShell } from "@/components/shell/AppShell";
import { AddExpenseSheet } from "@/components/sheets/AddExpenseSheet";
import { CancelSubscriptionSheet } from "@/components/sheets/CancelSubscriptionSheet";
import { DeleteConfirmSheet } from "@/components/sheets/DeleteConfirmSheet";
import { LogPaymentSheet } from "@/components/sheets/LogPaymentSheet";
import { OnboardingSheet } from "@/components/sheets/OnboardingSheet";
import type { DebtRow, StoredPlanAction, SubscriptionRow, WeeklyPlanRow } from "@/types/finance";
import { renderWithCrypt, resetNavigationMock } from "./helpers/crypt";
import { resetViewport } from "./helpers/viewport";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const MOBILE_WIDTH = 1023;
const DESKTOP_WIDTH = 1024;
const NOW = "2025-06-02";
const OPENER_LABEL = "Open sheet";
const DIALOG_ROLE = "dialog";
const TAB_LABELS = ["Home", "Exorcism", "Subscriptions", "Debts", "Transactions"];
const EXTRA_TABS = 3;

const DEBT: DebtRow = {
  id: "debt-card",
  name: "Gloom Card",
  balanceCents: 200_000,
  apr: 0.2,
  minimumPaymentCents: 5_000,
};
const SUB: SubscriptionRow = {
  id: "sub-1",
  name: "Wraithcast",
  amountCents: 1_200,
  cadence: "monthly",
  usage: "never",
  active: true,
};
const CANCEL_ACTION: StoredPlanAction = {
  id: "cancel:sub-1",
  kind: "cancel_subscription",
  title: "Cancel Wraithcast — saves $12/mo",
  subtitle: "Never used",
  targetId: SUB.id,
  monthlyAmountCents: 1_200,
  priorityCents: 1_200,
  done: false,
};
const FALLBACK_ACTION: StoredPlanAction = {
  id: "fallback:review",
  kind: "fallback",
  title: "Review last week's small expenses",
  subtitle: "",
  monthlyAmountCents: 0,
  priorityCents: 0,
  done: false,
};
const PLAN: WeeklyPlanRow = {
  weekKey: NOW,
  actions: [CANCEL_ACTION, FALLBACK_ACTION],
  startLightScore: 50,
  generatedOn: NOW,
};

const realSeed = (extra: Record<string, unknown> = {}) => ({ mode: "real" as const, seed: extra, now: NOW });

beforeEach(() => resetNavigationMock());
afterEach(() => {
  cleanup();
  resetViewport();
});

async function tabUntilFocused(
  user: ReturnType<typeof userEvent.setup>,
  target: Element,
  maxPresses: number,
): Promise<boolean> {
  for (let press = 0; press < maxPresses; press += 1) {
    await user.tab();
    if (document.activeElement === target) return true;
  }
  return false;
}

describe("navigation links", () => {
  it.each([
    [MOBILE_WIDTH, [...TAB_LABELS, "Settings"]],
    [DESKTOP_WIDTH, [...TAB_LABELS, "Settings"]],
  ])("Tab reaches every nav link at %ipx", async (width, labels) => {
    const user = userEvent.setup();
    await renderWithCrypt(
      <AppShell>
        <main>
          <h1>Page content</h1>
        </main>
      </AppShell>,
      { mode: "demo", width, pathname: "/" },
    );
    await screen.findByRole("navigation", { name: "Main" });
    const reached = new Set<string>();
    const presses = document.querySelectorAll("a[href], button").length + EXTRA_TABS;
    for (let press = 0; press < presses; press += 1) {
      await user.tab();
      const active = document.activeElement;
      if (active instanceof HTMLAnchorElement) reached.add(active.getAttribute("aria-label") ?? active.textContent ?? "");
    }
    for (const label of labels) {
      expect(Array.from(reached).some((name) => name.includes(label)), `${label} not reached`).toBe(true);
    }
  });
});

type SheetProps = { open: boolean; onClose: () => void };

function Host({ render }: { render: (props: SheetProps) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        {OPENER_LABEL}
      </button>
      {render({ open, onClose: () => setOpen(false) })}
    </div>
  );
}

const SHEETS: Array<[string, (props: SheetProps) => ReactNode, Record<string, unknown>]> = [
  ["LogPaymentSheet", (p) => <LogPaymentSheet {...p} debts={[DEBT]} />, { debts: [DEBT] }],
  [
    "CancelSubscriptionSheet",
    (p) => <CancelSubscriptionSheet {...p} subscriptionId={SUB.id} name={SUB.name} monthlyCents={1_200} />,
    { subscriptions: [SUB] },
  ],
  ["AddExpenseSheet", (p) => <AddExpenseSheet {...p} />, {}],
  [
    "DeleteConfirmSheet",
    (p) => (
      <DeleteConfirmSheet
        {...p}
        name="Gloom Card"
        confirmLabel="Delete debt"
        onConfirm={async () => ({ ok: true, value: undefined })}
      />
    ),
    {},
  ],
  ["OnboardingSheet", (p) => <OnboardingSheet {...p} />, {}],
];

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  const opener = await screen.findByRole("button", { name: OPENER_LABEL });
  await user.click(opener);
  const dialog = await screen.findByRole(DIALOG_ROLE);
  return { opener, dialog };
}

describe.each(SHEETS)("%s", (_name, render, seed) => {
  it("traps focus inside the dialog while tabbing", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(<Host render={render} />, realSeed(seed));
    const { dialog } = await openSheet(user);
    const focusable = dialog.querySelectorAll("button, input, a[href], [tabindex]:not([tabindex='-1'])").length;
    for (let press = 0; press < focusable + 3; press += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement), `press ${press + 1} left the dialog`).toBe(true);
    }
    for (let press = 0; press < focusable + 3; press += 1) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement), `shift press ${press + 1} left the dialog`).toBe(true);
    }
  });

  it("closes on Escape and returns focus to the opener", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(<Host render={render} />, realSeed(seed));
    const { opener } = await openSheet(user);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

describe("forms submit with Enter", () => {
  it("AddExpenseSheet saves from the description field", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<Host render={(p) => <AddExpenseSheet {...p} />} />, realSeed());
    await openSheet(user);
    await user.type(await screen.findByLabelText("Amount"), "4.50");
    await user.type(screen.getByLabelText("What was it?"), "Latte{Enter}");
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect(await ctx.realDb.transactions.count()).toBe(1);
  });

  it("LogPaymentSheet saves from the amount field", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(
      <Host render={(p) => <LogPaymentSheet {...p} debts={[DEBT]} />} />,
      realSeed({ debts: [DEBT] }),
    );
    await openSheet(user);
    const input = await screen.findByLabelText("Payment amount");
    await user.clear(input);
    await user.type(input, "80{Enter}");
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect((await ctx.realDb.debts.get(DEBT.id))?.balanceCents).toBe(192_000);
  });

  it("OnboardingSheet submits the income and reports creation", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    await renderWithCrypt(<Host render={(p) => <OnboardingSheet {...p} onCreated={onCreated} />} />);
    await openSheet(user);
    await user.type(await screen.findByLabelText("Monthly income"), "4000{Enter}");
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });
});

describe("exorcism plan keyboard", () => {
  async function renderPlan() {
    const ctx = await renderWithCrypt(<ExorcismScreen />, realSeed({ subscriptions: [SUB], plans: [PLAN] }));
    await screen.findAllByRole("checkbox");
    return ctx;
  }

  it("reaches the Do it button and opens the sheet with Enter, then Escape returns focus", async () => {
    const user = userEvent.setup();
    await renderPlan();
    const doIt = screen.getByRole("button", { name: `Do it: ${CANCEL_ACTION.title}` });
    expect(await tabUntilFocused(user, doIt, 20)).toBe(true);
    await user.keyboard("{Enter}");
    await screen.findByRole(DIALOG_ROLE);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(doIt));
  });

  it("reaches the checkbox and toggles it with Space", async () => {
    const user = userEvent.setup();
    const ctx = await renderPlan();
    const checkbox = screen.getByRole("checkbox", { name: `Mark "${FALLBACK_ACTION.title}" as done` });
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(await tabUntilFocused(user, checkbox, 20)).toBe(true);
    await user.keyboard(" ");
    await waitFor(() => expect((checkbox as HTMLInputElement).checked).toBe(true));
    const stored = await ctx.realDb.weeklyPlans.get(NOW);
    expect(stored?.actions.find((action) => action.id === FALLBACK_ACTION.id)?.done).toBe(true);
  });
});
