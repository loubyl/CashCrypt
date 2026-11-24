// Feature: house-scene, Property 10: Window opacity range, level 5 and monotonicity
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { DecayLevel } from "@/lib/haunting/config";
import { BAND_MIN_BRIGHTNESS } from "@/lib/scene/config";
import { getWindowOpacity } from "@/lib/scene/windows";

const NUM_RUNS = 200;
const BEST_LEVEL: DecayLevel = 1;

const levelArb = fc.constantFrom<DecayLevel>(1, 2, 3, 4, 5);
const hostileBrightnessArb = fc.oneof(
  fc.double({ noNaN: false, noDefaultInfinity: false }),
  fc.double({ min: -10, max: 10, noNaN: true }),
  fc.constantFrom(Number.NaN, Infinity, -Infinity, -0, 0, 1),
);
// Two distinct levels, ordered so that `better` < `worse` (better is the healthier house).
const levelPairArb = fc
  .tuple(levelArb, levelArb)
  .filter(([a, b]) => a !== b)
  .map(([a, b]) => ({ better: Math.min(a, b) as DecayLevel, worse: Math.max(a, b) as DecayLevel }));
const unitArb = fc.double({ min: 0, max: 1, noNaN: true });

function bandMax(level: DecayLevel): number {
  return level === BEST_LEVEL ? 1 : BAND_MIN_BRIGHTNESS[(level - 1) as DecayLevel];
}

describe("Property 10: window opacity range, level 5 and monotonicity", () => {
  // **Validates: Requirements 7.1, 7.4, 7.5**
  it("stays within 0 to 1 for any level and any brightness, including NaN and infinities", () => {
    fc.assert(
      fc.property(levelArb, hostileBrightnessArb, (level, brightness) => {
        const opacity = getWindowOpacity(level, brightness);
        expect(Number.isFinite(opacity)).toBe(true);
        expect(opacity).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(1);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 7.2**
  it("returns 0 at level 5 for any brightness", () => {
    fc.assert(
      fc.property(hostileBrightnessArb, (brightness) => {
        expect(getWindowOpacity(5, brightness)).toBe(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 7.4**
  it("is non-decreasing in brightness within a level", () => {
    fc.assert(
      fc.property(levelArb, unitArb, unitArb, (level, a, b) => {
        const low = Math.min(a, b);
        const high = Math.max(a, b);
        expect(getWindowOpacity(level, high)).toBeGreaterThanOrEqual(getWindowOpacity(level, low));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 7.5**
  it("gives a better level at least the opacity of a worse level for brightnesses inside their bands", () => {
    fc.assert(
      fc.property(
        levelPairArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        ({ better, worse }, u1, u2) => {
          const x = BAND_MIN_BRIGHTNESS[better] + u1 * (bandMax(better) - BAND_MIN_BRIGHTNESS[better]);
          const y = BAND_MIN_BRIGHTNESS[worse] + u2 * (bandMax(worse) - BAND_MIN_BRIGHTNESS[worse]);
          expect(getWindowOpacity(better, x)).toBeGreaterThanOrEqual(getWindowOpacity(worse, y));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 7.5, 7.7**
  it("gives a better level at least the opacity of a worse level for any brightnesses", () => {
    fc.assert(
      fc.property(levelPairArb, hostileBrightnessArb, hostileBrightnessArb, ({ better, worse }, x, y) => {
        expect(getWindowOpacity(better, x)).toBeGreaterThanOrEqual(getWindowOpacity(worse, y));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("returns the band floor at the bottom of level 4 and 1 at the top of level 1", () => {
    expect(getWindowOpacity(4, BAND_MIN_BRIGHTNESS[4])).toBeCloseTo(0.02, 10);
    expect(getWindowOpacity(1, 1)).toBe(1);
  });
});
