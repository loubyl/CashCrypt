import { describe, expect, it } from "vitest";
import {
  aprFractionToPercent,
  aprPercentToFraction,
  centsToMoneyText,
  formatCents,
  formatCentsPerMonth,
  parseMoneyToCents,
} from "@/lib/utils/cents";

describe("formatCents", () => {
  it("formats 12000 cents as $120.00", () => {
    expect(formatCents(12000)).toBe("$120.00");
  });

  it("formats 300000 cents as $3,000.00 with thousands grouping", () => {
    expect(formatCents(300000)).toBe("$3,000.00");
  });

  it("formats zero and sub-dollar amounts with two decimals", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(5)).toBe("$0.05");
  });

  it("groups millions", () => {
    expect(formatCents(123456789)).toBe("$1,234,567.89");
  });

  it("puts the minus sign before the currency symbol", () => {
    expect(formatCents(-12050)).toBe("-$120.50");
  });

  it("treats non-finite input as zero", () => {
    expect(formatCents(Number.NaN)).toBe("$0.00");
    expect(formatCents(Number.POSITIVE_INFINITY)).toBe("$0.00");
  });
});

describe("formatCentsPerMonth", () => {
  it("appends /mo to the formatted amount", () => {
    expect(formatCentsPerMonth(1549)).toBe("$15.49/mo");
  });
});

describe("centsToMoneyText", () => {
  it("converts 30000 cents to 300.00", () => {
    expect(centsToMoneyText(30000)).toBe("300.00");
  });

  it("does not add grouping separators or a currency symbol", () => {
    expect(centsToMoneyText(300000)).toBe("3000.00");
  });

  it("pads small amounts", () => {
    expect(centsToMoneyText(7)).toBe("0.07");
  });
});

describe("parseMoneyToCents", () => {
  it("parses 300.00 to 30000", () => {
    expect(parseMoneyToCents("300.00")).toBe(30000);
  });

  it("parses whole numbers and one-digit fractions", () => {
    expect(parseMoneyToCents("12")).toBe(1200);
    expect(parseMoneyToCents("12.5")).toBe(1250);
    expect(parseMoneyToCents("12.")).toBe(1200);
    expect(parseMoneyToCents(".5")).toBe(50);
  });

  it("returns null for empty text", () => {
    expect(parseMoneyToCents("")).toBeNull();
  });

  it("returns null for text without digits", () => {
    expect(parseMoneyToCents(".")).toBeNull();
  });

  it("returns null for invalid text", () => {
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("1.234")).toBeNull();
    expect(parseMoneyToCents("-5")).toBeNull();
    expect(parseMoneyToCents("1,000")).toBeNull();
    expect(parseMoneyToCents("$5")).toBeNull();
  });

  it("returns null when the result is not a safe integer", () => {
    expect(parseMoneyToCents("99999999999999999999")).toBeNull();
  });

  it("round-trips through centsToMoneyText", () => {
    expect(parseMoneyToCents(centsToMoneyText(1549))).toBe(1549);
  });
});

describe("APR conversions", () => {
  it("converts a percent to a fraction", () => {
    expect(aprPercentToFraction(22)).toBe(0.22);
    expect(aprPercentToFraction(0)).toBe(0);
  });

  it("converts a fraction to a percent rounded to 2 decimals", () => {
    expect(aprFractionToPercent(0.22)).toBe(22);
    expect(aprFractionToPercent(0.1999)).toBe(19.99);
    expect(aprFractionToPercent(1)).toBe(100);
  });

  it("round-trips a percent with two decimals", () => {
    expect(aprFractionToPercent(aprPercentToFraction(24.99))).toBe(24.99);
  });
});
