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
