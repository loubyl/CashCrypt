// Pure input validators. Never throw; return a ValidationResult.
// No React, Dexie or Next.js imports.

import type {
  Cadence,
  DebtInput,
  SubscriptionInput,
  TransactionInput,
  Usage,
} from "@/types/finance";
import { addDays, type LocalDate } from "@/lib/utils/calendar";
import { formatCents } from "@/lib/utils/cents";
import {
  MAX_MONEY_CENTS,
  MAX_NAME_LENGTH,
  MIN_INCOME_CENTS_INPUT,
} from "./limits";

export type FieldError = { field: string; message: string };

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldError[] };

const MIN_POSITIVE_CENTS = 1;
const MIN_NON_NEGATIVE_CENTS = 0;
const MIN_APR = 0;
const MAX_APR = 1;
const NO_DAYS = 0;
const CADENCES: readonly Cadence[] = ["weekly", "monthly", "yearly"];
const USAGES: readonly Usage[] = ["often", "rarely", "never"];

type Checked<T> = { value: T } | { error: string };

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function fail<T>(errors: FieldError[]): ValidationResult<T> {
  return { ok: false, errors };
}

function checkCents(value: unknown, min: number): Checked<number> {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return { error: "Enter a valid amount." };
  }
  if (value < min) {
    return {
      error:
        min >= MIN_POSITIVE_CENTS
          ? `Enter an amount of at least ${formatCents(min)}.`
          : "The amount cannot be negative.",
    };
  }
  if (value > MAX_MONEY_CENTS) {
    return { error: `Enter an amount of at most ${formatCents(MAX_MONEY_CENTS)}.` };
  }
  return { value };
}

function checkName(value: unknown): Checked<string> {
  if (typeof value !== "string") return { error: "Enter a name." };
  const trimmed = value.trim();
  if (trimmed === "") return { error: "Enter a name." };
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { error: `Use ${MAX_NAME_LENGTH} characters or fewer.` };
  }
  return { value: trimmed };
}

function checkApr(value: unknown): Checked<number> {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { error: "Enter a valid interest rate." };
  }
  if (value < MIN_APR || value > MAX_APR) {
    return { error: "The interest rate must be between 0% and 100%." };
  }
  return { value };
}

function checkOneOf<T extends string>(
  value: unknown,
  options: readonly T[],
  message: string,
): Checked<T> {
  const match = options.find((option) => option === value);
  return match === undefined ? { error: message } : { value: match };
}

function isRealDate(value: unknown): value is LocalDate {
  if (typeof value !== "string") return false;
  try {
    return addDays(value, NO_DAYS) === value;
  } catch {
    return false;
  }
}

function checkDate(value: unknown, now: LocalDate): Checked<LocalDate> {
  if (!isRealDate(value)) return { error: "Enter a valid date." };
  if (value > now) return { error: "The date cannot be in the future." };
  return { value };
}

/** Collects errors; returns the first error per field. */
function collect(
  checks: ReadonlyArray<readonly [string, Checked<unknown>]>,
): FieldError[] {
  const errors: FieldError[] = [];
  for (const [field, result] of checks) {
    if ("error" in result) errors.push({ field, message: result.error });
  }
  return errors;
}

function valueOf<T>(result: Checked<T>): T {
  if ("error" in result) throw new Error("unreachable: validated value read from an error");
  return result.value;
}

export function validateIncome(cents: unknown): ValidationResult<number> {
  const result = checkCents(cents, MIN_INCOME_CENTS_INPUT);
  return "error" in result
    ? fail([{ field: "monthlyIncomeCents", message: result.error }])
    : { ok: true, value: result.value };
}

export function validateDebtInput(input: unknown): ValidationResult<DebtInput> {
  const source = isRecord(input) ? input : {};
  const name = checkName(source.name);
  const balance = checkCents(source.balanceCents, MIN_NON_NEGATIVE_CENTS);
  const apr = checkApr(source.apr);
  const minimum = checkCents(source.minimumPaymentCents, MIN_NON_NEGATIVE_CENTS);
  const errors = collect([
    ["name", name],
    ["balanceCents", balance],
    ["apr", apr],
    ["minimumPaymentCents", minimum],
  ]);
  if (errors.length > 0) return fail(errors);
  return {
    ok: true,
    value: {
      name: valueOf(name),
      balanceCents: valueOf(balance),
      apr: valueOf(apr),
      minimumPaymentCents: valueOf(minimum),
    },
  };
}

export function validateSubscriptionInput(
  input: unknown,
): ValidationResult<SubscriptionInput> {
  const source = isRecord(input) ? input : {};
  const name = checkName(source.name);
  const amount = checkCents(source.amountCents, MIN_POSITIVE_CENTS);
  const cadence = checkOneOf(source.cadence, CADENCES, "Choose a billing cadence.");
  const usage = checkOneOf(source.usage, USAGES, "Choose how often you use it.");
  const active: Checked<boolean> =
    source.active === undefined || typeof source.active === "boolean"
      ? { value: source.active ?? true }
      : { error: "Active must be true or false." };
  const errors = collect([
    ["name", name],
    ["amountCents", amount],
    ["cadence", cadence],
    ["usage", usage],
    ["active", active],
  ]);
  if (errors.length > 0) return fail(errors);
  return {
    ok: true,
    value: {
      name: valueOf(name),
      amountCents: valueOf(amount),
      cadence: valueOf(cadence),
      usage: valueOf(usage),
      active: valueOf(active),
    },
  };
}

export function validateTransactionInput(
  input: unknown,
  now: LocalDate,
): ValidationResult<TransactionInput> {
  const source = isRecord(input) ? input : {};
  const amount = checkCents(source.amountCents, MIN_POSITIVE_CENTS);
  const description = checkName(source.description);
  const category = checkName(source.category);
  const date = checkDate(source.date, now);
  const errors = collect([
    ["amountCents", amount],
    ["description", description],
    ["category", category],
    ["date", date],
  ]);
  if (errors.length > 0) return fail(errors);
  return {
    ok: true,
    value: {
      amountCents: valueOf(amount),
      description: valueOf(description),
      category: valueOf(category),
      date: valueOf(date),
    },
  };
}

export function validatePaymentAmount(
  cents: unknown,
  debt: { balanceCents: number },
): ValidationResult<number> {
  const field = "amountCents";
  const result = checkCents(cents, MIN_POSITIVE_CENTS);
  if ("error" in result) return fail([{ field, message: result.error }]);
  if (result.value > debt.balanceCents) {
    return fail([
      {
        field,
        message: `The payment cannot be more than the balance. The balance is ${formatCents(debt.balanceCents)}.`,
      },
    ]);
  }
  return { ok: true, value: result.value };
}
