import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExorcismPlanAction } from "@/components/exorcism/ExorcismPlanAction";
import { ToastRegion } from "@/components/ui/ToastRegion";
import type { MutationResult } from "@/hooks/useCryptActions";
import type { StoredPlanAction } from "@/types/finance";
import { setReducedMotion } from "./helpers/motion";

// Feature: action-feedback, Requirements 15.1, 15.2, 15.3, 14.7.
// jsdom does not blur an element that becomes disabled, so this test fails on the `disabled`
// attribute. The real focus loss is covered by scripts/check-moments.mjs and guarded in task 1.7.

const COFFEE_ACTION: StoredPlanAction = {
  id: "reduce-small-expenses-coffee",
  kind: "reduce_small_expenses",
  title: "Cut Coffee by $60 this month to dispel the Poltergeist",
  subtitle: "Open Transactions to review it. Tick it when you are done.",
  targetId: "Coffee",
  monthlyAmountCents: 6000,
  priorityCents: 6000,
  done: false,
};

type Deferred = {
  promise: Promise<MutationResult<void>>;
  resolve: (result: MutationResult<void>) => void;
};

function defer(): Deferred {
  let resolve: Deferred["resolve"] = () => undefined;
  const promise = new Promise<MutationResult<void>>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const OK_RESULT: MutationResult<void> = { ok: true, value: undefined };
const FAILED_RESULT: MutationResult<void> = {
  ok: false,
  error: { kind: "unknown", message: "Could not save." },
};

function renderAction(toggleAction: (id: string, next: boolean) => Promise<MutationResult<void>>) {
  render(
    <ToastRegion>
      <ExorcismPlanAction
        action={COFFEE_ACTION}
        doItTarget={null}
        onDoIt={vi.fn()}
        toggleAction={toggleAction}
      />
    </ToastRegion>,
  );
  return screen.getByRole("checkbox", { name: `Mark "${COFFEE_ACTION.title}" as done` });
}

describe("plan checkbox focus while saving", () => {
  beforeEach(() => {
    setReducedMotion(true);
  });

  it.each([
    ["resolves", OK_RESULT],
    ["fails", FAILED_RESULT],
  ])("stays focusable, busy and guarded while the toggle saves, then keeps focus when it %s", async (_label, result) => {
    const user = userEvent.setup();
    const pending = defer();
    const toggleAction = vi.fn(() => pending.promise);
    const checkbox = renderAction(toggleAction);

    checkbox.focus();
    await user.keyboard(" ");

    expect(toggleAction).toHaveBeenCalledTimes(1);
    expect(toggleAction).toHaveBeenCalledWith(COFFEE_ACTION.id, true);

    // While the promise is pending.
    expect(checkbox).not.toHaveAttribute("disabled");
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(checkbox).toHaveAttribute("aria-busy", "true");
    expect(checkbox).not.toBeChecked();

    await user.keyboard(" ");
    await user.click(checkbox);
    expect(toggleAction).toHaveBeenCalledTimes(1);
    expect(checkbox).not.toBeChecked();

    pending.resolve(result);

    await waitFor(() => expect(checkbox).not.toHaveAttribute("aria-busy"));
    expect(checkbox).not.toHaveAttribute("aria-disabled");
    expect(checkbox).not.toHaveAttribute("disabled");
    expect(document.activeElement).toBe(checkbox);
  });
});
