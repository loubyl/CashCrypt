import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  commitMoneyInput,
  filterMoneyKeystroke,
  formatCurrencyParts,
  formatMoneyOnBlur,
  sanitizeMoneyInput,
} from "@/lib/utils/money";

const NUM_RUNS = 200;
const WELL_FORMED = /^\d*(\.\d{0,2})?$/;
const WELL_FORMED_BLUR = /^\d+\.\d{2}$/;
const CENTS_FACTOR = 100;
const BIASED_CHARS = ["0", "1", "5", "9", ".", ",", "-", "e", " ", "\t", "a", "$"];

// Strings biased toward digits, ".", ",", "-", "e" and whitespace, mixed with arbitrary text.
const rawInput = fc.oneof(
  fc.array(fc.constantFrom(...BIASED_CHARS), { maxLength: 20 }).map((chars) => chars.join("")),
  fc.string({ maxLength: 20 }),
  fc.string({ unit: "grapheme", maxLength: 10 }),
);

describe("sanitizeMoneyInput", () => {
  // Feature: design-system-foundation, Property 1: Money sanitizer output is always well formed
  it("always returns digits with at most one dot and at most 2 fractional digits", () => {
    fc.assert(
      fc.property(rawInput, (raw) => {
        const result = sanitizeMoneyInput(raw);
        expect(result).toMatch(WELL_FORMED);
        expect(result.split(".").length).toBeLessThanOrEqual(2);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: design-system-foundation, Property 2: Money sanitizer is idempotent
  it("returns the same string when applied twice", () => {
    fc.assert(
      fc.property(rawInput, (raw) => {
        const once = sanitizeMoneyInput(raw);
        expect(sanitizeMoneyInput(once)).toBe(once);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it.each([
    ["", ""],
    [".", "."],
    [".5", ".5"],
    ["1.234", "1.23"],
    ["1.2.3", "1.23"],
    ["-5e3", "53"],
    // A comma followed by exactly 3 digits groups thousands (cents never have 3 digits).
    [" 1,000 ", "1000"],
    ["1,234,567", "1234567"],
    ["12,5", "12.5"],
    ["15,49", "15.49"],
    ["1,234.50", "1234.50"],
    ["0,5", "0.5"],
    [",5", ".5"],
    ["1,000.00", "1000.00"],
    ["1,2,3", "1.23"],
  ])("sanitizes %j to %j", (raw, expected) => {
    expect(sanitizeMoneyInput(raw)).toBe(expected);
  });
});

describe("sanitizeMoneyInput decimal comma", () => {
  const digits = (min: number, max: number) =>
    fc.array(fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"), {
      minLength: min,
      maxLength: max,
    }).map((chars) => chars.join(""));

  // Feature: design-system-foundation, Property 16: A decimal comma is read the same as a decimal point
  it("reads a + \",\" + b the same as a + \".\" + b for any digits a and 1 or 2 digits b", () => {
    fc.assert(
      fc.property(digits(0, 12), digits(1, 2), (a, b) => {
        expect(sanitizeMoneyInput(`${a},${b}`)).toBe(sanitizeMoneyInput(`${a}.${b}`));
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("sanitizeMoneyInput thousands commas", () => {
  const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const digitString = (min: number, max: number) =>
    fc.array(fc.constantFrom(...DIGITS), { minLength: min, maxLength: max }).map((c) => c.join(""));
  const group = digitString(3, 3);

  // Feature: design-system-foundation, Property 17: Commas before 3-digit groups are thousands separators
  it("reads a leading 1-3 digits followed by comma-separated 3-digit groups as the digits without commas", () => {
    fc.assert(
      fc.property(digitString(1, 3), fc.array(group, { maxLength: 5 }), (a, groups) => {
        const grouped = [a, ...groups].join(",");
        expect(sanitizeMoneyInput(grouped)).toBe([a, ...groups].join(""));
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("Money_Input typing and commit", () => {
  /** Simulates typing `s` one character at a time through the onChange filter. */
  function typeThroughFilter(s: string): string {
    let value = "";
    for (const char of s) {
      value = filterMoneyKeystroke(value + char);
    }
    return value;
  }

  const digitRun = (min: number, max: number) =>
    fc
      .array(fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"), { minLength: min, maxLength: max })
      .map((chars) => chars.join(""));
  // Amount-shaped strings: comma-separated digit groups (often exactly 3 digits, the case a
  // per-keystroke comma conversion breaks), an optional "." or "," fraction, and some noise.
  const amountLike = fc
    .tuple(
      fc.constantFrom("", "$", "$ ", " "),
      digitRun(0, 4),
      fc.array(fc.oneof(digitRun(3, 3), digitRun(1, 4)), { maxLength: 3 }),
      fc.option(fc.tuple(fc.constantFrom(".", ","), digitRun(0, 3)), { nil: undefined }),
      fc.constantFrom("", " ", "x"),
    )
    .map(([prefix, lead, groups, fraction, suffix]) =>
      `${prefix}${[lead, ...groups].join(",")}${fraction ? fraction.join("") : ""}${suffix}`,
    );

  // Feature: design-system-foundation, Property 18: Typing key by key then blurring equals committing the whole string
  it("gives the same committed value when s is typed one character at a time and then blurred", () => {
    fc.assert(
      fc.property(fc.oneof(rawInput, amountLike), (s) => {
        expect(commitMoneyInput(typeThroughFilter(s))).toBe(formatMoneyOnBlur(sanitizeMoneyInput(s)));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it.each([
    ["1,000", "1000.00"],
    ["15,49", "15.49"],
    ["1,234,567", "1234567.00"],
    ["$ 12.5", "12.50"],
  ])("commits %j typed key by key as %j", (typed, expected) => {
    expect(commitMoneyInput(typeThroughFilter(typed))).toBe(expected);
  });

  it("keeps only digits, commas and dots while typing, without converting separators", () => {
    expect(filterMoneyKeystroke("1,")).toBe("1,");
    expect(filterMoneyKeystroke("$ 1,000.5x")).toBe("1,000.5");
    expect(filterMoneyKeystroke("")).toBe("");
  });
});

describe("formatMoneyOnBlur", () => {
  // Feature: design-system-foundation, Property 3: Money blur formatting yields exactly two decimals and preserves the value
  it("yields exactly two decimals and keeps the value, or empty when there is no digit", () => {
    fc.assert(
      fc.property(rawInput, (raw) => {
        const sanitized = sanitizeMoneyInput(raw);
        const result = formatMoneyOnBlur(sanitized);
        if (/\d/.test(sanitized)) {
          expect(result).toMatch(WELL_FORMED_BLUR);
          expect(Math.round(Number(result) * CENTS_FACTOR)).toBe(
            Math.round(Number(sanitized) * CENTS_FACTOR),
          );
        } else {
          expect(result).toBe("");
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it.each([
    ["", ""],
    [".", ""],
    [".5", "0.50"],
    ["5", "5.00"],
    ["5.", "5.00"],
    ["1.2", "1.20"],
    ["1.23", "1.23"],
    ["1.234", "1.23"],
  ])("formats %j to %j", (input, expected) => {
    expect(formatMoneyOnBlur(input)).toBe(expected);
  });
});

describe("formatCurrencyParts", () => {
  // Feature: design-system-foundation, Property 7: Currency parts reconstruct the rounded value
  it("rebuilds the value rounded to cents from the integer and cents parts", () => {
    fc.assert(
      fc.property(fc.double({ min: -1e9, max: 1e9, noNaN: true }), (value) => {
        const parts = formatCurrencyParts(value);
        const expectedCents = Math.round(Math.abs(value) * CENTS_FACTOR);
        const isNegative = parts.integer.startsWith("-");
        const integerDigits = parts.integer.replace(/^-/, "").replaceAll(",", "");
        expect(parts.cents).toMatch(/^\d{2}$/);
        expect(integerDigits).toMatch(/^\d+$/);
        const rebuiltCents = Number(integerDigits) * CENTS_FACTOR + Number(parts.cents);
        expect(rebuiltCents).toBe(expectedCents);
        expect(isNegative).toBe(value < 0 && expectedCents > 0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("treats non-finite values as zero", () => {
    for (const value of [Number.NaN, Infinity, -Infinity]) {
      expect(formatCurrencyParts(value)).toEqual({ symbol: "$", integer: "0", cents: "00" });
    }
  });

  it("groups thousands and pads cents", () => {
    expect(formatCurrencyParts(1234567.5)).toEqual({ symbol: "$", integer: "1,234,567", cents: "50" });
  });
});
