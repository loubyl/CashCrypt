import { describe, expect, it } from "vitest";
import {
  addDays,
  formatWeekRange,
  getLocalDate,
  getPlanWeekStart,
  getWeekEnd,
} from "@/lib/utils/calendar";

describe("addDays", () => {
  it("moves from Feb 28 to Feb 29 in a leap year", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("moves from Feb 28 to Mar 1 in a non-leap year", () => {
    expect(addDays("2023-02-28", 1)).toBe("2023-03-01");
  });

  it("treats 2000 as a leap year and 1900 as a common year", () => {
    expect(addDays("2000-02-28", 1)).toBe("2000-02-29");
    expect(addDays("1900-02-28", 1)).toBe("1900-03-01");
  });

  it("crosses the year boundary forward and backward", () => {
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
    expect(addDays("2025-01-01", -1)).toBe("2024-12-31");
  });

  it("returns the same date when adding zero days", () => {
    expect(addDays("2024-06-15", 0)).toBe("2024-06-15");
  });

  it("throws a RangeError for a date that does not exist", () => {
    expect(() => addDays("2023-02-29", 1)).toThrow(RangeError);
    expect(() => addDays("2024-13-01", 1)).toThrow(RangeError);
  });

  it("throws a RangeError for text in the wrong format", () => {
    expect(() => addDays("2024-1-1", 1)).toThrow(RangeError);
    expect(() => addDays("", 1)).toThrow(RangeError);
  });
});

describe("getLocalDate", () => {
  it("reads the local year, month and day fields", () => {
    expect(getLocalDate(new Date(2024, 0, 5, 23, 59, 59))).toBe("2024-01-05");
  });

  it("uses local fields, not UTC fields", () => {
    const date = new Date(2024, 5, 10, 23, 30);
    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    expect(getLocalDate(date)).toBe(expected);
    expect(getLocalDate(date)).toBe("2024-06-10");
  });

  it("returns a date in YYYY-MM-DD format when called without arguments", () => {
    expect(getLocalDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("getPlanWeekStart", () => {
  it("returns the same day when the date is a Monday", () => {
    expect(getPlanWeekStart("2024-06-03")).toBe("2024-06-03");
  });

  it("returns the previous Monday for a Sunday", () => {
    expect(getPlanWeekStart("2024-06-09")).toBe("2024-06-03");
  });

  it("returns the Monday for a mid-week date", () => {
    expect(getPlanWeekStart("2024-06-05")).toBe("2024-06-03");
  });

  it("crosses a year boundary back to the previous year", () => {
    expect(getPlanWeekStart("2025-01-01")).toBe("2024-12-30");
  });

  it("throws a RangeError for an invalid date", () => {
    expect(() => getPlanWeekStart("2024-02-30")).toThrow(RangeError);
  });
});

describe("getWeekEnd", () => {
  it("returns the Sunday six days after the Monday", () => {
    expect(getWeekEnd("2024-06-03")).toBe("2024-06-09");
  });

  it("crosses a year boundary", () => {
    expect(getWeekEnd("2024-12-30")).toBe("2025-01-05");
  });
});

describe("formatWeekRange", () => {
  it("formats a week inside one month", () => {
    expect(formatWeekRange("2024-06-03")).toBe("Jun 3 – Jun 9");
  });

  it("formats a week that spans two months", () => {
    expect(formatWeekRange("2024-05-27")).toBe("May 27 – Jun 2");
  });

  it("formats a week that spans two years", () => {
    expect(formatWeekRange("2024-12-30")).toBe("Dec 30 – Jan 5");
  });
});
