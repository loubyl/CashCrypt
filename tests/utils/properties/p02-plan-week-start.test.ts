import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { getPlanWeekStart } from "@/lib/utils/calendar";

const MIN_YEAR = 1970;
const MAX_YEAR = 2100;
const NUM_RUNS = 200;
const MONDAY_INDEX = 1;
const MAX_DAYS_BEFORE = 6;
const MS_PER_DAY = 86_400_000;

const localDateArb = fc
  .date({
    min: new Date(Date.UTC(MIN_YEAR, 0, 1)),
    max: new Date(Date.UTC(MAX_YEAR, 11, 31)),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString().slice(0, 10));

function utcMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

describe("plan week start", () => {
  // Feature: app-screens, Property 2: Plan week start is the Monday on or before the date
  // **Validates: Requirements 3.3, 3.5**
  it("returns a Monday that is on or at most 6 days before the date", () => {
    fc.assert(
      fc.property(localDateArb, (date) => {
        const start = getPlanWeekStart(date);
        expect(new Date(utcMs(start)).getUTCDay()).toBe(MONDAY_INDEX);
        const diffDays = (utcMs(date) - utcMs(start)) / MS_PER_DAY;
        expect(diffDays).toBeGreaterThanOrEqual(0);
        expect(diffDays).toBeLessThanOrEqual(MAX_DAYS_BEFORE);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
