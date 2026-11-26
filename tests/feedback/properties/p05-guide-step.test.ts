// Feature: action-feedback, Property 5: The Guide_Step names the right action
// Validates: Requirements 5.3, 5.4, 5.5
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { ExorcismAction, ExorcismActionKind } from "@/lib/exorcism/types";
import { getDoItTarget, getGuideStep, getShortTitle, type DoItRows } from "@/lib/utils/planView";

const DONE_TEXT =
  "This week's exorcism is done. Use Skip to next week in Demo controls for a new plan.";

const kindArb = fc.constantFrom<ExorcismActionKind>(
  "cancel_subscription",
  "extra_payment",
  "reduce_small_expenses",
  "fallback",
);

const actionArb = fc.record({
  id: fc.uuid(),
  kind: kindArb,
  name: fc.stringMatching(/^[A-Za-z0-9 $]{1,20}$/),
  tail: fc.option(fc.stringMatching(/^[a-z0-9 $/]{1,12}$/), { nil: undefined }),
  targetId: fc.option(fc.constantFrom("t1", "t2", "t3"), { nil: undefined }),
  done: fc.boolean(),
});

const rowsArb = fc.record({
  subscriptions: fc.array(
    fc.record({ id: fc.constantFrom("t1", "t2", "t3"), active: fc.boolean() }),
    { maxLength: 3 },
  ),
  debts: fc.array(
    fc.record({
      id: fc.constantFrom("t1", "t2", "t3"),
      balanceCents: fc.integer({ min: 0, max: 1_000_000 }),
      minimumPaymentCents: fc.integer({ min: 0, max: 100_000 }),
    }),
    { maxLength: 3 },
  ),
});

describe("Property 5: The Guide_Step names the right action", () => {
  it("names the first Do it action, else the first not-done action, else the done text", () => {
    fc.assert(
      fc.property(fc.array(actionArb, { minLength: 3, maxLength: 3 }), rowsArb, (specs, rows) => {
        const actions: ExorcismAction[] = specs.map((spec) => ({
          id: spec.id,
          kind: spec.kind,
          title: spec.tail === undefined ? spec.name : `${spec.name} — ${spec.tail}`,
          subtitle: "",
          targetId: spec.targetId,
          monthlyAmountCents: 0,
          priorityCents: 0,
          done: spec.done,
        }));
        const doItRows: DoItRows = rows;
        const step = getGuideStep(actions, doItRows);
        const firstDoIt = actions.find((a) => getDoItTarget(a, doItRows) !== null);
        const firstPending = actions.find((a) => !a.done);
        if (firstDoIt !== undefined) {
          expect(step.startsWith(`Press Do it on ${getShortTitle(firstDoIt.title)} and watch`)).toBe(
            true,
          );
        } else if (firstPending !== undefined) {
          expect(step.startsWith(`Tick ${getShortTitle(firstPending.title)} in `)).toBe(true);
        } else {
          expect(step).toBe(DONE_TEXT);
        }
      }),
      { numRuns: 200 },
    );
  });
});
