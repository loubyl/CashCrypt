import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { planMoments } from "@/lib/moments/requests";
import type { ActionContext, ActionOutcome, MomentRequest, PlanActionView } from "@/lib/moments/types";

const NUM_RUNS = 200;
const ACTION_ID = "act";
const KINDS = ["reduce_small_expenses", "cancel_subscription", "extra_payment", "fallback"] as const;

const ctxArb: fc.Arbitrary<ActionContext> = fc.record({
  level: fc.constantFrom(1, 2, 3, 4, 5) as fc.Arbitrary<ActionContext["level"]>,
  poltergeistPresent: fc.boolean(),
  drawnZombieIds: fc.constant([] as string[]),
  crackCount: fc.integer({ min: 0, max: 6 }),
  litWindowCount: fc.integer({ min: 0, max: 4 }),
  subscriptionNames: fc.constant({} as Record<string, string>),
  planActions: fc.record({ kind: fc.constantFrom(...KINDS), done: fc.boolean() }).map(
    (a): PlanActionView[] => [{ id: ACTION_ID, ...a }],
  ),
});

const expenseArb = fc.record({
  kind: fc.constant("expense" as const),
  transactionId: fc.string({ minLength: 1, maxLength: 8 }),
  small: fc.boolean(),
  poltergeistAfter: fc.boolean(),
});

const toggleArb = fc.record({
  kind: fc.constant("planToggle" as const),
  actionId: fc.constant(ACTION_ID),
  next: fc.boolean(),
  lightDelta: fc.oneof(fc.constant(0), fc.double({ min: -50, max: 50, noNaN: true })),
});

function ownKinds(requests: MomentRequest[]): MomentRequest[] {
  return requests.filter((r) => r.kind !== "exorcismComplete");
}

// Feature: action-feedback, Property 4: New Moment requests follow the outcome
describe("new Moment requests follow the outcome", () => {
  it("plans a feed or arrival only for small expenses, and nothing for other expenses", () => {
    // Validates: Requirements 4.1, 4.5, 4.8
    fc.assert(
      fc.property(expenseArb, ctxArb, (outcome: ActionOutcome & { kind: "expense" }, ctx) => {
        const result = planMoments(outcome, ctx);
        let expected: MomentRequest[] = [];
        if (outcome.small) {
          expected = outcome.poltergeistAfter
            ? [{ kind: "poltergeistFeed", appeared: !ctx.poltergeistPresent }]
            : [{ kind: "ghostArrival", transactionId: outcome.transactionId }];
        }
        expect(result).toEqual(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("plans a candle flicker only for a new tick of a reduce action with no Poltergeist and a positive light delta", () => {
    // Validates: Requirements 8.1 to 8.3 and 17.6 (a fallback tick never flickers)
    fc.assert(
      fc.property(toggleArb, ctxArb, (outcome, ctx) => {
        const own = ownKinds(planMoments(outcome, ctx));
        const action = ctx.planActions[0];
        const sigil = action.kind === "reduce_small_expenses" && ctx.poltergeistPresent;
        const flickers =
          outcome.next && !action.done && !sigil && action.kind === "reduce_small_expenses" && outcome.lightDelta > 0;
        if (flickers) {
          expect(own).toEqual([{ kind: "candleFlicker", litWindows: ctx.litWindowCount > 0 }]);
        } else {
          expect(own.map((r) => r.kind)).not.toContain("candleFlicker");
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
