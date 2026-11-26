// Controls that can hold focus when they become unavailable stay focusable (action-feedback
// Requirements 15.5, 15.6, 15.7). jsdom does not blur a disabled element, but `focus()` on a
// disabled button is a no-op, so the returned-focus cases below fail on the `disabled` attribute.
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { DebtsScreen } from "@/components/screens/DebtsScreen";
import type { MutationResult } from "@/hooks/useCryptActions";
import type { DebtRow } from "@/types/finance";
import { renderWithCrypt, resetNavigationMock } from "./helpers/crypt";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

// Lets a test hold the demo reset open; without a hold the real reset runs.
const resetGate = vi.hoisted(() => ({
  calls: 0,
  hold: null as null | (() => Promise<unknown>),
}));
vi.mock("@/hooks/useDemo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useDemo")>();
  return {
    ...actual,
    useDemo: () => {
      const demo = actual.useDemo();
      return {
        ...demo,
        reset: () => {
          resetGate.calls += 1;
          return resetGate.hold ? resetGate.hold() : demo.reset();
        },
      };
    },
  };
});

const DIALOG_ROLE = "dialog";
const DO_IT_NAME = /^Do it: /;
const LOAD_TIMEOUT_MS = 5000;
const LOG_PAYMENT_LABEL = "Log payment";
const PAYMENT_AMOUNT_LABEL = "Payment amount";
const SAVE_PAYMENT_LABEL = "Save payment";
const PAY_OFF_TEXT = "1800";
const RESET_LABEL = "Reset demo";
const SKIP_LABEL = "Skip to next week";

const SCARLET: DebtRow = {
  id: "debt-scarlet",
  name: "Scarlet Moth Card",
  balanceCents: 180_000,
  apr: 0.24,
  minimumPaymentCents: 5_500,
};

type User = ReturnType<typeof userEvent.setup>;

async function payOff(user: User, dialog: HTMLElement): Promise<void> {
  const amount = within(dialog).getByLabelText(PAYMENT_AMOUNT_LABEL);
  await user.clear(amount);
  await user.type(amount, PAY_OFF_TEXT);
  await user.click(within(dialog).getByRole("button", { name: SAVE_PAYMENT_LABEL }));
}

beforeEach(() => {
  resetNavigationMock();
  resetGate.calls = 0;
  resetGate.hold = null;
});
afterEach(() => cleanup());

describe("demo controls while a demo action runs", () => {
  it("keeps Reset demo focusable and ignores a second click while it runs", async () => {
    let release: (result: MutationResult<void>) => void = () => undefined;
    resetGate.hold = () => new Promise<MutationResult<void>>((resolve) => (release = resolve));
    const user = userEvent.setup();
    await renderWithCrypt(<Dashboard />, { mode: "demo", seed: "level-4" });
    await screen.findAllByRole("button", { name: DO_IT_NAME }, { timeout: LOAD_TIMEOUT_MS });
    const reset = screen.getByRole("button", { name: RESET_LABEL });
    const skip = screen.getByRole("button", { name: SKIP_LABEL });

    await user.click(reset);

    expect(resetGate.calls).toBe(1);
    expect(reset).not.toHaveAttribute("disabled");
    expect(reset).toHaveAttribute("aria-disabled", "true");
    expect(reset).toHaveAttribute("aria-busy", "true");
    expect(document.activeElement).toBe(reset);
    expect(skip).not.toHaveAttribute("disabled");
    expect(skip).toHaveAttribute("aria-disabled", "true");

    await user.click(reset);
    await user.click(skip);
    expect(resetGate.calls).toBe(1);

    await act(async () => release({ ok: true, value: undefined }));
    // The data reload can remount the controls, so look them up again.
    await waitFor(() => expect(screen.getByRole("button", { name: RESET_LABEL })).not.toHaveAttribute("aria-busy"));
    expect(screen.getByRole("button", { name: RESET_LABEL })).not.toHaveAttribute("aria-disabled");
    expect(screen.getByRole("button", { name: SKIP_LABEL })).not.toHaveAttribute("aria-disabled");
  });
});

describe("the Log payment QuickAction", () => {
  it("is aria-disabled, not disabled, and opens nothing when no Debt can be paid", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(<Dashboard />, { mode: "real", seed: {} });
    const quickAction = await screen.findByRole("button", { name: LOG_PAYMENT_LABEL }, { timeout: LOAD_TIMEOUT_MS });

    expect(quickAction).toHaveAttribute("aria-disabled", "true");
    expect(quickAction).not.toHaveAttribute("disabled");

    await user.click(quickAction);
    expect(screen.queryByRole(DIALOG_ROLE)).toBeNull();
  });

  it("keeps focus on the QuickAction after paying off the last Debt from its sheet", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(<Dashboard />, { mode: "real", seed: { debts: [SCARLET] } });
    const quickAction = await screen.findByRole("button", { name: LOG_PAYMENT_LABEL }, { timeout: LOAD_TIMEOUT_MS });
    expect(quickAction).not.toHaveAttribute("aria-disabled");

    await user.click(quickAction);
    await payOff(user, await screen.findByRole(DIALOG_ROLE, { name: LOG_PAYMENT_LABEL }));

    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    // The last Debt is paid, so the control becomes unavailable. jsdom keeps focus on an element
    // that becomes disabled (a browser blurs it), so the attribute is asserted along with the focus.
    await waitFor(() => expect(quickAction.matches('[aria-disabled="true"], :disabled')).toBe(true));
    expect(document.activeElement).toBe(quickAction);
    expect(quickAction).not.toHaveAttribute("disabled");
    expect(quickAction).toHaveAttribute("aria-disabled", "true");
  });
});

describe("the Debt sheet Log payment button", () => {
  it("leaves focus on the Debt row after paying the Debt off", async () => {
    const user = userEvent.setup();
    await renderWithCrypt(<DebtsScreen />, { mode: "real", seed: { debts: [SCARLET] } });
    const row = await screen.findByRole("button", { name: /^Scarlet Moth Card, balance/ });

    await user.click(row);
    const details = await screen.findByRole(DIALOG_ROLE, { name: SCARLET.name });
    await user.click(within(details).getByRole("button", { name: LOG_PAYMENT_LABEL }));
    await payOff(user, await screen.findByRole(DIALOG_ROLE, { name: LOG_PAYMENT_LABEL }));

    await waitFor(() => expect(screen.queryByRole(DIALOG_ROLE)).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(row));
  });
});
