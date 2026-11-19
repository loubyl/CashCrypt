import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  addDays,
  formatWeekRange,
  getPlanWeekStart,
  getWeekEnd,
} from "@/lib/utils/calendar";

const NUM_RUNS = 200;
const SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_MONTH = 12;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const FEBRUARY = 2;
const LEAP_DAYS = 29;

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Independent oracle: true only for a real YYYY-MM-DD calendar date. */
function isRealDate(value: string): boolean {
  const match = SHAPE.exec(value);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > MAX_MONTH || day < 1) return false;
  const max =
    month === FEBRUARY && isLeap(year) ? LEAP_DAYS : DAYS_IN_MONTH[month - 1];
  return day <= max;
}

const pad = (n: number, width: number): string => String(n).padStart(width, "0");

const arbitraryString = fc.string({ maxLength: 20 });
const wrongFormat = fc.oneof(
  fc.constantFrom("", " ", "2025-1-5", "2025/01/05", "25-01-05", "2025-01-05T00:00", " 2025-01-05", "2025-01-05 ", "20250105", "2025-01", "abcd-ef-gh"),
  fc.tuple(fc.nat(99999), fc.nat(999), fc.nat(999)).map(([y, m, d]) => `${y}-${m}-${d}`),
);
const impossible = fc.oneof(
  fc.tuple(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 13, max: 99 }), fc.integer({ min: 1, max: 28 }))
    .map(([y, m, d]) => `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`),
  fc.tuple(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 1, max: 12 }))
    .map(([y, m]) => `${pad(y, 4)}-${pad(m, 2)}-00`),
  fc.tuple(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 32, max: 99 }))
    .map(([y, m, d]) => `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`),
  fc.tuple(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 30, max: 31 }))
    .map(([y, d]) => `${pad(y, 4)}-02-${pad(d, 2)}`),
  fc.constantFrom("2025-02-30", "2025-02-29", "2100-02-29", "2025-04-31", "2025-13-01", "2025-01-00"),
);

const invalidDate = fc
  .oneof(arbitraryString, wrongFormat, impossible)
  .filter((value) => !isRealDate(value));

describe("invalid dates", () => {
  // Feature: app-screens, Property 3: Invalid dates are rejected with the offending value
  // **Validates: Requirements 3.6**
  it("addDays, getPlanWeekStart, getWeekEnd and formatWeekRange throw a RangeError naming the value", () => {
    fc.assert(
      fc.property(invalidDate, fc.integer({ min: -400, max: 400 }), (value, days) => {
        const calls = [
          () => addDays(value, days),
          () => getPlanWeekStart(value),
          () => getWeekEnd(value),
          () => formatWeekRange(value),
        ];
        for (const call of calls) {
          let caught: unknown;
          try {
            call();
          } catch (error) {
            caught = error;
          }
          expect(caught).toBeInstanceOf(RangeError);
          expect((caught as RangeError).message).toContain(value);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects the examples from the requirement", () => {
    for (const value of ["2025-02-30", "2025-13-01", "2025-01-00", ""]) {
      expect(() => addDays(value, 1)).toThrow(RangeError);
    }
  });
});
