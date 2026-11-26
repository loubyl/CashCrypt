import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActionToast } from "@/components/feedback/useActionToast";
import { ACTION_TOAST_DURATION_MS } from "@/components/ui/motionTokens";
import type { ToastShowInput } from "@/components/ui/ToastRegion";
import { EXPENSE_CLAUSE } from "@/lib/utils/lightClause";
import type { HighlightTarget } from "@/lib/utils/destinations";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  show: vi.fn(),
  request: vi.fn(),
  pathname: { current: "/" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => mocks.pathname.current,
}));
vi.mock("@/components/ui/ToastRegion", () => ({
  useToast: () => ({ show: mocks.show, dismiss: vi.fn() }),
}));
vi.mock("@/components/feedback/RowHighlightProvider", () => ({
  useRequestHighlight: () => mocks.request,
}));

const DEBT_TARGET: HighlightTarget = { list: "debts", rowId: "d1", tag: "updated" };
const CHANGE = { lightBefore: 32.735, lightAfter: 32.847, poltergeistAfter: true };

function lastToast(): ToastShowInput {
  return mocks.show.mock.calls.at(-1)?.[0] as ToastShowInput;
}

describe("useActionToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname.current = "/";
  });

  it("appends the light clause measured from the change", () => {
    const { result } = renderHook(() => useActionToast());
    result.current({
      tone: "success",
      base: "Payment saved",
      effect: { kind: "light", change: CHANGE },
    });
    expect(lastToast().message).toBe("Payment saved \u00b7 Light +0.1");
    expect(lastToast().tone).toBe("success");
  });

  it("shows the base text alone when the change is null", () => {
    const { result } = renderHook(() => useActionToast());
    result.current({ tone: "success", base: "Debt added", effect: { kind: "light", change: null } });
    expect(lastToast().message).toBe("Debt added");
  });

  it("uses the fixed clause of an expense", () => {
    const { result } = renderHook(() => useActionToast());
    result.current({
      tone: "info",
      base: "Expense added: $8.00",
      effect: { kind: "fixed", clause: EXPENSE_CLAUSE },
    });
    expect(lastToast().message).toBe(`Expense added: $8.00 \u00b7 ${EXPENSE_CLAUSE}`);
  });

  it("adds a View action that highlights with focus and navigates when off the destination Screen", () => {
    const { result } = renderHook(() => useActionToast());
    result.current({
      tone: "success",
      base: "Payment saved",
      effect: { kind: "light", change: CHANGE },
      destination: DEBT_TARGET,
    });
    const toast = lastToast();
    expect(toast.actionLabel).toBe("View");
    expect(toast.actionAccessibleName).toBe("View in Debts");
    expect(toast.duration).toBe(ACTION_TOAST_DURATION_MS);
    expect(mocks.request).not.toHaveBeenCalled();
    toast.onAction?.();
    expect(mocks.request).toHaveBeenCalledWith({ ...DEBT_TARGET, focus: true });
    expect(mocks.push).toHaveBeenCalledWith("/debts");
  });

  it("highlights in place without an action when already on the destination Screen", () => {
    mocks.pathname.current = "/debts";
    const { result } = renderHook(() => useActionToast());
    result.current({
      tone: "success",
      base: "Payment saved",
      effect: { kind: "light", change: CHANGE },
      destination: DEBT_TARGET,
    });
    expect(mocks.request).toHaveBeenCalledWith({ ...DEBT_TARGET, focus: false });
    expect(lastToast().actionLabel).toBeUndefined();
    expect(lastToast().onAction).toBeUndefined();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("neither highlights nor adds an action without a destination", () => {
    const { result } = renderHook(() => useActionToast());
    result.current({
      tone: "success",
      base: "Income saved",
      effect: { kind: "light", change: CHANGE },
    });
    expect(mocks.request).not.toHaveBeenCalled();
    expect(lastToast().actionLabel).toBeUndefined();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
