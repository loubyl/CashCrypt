import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BAND_L1_MIN,
  BAND_L2_MIN,
  BAND_L3_MIN,
  BAND_L4_MIN,
  BAND_L5_MIN,
  SCORE_MAX,
  SCORE_MIN,
} from "@/lib/haunting/config";
import {
  computeDecayLevel,
  computeLevelProgress,
  computeWindowBrightness,
} from "@/lib/haunting/decay";
import type { DecayLevel } from "@/lib/haunting/types";

const PRECISION_DIGITS = 6;

describe("computeDecayLevel", () => {
  const boundaryCases: ReadonlyArray<readonly [number, DecayLevel]> = [
    [100, 1],
    [80, 1],
    [79.999, 2],
    [60, 2],
    [59.999, 3],
    [40, 3],
    [39.999, 4],
    [20, 4],
    [19.999, 5],
    [0, 5],
  ];

  it.each(boundaryCases)("returns the right level for score %s", (score, expected) => {
    expect(computeDecayLevel(score)).toBe(expected);
  });

  it("clamps a score below zero to level 5", () => {
    expect(computeDecayLevel(-5)).toBe(5);
  });

  it("clamps a score above 100 to level 1", () => {
    expect(computeDecayLevel(105)).toBe(1);
  });
});

describe("computeLevelProgress", () => {
  const bandLows: ReadonlyArray<readonly [number, DecayLevel]> = [
    [60, 2],
    [40, 3],
    [20, 4],
    [0, 5],
  ];

  it.each(bandLows)("is 0 at band low %s for level %s", (score, level) => {
    expect(computeLevelProgress(score, level)).toBeCloseTo(0, PRECISION_DIGITS);
  });

  it("is 1 at score 100 in level 1", () => {
    expect(computeLevelProgress(100, 1)).toBeCloseTo(1, PRECISION_DIGITS);
  });

  it("returns the exact fraction at a mid-band value", () => {
    expect(computeLevelProgress(39.5, 4)).toBeCloseTo(0.975, PRECISION_DIGITS);
  });

  it("clamps out-of-range scores into [0, 1]", () => {
    expect(computeLevelProgress(-5, 5)).toBeCloseTo(0, PRECISION_DIGITS);
    expect(computeLevelProgress(105, 1)).toBeCloseTo(1, PRECISION_DIGITS);
  });
});

describe("computeWindowBrightness", () => {
  const brightnessCases: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [50, 0.5],
    [100, 1],
  ];

  it.each(brightnessCases)("maps score %s to brightness %s", (score, expected) => {
    expect(computeWindowBrightness(score)).toBeCloseTo(expected, PRECISION_DIGITS);
  });
});

describe("non-finite scores", () => {
  // [label, expected level, score]; the order matches the it.each titles.
  const nonFiniteCases: ReadonlyArray<readonly [string, DecayLevel, number]> = [
    ["NaN", 5, Number.NaN],
    ["+Infinity", 1, Number.POSITIVE_INFINITY],
    ["-Infinity", 5, Number.NEGATIVE_INFINITY],
  ];

  it.each(nonFiniteCases)("maps %s to level %s", (_label, expected, score) => {
    expect(computeDecayLevel(score)).toBe(expected);
  });

  it.each(nonFiniteCases)("returns a finite level progress in [0, 1] for %s", (_label, _expected, score) => {
    const levels: DecayLevel[] = [1, 2, 3, 4, 5];
    for (const level of [computeDecayLevel(score), ...levels]) {
      const progress = computeLevelProgress(score, level);
      expect(Number.isFinite(progress)).toBe(true);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    }
  });

  it.each(nonFiniteCases)("returns a finite window brightness in [0, 1] for %s", (_label, _expected, score) => {
    const brightness = computeWindowBrightness(score);
    expect(Number.isFinite(brightness)).toBe(true);
    expect(brightness).toBeGreaterThanOrEqual(0);
    expect(brightness).toBeLessThanOrEqual(1);
  });

  it("treats NaN like the minimum score and the infinities like the bounds", () => {
    expect(computeWindowBrightness(Number.NaN)).toBe(0);
    expect(computeWindowBrightness(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(computeWindowBrightness(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Function-level property tests (design.md Properties 2 and 3).
// Tasks 12.2 and 12.3 still cover the same properties end to end through
// computeHouseState once index.ts exists.
// ---------------------------------------------------------------------------

const NUM_RUNS = 500;
const JUST_BELOW = 1e-9;

// Lower band boundaries ordered from level 1 to level 5, mirroring config.ts.
const BAND_LOWS: ReadonlyArray<readonly [DecayLevel, number]> = [
  [1, BAND_L1_MIN],
  [2, BAND_L2_MIN],
  [3, BAND_L3_MIN],
  [4, BAND_L4_MIN],
  [5, BAND_L5_MIN],
];

const EXACT_BOUNDARIES: number[] = [
  SCORE_MIN,
  SCORE_MAX,
  ...BAND_LOWS.map(([, low]) => low),
  ...BAND_LOWS.filter(([, low]) => low > SCORE_MIN).map(([, low]) => low - JUST_BELOW),
];

/** Scores in [0, 100]: arbitrary doubles, integers, and the exact band boundaries. */
const scoreArb = fc.oneof(
  fc.double({ min: SCORE_MIN, max: SCORE_MAX, noNaN: true }),
  fc.integer({ min: SCORE_MIN, max: SCORE_MAX }),
  fc.constantFrom(...EXACT_BOUNDARIES),
);

/** The expected level, written directly from the half-open band definition. */
function expectedLevel(score: number): DecayLevel {
  const match = BAND_LOWS.find(([, low]) => score >= low);
  return match === undefined ? 5 : match[0];
}

function bandOf(level: DecayLevel): { low: number; high: number } {
  const index = level - 1;
  const low = BAND_LOWS[index][1];
  const high = index === 0 ? SCORE_MAX : BAND_LOWS[index - 1][1];
  return { low, high };
}

describe("decay properties", () => {
  // Feature: haunting-engine, Property 2: Band consistency invariant
  it("puts every score in the unique half-open band that contains it", () => {
    fc.assert(
      fc.property(scoreArb, (score) => {
        const level = computeDecayLevel(score);
        expect(level).toBe(expectedLevel(score));
        const { low, high } = bandOf(level);
        expect(score).toBeGreaterThanOrEqual(low);
        if (level === 1) expect(score).toBeLessThanOrEqual(high);
        else expect(score).toBeLessThan(high);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 2: Band consistency invariant
  it("gives Math.floor(score) the same level as the score itself", () => {
    fc.assert(
      fc.property(scoreArb, (score) => {
        expect(computeDecayLevel(Math.floor(score))).toBe(computeDecayLevel(score));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 3: Output consistency invariant
  it("keeps level progress in [0, 1] and equal to the position inside the band", () => {
    fc.assert(
      fc.property(scoreArb, (score) => {
        const level = computeDecayLevel(score);
        const progress = computeLevelProgress(score, level);
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(1);
        const { low, high } = bandOf(level);
        expect(progress).toBeCloseTo((score - low) / (high - low), PRECISION_DIGITS);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 3: Output consistency invariant
  it("sets window brightness to score / 100 and never lowers it when the score rises", () => {
    fc.assert(
      fc.property(scoreArb, scoreArb, (a, b) => {
        const [low, high] = a <= b ? [a, b] : [b, a];
        expect(computeWindowBrightness(low)).toBeCloseTo(low / SCORE_MAX, PRECISION_DIGITS);
        expect(computeWindowBrightness(low)).toBeLessThanOrEqual(computeWindowBrightness(high));
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
