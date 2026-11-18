import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { getNextEnabledIndex, type SegmentNavKey } from "@/lib/utils/segmentedNav";

const NUM_RUNS = 100;
const MAX_SEGMENTS = 12;

const flagsArb = fc.array(fc.boolean(), { minLength: 1, maxLength: MAX_SEGMENTS });

// Disabled flags with at least one enabled segment, plus an enabled start index.
const withEnabledStartArb = flagsArb
  .filter((flags) => flags.some((d) => !d))
  .chain((flags) => {
    const enabled = flags.map((d, i) => (d ? -1 : i)).filter((i) => i >= 0);
    return fc.constantFrom(...enabled).map((start) => ({ flags, enabled, start }));
  });

describe("segmented navigation", () => {
  // Feature: design-system-foundation, Property 10: Segmented navigation always lands on an enabled segment
  // **Validates: Requirements 12.4, 12.5, 12.6, 12.8**
  it("always lands on an enabled segment and follows first, last, next and prev rules", () => {
    fc.assert(
      fc.property(withEnabledStartArb, ({ flags, enabled, start }) => {
        const pos = enabled.indexOf(start);
        const next = getNextEnabledIndex(flags, start, "next");
        const prev = getNextEnabledIndex(flags, start, "prev");
        const first = getNextEnabledIndex(flags, start, "first");
        const last = getNextEnabledIndex(flags, start, "last");

        for (const result of [next, prev, first, last]) {
          expect(flags[result]).toBe(false);
        }
        expect(first).toBe(enabled[0]);
        expect(last).toBe(enabled[enabled.length - 1]);
        expect(next).toBe(enabled[(pos + 1) % enabled.length]);
        expect(prev).toBe(enabled[(pos - 1 + enabled.length) % enabled.length]);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: design-system-foundation, Property 10: Segmented navigation always lands on an enabled segment
  // **Validates: Requirements 12.4, 12.5, 12.6, 12.8**
  it("returns the current index when every segment is disabled", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_SEGMENTS }),
        fc.constantFrom<SegmentNavKey[]>("next", "prev", "first", "last"),
        fc.nat(),
        (length, key, seed) => {
          const flags = Array.from({ length }, () => true);
          const current = seed % length;
          expect(getNextEnabledIndex(flags, current, key)).toBe(current);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: design-system-foundation, Property 11: Segmented navigation forms a cycle
  // **Validates: Requirements 12.4, 12.5**
  it("returns to the start after pressing next once per enabled segment", () => {
    fc.assert(
      fc.property(withEnabledStartArb, ({ flags, enabled, start }) => {
        let index = start;
        for (let i = 0; i < enabled.length; i += 1) {
          index = getNextEnabledIndex(flags, index, "next");
        }
        expect(index).toBe(start);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: design-system-foundation, Property 11: Segmented navigation forms a cycle
  // **Validates: Requirements 12.4, 12.5**
  it("returns to the start when prev follows next", () => {
    fc.assert(
      fc.property(withEnabledStartArb, ({ flags, start }) => {
        const forward = getNextEnabledIndex(flags, start, "next");
        expect(getNextEnabledIndex(flags, forward, "prev")).toBe(start);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
