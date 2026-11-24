import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { planLevelMoment } from "@/lib/moments/requests";
import type { DecayLevel } from "@/lib/haunting/config";

const NUM_RUNS = 200;
const levelArb = fc.constantFrom<DecayLevel>(1, 2, 3, 4, 5);

describe("Property 17: Level request only when the level changed", () => {
  // Feature: house-scene, Property 17: Level request only when the level changed
  // **Validates: Requirements 16.1, 16.4, 16.6**
  it("returns one level request with from/to equal to the pair iff the levels differ", () => {
    fc.assert(
      fc.property(levelArb, levelArb, (before, after) => {
        const request = planLevelMoment(before, after);
        if (before === after) {
          expect(request).toBeNull();
        } else {
          expect(request).toEqual({ kind: "level", from: before, to: after });
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("emits a single request even when the levels differ by more than one step", () => {
    expect(planLevelMoment(1, 5)).toEqual({ kind: "level", from: 1, to: 5 });
    expect(planLevelMoment(5, 2)).toEqual({ kind: "level", from: 5, to: 2 });
  });
});
