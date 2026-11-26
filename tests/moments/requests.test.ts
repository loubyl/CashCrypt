// Example tests for Moment request planning (house-scene task 9.11). Requirements: 12.4, 12.6.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMomentQueue } from "@/lib/moments/queue";
import { planLevelMoment, planMoments } from "@/lib/moments/requests";
import { MOMENT_GAP_MS, MOMENT_HARD_CAP_MS, MOMENT_QUEUE_MAX_PENDING } from "@/lib/scene/config";
import type { ActionContext, ActionOutcome, MomentRequest } from "@/lib/moments/types";

const ORIGIN = { left: 1, top: 2, width: 3, height: 4 };

function context(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    level: 4,
    poltergeistPresent: true,
    drawnZombieIds: ["sub-1"],
    crackCount: 2,
    litWindowCount: 2,
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
  const toggle = (actionId: string, next: boolean): ActionOutcome => ({ kind: "planToggle", actionId, next, lightDelta: 0 });

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

describe("planMoments for expenses and fallback ticks", () => {
  const expense = (over: Partial<Extract<ActionOutcome, { kind: "expense" }>> = {}): ActionOutcome => ({
    kind: "expense",
    transactionId: "t1",
    small: true,
    poltergeistAfter: true,
    ...over,
  });
  const fallbackCtx = context({
    level: 1,
    poltergeistPresent: false,
    planActions: [{ id: "f1", kind: "fallback", done: false }],
  });
  const tick = (lightDelta: number): ActionOutcome => ({ kind: "planToggle", actionId: "f1", next: true, lightDelta });

  it("feeds the existing Poltergeist for a small expense at level 4", () => {
    expect(planMoments(expense(), context())).toEqual([{ kind: "poltergeistFeed", appeared: false }]);
  });

  it("plans a ghost arrival for a small expense at level 2 without a Poltergeist", () => {
    const ctx = context({ level: 2, poltergeistPresent: false });
    expect(planMoments(expense({ poltergeistAfter: false }), ctx)).toEqual([
      { kind: "ghostArrival", transactionId: "t1" },
    ]);
  });

  it("plans nothing for a $40 expense", () => {
    expect(planMoments(expense({ small: false }), context())).toEqual([]);
  });

  it("flickers lit windows for a level-1 fallback tick with delta 1, and nothing for its re-tick with delta 0", () => {
    expect(planMoments(tick(1), fallbackCtx)).toEqual([{ kind: "candleFlicker", litWindows: true }]);
    expect(planMoments(tick(0), fallbackCtx)).toEqual([]);
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
      { kind: "planToggle", actionId: CUT_COFFEE, next: true, lightDelta: 0 },
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

// Task 16.2. Requirements: 12.5, 18.6, 18.7.
describe("level-4 demo flow through the Moment queue", () => {
  const PLAY_MS = 700;
  const WRAITHCAST = "sub-wraithcast";
  const CUT_COFFEE = "reduce-Coffee";
  const PAY_SCARLET = "pay-scarlet-moth";
  const CANCEL_WRAITHCAST = "cancel-wraithcast";
  const plan = [
    { id: CANCEL_WRAITHCAST, kind: "cancel_subscription" },
    { id: CUT_COFFEE, kind: "reduce_small_expenses" },
    { id: PAY_SCARLET, kind: "extra_payment" },
  ];
  const ctx = (doneIds: readonly string[]): ActionContext =>
    context({
      drawnZombieIds: [WRAITHCAST],
      subscriptionNames: { [WRAITHCAST]: "Wraithcast" },
      planActions: plan.map((a) => ({ ...a, done: doneIds.includes(a.id) })),
    });

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays cancel, sigil, payment, exorcism complete and level 4 to 3 in order, without overlap and one gap apart", async () => {
    const plays: { kind: MomentRequest["kind"]; start: number; end: number }[] = [];
    let active = 0;
    let maxActive = 0;
    const queue = createMomentQueue({
      play: async (request) => {
        const start = Date.now();
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((resolve) => setTimeout(resolve, PLAY_MS));
        active -= 1;
        plays.push({ kind: request.kind, start, end: Date.now() });
      },
      isTargetMounted: () => true,
      gapMs: MOMENT_GAP_MS,
      hardCapMs: MOMENT_HARD_CAP_MS,
      maxPending: MOMENT_QUEUE_MAX_PENDING,
    });

    const cancel = planMoments(
      cancelOutcome({ subscriptionId: WRAITHCAST, monthlySavedCents: 12_000, completedActionId: CANCEL_WRAITHCAST }),
      ctx([]),
    );
    const sigil = planMoments({ kind: "planToggle", actionId: CUT_COFFEE, next: true, lightDelta: 0 }, ctx([CANCEL_WRAITHCAST]));
    const payment = planMoments(
      { kind: "payment", extraPrincipalCents: 30_000, completedActionId: PAY_SCARLET, origin: ORIGIN },
      ctx([CANCEL_WRAITHCAST, CUT_COFFEE]),
    );
    const outcomes = [...cancel, ...sigil, ...payment].map((request) => queue.enqueue(request));
    // The level request is appended once live data settles on level 3.
    const level = planLevelMoment(4, 3);
    expect(level).not.toBeNull();
    outcomes.push(queue.enqueue(level as MomentRequest));

    await vi.advanceTimersByTimeAsync(5 * PLAY_MS + 4 * MOMENT_GAP_MS);

    await expect(Promise.all(outcomes)).resolves.toEqual(Array(5).fill("completed"));
    expect(plays.map((p) => p.kind)).toEqual(["cancel", "sigil", "payment", "exorcismComplete", "level"]);
    expect(maxActive).toBe(1);
    for (let i = 1; i < plays.length; i += 1) {
      expect(plays[i].start - plays[i - 1].end).toBe(MOMENT_GAP_MS);
    }
    expect(queue.state).toBe("idle");
  });
});
