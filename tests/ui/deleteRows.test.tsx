// Delete flows on the Debts and Subscriptions screens against a fake-indexeddb
// Real_Crypt: the danger button, the confirmation text, "Keep it", what a
// confirmed delete removes and keeps, the toast, the focus target, and a plan
// action whose target is gone.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DebtsScreen } from "@/components/screens/DebtsScreen";
import { ExorcismScreen } from "@/components/screens/ExorcismScreen";
import { SubscriptionsScreen } from "@/components/screens/SubscriptionsScreen";
import { cancelRefKey } from "@/lib/db/refKeys";
import { deleteDebt, deleteSubscription } from "@/lib/db/mutations";
import type { DebtRow, EventRow, StoredPlanAction, SubscriptionRow, WeeklyPlanRow } from "@/types/finance";
import { renderWithCrypt, type CryptTestContext, type RealSeed } from "./helpers/crypt";

const DIALOG_ROLE = "dialog";
const KEEP_LABEL = "Keep it";
const DELETE_DEBT_LABEL = "Delete debt";
const DELETE_SUBSCRIPTION_LABEL = "Delete subscription";
const DEBTS_HEADING = "Your debts";
const ZOMBIES_HEADING = "Zombies";
const GRAVEYARD_HEADING = "Graveyard";
const PLAN_NOW = "2025-06-02";

const SCARLET: DebtRow = {
  id: "debt-scarlet",
  name: "Scarlet Moth Card",
  balanceCents: 180_000,
  apr: 0.24,
  minimumPaymentCents: 5_500,
};
const SETTLED: DebtRow = {
  id: "debt-settled",
  name: "Old Candle Tab",
  balanceCents: 0,
  apr: 0,
  minimumPaymentCents: 2_000,
};
const WRAITHCAST: SubscriptionRow = {
  id: "sub-wraith",
  name: "Wraithcast",
  amountCents: 1_200,
  cadence: "monthly",
  usage: "never",
  active: true,
};
const GAZETTE: SubscriptionRow = {
  id: "sub-gazette",
  name: "Gloom Gazette",
  amountCents: 1_549,
  cadence: "monthly",
  usage: "rarely",
  active: true,
};
const BONE_DAILY: SubscriptionRow = {
  id: "sub-bone",
  name: "Bone Daily",
  amountCents: 800,
  cadence: "monthly",
  usage: "never",
  active: false,
  canceledOn: "2025-06-02",
};

const PAYMENT_EVENT: EventRow = {
  id: "ev-pay",
  type: "debt_payment",
  date: "2025-06-10",
  extraPrincipalCents: 5_000,
  refKey: "pay:1",
};
const BONE_CANCEL_EVENT: EventRow = {
  id: "ev-cancel-bone",
  type: "subscription_canceled",
  date: "2025-06-02",
  amountCents: 800,
  refKey: cancelRefKey(BONE_DAILY.id),
};
// An active subscription that was canceled and brought back keeps this Event until it is deleted.
const WRAITH_CANCEL_EVENT: EventRow = {
  id: "ev-cancel-wraith",
  type: "subscription_canceled",
  date: "2025-06-03",
  amountCents: 1_200,
  refKey: cancelRefKey(WRAITHCAST.id),
};
const EXORCISM_EVENT: EventRow = {
  id: "ev-exorcism",
  type: "exorcism_action_completed",
  date: "2025-06-04",
  refKey: "plan:other",
};

type User = ReturnType<typeof userEvent.setup>;

function sectionOf(title: string): HTMLElement {
  const section = screen.getByRole("heading", { name: title }).closest("section");
  if (!section) throw new Error(`No section for ${title}.`);
  return section;
}

async function renderDebts(seed: RealSeed): Promise<CryptTestContext> {
  const ctx = await renderWithCrypt(<DebtsScreen />, { mode: "real", seed });
  await screen.findByRole("button", { name: "Add debt" });
  return ctx;
}

async function renderSubscriptions(seed: RealSeed): Promise<CryptTestContext> {
  const ctx = await renderWithCrypt(<SubscriptionsScreen />, { mode: "real", seed });
  await screen.findByRole("button", { name: "Add subscription" });
  return ctx;
}

/** Opens the row's sheet and presses its danger button; returns the confirmation dialog. */
async function openConfirmation(
  user: User,
  rowName: RegExp,
  sheetName: string,
  deleteLabel: string,
): Promise<HTMLElement> {
  await user.click(screen.getByRole("button", { name: rowName }));
  const sheet = await screen.findByRole(DIALOG_ROLE, { name: sheetName });
  await user.click(within(sheet).getByRole("button", { name: deleteLabel }));
  return screen.findByRole(DIALOG_ROLE, { name: `Delete ${sheetName}?` });
}

async function expectHeadingFocused(name: string): Promise<void> {
  await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
  await waitFor(() => {
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name }));
  });
}

afterEach(() => cleanup());

describe("Delete a debt", () => {
  it("shows the danger button and the confirmation text for an owing debt", async () => {
    const user = userEvent.setup();
    await renderDebts({ debts: [SCARLET] });
    const confirm = await openConfirmation(user, /^Scarlet Moth Card, balance/, SCARLET.name, DELETE_DEBT_LABEL);
    expect(within(confirm).getByText("This can't be undone.")).toBeTruthy();
    expect(within(confirm).getByRole("button", { name: DELETE_DEBT_LABEL })).toBeTruthy();
    expect(within(confirm).getByRole("button", { name: KEEP_LABEL })).toBeTruthy();
  });

  it("offers Delete debt for a paid-off debt too", async () => {
    const user = userEvent.setup();
    await renderDebts({ debts: [SETTLED] });
    const confirm = await openConfirmation(user, /^Old Candle Tab, balance/, SETTLED.name, DELETE_DEBT_LABEL);
    expect(within(confirm).getByText("This can't be undone.")).toBeTruthy();
  });

  it("writes nothing when the user keeps the debt", async () => {
    const user = userEvent.setup();
    const ctx = await renderDebts({ debts: [SCARLET], events: [PAYMENT_EVENT] });
    const confirm = await openConfirmation(user, /^Scarlet Moth Card, balance/, SCARLET.name, DELETE_DEBT_LABEL);
    await user.click(within(confirm).getByRole("button", { name: KEEP_LABEL }));
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect(await ctx.realDb.debts.toArray()).toEqual([SCARLET]);
    expect(await ctx.realDb.events.toArray()).toEqual([PAYMENT_EVENT]);
    expect(screen.queryByText("Debt deleted")).toBeNull();
  });

  it("removes only the debt, keeps its events, toasts and focuses the Your debts heading", async () => {
    const user = userEvent.setup();
    const ctx = await renderDebts({ debts: [SCARLET, SETTLED], events: [PAYMENT_EVENT] });
    const confirm = await openConfirmation(user, /^Scarlet Moth Card, balance/, SCARLET.name, DELETE_DEBT_LABEL);
    await user.click(within(confirm).getByRole("button", { name: DELETE_DEBT_LABEL }));
    expect(await screen.findByText("Debt deleted")).toBeTruthy();
    await expectHeadingFocused(DEBTS_HEADING);
    expect(await ctx.realDb.debts.toArray()).toEqual([SETTLED]);
    expect(await ctx.realDb.events.toArray()).toEqual([PAYMENT_EVENT]);
    expect(screen.queryByRole("button", { name: /^Scarlet Moth Card/ })).toBeNull();
  });

  it("deletes a paid-off debt and focuses the heading", async () => {
    const user = userEvent.setup();
    const ctx = await renderDebts({ debts: [SETTLED] });
    const confirm = await openConfirmation(user, /^Old Candle Tab, balance/, SETTLED.name, DELETE_DEBT_LABEL);
    await user.click(within(confirm).getByRole("button", { name: DELETE_DEBT_LABEL }));
    expect(await screen.findByText("Debt deleted")).toBeTruthy();
    await expectHeadingFocused(DEBTS_HEADING);
    expect(await ctx.realDb.debts.count()).toBe(0);
  });
});

describe("Delete a subscription", () => {
  it("shows the danger button and the confirmation text for an active subscription", async () => {
    const user = userEvent.setup();
    await renderSubscriptions({ subscriptions: [WRAITHCAST] });
    const confirm = await openConfirmation(
      user,
      /^Wraithcast, Never used/,
      WRAITHCAST.name,
      DELETE_SUBSCRIPTION_LABEL,
    );
    expect(within(confirm).getByText("This can't be undone.")).toBeTruthy();
    expect(within(confirm).getByRole("button", { name: DELETE_SUBSCRIPTION_LABEL })).toBeTruthy();
  });

  it("shows the danger button and the confirmation text for a graveyard subscription", async () => {
    const user = userEvent.setup();
    await renderSubscriptions({ subscriptions: [BONE_DAILY], events: [BONE_CANCEL_EVENT] });
    const confirm = await openConfirmation(user, /Bone Daily/, BONE_DAILY.name, DELETE_SUBSCRIPTION_LABEL);
    expect(within(confirm).getByText("This can't be undone.")).toBeTruthy();
    expect(within(confirm).getByRole("button", { name: DELETE_SUBSCRIPTION_LABEL })).toBeTruthy();
  });

  it("writes nothing when the user keeps the subscription", async () => {
    const user = userEvent.setup();
    const ctx = await renderSubscriptions({
      subscriptions: [WRAITHCAST],
      events: [WRAITH_CANCEL_EVENT],
    });
    const confirm = await openConfirmation(
      user,
      /^Wraithcast, Never used/,
      WRAITHCAST.name,
      DELETE_SUBSCRIPTION_LABEL,
    );
    await user.click(within(confirm).getByRole("button", { name: KEEP_LABEL }));
    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    expect(await ctx.realDb.subscriptions.toArray()).toEqual([WRAITHCAST]);
    expect(await ctx.realDb.events.toArray()).toEqual([WRAITH_CANCEL_EVENT]);
    expect(screen.queryByText("Subscription deleted")).toBeNull();
  });

  it("deletes an active subscription with its undone cancellation Event, keeps other events and focuses Zombies", async () => {
    const user = userEvent.setup();
    const ctx = await renderSubscriptions({
      subscriptions: [WRAITHCAST, GAZETTE],
      events: [WRAITH_CANCEL_EVENT, EXORCISM_EVENT],
    });
    const confirm = await openConfirmation(
      user,
      /^Wraithcast, Never used/,
      WRAITHCAST.name,
      DELETE_SUBSCRIPTION_LABEL,
    );
    await user.click(within(confirm).getByRole("button", { name: DELETE_SUBSCRIPTION_LABEL }));
    expect(await screen.findByText("Subscription deleted")).toBeTruthy();
    await expectHeadingFocused(ZOMBIES_HEADING);
    expect(await ctx.realDb.subscriptions.toArray()).toEqual([GAZETTE]);
    expect(await ctx.realDb.events.toArray()).toEqual([EXORCISM_EVENT]);
  });

  it("deletes a graveyard subscription, keeps its cancellation Event and focuses Graveyard", async () => {
    const user = userEvent.setup();
    const ctx = await renderSubscriptions({
      subscriptions: [BONE_DAILY, GAZETTE],
      events: [BONE_CANCEL_EVENT],
    });
    const confirm = await openConfirmation(user, /Bone Daily/, BONE_DAILY.name, DELETE_SUBSCRIPTION_LABEL);
    await user.click(within(confirm).getByRole("button", { name: DELETE_SUBSCRIPTION_LABEL }));
    expect(await screen.findByText("Subscription deleted")).toBeTruthy();
    await expectHeadingFocused(GRAVEYARD_HEADING);
    expect(await ctx.realDb.subscriptions.toArray()).toEqual([GAZETTE]);
    expect(await ctx.realDb.events.toArray()).toEqual([BONE_CANCEL_EVENT]);
    expect(within(sectionOf(GRAVEYARD_HEADING)).queryByRole("button", { name: /Bone Daily/ })).toBeNull();
  });
});

describe("Plan action whose target was deleted", () => {
  const CANCEL: StoredPlanAction = {
    id: "cancel:sub-wraith",
    kind: "cancel_subscription",
    title: "Cancel Wraithcast — saves $12/mo",
    subtitle: "Never used",
    targetId: WRAITHCAST.id,
    monthlyAmountCents: 1_200,
    priorityCents: 1_200,
    done: false,
  };
  const PAY: StoredPlanAction = {
    id: "extra:debt-scarlet",
    kind: "extra_payment",
    title: "Pay $100 extra on Scarlet Moth Card",
    subtitle: "Saves interest",
    targetId: SCARLET.id,
    suggestedAmountCents: 10_000,
    monthlyAmountCents: 1_000,
    priorityCents: 1_000,
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
  const PLAN: WeeklyPlanRow = {
    weekKey: PLAN_NOW,
    actions: [CANCEL, PAY, FALLBACK],
    startLightScore: 50,
    generatedOn: PLAN_NOW,
  };

  it("shows no Do it button and still lets the user tick the action", async () => {
    const user = userEvent.setup();
    const ctx = await renderWithCrypt(<ExorcismScreen />, {
      mode: "real",
      seed: { subscriptions: [WRAITHCAST], debts: [SCARLET], plans: [PLAN] },
      now: PLAN_NOW,
    });
    await screen.findByText(/of 3 done/);
    expect(await screen.findByRole("button", { name: `Do it: ${CANCEL.title}` })).toBeTruthy();
    expect(screen.getByRole("button", { name: `Do it: ${PAY.title}` })).toBeTruthy();

    await deleteSubscription(ctx.realDb, WRAITHCAST.id);
    await deleteDebt(ctx.realDb, SCARLET.id);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: `Do it: ${CANCEL.title}` })).toBeNull();
      expect(screen.queryByRole("button", { name: `Do it: ${PAY.title}` })).toBeNull();
    });
    expect(screen.getByText(CANCEL.title)).toBeTruthy();

    await user.click(screen.getByRole("checkbox", { name: `Mark "${CANCEL.title}" as done` }));
    await waitFor(async () => {
      const stored = await ctx.realDb.weeklyPlans.get(PLAN_NOW);
      expect(stored?.actions.find((action) => action.id === CANCEL.id)?.done).toBe(true);
    });
  });
});
