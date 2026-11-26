import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { computeHouseState } from "@/lib/haunting";
import { MIN_INCOME_CENTS, SMALL_EXPENSE_THRESHOLD_CENTS } from "@/lib/haunting/config";
import { planMoments } from "@/lib/moments/requests";
import type { ActionContext, ActionOutcome } from "@/lib/moments/types";
import {
  GHOST_ASLEEP_CLAUSE,
  GHOST_EXPENSE_CLAUSE,
  GHOST_WOKE_CLAUSE,
  getGhostClause,
} from "@/lib/utils/lightClause";
import { getSmallExpenseSummary } from "@/lib/utils/listViews";
import type { CryptRows, TransactionRow } from "@/types/finance";
const NUM_RUNS = 200;
const NOW = "2025-06-02";
const MAX_INCOME_CENTS = 50_000_000;
const MAX_SMALL_ROWS = 8;
const WAKES_TEXT = "more wakes the Poltergeist";
const ctxFor = (poltergeistPresent: boolean): ActionContext => ({
  level: 3,
  poltergeistPresent,
  drawnZombieIds: [],
  crackCount: 0,
  litWindowCount: 2,
  subscriptionNames: {},
  planActions: [],
});
const smallRowArb: fc.Arbitrary<TransactionRow> = fc.record({
  id: fc.uuid(),
  amountCents: fc.integer({ min: 1, max: SMALL_EXPENSE_THRESHOLD_CENTS - 1 }),
  description: fc.constant("Small"),
  category: fc.constant("Coffee"),
  date: fc.constant(NOW),
});
function rowsOf(incomeCents: number, transactions: TransactionRow[]): CryptRows {
  return {
    profile: { monthlyIncomeCents: incomeCents },
    debts: [],
    subscriptions: [],
    transactions,
    events: [],
    plans: [],
  };
}
function hasPoltergeist(rows: CryptRows): boolean {
  return computeHouseState(toFinancialSnapshot(rows, NOW)).poltergeist !== null;
}
/** Splits `cents` into small expenses, each below the small-expense threshold. */
function splitIntoSmallRows(cents: number): TransactionRow[] {
  const rows: TransactionRow[] = [];
  let left = cents;
  while (left > 0) {
    const part = Math.min(left, SMALL_EXPENSE_THRESHOLD_CENTS - 1);
    rows.push({ id: `extra-${rows.length}`, amountCents: part, description: "Extra", category: "Coffee", date: NOW });
    left -= part;
  }
  return rows;
}
// Feature: action-feedback, Property 6: The ghost toast and the Moment agree
describe("Property 6: The ghost toast and the Moment agree", () => {
  it("names the Poltergeist in the toast exactly when the Moment is a feed", () => {
    // **Validates: Requirements 2.6, 4.1, 4.5**
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.option(fc.integer({ min: 1, max: 10_000_000 }), { nil: null }),
        (before, after, centsToWake) => {
          const outcome: ActionOutcome = { kind: "expense", transactionId: "t1", small: true, poltergeistAfter: after };
          const requests = planMoments(outcome, ctxFor(before));
          const clause = getGhostClause({ poltergeistBefore: before, poltergeistAfter: after, centsToWake });
          expect(requests).toHaveLength(1);
          const request = requests[0];
          if (request?.kind === "poltergeistFeed") {
            expect(clause).toBe(request.appeared ? GHOST_WOKE_CLAUSE : GHOST_EXPENSE_CLAUSE);
          } else {
            expect(request?.kind).toBe("ghostArrival");
            expect(clause.startsWith(GHOST_ASLEEP_CLAUSE)).toBe(true);
            expect(clause.includes(WAKES_TEXT)).toBe(centsToWake !== null);
            expect(clause.includes("feeds")).toBe(false);
            expect(clause.includes("woke")).toBe(false);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
  it("says nothing about the Poltergeist when the reading failed", () => {
    expect(getGhostClause(null)).toBe(GHOST_ASLEEP_CLAUSE);
  });
  it("wakes the Poltergeist with centsToWake more, and not with one cent less", () => {
    // **Validates: Requirements 2.6**
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_INCOME_CENTS, max: MAX_INCOME_CENTS }),
        fc.array(smallRowArb, { maxLength: MAX_SMALL_ROWS }),
        (income, small) => {
          const summary = getSmallExpenseSummary(small, NOW, income);
          if (summary.awake) {
            expect(summary.centsToWake).toBeNull();
            return;
          }
          const need = summary.centsToWake;
          expect(need).not.toBeNull();
          if (need === null) return;
          expect(need).toBeGreaterThanOrEqual(1);
          expect(hasPoltergeist(rowsOf(income, small))).toBe(false);
          expect(hasPoltergeist(rowsOf(income, [...small, ...splitIntoSmallRows(need)]))).toBe(true);
          if (need > 1) {
            expect(hasPoltergeist(rowsOf(income, [...small, ...splitIntoSmallRows(need - 1)]))).toBe(false);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
  it("has no centsToWake when the income is too low to wake it", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MIN_INCOME_CENTS - 1 }), fc.array(smallRowArb, { maxLength: 4 }), (income, small) => {
        expect(getSmallExpenseSummary(small, NOW, income).centsToWake).toBeNull();
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
