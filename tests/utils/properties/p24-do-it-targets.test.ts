import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { ExorcismAction } from "@/lib/exorcism/types";
import { getDoItTarget, getExtraAboveMinimum, type DoItRows } from "@/lib/utils/planView";

const NUM_RUNS = 200;
const MAX_CENTS = 100_000_000;
const MIN_PAYMENT_CENTS = 1;

const centsArb = fc.integer({ min: 0, max: MAX_CENTS });
const positiveCentsArb = fc.integer({ min: MIN_PAYMENT_CENTS, max: MAX_CENTS });

const baseActionArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  title: fc.string(),
  subtitle: fc.string(),
  monthlyAmountCents: centsArb,
  priorityCents: centsArb,
});

const noTargetKindArb = fc.constantFrom("fallback", "reduce_small_expenses") as fc.Arbitrary<
  "fallback" | "reduce_small_expenses"
>;

function makeAction(
  base: { id: string; title: string; subtitle: string; monthlyAmountCents: number; priorityCents: number },
  extra: Partial<ExorcismAction> & Pick<ExorcismAction, "kind" | "done">,
): ExorcismAction {
  return { ...base, ...extra };
}

const rowsArb = fc.record({
  subscriptions: fc.array(
    fc.record({ id: fc.constantFrom("s1", "s2", "s3"), active: fc.boolean() }),
    { maxLength: 4 },
  ),
  debts: fc.array(
    fc.record({
      id: fc.constantFrom("d1", "d2", "d3"),
      balanceCents: centsArb,
      minimumPaymentCents: centsArb,
    }),
    { maxLength: 4 },
  ),
});

describe("Do it targets and pre-fill", () => {
  // Feature: app-screens, Property 24: Do it is offered only where it can work, with a safe pre-fill
  // **Validates: Requirements 13.8, 14.6, 22.9, 22.10, 25.3, 25.4, 25.8, 25.9**
  it("returns null for fallback and reduce_small_expenses actions", () => {
    fc.assert(
      fc.property(baseActionArb, noTargetKindArb, rowsArb, fc.boolean(), (base, kind, rows, done) => {
        const action = makeAction(base, { kind, done, targetId: "s1" });
        expect(getDoItTarget(action, rows)).toBeNull();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: app-screens, Property 24: Do it is offered only where it can work, with a safe pre-fill
  it("returns null for done actions", () => {
    fc.assert(
      fc.property(
        baseActionArb,
        fc.constantFrom("cancel_subscription", "extra_payment") as fc.Arbitrary<
          "cancel_subscription" | "extra_payment"
        >,
        rowsArb,
        (base, kind, rows) => {
          const action = makeAction(base, { kind, done: true, targetId: "s1", suggestedAmountCents: 100 });
          expect(getDoItTarget(action, rows)).toBeNull();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: app-screens, Property 24: Do it is offered only where it can work, with a safe pre-fill
  it("offers cancel only for an existing active subscription", () => {
    fc.assert(
      fc.property(baseActionArb, rowsArb, fc.constantFrom("s1", "s2", "s3", "missing"), (base, rows, targetId) => {
        const action = makeAction(base, { kind: "cancel_subscription", done: false, targetId });
        const target = getDoItTarget(action, rows);
        const qualifies = rows.subscriptions.find((s) => s.id === targetId)?.active === true;
        if (qualifies) {
          expect(target).toEqual({ kind: "cancel", subscriptionId: targetId });
        } else {
          expect(target).toBeNull();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: app-screens, Property 24: Do it is offered only where it can work, with a safe pre-fill
  it("offers pay only for an existing debt with a balance, with a pre-fill within 1 cent and the balance", () => {
    fc.assert(
      fc.property(
        baseActionArb,
        rowsArb,
        fc.constantFrom("d1", "d2", "d3", "missing"),
        positiveCentsArb,
        (base, rows, targetId, suggested) => {
          const action = makeAction(base, {
            kind: "extra_payment",
            done: false,
            targetId,
            suggestedAmountCents: suggested,
          });
          const target = getDoItTarget(action, rows as DoItRows);
          const debt = rows.debts.find((d) => d.id === targetId);
          if (debt === undefined || debt.balanceCents <= 0) {
            expect(target).toBeNull();
            return;
          }
          expect(target).not.toBeNull();
          if (target === null || target.kind !== "pay") {
            throw new Error("expected a pay target");
          }
          expect(target.debtId).toBe(targetId);
          expect(target.prefillCents).toBe(
            Math.min(debt.minimumPaymentCents + suggested, debt.balanceCents),
          );
          expect(target.prefillCents).toBeGreaterThanOrEqual(MIN_PAYMENT_CENTS);
          expect(target.prefillCents).toBeLessThanOrEqual(debt.balanceCents);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: app-screens, Property 24: Do it is offered only where it can work, with a safe pre-fill
  it("computes the extra above the minimum as max(0, amount - minimum)", () => {
    fc.assert(
      fc.property(centsArb, centsArb, (amount, minimum) => {
        expect(getExtraAboveMinimum(amount, minimum)).toBe(Math.max(0, amount - minimum));
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
