import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getLightClause, LIGHT_NOISE_EPSILON, MINUS_SIGN } from "@/lib/utils/lightClause";

const NUM_RUNS = 200;
const MAX_SCORE = 100;
const score = fc.double({ min: 0, max: MAX_SCORE, noNaN: true });

// Feature: action-feedback, Property 1: The light clause has the sign of the change
describe("light clause sign", () => {
  it("shows + or 'rises slightly' for a rise, − or 'dims slightly' for a drop, and neither otherwise", () => {
    // Validates: Requirements 2.2 to 2.6, 2.9
    fc.assert(
      fc.property(score, score, (before, after) => {
        const clause = getLightClause(before, after);
        const delta = after - before;
        const rises = clause.includes("+") || clause.includes("rises slightly");
        const drops = clause.includes(MINUS_SIGN) || clause.includes("dims slightly");
        if (delta >= LIGHT_NOISE_EPSILON) {
          expect(rises).toBe(true);
          expect(drops).toBe(false);
        } else if (delta <= -LIGHT_NOISE_EPSILON) {
          expect(drops).toBe(true);
          expect(rises).toBe(false);
        } else {
          expect(rises).toBe(false);
          expect(drops).toBe(false);
          expect(["Light unchanged", "Light already full"]).toContain(clause);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
