// Pure calendar-date arithmetic based on Julian Day Numbers.
// No Date object, no clock access; every function is deterministic.
//
// NUMERIC-LITERAL EXEMPTION: this file is exempt from the "no numeric literals
// outside config.ts" rule. The Julian Day formula and the Gregorian calendar
// rules (month lengths, leap-year cycle) are calendar arithmetic, not tunable
// constants. The only tunable value, the window length, comes from config.ts.

import { WINDOW_DAYS } from "./config";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

type DateParts = { year: number; month: number; day: number };

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
}

/** Parses a strict YYYY-MM-DD string; returns null when malformed or not a real calendar day. */
function parseDate(value: string): DateParts | null {
  if (typeof value !== "string") return null;
  const match = DATE_PATTERN.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** Converts a Gregorian calendar date to its Julian Day Number (2000-01-01 → 2451545). */
export function dateToJulian(yyyy: number, mm: number, dd: number): number {
  const a = Math.floor((14 - mm) / 12);
  const y = yyyy + 4800 - a;
  const m = mm + 12 * a - 3;
  return (
    dd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/**
 * True when `date` is one of the WINDOW_DAYS calendar days ending on `now`, inclusive:
 * (now − WINDOW_DAYS, now], i.e. now − (WINDOW_DAYS − 1) through now.
 * `now − WINDOW_DAYS` and earlier are outside; dates after `now` are outside.
 * Malformed input on either side returns false.
 */
export function isInWindow(date: string, now: string): boolean {
  const d = parseDate(date);
  const n = parseDate(now);
  if (d === null || n === null) return false;
  const dateJulian = dateToJulian(d.year, d.month, d.day);
  const nowJulian = dateToJulian(n.year, n.month, n.day);
  return dateJulian <= nowJulian && dateJulian > nowJulian - WINDOW_DAYS;
}
