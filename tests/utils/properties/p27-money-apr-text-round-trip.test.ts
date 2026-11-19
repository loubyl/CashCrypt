import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  aprFractionToPercent,
  aprPercentToFraction,
  centsToMoneyText,
  formatCents,
  parseMoneyToCents,
} from "@/lib/utils/cents";

const MAX_CENTS = 100_000_000;
const MAX_APR_HUNDREDTHS = 10_000;
const HUNDREDTHS_PER_PERCENT = 100;
const NUM_RUNS = 200;

describe("money and APR text round trip", () => {
  // Feature: app-screens, Property 27: Money and APR text round trip
  // **Validates: Requirements 24.4, 28.4**
  it("parses centsToMoneyText back to the same cents", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_CENTS }), (cents) => {
        expect(parseMoneyToCents(centsToMoneyText(cents))).toBe(cents);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("formatCents digits read back to the same cents", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_CENTS }), (cents) => {
        const text = formatCents(cents);
        expect(text).toMatch(/^\$\d{1,3}(,\d{3})*\.\d{2}$/);
        expect(parseMoneyToCents(text.replace("$", "").replaceAll(",", ""))).toBe(cents);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("converts APR percent to fraction and back unchanged", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_APR_HUNDREDTHS }), (hundredths) => {
        const percent = hundredths / HUNDREDTHS_PER_PERCENT;
        expect(aprFractionToPercent(aprPercentToFraction(percent))).toBe(percent);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
