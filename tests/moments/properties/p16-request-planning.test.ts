import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { planMoments } from "@/lib/moments/requests";
import type { ActionContext, ActionOutcome, MomentRequest, PlanActionView } from "@/lib/moments/types";

// Feature: house-scene, Property 16: Request planning follows the action outcome
// **Validates: Requirements 12.1, 12.3, 12.5, 13.1, 13.2, 13.5, 14.1, 14.2, 15.1, 15.2, 17.1, 17.7**

const NUM_RUNS = 200;
const IDS = ["a", "b", "c", "d", "e"] as const;
const KINDS = ["reduce_small_expenses", "cancel_subscription", "extra_payment", "fallback"] as const;
const REDUCE = "reduce_small_expenses";
const COMPLETE_FROM = 2;

const rectArb = fc.record({
  left: fc.integer({ min: 0, max: 2000 }),
  top: fc.integer({ min: 0, max: 2000 }),
  width: fc.integer({ min: 1, max: 500 }),
  height: fc.integer({ min: 1, max: 500 }),
});

const planActionsArb: fc.Arbitrary<PlanActionView[]> = fc
  .uniqueArray(fc.constantFrom(...IDS), { minLength: 0, maxLength: 5 })
  .chain((ids) =>
    fc.tuple(...ids.map((id) =>
      fc.record({ id: fc.constant(id), kind: fc.constantFrom(...KINDS), done: fc.boolean() }),
    )) as fc.Arbitrary<PlanActionView[]>,
  );

const ctxArb: fc.Arbitrary<ActionContext> = fc.record({
  level: fc.constantFrom(1, 2, 3, 4, 5) as fc.Arbitrary<ActionContext["level"]>,
  poltergeistPresent: fc.boolean(),
  drawnZombieIds: fc.uniqueArray(fc.constantFrom(...IDS), { maxLength: 5 }),
  crackCount: fc.integer({ min: 0, max: 6 }),
  subscriptionNames: fc.constant({ a: "Alpha", b: "Beta", c: "Gamma" } as Record<string, string>),
  planActions: planActionsArb,
});

const completedIdArb = fc.option(fc.constantFrom(...IDS), { nil: null });

const outcomeArb: fc.Arbitrary<ActionOutcome> = fc.oneof(
  fc.record({
    kind: fc.constant("cancel" as const),
    subscriptionId: fc.constantFrom(...IDS),
    changed: fc.boolean(),
    monthlySavedCents: fc.integer({ min: 0, max: 100_000 }),
    completedActionId: completedIdArb,
  }),
  fc.record({
    kind: fc.constant("payment" as const),
    extraPrincipalCents: fc.integer({ min: -100, max: 100_000 }),
    completedActionId: completedIdArb,
    origin: fc.option(rectArb, { nil: null }),
  }),
  fc.record({
    kind: fc.constant("planToggle" as const),
    actionId: fc.constantFrom(...IDS),
    next: fc.boolean(),
  }),
);

function expectedOwn(outcome: ActionOutcome, ctx: ActionContext): MomentRequest | null {
  if (outcome.kind === "cancel") {
    if (!outcome.changed) return null;
    return {
      kind: "cancel",
      subscriptionId: outcome.subscriptionId,
      name: ctx.subscriptionNames[outcome.subscriptionId] ?? "",
      monthlyCents: outcome.monthlySavedCents,
      target: ctx.drawnZombieIds.includes(outcome.subscriptionId) ? "zombie" : "overflow",
    };
  }
  if (outcome.kind === "payment") {
    if (outcome.extraPrincipalCents <= 0) return null;
    return { kind: "payment", origin: outcome.origin, hasCrack: ctx.crackCount > 0 };
  }
  const action = ctx.planActions.find((a) => a.id === outcome.actionId);
  const isSigil =
    outcome.next && ctx.poltergeistPresent && action !== undefined && !action.done && action.kind === REDUCE;
  return isSigil ? { kind: "sigil" } : null;
}

function expectedCompletes(outcome: ActionOutcome, ctx: ActionContext): boolean {
  const id = outcome.kind === "planToggle" ? (outcome.next ? outcome.actionId : null) : outcome.completedActionId;
  if (id === null) return false;
  const action = ctx.planActions.find((a) => a.id === id);
  if (!action || action.done) return false;
  return ctx.planActions.filter((a) => a.done).length === COMPLETE_FROM;
}

describe("Property 16: Request planning follows the action outcome", () => {
  it("plans exactly the own request and the plan-complete request, in that order", () => {
    fc.assert(
      fc.property(outcomeArb, ctxArb, (outcome, ctx) => {
        const own = expectedOwn(outcome, ctx);
        const expected: MomentRequest[] = [];
        if (own) expected.push(own);
        if (expectedCompletes(outcome, ctx)) expected.push({ kind: "exorcismComplete" });
        expect(planMoments(outcome, ctx)).toEqual(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("never plans more than one request of each kind", () => {
    fc.assert(
      fc.property(outcomeArb, ctxArb, (outcome, ctx) => {
        const kinds = planMoments(outcome, ctx).map((r) => r.kind);
        expect(new Set(kinds).size).toBe(kinds.length);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("plans no request for a rejected, unchanged or untick outcome", () => {
    fc.assert(
      fc.property(ctxArb, fc.constantFrom(...IDS), (ctx, id) => {
        const none: ActionOutcome[] = [
          { kind: "cancel", subscriptionId: id, changed: false, monthlySavedCents: 100, completedActionId: null },
          { kind: "payment", extraPrincipalCents: 0, completedActionId: null, origin: null },
          { kind: "planToggle", actionId: id, next: false },
        ];
        for (const outcome of none) expect(planMoments(outcome, ctx)).toEqual([]);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("never plans a sigil for a payment or a cancel, even when it auto-completes a reduce_small_expenses action", () => {
    const reduceCtxArb = fc.record({
      done: fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }),
    }).map(({ done }): ActionContext => ({
      level: 4,
      poltergeistPresent: true,
      drawnZombieIds: ["a"],
      crackCount: 1,
      subscriptionNames: { a: "Alpha" },
      planActions: IDS.slice(0, 3).map((id, i) => ({ id, kind: REDUCE, done: done[i] })),
    }));
    const autoCompleteArb: fc.Arbitrary<ActionOutcome> = fc.oneof(
      fc.record({
        kind: fc.constant("cancel" as const),
        subscriptionId: fc.constant("a"),
        changed: fc.boolean(),
        monthlySavedCents: fc.integer({ min: 0, max: 5000 }),
        completedActionId: fc.constantFrom("a", "b", "c"),
      }),
      fc.record({
        kind: fc.constant("payment" as const),
        extraPrincipalCents: fc.integer({ min: -10, max: 5000 }),
        completedActionId: fc.constantFrom("a", "b", "c"),
        origin: fc.constant(null),
      }),
    );
    fc.assert(
      fc.property(autoCompleteArb, reduceCtxArb, (outcome, ctx) => {
        expect(planMoments(outcome, ctx).map((r) => r.kind)).not.toContain("sigil");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("plans exorcismComplete again after an untick and a tick", () => {
    const actions: PlanActionView[] = [
      { id: "a", kind: "fallback", done: true },
      { id: "b", kind: "fallback", done: true },
      { id: "c", kind: "fallback", done: false },
    ];
    const ctx: ActionContext = {
      level: 3,
      poltergeistPresent: false,
      drawnZombieIds: [],
      crackCount: 0,
      subscriptionNames: {},
      planActions: actions,
    };
    const tick: ActionOutcome = { kind: "planToggle", actionId: "c", next: true };
    expect(planMoments(tick, ctx)).toEqual([{ kind: "exorcismComplete" }]);
    const untickedCtx: ActionContext = {
      ...ctx,
      planActions: actions.map((a) => ({ ...a, done: a.id === "c" ? true : a.id === "a" })),
    };
    expect(planMoments({ kind: "planToggle", actionId: "b", next: true }, untickedCtx)).toEqual([
      { kind: "exorcismComplete" },
    ]);
  });
});
