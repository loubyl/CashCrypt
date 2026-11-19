// useExorcismPlan must generate the weekly plan only from an effect, never
// while rendering. A render counter marks every call made during render.
import { waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useExorcismPlan } from "@/hooks/useExorcismPlan";
import type { WeeklyPlanRow } from "@/types/finance";
import { renderWithCrypt } from "./helpers/crypt";

const NOW = "2025-06-02";
const renderPhase = { depth: 0 };
const enterRender = (): void => {
  renderPhase.depth += 1;
};
const leaveRender = (): void => {
  renderPhase.depth -= 1;
};
const calls: Array<{ duringRender: boolean }> = [];

vi.mock("@/lib/db/plans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/plans")>();
  return {
    ...actual,
    ensureWeeklyPlan: vi.fn((...args: Parameters<typeof actual.ensureWeeklyPlan>) => {
      calls.push({ duringRender: renderPhase.depth > 0 });
      return actual.ensureWeeklyPlan(...args);
    }),
  };
});

function PlanProbe(): ReactNode {
  enterRender();
  try {
    const { status, plan } = useExorcismPlan();
    return <p data-testid="plan">{status === "ready" ? plan?.actions[0]?.title : "loading"}</p>;
  } finally {
    leaveRender();
  }
}

describe("useExorcismPlan", () => {
  it("does not call ensureWeeklyPlan when the week already has a stored plan", async () => {
    calls.length = 0;
    const stored: WeeklyPlanRow = {
      weekKey: NOW,
      actions: [
        { id: "fallback:stored", kind: "fallback", title: "Stored plan", subtitle: "", monthlyAmountCents: 0, priorityCents: 0, done: false },
      ],
      startLightScore: 50,
      generatedOn: NOW,
    };
    const ctx = await renderWithCrypt(<PlanProbe />, { mode: "real", seed: { plans: [stored] }, now: NOW });
    await waitFor(() => expect(ctx.getByTestId("plan").textContent).toBe("Stored plan"));
    expect(calls).toEqual([]);
  });

  it("generates a missing plan only from an effect, never during render", async () => {
    calls.length = 0;
    const ctx = await renderWithCrypt(<PlanProbe />, { mode: "real", now: NOW });
    await waitFor(() => expect(ctx.getByTestId("plan").textContent).not.toBe("loading"));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter((c) => c.duringRender)).toEqual([]);
    expect(await ctx.realDb.weeklyPlans.count()).toBe(1);
  });
});
