import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getLightClause } from "@/lib/utils/lightClause";

const NUM_RUNS = 200;
const MAX_SCORE = 100;
const TENTH = 10;
const score = fc.double({ min: 0, max: MAX_SCORE, noNaN: true });
const SHOWN_VALUE = /^Light [+\u2212](\d+\.\d)$/;

// Feature: action-feedback, Property 2: The shown value is the change rounded to a tenth
describe("light clause rounding", () => {
  it("shows |after − before| rounded half away from zero to one decimal", () => {
    // Validates: Requirements 2.2
    fc.assert(
      fc.property(score, score, (before, after) => {
        const match = SHOWN_VALUE.exec(getLightClause(before, after));
        if (match === null) return; // no number shown (slight, unchanged or full)
        const expected = (Math.round(Math.abs(after - before) * TENTH) / TENTH).toFixed(1);
        expect(match[1]).toBe(expected);
        expect(Number(match[1])).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("shows a number for every change of at least half a tenth", () => {
    fc.assert(
      fc.property(score, fc.double({ min: 0.06, max: 5, noNaN: true }), (before, step) => {
        const after = Math.min(MAX_SCORE, before + step);
        fc.pre(after - before >= 0.06);
        expect(SHOWN_VALUE.test(getLightClause(before, after))).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
