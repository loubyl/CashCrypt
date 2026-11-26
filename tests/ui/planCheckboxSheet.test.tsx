// Plan checkbox that opens the Do it sheet (action-feedback Requirement 7, tasks 3.1 and 3.2).
// Every case runs on the Exorcism screen and on the Dashboard plan card (Requirement 7.9).
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { ExorcismScreen } from "@/components/screens/ExorcismScreen";
import type { DebtRow, StoredPlanAction, SubscriptionRow, WeeklyPlanRow } from "@/types/finance";
import { renderWithCrypt, resetNavigationMock, type CryptTestContext } from "./helpers/crypt";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const mutationSpies = vi.hoisted(() => ({
  complete: vi.fn(),
  uncomplete: vi.fn(),
}));
vi.mock("@/lib/db/mutations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/mutations")>();
  return {
    ...actual,
    completePlanAction: vi.fn(async (...args: Parameters<typeof actual.completePlanAction>) => {
      mutationSpies.complete(...args);
      return actual.completePlanAction(...args);
    }),
    uncompletePlanAction: vi.fn(async (...args: Parameters<typeof actual.uncompletePlanAction>) => {
      mutationSpies.uncomplete(...args);
      return actual.uncompletePlanAction(...args);
    }),
  };
});

const NOW = "2025-06-02";
const COMPLETED_EVENT_TYPE = "exorcism_action_completed";
const CANCEL_DESCRIPTION = "Opens the cancel confirmation";
const PAY_DESCRIPTION = "Opens the payment sheet";
const CONFIRM_CANCEL_LABEL = "Cancel subscription";
const SAVE_PAYMENT_LABEL = "Save payment";
const PAYMENT_LABEL = "Payment amount";
const SAVED_TOAST = /\/mo (saved|freed)( · .+)?$/;
// Below the 5 s test timeout, so a missing dialog fails with the Testing Library message.
const WAIT = { timeout: 3000 };

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

type Surface = { name: string; element: () => ReactElement; pathname: string };
const SURFACES: Surface[] = [
  { name: "Exorcism screen", element: () => <ExorcismScreen />, pathname: "/exorcism" },
  { name: "Dashboard plan card", element: () => <Dashboard />, pathname: "/" },
];

async function renderSurface(
  surface: Surface,
  actions: StoredPlanAction[],
  rows: { subscriptions?: SubscriptionRow[]; debts?: DebtRow[] } = {},
): Promise<CryptTestContext> {
  const ctx = await renderWithCrypt(surface.element(), {
    mode: "real",
    seed: {
      subscriptions: rows.subscriptions ?? [SUB],
      debts: rows.debts ?? [DEBT],
      plans: [plan(actions)],
    },
    now: NOW,
    pathname: surface.pathname,
  });
  await screen.findAllByRole("checkbox", {}, WAIT);
  return ctx;
}

const checkboxFor = (title: string): HTMLInputElement =>
  screen.getByRole("checkbox", { name: `Mark "${title}" as done` }) as HTMLInputElement;

async function countCompletedEvents(ctx: CryptTestContext): Promise<number> {
  return (await ctx.realDb.events.toArray()).filter((event) => event.type === COMPLETED_EVENT_TYPE).length;
}

beforeEach(() => {
  resetNavigationMock();
  mutationSpies.complete.mockClear();
  mutationSpies.uncomplete.mockClear();
});
afterEach(() => cleanup());

describe.each(SURFACES)("plan checkbox on the $name", (surface) => {
  it("opens the cancel sheet when the cancel action is ticked, leaving it unchecked and writing nothing", async () => {
    const user = userEvent.setup();
    const ctx = await renderSurface(surface, [CANCEL, PAY, FALLBACK]);
    await user.click(checkboxFor(CANCEL.title));
    const dialog = await screen.findByRole("dialog", {}, WAIT);
    expect(within(dialog).getByRole("button", { name: CONFIRM_CANCEL_LABEL })).toBeTruthy();
    expect(checkboxFor(CANCEL.title).checked).toBe(false);
    expect(mutationSpies.complete).not.toHaveBeenCalled();
    expect(await countCompletedEvents(ctx)).toBe(0);
    expect((await ctx.realDb.subscriptions.get(SUB.id))?.active).toBe(true);
  });

  it("marks the action done with exactly one toast after the cancel sheet is confirmed", async () => {
    const user = userEvent.setup();
    const ctx = await renderSurface(surface, [CANCEL, PAY, FALLBACK]);
    await user.click(checkboxFor(CANCEL.title));
    const dialog = await screen.findByRole("dialog", {}, WAIT);
    await user.click(within(dialog).getByRole("button", { name: CONFIRM_CANCEL_LABEL }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    await waitFor(() => expect(checkboxFor(CANCEL.title).checked).toBe(true), WAIT);
    expect(screen.getAllByText(SAVED_TOAST)).toHaveLength(1);
    expect((await ctx.realDb.subscriptions.get(SUB.id))?.active).toBe(false);
    expect(await countCompletedEvents(ctx)).toBe(1);
  });

  it("writes nothing and returns focus to the checkbox when Escape closes the sheet", async () => {
    const user = userEvent.setup();
    const ctx = await renderSurface(surface, [CANCEL, PAY, FALLBACK]);
    await user.click(checkboxFor(CANCEL.title));
    await screen.findByRole("dialog", {}, WAIT);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    await waitFor(() => expect(document.activeElement).toBe(checkboxFor(CANCEL.title)), WAIT);
    expect(checkboxFor(CANCEL.title).checked).toBe(false);
    expect(mutationSpies.complete).not.toHaveBeenCalled();
    expect(await countCompletedEvents(ctx)).toBe(0);
    expect((await ctx.realDb.subscriptions.get(SUB.id))?.active).toBe(true);
  });

  it("opens the Log payment sheet with the Do it pre-fill when the extra payment is ticked", async () => {
    const user = userEvent.setup();
    const ctx = await renderSurface(surface, [CANCEL, PAY, FALLBACK]);
    await user.click(checkboxFor(PAY.title));
    const dialog = await screen.findByRole("dialog", {}, WAIT);
    const input = (await within(dialog).findByLabelText(PAYMENT_LABEL)) as HTMLInputElement;
    expect(input.value).toBe("150.00");
    expect(within(dialog).getByText(DEBT.name)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: SAVE_PAYMENT_LABEL })).toBeTruthy();
    expect(checkboxFor(PAY.title).checked).toBe(false);
    expect(mutationSpies.complete).not.toHaveBeenCalled();
    expect(await countCompletedEvents(ctx)).toBe(0);
  });

  it("unticks a done action through uncompletePlanAction without opening a sheet", async () => {
    const user = userEvent.setup();
    await renderSurface(surface, [{ ...CANCEL, done: true, completedOn: NOW }, PAY, FALLBACK]);
    expect(checkboxFor(CANCEL.title).checked).toBe(true);
    await user.click(checkboxFor(CANCEL.title));
    await waitFor(() => expect(mutationSpies.uncomplete).toHaveBeenCalledTimes(1), WAIT);
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(checkboxFor(CANCEL.title).checked).toBe(false), WAIT);
  });

  it("completes a fallback action directly, without a sheet", async () => {
    const user = userEvent.setup();
    const ctx = await renderSurface(surface, [CANCEL, PAY, FALLBACK]);
    await user.click(checkboxFor(FALLBACK.title));
    await waitFor(() => expect(checkboxFor(FALLBACK.title).checked).toBe(true), WAIT);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mutationSpies.complete).toHaveBeenCalledTimes(1);
    expect(await countCompletedEvents(ctx)).toBe(1);
  });

  it("completes a cancel action directly when its subscription no longer qualifies", async () => {
    const user = userEvent.setup();
    const ctx = await renderSurface(surface, [CANCEL, PAY, FALLBACK], {
      subscriptions: [{ ...SUB, active: false }],
    });
    await user.click(checkboxFor(CANCEL.title));
    await waitFor(() => expect(checkboxFor(CANCEL.title).checked).toBe(true), WAIT);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mutationSpies.complete).toHaveBeenCalledTimes(1);
    expect(await countCompletedEvents(ctx)).toBe(1);
  });

  it("describes what ticking does, only for the actions that open a sheet", async () => {
    await renderSurface(surface, [CANCEL, PAY, FALLBACK]);
    expect(checkboxFor(CANCEL.title)).toHaveAccessibleDescription(CANCEL_DESCRIPTION);
    expect(checkboxFor(PAY.title)).toHaveAccessibleDescription(PAY_DESCRIPTION);
    expect(checkboxFor(FALLBACK.title).hasAttribute("aria-describedby")).toBe(false);
    expect(checkboxFor(CANCEL.title)).toHaveAccessibleName(`Mark "${CANCEL.title}" as done`);
  });
});
