// Pure integer-cent helpers. Framework-agnostic and total (never throw).

const CURRENCY_SYMBOL = "$";
const PER_MONTH_SUFFIX = "/mo";
const NEGATIVE_PREFIX = "-";
const DECIMAL_SEPARATOR = ".";
const GROUP_SEPARATOR = ",";
const GROUP_SIZE = 3;
const CENTS_PER_UNIT = 100;
const FRACTION_DIGITS = 2;
const ZERO_PAD = "0";
const RADIX = 10;
const PERCENT_PER_UNIT = 100;
/** Fractions are rounded to 2 percent decimals: fraction × 100 × 100. */
const PERCENT_DECIMAL_SCALE = 100;
const COMMITTED_MONEY_TEXT = /^(\d*)(?:\.(\d{0,2}))?$/;

function safeCents(cents: number): number {
  return Number.isFinite(cents) ? Math.round(cents) : 0;
}

function groupThousands(digits: string): string {
  let result = "";
  for (let end = digits.length; end > 0; end -= GROUP_SIZE) {
    const start = Math.max(0, end - GROUP_SIZE);
    const chunk = digits.slice(start, end);
    result = result === "" ? chunk : `${chunk}${GROUP_SEPARATOR}${result}`;
  }
  return result;
}

function splitCents(cents: number): { negative: boolean; integer: string; fraction: string } {
  const whole = safeCents(cents);
  const absolute = Math.abs(whole);
  const integer = Math.floor(absolute / CENTS_PER_UNIT);
  const fraction = absolute % CENTS_PER_UNIT;
  return {
    negative: whole < 0,
    integer: String(integer),
    fraction: String(fraction).padStart(FRACTION_DIGITS, ZERO_PAD),
  };
}

/** 12000 → "$120.00" (en-US grouping). Non-finite input is treated as 0. */
export function formatCents(cents: number): string {
  const { negative, integer, fraction } = splitCents(cents);
  const sign = negative ? NEGATIVE_PREFIX : "";
  return `${sign}${CURRENCY_SYMBOL}${groupThousands(integer)}${DECIMAL_SEPARATOR}${fraction}`;
}

/** 12000 → "$120.00/mo". */
export function formatCentsPerMonth(cents: number): string {
  return `${formatCents(cents)}${PER_MONTH_SUFFIX}`;
}

/** 30000 → "300.00" (plain text for Input prefill). */
export function centsToMoneyText(cents: number): string {
  const { negative, integer, fraction } = splitCents(cents);
  const sign = negative ? NEGATIVE_PREFIX : "";
  return `${sign}${integer}${DECIMAL_SEPARATOR}${fraction}`;
}

/**
 * "300.00" → 30000. Returns null for "" or any text outside `^\d*(\.\d{0,2})?$`
 * (or text with no digit, like "."). Built from digit strings, no float math.
 */
export function parseMoneyToCents(text: string): number | null {
  if (typeof text !== "string") {
    return null;
  }
  const match = COMMITTED_MONEY_TEXT.exec(text);
  if (match === null) {
    return null;
  }
  const integerDigits = match[1] ?? "";
  const fractionDigits = match[2] ?? "";
  if (integerDigits === "" && fractionDigits === "") {
    return null;
  }
  const centsDigits = `${integerDigits === "" ? ZERO_PAD : integerDigits}${fractionDigits.padEnd(FRACTION_DIGITS, ZERO_PAD)}`;
  const cents = Number.parseInt(centsDigits, RADIX);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** 22 → 0.22. */
export function aprPercentToFraction(percent: number): number {
  return percent / PERCENT_PER_UNIT;
}

/** 0.22 → 22, rounded to 2 decimals. */
export function aprFractionToPercent(fraction: number): number {
  return Math.round(fraction * PERCENT_PER_UNIT * PERCENT_DECIMAL_SCALE) / PERCENT_DECIMAL_SCALE;
}
