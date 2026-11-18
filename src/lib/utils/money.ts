// Pure helpers for the Money_Input. Framework-agnostic, total (never throw).

const DECIMAL_SEPARATOR = ".";
const COMMA = ",";
/** Cents never have 3 digits, so a comma followed by exactly 3 digits groups thousands. */
const THOUSANDS_GROUP_DIGITS = 3;
const NOT_DIGIT_OR_COMMA = /[^0-9,]/g;
// Optional leading digits, then one or more groups of "," and exactly 3 digits, to the end.
const THOUSANDS_GROUPED = new RegExp(`^[0-9]*(?:,[0-9]{${THOUSANDS_GROUP_DIGITS}})+$`);
const MAX_FRACTION_DIGITS = 2;
const FIRST_DIGIT = "0";
const LAST_DIGIT = "9";
const ZERO_INTEGER_PART = "0";
const ZERO_PAD = "0";

function isDigit(char: string): boolean {
  return char >= FIRST_DIGIT && char <= LAST_DIGIT;
}

function removeCommas(value: string): string {
  return value.split(COMMA).join("");
}

/**
 * Resolves commas before sanitizing:
 * - If the string contains a ".", commas are thousands separators and are removed
 *   ("1,234.50" → "1234.50").
 * - Otherwise, if every comma is followed by exactly 3 digits and then another comma or
 *   the end, all commas are thousands separators and are removed ("1,000" → "1000",
 *   "1,234,567" → "1234567"). The check looks only at digits and commas, because every
 *   other character is dropped later anyway (so " 1,000 " → "1000").
 * - Otherwise the first comma is the decimal separator and later commas are removed
 *   ("15,49" → "15.49", "12,5" → "12.5").
 */
function normalizeCommas(raw: string): string {
  if (raw.includes(DECIMAL_SEPARATOR)) {
    return removeCommas(raw);
  }
  const firstComma = raw.indexOf(COMMA);
  if (firstComma === -1) {
    return raw;
  }
  if (THOUSANDS_GROUPED.test(raw.replace(NOT_DIGIT_OR_COMMA, ""))) {
    return removeCommas(raw);
  }
  const before = raw.slice(0, firstComma);
  const after = removeCommas(raw.slice(firstComma + COMMA.length));
  return `${before}${DECIMAL_SEPARATOR}${after}`;
}

/**
 * Keeps digits and the first decimal separator, drops every other character,
 * and caps the fraction at 2 digits. A comma is a decimal separator when the
 * string has no "." and a thousands separator when it has one (see normalizeCommas).
 * Output always matches `^\d*(\.\d{0,2})?$`.
 */
export function sanitizeMoneyInput(raw: string): string {
  if (typeof raw !== "string") {
    return "";
  }
  const normalized = normalizeCommas(raw);
  let result = "";
  let hasSeparator = false;
  let fractionDigits = 0;
  for (const char of normalized) {
    if (isDigit(char)) {
      if (!hasSeparator) {
        result += char;
      } else if (fractionDigits < MAX_FRACTION_DIGITS) {
        result += char;
        fractionDigits += 1;
      }
    } else if (char === DECIMAL_SEPARATOR && !hasSeparator) {
      hasSeparator = true;
      result += char;
    }
  }
  return result;
}

/**
 * Keystroke filter for the Money_Input while the user is typing: keeps digits, "," and "."
 * and drops every other character, without interpreting separators. The comma rule needs
 * the whole value (a comma followed by 3 digits is a thousands separator), so it runs only
 * on commit, in `commitMoneyInput`.
 */
export function filterMoneyKeystroke(raw: string): string {
  if (typeof raw !== "string") {
    return "";
  }
  let result = "";
  for (const char of raw) {
    if (isDigit(char) || char === COMMA || char === DECIMAL_SEPARATOR) {
      result += char;
    }
  }
  return result;
}

/** The committed Money_Input value: full sanitizing, then 2-decimal formatting. */
export function commitMoneyInput(raw: string): string {
  return formatMoneyOnBlur(sanitizeMoneyInput(raw));
}

/**
 * Formats a sanitized value to exactly 2 fractional digits.
 * Returns "" when the value holds no digit ("" or ".").
 */
export function formatMoneyOnBlur(sanitized: string): string {
  const clean = sanitizeMoneyInput(sanitized);
  const [integerPart = "", fractionPart = ""] = clean.split(DECIMAL_SEPARATOR);
  if (integerPart === "" && fractionPart === "") {
    return "";
  }
  const integer = integerPart === "" ? ZERO_INTEGER_PART : integerPart;
  const fraction = fractionPart.padEnd(MAX_FRACTION_DIGITS, ZERO_PAD);
  return `${integer}${DECIMAL_SEPARATOR}${fraction}`;
}
