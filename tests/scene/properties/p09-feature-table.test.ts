// Feature: house-scene, Property 9: Level feature table is monotone and distinct
// Validates: Requirements 6.2, 6.3, 7.3

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { DecayLevel } from "@/lib/haunting/config";
import { DECAY_LEVELS, LEVEL_FEATURES, WINDOW_COUNT, featureSeverity } from "@/lib/scene/config";
import { assignWindowStates } from "@/lib/scene/windows";

const NUM_RUNS = 200;

const levelArb = fc.constantFrom<DecayLevel>(...DECAY_LEVELS);

/** Ordered pair of different levels a < b. */
const levelPairArb = fc
  .tuple(levelArb, levelArb)
  .filter(([a, b]) => a !== b)
  .map(([a, b]): [DecayLevel, DecayLevel] => (a < b ? [a, b] : [b, a]));

describe("Property 9: Level feature table is monotone and distinct", () => {
  it("severity of every ordinal feature never decreases as the level worsens", () => {
    fc.assert(
      fc.property(levelPairArb, ([a, b]) => {
        const better = featureSeverity(LEVEL_FEATURES[a]);
        const worse = featureSeverity(LEVEL_FEATURES[b]);
        expect(better.every((n) => n >= 0)).toBe(true);
        worse.forEach((value, index) => expect(value).toBeGreaterThanOrEqual(better[index]));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("every pair of different levels differs in at least one feature", () => {
    fc.assert(
      fc.property(levelPairArb, ([a, b]) => {
        expect(LEVEL_FEATURES[a]).not.toEqual(LEVEL_FEATURES[b]);
        expect(featureSeverity(LEVEL_FEATURES[a])).not.toEqual(featureSeverity(LEVEL_FEATURES[b]));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("boarded and broken window counts never decrease as the level worsens", () => {
    fc.assert(
      fc.property(levelPairArb, ([a, b]) => {
        expect(LEVEL_FEATURES[b].boardedWindows).toBeGreaterThanOrEqual(LEVEL_FEATURES[a].boardedWindows);
        expect(LEVEL_FEATURES[b].brokenWindows).toBeGreaterThanOrEqual(LEVEL_FEATURES[a].brokenWindows);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("assigned window states match the table counts with distinct boarded and broken states", () => {
    fc.assert(
      fc.property(levelArb, (level) => {
        const features = LEVEL_FEATURES[level];
        const states = assignWindowStates(features);
        const count = (state: string) => states.filter((s) => s === state).length;

        expect(states).toHaveLength(WINDOW_COUNT);
        expect(count("broken")).toBe(features.brokenWindows);
        expect(count("boarded")).toBe(features.boardedWindows);
        expect(count("lit")).toBe(WINDOW_COUNT - features.boardedWindows - features.brokenWindows);

        // Boarded and broken are separate states on separate windows,
        // so they are told apart by state, not by brightness alone.
        const brokenIdx = states.flatMap((s, i) => (s === "broken" ? [i] : []));
        const boardedIdx = states.flatMap((s, i) => (s === "boarded" ? [i] : []));
        expect(brokenIdx.some((i) => boardedIdx.includes(i))).toBe(false);
        if (features.boardedWindows > 0 && features.brokenWindows > 0) {
          expect(new Set(states.filter((s) => s !== "lit")).size).toBe(2);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("level 4 and 5 show both boarded and broken windows, level 1 and 2 show none", () => {
    expect(assignWindowStates(LEVEL_FEATURES[1])).not.toContain("boarded");
    expect(assignWindowStates(LEVEL_FEATURES[2])).not.toContain("broken");
    for (const level of [4, 5] as const) {
      const states = assignWindowStates(LEVEL_FEATURES[level]);
      expect(states).toContain("boarded");
      expect(states).toContain("broken");
    }
  });
});
