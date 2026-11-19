import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/utils/calendar";

const MIN_YEAR = 1970;
const MAX_YEAR = 2100;
const MAX_OFFSET_DAYS = 100_000;
const NUM_RUNS = 200;
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const localDateArb = fc
  .date({
    min: new Date(Date.UTC(MIN_YEAR, 0, 1)),
    max: new Date(Date.UTC(MAX_YEAR, 11, 31)),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString().slice(0, 10));

describe("day arithmetic", () => {
  // Feature: app-screens, Property 1: Day arithmetic round trip
  // **Validates: Requirements 3.3, 3.4**
  it("addDays(addDays(d, n), -n) returns d and the intermediate date is valid", () => {
    fc.assert(
      fc.property(
        localDateArb,
        fc.integer({ min: -MAX_OFFSET_DAYS, max: MAX_OFFSET_DAYS }),
        (date, offset) => {
          const shifted = addDays(date, offset);
          expect(shifted).toMatch(LOCAL_DATE_PATTERN);
          expect(() => addDays(shifted, 0)).not.toThrow();
          expect(addDays(shifted, -offset)).toBe(date);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
