import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { getFlareSteps } from "@/lib/scene/windows";

const NUM_RUNS = 200;
const BOOST_MIN = Number.MIN_VALUE;

const unit = fc.double({ min: 0, max: 1, noNaN: true });
const boost = fc.double({ min: BOOST_MIN, max: 1, noNaN: true });
const hostile = fc.oneof(
  fc.double({ noNaN: false }),
  fc.constantFrom(NaN, Infinity, -Infinity, -1, 0, -0, 2, 1e308, -1e308, 5e-324),
);

describe("getFlareSteps", () => {
  // Feature: house-scene, Property 19: The flare peaks at most at 1, never below the live value, and ends on it
  // **Validates: Requirements 14.3, 14.6**
  it("peaks at min(1, live + boost), never below live, and ends on live", () => {
    fc.assert(
      fc.property(unit, unit, boost, (previous, live, lift) => {
        const steps = getFlareSteps(previous, live, lift);
        expect(steps.from).toBeGreaterThanOrEqual(0);
        expect(steps.from).toBeLessThanOrEqual(1);
        expect(steps.peak).toBe(Math.min(1, live + lift));
        expect(steps.peak).toBeLessThanOrEqual(1);
        expect(steps.peak).toBeGreaterThanOrEqual(live);
        expect(steps.final).toBe(live);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: house-scene, Property 19: The flare peaks at most at 1, never below the live value, and ends on it
  it("keeps every step in 0 to 1 with peak at least final for hostile numbers", () => {
    fc.assert(
      fc.property(hostile, hostile, hostile, (previous, live, lift) => {
        const steps = getFlareSteps(previous, live, lift);
        for (const value of [steps.from, steps.peak, steps.final]) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
        expect(steps.peak).toBeGreaterThanOrEqual(steps.final);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: house-scene, Property 19: The flare peaks at most at 1, never below the live value, and ends on it
  it("never returns NaN or infinite steps for NaN and infinite brightness or boost", () => {
    const bad = [NaN, Infinity, -Infinity];
    const good = [0, 0.4, 1];
    const cases: Array<[number, number, number]> = [];
    for (const b of bad) {
      for (const g of good) {
        cases.push([b, g, g], [g, b, g], [g, g, b]);
      }
      cases.push([b, b, b]);
    }
    for (const [previous, live, lift] of cases) {
      const steps = getFlareSteps(previous, live, lift);
      for (const value of [steps.from, steps.peak, steps.final]) {
        expect(Number.isFinite(value), `${previous}, ${live}, ${lift}`).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("flares a level 4 payment from 0.3801 to a 0.7849 peak and settles on 0.4349", () => {
    const steps = getFlareSteps(0.3801, 0.4349, 0.35);
    expect(steps.from).toBe(0.3801);
    expect(steps.peak).toBeCloseTo(0.7849, 10);
    expect(steps.final).toBe(0.4349);
  });
});
