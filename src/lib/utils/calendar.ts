// Pure calendar-date helpers over "YYYY-MM-DD" local dates.
// All arithmetic uses UTC timestamps so daylight-saving shifts never change a result.
// No React, Dexie or Next.js imports.

/** A local calendar date written as "YYYY-MM-DD". */
export type LocalDate = string;

/** Returns today's LocalDate. Injected wherever code needs "now". */
export type Clock = () => LocalDate;

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
const MONDAY_INDEX = 1;
const LAST_DAY_OF_WEEK_OFFSET = DAYS_PER_WEEK - 1;
const MONTH_INDEX_OFFSET = 1;
const YEAR_DIGITS = 4;
const PART_DIGITS = 2;
const PAD_CHAR = "0";
const RANGE_SEPARATOR = " – ";
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Builds a UTC timestamp for a calendar day; keeps years 0-99 as written (Date.UTC would map them to 1900+). */
function utcTimestamp(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - MONTH_INDEX_OFFSET, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function formatParts(year: number, month: number, day: number): LocalDate {
  const yyyy = String(year).padStart(YEAR_DIGITS, PAD_CHAR);
  const mm = String(month).padStart(PART_DIGITS, PAD_CHAR);
  const dd = String(day).padStart(PART_DIGITS, PAD_CHAR);
  return `${yyyy}-${mm}-${dd}`;
}

/** Validates the strict format and that the day exists in the real calendar; returns the UTC timestamp. */
function parseLocalDate(value: LocalDate): number {
  const match = typeof value === "string" ? LOCAL_DATE_PATTERN.exec(value) : null;
  if (match === null) throw new RangeError(`Invalid local date: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = utcTimestamp(year, month, day);
  const check = new Date(timestamp);
  const isReal =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - MONTH_INDEX_OFFSET &&
    check.getUTCDate() === day;
  if (!isReal) throw new RangeError(`Invalid local date: ${value}`);
  return timestamp;
}

function fromTimestamp(timestamp: number): LocalDate {
  const date = new Date(timestamp);
  return formatParts(
    date.getUTCFullYear(),
    date.getUTCMonth() + MONTH_INDEX_OFFSET,
    date.getUTCDate(),
  );
}

/** Returns the local calendar date (local year, month and day fields) of `date`, default now. */
export function getLocalDate(date: Date = new Date()): LocalDate {
  return formatParts(
    date.getFullYear(),
    date.getMonth() + MONTH_INDEX_OFFSET,
    date.getDate(),
  );
}

/** Adds a whole number of days (negative allowed). Throws RangeError on an invalid date. */
export function addDays(date: LocalDate, days: number): LocalDate {
  return fromTimestamp(parseLocalDate(date) + days * MS_PER_DAY);
}

/** Returns the Monday on or before `date`. Throws RangeError on an invalid date. */
export function getPlanWeekStart(date: LocalDate): LocalDate {
  const timestamp = parseLocalDate(date);
  const dayIndex = new Date(timestamp).getUTCDay();
  const daysSinceMonday = (dayIndex - MONDAY_INDEX + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return fromTimestamp(timestamp - daysSinceMonday * MS_PER_DAY);
}

/** Returns the last day of the plan week that starts on `weekKey` (weekKey + 6). */
export function getWeekEnd(weekKey: LocalDate): LocalDate {
  return addDays(weekKey, LAST_DAY_OF_WEEK_OFFSET);
}

/** Formats a date as "Jun 2". */
export function formatMonthDay(date: LocalDate): string {
  const parsed = new Date(parseLocalDate(date));
  return `${MONTH_LABELS[parsed.getUTCMonth()]} ${parsed.getUTCDate()}`;
}

/** Formats a plan week as "Jun 2 – Jun 8". */
export function formatWeekRange(weekKey: LocalDate): string {
  return `${formatMonthDay(weekKey)}${RANGE_SEPARATOR}${formatMonthDay(getWeekEnd(weekKey))}`;
}
