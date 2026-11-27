// Feature: action-feedback, Property 7: Fallback completions never change momentum
// Validates: Requirements 17.1, 17.2
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isFallbackPlanRefKey, planRefKey } from "@/lib/db/refKeys";
import { toFinancialSnapshot } from "@/lib/db/snapshotAdapter";
import { computeHouseState } from "@/lib/haunting";
import { FALLBACK_KEYS } from "@/lib/exorcism/config";
import type { CryptRows, DebtRow, EventRow, SubscriptionRow, TransactionRow } from "@/types/finance";

const NUM_RUNS = 100;
const MAX_CENTS = 100_000_000;
const MAX_ITEMS = 5;
const NOW = "2025-06-18";
const WEEK_KEY = "2025-06-16";
const WINDOW_DATES = ["2025-06-18", "2025-06-10", "2025-05-25", "2025-01-01", "2030-01-01"] as const;
const REAL_REF_PREFIXES = ["cancel:", "pay:", "reduce:"] as const;

const centsArb = fc.integer({ min: 0, max: MAX_CENTS });
const debtArb: fc.Arbitrary<DebtRow> = fc.record({
  id: fc.uuid(),
  name: fc.string(),
  balanceCents: centsArb,
  apr: fc.double({ min: 0, max: 1, noNaN: true }),
  minimumPaymentCents: centsArb,
});
const subscriptionArb: fc.Arbitrary<SubscriptionRow> = fc.record({
  id: fc.uuid(),
  name: fc.string(),
  amountCents: centsArb,
  cadence: fc.constantFrom("weekly" as const, "monthly" as const, "yearly" as const),
  usage: fc.constantFrom("often" as const, "rarely" as const, "never" as const),
  active: fc.boolean(),
});
const transactionArb: fc.Arbitrary<TransactionRow> = fc.record({
  id: fc.uuid(),
  amountCents: fc.integer({ min: 1, max: MAX_CENTS }),
  description: fc.string(),
  category: fc.string(),
  date: fc.constantFrom(...WINDOW_DATES),
});
const planCompletionArb = (actionIdArb: fc.Arbitrary<string>): fc.Arbitrary<EventRow> =>
  fc.record({
    id: fc.uuid(),
    type: fc.constant("exorcism_action_completed" as const),
    date: fc.constantFrom(...WINDOW_DATES),
    refKey: actionIdArb.map((actionId) => planRefKey(WEEK_KEY, actionId)),
  });
const fallbackIdArb = fc.constantFrom(...FALLBACK_KEYS).map((key) => `fallback:${key}`);
const realIdArb = fc
  .tuple(fc.constantFrom(...REAL_REF_PREFIXES), fc.uuid())
  .map(([prefix, id]) => `${prefix}${id}`);
const rowsArb: fc.Arbitrary<CryptRows> = fc.record({
  profile: fc.record({ monthlyIncomeCents: fc.integer({ min: 0, max: MAX_CENTS }) }),
  debts: fc.array(debtArb, { maxLength: MAX_ITEMS }),
  subscriptions: fc.array(subscriptionArb, { maxLength: MAX_ITEMS }),
  transactions: fc.array(transactionArb, { maxLength: MAX_ITEMS }),
  events: fc.array(planCompletionArb(realIdArb), { maxLength: MAX_ITEMS }),
  plans: fc.constant([]),
});

const stateOf = (rows: CryptRows) => computeHouseState(toFinancialSnapshot(rows, NOW));

describe("fallback plan actions and momentum", () => {
  // Feature: action-feedback, Property 7: Fallback completions never change momentum
  it("adding fallback completion Events changes neither momentum nor the light score", () => {
    fc.assert(
      fc.property(rowsArb, fc.array(planCompletionArb(fallbackIdArb), { maxLength: 6 }), (rows, extra) => {
        const before = stateOf(rows);
        const after = stateOf({ ...rows, events: [...rows.events, ...extra] });
        expect(after.momentum).toBe(before.momentum);
        expect(after.lightScore).toBe(before.lightScore);
        expect(after.decayLevel).toBe(before.decayLevel);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: action-feedback, Property 7: Fallback completions never change momentum
  it("a real plan completion Event never lowers momentum, and the input rows are not mutated", () => {
    fc.assert(
      fc.property(rowsArb, planCompletionArb(realIdArb), (rows, extra) => {
        const frozen = JSON.stringify(rows);
        const before = stateOf(rows);
        const after = stateOf({ ...rows, events: [...rows.events, extra] });
        expect(after.momentum).toBeGreaterThanOrEqual(before.momentum);
        expect(JSON.stringify(rows)).toBe(frozen);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: action-feedback, Property 7: Fallback completions never change momentum
  it("tells fallback reference keys from real ones and never throws on arbitrary text", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(typeof isFallbackPlanRefKey(text)).toBe("boolean");
      }),
      { numRuns: NUM_RUNS },
    );
    expect(isFallbackPlanRefKey(planRefKey(WEEK_KEY, "fallback:emergency-fund"))).toBe(true);
    expect(isFallbackPlanRefKey(planRefKey(WEEK_KEY, "cancel:sub-1"))).toBe(false);
    expect(isFallbackPlanRefKey("cancel:fallback:x")).toBe(false);
    expect(isFallbackPlanRefKey("plan:2025-06-16")).toBe(false);
  });

  it("a real completion raises momentum for a crypt with income, a fallback one does not", () => {
    const rows: CryptRows = {
      profile: { monthlyIncomeCents: 300_000 },
      debts: [],
      subscriptions: [],
      transactions: [],
      events: [],
      plans: [],
    };
    const event = (actionId: string): EventRow => ({
      id: actionId,
      type: "exorcism_action_completed",
      date: NOW,
      refKey: planRefKey(WEEK_KEY, actionId),
    });
    const base = stateOf(rows).momentum;
    expect(stateOf({ ...rows, events: [event("fallback:emergency-fund")] }).momentum).toBe(base);
    expect(stateOf({ ...rows, events: [event("reduce:Coffee")] }).momentum).toBeGreaterThan(base);
  });
});
