import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  clampScore,
  formatBreakdown,
  formatScoreText,
  getFillPercent,
} from "@/lib/utils/score";

const NUM_RUNS = 100;

/** Any double, including NaN, ±Infinity and values far outside [0, 100]. */
const anyScore = fc.oneof(
  fc.double({ noDefaultInfinity: false, noNaN: false }),
  fc.double({ min: -1000, max: 1000, noNaN: true }),
  fc.constantFrom(Number.NaN, Infinity, -Infinity, -0, 0, 100, 100.0001, -0.0001),
);

/** Finite doubles only, spread across and beyond the valid range. */
const finiteScore = fc.oneof(
  fc.double({ noDefaultInfinity: true, noNaN: true }),
  fc.double({ min: -200, max: 300, noNaN: true }),
);

const inRangeScore = fc.double({ min: 0, max: 100, noNaN: true });
const nonNegativeFinite = fc.double({ min: 0, max: 1e6, noNaN: true });

describe("score helpers", () => {
  // Feature: design-system-foundation, Property 4: Score clamp is total and bounded
  it("clamps any number, including NaN and infinities, into a finite value between 0 and 100", () => {
    fc.assert(
      fc.property(anyScore, (x) => {
        const result = clampScore(x);
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: design-system-foundation, Property 4: Score clamp is total and bounded
  it("turns NaN into 0 and leaves values already between 0 and 100 unchanged", () => {
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(Infinity)).toBe(100);
    expect(clampScore(-Infinity)).toBe(0);
    fc.assert(
      fc.property(inRangeScore, (x) => {
        expect(clampScore(x)).toBe(x);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: design-system-foundation, Property 5: Fill percent is bounded and monotonic, and the number is the floor
  it("never lowers the fill percent when the score goes up, and keeps it between 0 and 100", () => {
    fc.assert(
      fc.property(finiteScore, finiteScore, (p, q) => {
        const a = Math.min(p, q);
        const b = Math.max(p, q);
        const fillA = getFillPercent(a);
        const fillB = getFillPercent(b);
        expect(fillA).toBeLessThanOrEqual(fillB);
        for (const fill of [fillA, fillB]) {
          expect(fill).toBeGreaterThanOrEqual(0);
          expect(fill).toBeLessThanOrEqual(100);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: design-system-foundation, Property 5: Fill percent is bounded and monotonic, and the number is the floor
  it("shows the score as the floor of the clamped value", () => {
    fc.assert(
      fc.property(finiteScore, (a) => {
        expect(formatScoreText(a)).toBe(String(Math.floor(clampScore(a))));
      }),
      { numRuns: NUM_RUNS },
    );
    expect(formatScoreText(Number.NaN)).toBe("0");
    expect(formatScoreText(Infinity)).toBe("100");
  });

  // Feature: design-system-foundation, Property 6: Breakdown text floors every part
  it("floors the score, base and momentum in the breakdown text", () => {
    fc.assert(
      fc.property(nonNegativeFinite, nonNegativeFinite, inRangeScore, (base, momentum, score) => {
        expect(formatBreakdown(base, momentum, score)).toBe(
          `${Math.floor(score)} = ${Math.floor(base)} base + ${Math.floor(momentum)} momentum`,
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("formatScoreText", () => {
  // Feature: design-system-foundation, Property 8: Score text is the integer floor with no decimal point
  it("returns the floor of the clamped score as an integer string with no decimal point", () => {
    fc.assert(
      fc.property(anyScore, (value) => {
        const text = formatScoreText(value);
        expect(text).toMatch(/^\d+$/);
        expect(text).not.toContain(".");
        expect(text).toBe(String(Math.floor(clampScore(value))));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("equals Math.floor for in-range values", () => {
    fc.assert(
      fc.property(inRangeScore, (value) => {
        expect(formatScoreText(value)).toBe(String(Math.floor(value)));
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
