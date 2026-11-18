import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FOCUSABLE_SELECTOR, getNextFocusIndex, shouldSkipInert } from "@/lib/utils/focusTrap";

const NUM_RUNS = 100;
const MAX_COUNT = 1000;
const NO_INDEX = -1;
const EXACT_EXEMPT_TAGS = ["script", "style", "link", "template", "next-route-announcer"];
const DEV_OVERLAY_PREFIX = "nextjs-";
const ORDINARY_TAGS = ["div", "main", "section", "header", "nav", "span", "body-wrapper"];

const asciiTag = fc.stringMatching(/^[A-Za-z][A-Za-z0-9-]{0,20}$/);
const mixCase = (tag: string, flags: boolean[]): string =>
  [...tag].map((ch, i) => (flags[i % flags.length] ? ch.toUpperCase() : ch.toLowerCase())).join("");
const caseFlags = fc.array(fc.boolean(), { minLength: 1, maxLength: 8 });
const isExemptByName = (tag: string): boolean => {
  const lower = tag.toLowerCase();
  return EXACT_EXEMPT_TAGS.includes(lower) || lower.startsWith(DEV_OVERLAY_PREFIX);
};

describe("getNextFocusIndex", () => {
  it("returns an index inside the trap for any positive count and valid current", () => {
    // Feature: design-system-foundation, Property 12: Focus index wraps within the trap
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_COUNT }),
        fc.nat(),
        fc.boolean(),
        (count, seed, shift) => {
          const current = seed % count;
          const next = getNextFocusIndex(count, current, shift);
          expect(Number.isInteger(next)).toBe(true);
          expect(next).toBeGreaterThanOrEqual(0);
          expect(next).toBeLessThan(count);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("returns to the starting index after Tab then Shift+Tab", () => {
    // Feature: design-system-foundation, Property 12: Focus index wraps within the trap
    fc.assert(
      fc.property(fc.integer({ min: 1, max: MAX_COUNT }), fc.nat(), (count, seed) => {
        const current = seed % count;
        const forward = getNextFocusIndex(count, current, false);
        expect(getNextFocusIndex(count, forward, true)).toBe(current);
        const backward = getNextFocusIndex(count, current, true);
        expect(getNextFocusIndex(count, backward, false)).toBe(current);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("wraps from the last item to the first on Tab and from the first to the last on Shift+Tab", () => {
    // Feature: design-system-foundation, Property 12: Focus index wraps within the trap
    fc.assert(
      fc.property(fc.integer({ min: 1, max: MAX_COUNT }), (count) => {
        expect(getNextFocusIndex(count, count - 1, false)).toBe(0);
        expect(getNextFocusIndex(count, 0, true)).toBe(count - 1);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("focuses the first item on Tab and the last on Shift+Tab when focus is outside the trap", () => {
    // Feature: design-system-foundation, Property 12: Focus index wraps within the trap
    fc.assert(
      fc.property(fc.integer({ min: 1, max: MAX_COUNT }), fc.integer({ max: -1 }), (count, current) => {
        expect(getNextFocusIndex(count, current, false)).toBe(0);
        expect(getNextFocusIndex(count, current, true)).toBe(count - 1);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("returns -1 when the trap has no focusable items", () => {
    // Feature: design-system-foundation, Property 12: Focus index wraps within the trap
    fc.assert(
      fc.property(
        fc.integer({ max: 0 }),
        fc.integer({ min: -MAX_COUNT, max: MAX_COUNT }),
        fc.boolean(),
        (count, current, shift) => {
          expect(getNextFocusIndex(count, current, shift)).toBe(NO_INDEX);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("matches simple examples", () => {
    expect(getNextFocusIndex(3, 0, false)).toBe(1);
    expect(getNextFocusIndex(3, 2, false)).toBe(0);
    expect(getNextFocusIndex(3, 0, true)).toBe(2);
    expect(getNextFocusIndex(1, 0, false)).toBe(0);
    expect(getNextFocusIndex(1, 0, true)).toBe(0);
    expect(getNextFocusIndex(0, 0, false)).toBe(NO_INDEX);
    expect(getNextFocusIndex(4, -1, false)).toBe(0);
    expect(getNextFocusIndex(4, -1, true)).toBe(3);
  });
});

describe("shouldSkipInert", () => {
  it("always skips an element that carries the exempt attribute", () => {
    // Feature: design-system-foundation, Property 15: Inert exemptions depend only on the tag name and the exempt attribute
    fc.assert(
      fc.property(fc.string({ maxLength: 30 }), (tag) => {
        expect(shouldSkipInert(tag, true)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("skips non-content tags, the route announcer and nextjs-* elements in any letter case", () => {
    // Feature: design-system-foundation, Property 15: Inert exemptions depend only on the tag name and the exempt attribute
    fc.assert(
      fc.property(
        fc.constantFrom(...EXACT_EXEMPT_TAGS),
        caseFlags,
        (tag, flags) => {
          expect(shouldSkipInert(mixCase(tag, flags), false)).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z0-9-]{0,15}$/),
        caseFlags,
        (suffix, flags) => {
          expect(shouldSkipInert(mixCase(DEV_OVERLAY_PREFIX + suffix, flags), false)).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("does not skip ordinary tags without the exempt attribute", () => {
    // Feature: design-system-foundation, Property 15: Inert exemptions depend only on the tag name and the exempt attribute
    fc.assert(
      fc.property(fc.constantFrom(...ORDINARY_TAGS), caseFlags, (tag, flags) => {
        expect(shouldSkipInert(mixCase(tag, flags), false)).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("depends only on the lower-cased name and the attribute for any ASCII tag", () => {
    // Feature: design-system-foundation, Property 15: Inert exemptions depend only on the tag name and the exempt attribute
    fc.assert(
      fc.property(asciiTag, fc.boolean(), (tag, attr) => {
        const expected = attr || isExemptByName(tag);
        expect(shouldSkipInert(tag, attr)).toBe(expected);
        expect(shouldSkipInert(tag.toUpperCase(), attr)).toBe(expected);
        expect(shouldSkipInert(tag.toLowerCase(), attr)).toBe(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("never throws for arbitrary strings", () => {
    // Feature: design-system-foundation, Property 15: Inert exemptions depend only on the tag name and the exempt attribute
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 40 }), fc.boolean(), (tag, attr) => {
        expect(typeof shouldSkipInert(tag, attr)).toBe("boolean");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("matches simple examples", () => {
    expect(shouldSkipInert("SCRIPT", false)).toBe(true);
    expect(shouldSkipInert("next-route-announcer", false)).toBe(true);
    expect(shouldSkipInert("NEXTJS-Dev-Overlay", false)).toBe(true);
    expect(shouldSkipInert("div", false)).toBe(false);
    expect(shouldSkipInert("main", false)).toBe(false);
    expect(shouldSkipInert("div", true)).toBe(true);
    expect(shouldSkipInert("", false)).toBe(false);
  });
});

describe("FOCUSABLE_SELECTOR", () => {
  it("covers links, buttons, inputs, selects, textareas and tabindex elements", () => {
    for (const part of ["a[href]", "button", "input", "select", "textarea", "[tabindex]"]) {
      expect(FOCUSABLE_SELECTOR).toContain(part);
    }
  });

  it("excludes disabled controls, hidden inputs and tabindex -1", () => {
    expect(FOCUSABLE_SELECTOR).toContain(":not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain(':not([type="hidden"])');
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
  });
});
