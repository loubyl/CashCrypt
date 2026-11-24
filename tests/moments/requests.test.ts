// Example tests for Moment request planning (house-scene task 9.11). Requirements: 12.4, 12.6.
import { describe, expect, it } from "vitest";
import { planLevelMoment, planMoments } from "@/lib/moments/requests";
import type { ActionContext, ActionOutcome } from "@/lib/moments/types";

const ORIGIN = { left: 1, top: 2, width: 3, height: 4 };

function context(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    level: 4,
    poltergeistPresent: true,
    drawnZombieIds: ["sub-1"],
    crackCount: 2,
    subscriptionNames: { "sub-1": "StreamMax", "sub-2": "Gym" },
    planActions: [
      { id: "a1", kind: "cancel_subscription", done: true },
      { id: "a2", kind: "extra_payment", done: true },
      { id: "a3", kind: "reduce_small_expenses", done: false },
    ],
    ...overrides,
  };
}

const cancelOutcome = (over: Partial<Extract<ActionOutcome, { kind: "cancel" }>> = {}): ActionOutcome => ({
  kind: "cancel",
  subscriptionId: "sub-1",
  changed: true,
  monthlySavedCents: 2299,
  completedActionId: null,
  ...over,
});

describe("planMoments for a cancel", () => {
  it("plans a zombie cancel Moment with the name and monthly saving", () => {
    expect(planMoments(cancelOutcome(), context())).toEqual([
      { kind: "cancel", subscriptionId: "sub-1", name: "StreamMax", monthlyCents: 2299, target: "zombie" },
    ]);
  });

  it("targets the overflow marker when the zombie is not drawn", () => {
    const [request] = planMoments(cancelOutcome({ subscriptionId: "sub-2" }), context());
    expect(request).toMatchObject({ kind: "cancel", target: "overflow", name: "Gym" });
  });

  it("plans nothing when the cancel changed nothing", () => {
    expect(planMoments(cancelOutcome({ changed: false }), context())).toEqual([]);
  });
});

describe("planMoments for a payment", () => {
  it("plans a payment Moment only when extra principal was paid", () => {
    const paid: ActionOutcome = { kind: "payment", extraPrincipalCents: 5000, completedActionId: null, origin: ORIGIN };
    expect(planMoments(paid, context())).toEqual([{ kind: "payment", origin: ORIGIN, hasCrack: true }]);
    expect(planMoments({ ...paid, extraPrincipalCents: 0 }, context())).toEqual([]);
  });

  it("reports no crack when the scene has none", () => {
    const paid: ActionOutcome = { kind: "payment", extraPrincipalCents: 1, completedActionId: null, origin: null };
    expect(planMoments(paid, context({ crackCount: 0 }))).toEqual([{ kind: "payment", origin: null, hasCrack: false }]);
  });
});

describe("planMoments for plan toggles", () => {
  const toggle = (actionId: string, next: boolean): ActionOutcome => ({ kind: "planToggle", actionId, next });

  it("plans a sigil for ticking reduce_small_expenses while the Poltergeist is present, then the plan-complete Moment", () => {
    expect(planMoments(toggle("a3", true), context())).toEqual([{ kind: "sigil" }, { kind: "exorcismComplete" }]);
  });

  it("plans no sigil without a Poltergeist", () => {
    expect(planMoments(toggle("a3", true), context({ poltergeistPresent: false }))).toEqual([{ kind: "exorcismComplete" }]);
  });

  it("plans nothing when an action is unticked", () => {
    expect(planMoments(toggle("a1", false), context())).toEqual([]);
  });

  it("plans the plan-complete Moment only for the third done action", () => {
    const twoDone = context({
      planActions: [
        { id: "a1", kind: "cancel_subscription", done: true },
        { id: "a2", kind: "extra_payment", done: false },
        { id: "a3", kind: "reduce_small_expenses", done: false },
      ],
    });
    expect(planMoments(toggle("a2", true), twoDone)).toEqual([]);
  });

  it("adds the plan-complete Moment after a payment that completes the third action", () => {
    const paid: ActionOutcome = { kind: "payment", extraPrincipalCents: 100, completedActionId: "a3", origin: ORIGIN };
    expect(planMoments(paid, context()).map((r) => r.kind)).toEqual(["payment", "exorcismComplete"]);
  });
});

describe("planLevelMoment", () => {
  it("returns a level request when the levels differ", () => {
    expect(planLevelMoment(4, 3)).toEqual({ kind: "level", from: 4, to: 3 });
    expect(planLevelMoment(2, 5)).toEqual({ kind: "level", from: 2, to: 5 });
  });

  it("returns null when the levels are equal", () => {
    expect(planLevelMoment(3, 3)).toBeNull();
  });
});

describe("planMoments for the level-4 demo week-1 plan", () => {
  // Names and amounts come from the level-4 demo seed (src/lib/demo/seed.ts).
  const WRAITHCAST = "sub-wraithcast";
  const CUT_COFFEE = "reduce-Coffee";
  const PAY_SCARLET = "pay-scarlet-moth";
  const CANCEL_WRAITHCAST = "cancel-wraithcast";
  const WRAITHCAST_MONTHLY_CENTS = 12_000;
  const EXTRA_PAYMENT_CENTS = 30_000;

  const basePlan = [
    { id: CANCEL_WRAITHCAST, kind: "cancel_subscription" },
    { id: CUT_COFFEE, kind: "reduce_small_expenses" },
    { id: PAY_SCARLET, kind: "extra_payment" },
  ];

  function demoContext(doneIds: readonly string[]): ActionContext {
    return context({
      level: 4,
      poltergeistPresent: true,
      drawnZombieIds: [WRAITHCAST],
      subscriptionNames: { [WRAITHCAST]: "Wraithcast" },
      planActions: basePlan.map((a) => ({ ...a, done: doneIds.includes(a.id) })),
    });
  }

  it("plans cancel, then sigil, then payment followed by exorcismComplete (no level request)", () => {
    const cancel = planMoments(
      cancelOutcome({
        subscriptionId: WRAITHCAST,
        monthlySavedCents: WRAITHCAST_MONTHLY_CENTS,
        completedActionId: CANCEL_WRAITHCAST,
      }),
      demoContext([]),
    );
    expect(cancel).toEqual([
      { kind: "cancel", subscriptionId: WRAITHCAST, name: "Wraithcast", monthlyCents: WRAITHCAST_MONTHLY_CENTS, target: "zombie" },
    ]);

    const sigil = planMoments(
      { kind: "planToggle", actionId: CUT_COFFEE, next: true },
      demoContext([CANCEL_WRAITHCAST]),
    );
    expect(sigil).toEqual([{ kind: "sigil" }]);

    const payment = planMoments(
      { kind: "payment", extraPrincipalCents: EXTRA_PAYMENT_CENTS, completedActionId: PAY_SCARLET, origin: ORIGIN },
      demoContext([CANCEL_WRAITHCAST, CUT_COFFEE]),
    );
    expect(payment).toEqual([{ kind: "payment", origin: ORIGIN, hasCrack: true }, { kind: "exorcismComplete" }]);

    const whole = [...cancel, ...sigil, ...payment].map((r) => r.kind);
    expect(whole).toEqual(["cancel", "sigil", "payment", "exorcismComplete"]);
    expect(whole).not.toContain("level");
  });
});
