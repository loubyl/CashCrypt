import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { getScoreDelta } from "@/lib/utils/scoreView";

const NUM_RUNS = 200;
const MAX_SCORE = 100;
const TEXT_PATTERN = /^\D*(\d+) this week$/;

const scoreArb = fc.double({ min: 0, max: MAX_SCORE, noNaN: true });

describe("weekly score delta", () => {
  // Feature: app-screens, Property 26: The weekly delta appears only when the displayed score changed
  // **Validates: Requirements 21.2, 21.3**
  it("appears only when the floored scores differ, with matching direction, intent and amount", () => {
    fc.assert(
      fc.property(scoreArb, scoreArb, (current, start) => {
        const flooredCurrent = Math.floor(current);
        const flooredStart = Math.floor(start);
        const delta = getScoreDelta(current, start);

        if (flooredCurrent === flooredStart) {
          expect(delta).toBeNull();
          return;
        }
        expect(delta).not.toBeNull();
        const higher = flooredCurrent > flooredStart;
        expect(delta?.direction).toBe(higher ? "up" : "down");
        expect(delta?.intent).toBe(higher ? "good" : "bad");
        const match = TEXT_PATTERN.exec(delta?.text ?? "");
        expect(match).not.toBeNull();
        expect(Number(match?.[1])).toBe(Math.abs(flooredCurrent - flooredStart));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("returns null for scores that share the same integer part", () => {
    expect(getScoreDelta(39.9, 39.1)).toBeNull();
  });
});
