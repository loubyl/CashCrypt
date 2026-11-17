import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { WINDOW_DAYS } from "@/lib/haunting/config";
import { dateToJulian, isInWindow } from "@/lib/haunting/dates";

describe("dateToJulian", () => {
  it("returns 2451545 for 2000-01-01", () => {
    expect(dateToJulian(2000, 1, 1)).toBe(2451545);
  });

  it("increases by exactly one for consecutive days across a month end", () => {
    expect(dateToJulian(2024, 3, 1) - dateToJulian(2024, 2, 29)).toBe(1);
  });
});

describe("isInWindow", () => {
  const now = "2025-06-15";

  it("includes the same day as now", () => {
    expect(isInWindow(now, now)).toBe(true);
  });

  it("includes the date 29 days before now, the oldest day inside the window", () => {
    expect(isInWindow("2025-05-17", now)).toBe(true);
  });

  it("excludes the date exactly 30 days before now", () => {
    expect(isInWindow("2025-05-16", now)).toBe(false);
  });

  it("excludes the date 31 days before now", () => {
    expect(isInWindow("2025-05-15", now)).toBe(false);
  });

  it("contains exactly WINDOW_DAYS calendar days ending on now", () => {
    const start = Date.UTC(2025, 3, 1);
    const dayMs = 24 * 60 * 60 * 1000;
    let inside = 0;
    for (let i = 0; i < 120; i += 1) {
      const iso = new Date(start + i * dayMs).toISOString().slice(0, 10);
      if (isInWindow(iso, now)) inside += 1;
    }
    expect(inside).toBe(WINDOW_DAYS);
  });

  it("excludes a date one day after now", () => {
    expect(isInWindow("2025-06-16", now)).toBe(false);
  });

  it("counts February 29 in a leap year", () => {
    expect(isInWindow("2024-02-01", "2024-03-01")).toBe(true);
    expect(isInWindow("2024-01-31", "2024-03-01")).toBe(false);
  });

  it("uses a 28-day February in a non-leap year", () => {
    expect(isInWindow("2023-01-31", "2023-03-01")).toBe(true);
    expect(isInWindow("2023-01-30", "2023-03-01")).toBe(false);
  });

  it("handles a window that crosses a year boundary", () => {
    expect(isInWindow("2024-12-12", "2025-01-10")).toBe(true);
    expect(isInWindow("2024-12-11", "2025-01-10")).toBe(false);
  });

  it("returns false for malformed or impossible dates", () => {
    expect(isInWindow("not-a-date", now)).toBe(false);
    expect(isInWindow("2025-02-30", now)).toBe(false);
    expect(isInWindow(now, "2025/06/15")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Module-level property tests (design.md Property 14).
// These generators stay inline on purpose: they cover 1900-2100 and malformed strings,
// which testArbitraries.ts does not generate, and they use Date.UTC as an independent oracle.
// Date.UTC is used here only as an independent oracle for calendar dates;
// the module under test never touches Date.
// ---------------------------------------------------------------------------

const NUM_RUNS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_START_MS = Date.UTC(1900, 0, 1);
const RANGE_END_MS = Date.UTC(2100, 11, 31);
const RANGE_DAYS = Math.round((RANGE_END_MS - RANGE_START_MS) / DAY_MS);
const SWEEP_MARGIN_DAYS = 10;
const MAX_FUTURE_DAYS = 400;
const STRICT_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD for the calendar day `offset` days after 1900-01-01. */
function isoFromOffset(offset: number): string {
  return new Date(RANGE_START_MS + offset * DAY_MS).toISOString().slice(0, 10);
}

function julianOf(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return dateToJulian(year, month, day);
}

/** Day offsets whose date stays in 1900-01-01 .. 2100-12-31. */
const dayOffsetArb = fc.integer({ min: 0, max: RANGE_DAYS });

/** A `now` whose full sweep (window plus margins) stays inside the range. */
const nowOffsetArb = fc.integer({
  min: WINDOW_DAYS + SWEEP_MARGIN_DAYS,
  max: RANGE_DAYS - SWEEP_MARGIN_DAYS,
});

const pad = (value: number, width: number): string => String(value).padStart(width, "0");

// Independent oracle for "is this a real calendar date in strict YYYY-MM-DD form".
// Written here on purpose: it must not reuse dates.ts, which is the code under test.
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const FEBRUARY = 2;
const LEAP_FEBRUARY_DAYS = 29;

function isGregorianLeapYear(year: number): boolean {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

function isRealCalendarDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > MONTH_LENGTHS.length) return false;
  const length = month === FEBRUARY && isGregorianLeapYear(year) ? LEAP_FEBRUARY_DAYS : MONTH_LENGTHS[month - 1];
  return day >= 1 && day <= length;
}

/**
 * Strings that look like dates but are not real calendar days in strict YYYY-MM-DD form.
 * Every candidate is filtered through the independent oracle above, so a template that
 * accidentally rebuilds a valid date (for example "no padding" on 2100-12-21) is dropped.
 */
const malformedDateArb = fc.oneof(
  // Random text that does not match the strict pattern.
  fc.string().filter((text) => !STRICT_DATE.test(text)),
  // Month 00 or 13..99.
  fc
    .tuple(fc.integer({ min: 1900, max: 2100 }), fc.oneof(fc.constant(0), fc.integer({ min: 13, max: 99 })), fc.integer({ min: 1, max: 28 }))
    .map(([y, m, d]) => `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`),
  // Day 00 or 32..99.
  fc
    .tuple(fc.integer({ min: 1900, max: 2100 }), fc.integer({ min: 1, max: 12 }), fc.oneof(fc.constant(0), fc.integer({ min: 32, max: 99 })))
    .map(([y, m, d]) => `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`),
  // Days that do not exist in that month (for example February 30, April 31, February 29 in a non-leap year).
  fc.constantFrom("2023-02-29", "2100-02-29", "1900-02-29", "2024-02-30", "2025-04-31", "2025-06-31", "2025-09-31", "2025-11-31"),
  // Wrong separators, missing padding, extra characters.
  dayOffsetArb.chain((offset) => {
    const iso = isoFromOffset(offset);
    const [y, m, d] = iso.split("-");
    return fc.constantFrom(
      `${y}/${m}/${d}`,
      `${y}.${m}.${d}`,
      `${y}-${Number(m)}-${Number(d)}`,
      ` ${iso}`,
      `${iso} `,
      `${iso}T00:00:00Z`,
      `${d}-${m}-${y}`,
      `${y}${m}${d}`,
    );
  }),
).filter((candidate) => !isRealCalendarDate(candidate));

describe("independent calendar oracle used by the property tests", () => {
  it("accepts real dates, including leap days in leap years", () => {
    for (const valid of ["1900-01-01", "2000-02-29", "2024-02-29", "2100-12-21", "2100-12-31"]) {
      expect(isRealCalendarDate(valid)).toBe(true);
    }
  });

  it("rejects impossible days, bad months and non-strict formats", () => {
    for (const invalid of ["1900-02-29", "2100-02-29", "2023-02-29", "2025-04-31", "2025-13-01", "2025-00-10", "2025-01-00", "2100-12-2", "2100/12/21", " 2100-12-21"]) {
      expect(isRealCalendarDate(invalid)).toBe(false);
    }
  });

  it("agrees with dates.ts on every day from 1900 to 2100", () => {
    for (let offset = 0; offset <= RANGE_DAYS; offset += 1) {
      const iso = isoFromOffset(offset);
      expect(isRealCalendarDate(iso)).toBe(true);
      expect(isInWindow(iso, iso)).toBe(true);
    }
  });
});

describe("dates properties", () => {
  // Feature: haunting-engine, Property 14: Calendar arithmetic and window size
  it("gives consecutive calendar days Julian numbers exactly 1 apart", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: RANGE_DAYS - 1 }), (offset) => {
        const today = julianOf(isoFromOffset(offset));
        const tomorrow = julianOf(isoFromOffset(offset + 1));
        expect(tomorrow - today).toBe(1);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 14: Calendar arithmetic and window size
  it("agrees with an independent calendar on the number of days between two dates", () => {
    fc.assert(
      fc.property(dayOffsetArb, dayOffsetArb, (a, b) => {
        expect(julianOf(isoFromOffset(b)) - julianOf(isoFromOffset(a))).toBe(b - a);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 14: Calendar arithmetic and window size
  it("puts exactly WINDOW_DAYS dates inside the window for any now, ending on now", () => {
    fc.assert(
      fc.property(nowOffsetArb, (nowOffset) => {
        const now = isoFromOffset(nowOffset);
        const insideOffsets: number[] = [];
        for (let k = -(WINDOW_DAYS + SWEEP_MARGIN_DAYS); k <= SWEEP_MARGIN_DAYS; k += 1) {
          if (isInWindow(isoFromOffset(nowOffset + k), now)) insideOffsets.push(k);
        }
        expect(insideOffsets).toHaveLength(WINDOW_DAYS);
        expect(insideOffsets[0]).toBe(-(WINDOW_DAYS - 1));
        expect(insideOffsets[insideOffsets.length - 1]).toBe(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 14: Calendar arithmetic and window size
  it("never puts a future date inside the window", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: RANGE_DAYS - MAX_FUTURE_DAYS }),
        fc.integer({ min: 1, max: MAX_FUTURE_DAYS }),
        (nowOffset, daysAhead) => {
          expect(isInWindow(isoFromOffset(nowOffset + daysAhead), isoFromOffset(nowOffset))).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: haunting-engine, Property 14: Calendar arithmetic and window size
  it("never throws on malformed strings and returns false on either argument", () => {
    fc.assert(
      fc.property(malformedDateArb, dayOffsetArb, (malformed, offset) => {
        const valid = isoFromOffset(offset);
        let asDate: boolean | undefined;
        let asNow: boolean | undefined;
        expect(() => {
          asDate = isInWindow(malformed, valid);
          asNow = isInWindow(valid, malformed);
        }).not.toThrow();
        expect(asDate).toBe(false);
        expect(asNow).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
