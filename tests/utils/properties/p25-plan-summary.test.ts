import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { ExorcismAction } from "@/lib/exorcism/types";
import { summarizePlan } from "@/lib/utils/planView";

const NUM_RUNS = 200;
const PLAN_SIZE = 3;
const MAX_CENTS = 10_000_000;

const actionArb = fc.record({
  id: fc.uuid(),
  kind: fc.constantFrom<ExorcismAction["kind"]>(
    "cancel_subscription",
    "extra_payment",
    "reduce_small_expenses",
    "fallback",
  ),
  title: fc.string(),
  subtitle: fc.string(),
  monthlyAmountCents: fc.integer({ min: 0, max: MAX_CENTS }),
  priorityCents: fc.integer({ min: 0, max: MAX_CENTS }),
  done: fc.boolean(),
}) satisfies fc.Arbitrary<ExorcismAction>;

const planArb = fc.array(actionArb, { minLength: PLAN_SIZE, maxLength: PLAN_SIZE });

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe("plan summary", () => {
  // Feature: app-screens, Property 25: The plan summary adds up
  // **Validates: Requirements 22.1, 22.4, 22.5**
  it("counts done actions, sums freed and possible cents, and sets allDone only when all three are done", () => {
    fc.assert(
      fc.property(planArb, (actions) => {
        const summary = summarizePlan(actions);
        const done = actions.filter((action) => action.done);

        expect(summary.total).toBe(PLAN_SIZE);
        expect(summary.doneCount).toBe(done.length);
        expect(summary.freedCents).toBe(sum(done.map((a) => a.monthlyAmountCents)));
        expect(summary.possibleCents).toBe(sum(actions.map((a) => a.monthlyAmountCents)));
        expect(summary.freedCents).toBeLessThanOrEqual(summary.possibleCents);
        expect(summary.allDone).toBe(summary.doneCount === PLAN_SIZE);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
