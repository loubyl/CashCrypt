import { describe, expect, it } from "vitest";
import {
  validateDebtInput,
  validateIncome,
  validatePaymentAmount,
  validateSubscriptionInput,
  validateTransactionInput,
} from "@/lib/validation/inputs";
import { MAX_MONEY_CENTS, MAX_NAME_LENGTH } from "@/lib/validation/limits";

const NOW = "2025-06-15";

const validDebt = {
  name: "Card",
  balanceCents: 180000,
  apr: 0.2,
  minimumPaymentCents: 5000,
};

const validTransaction = {
  amountCents: 450,
  description: "Coffee",
  category: "Food",
  date: NOW,
};

describe("validateIncome", () => {
  it("rejects 99 cents", () => {
    expect(validateIncome(99).ok).toBe(false);
  });

  it("accepts 100 cents", () => {
    expect(validateIncome(100)).toEqual({ ok: true, value: 100 });
  });

  it("accepts the maximum money amount and rejects one cent more", () => {
    expect(validateIncome(MAX_MONEY_CENTS).ok).toBe(true);
    expect(validateIncome(MAX_MONEY_CENTS + 1).ok).toBe(false);
  });

  it("rejects non-integer, NaN and non-number amounts", () => {
    expect(validateIncome(100.5).ok).toBe(false);
    expect(validateIncome(Number.NaN).ok).toBe(false);
    expect(validateIncome(Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(validateIncome("500").ok).toBe(false);
  });
});

describe("validateDebtInput", () => {
  it("trims the name", () => {
    const result = validateDebtInput({ ...validDebt, name: "  Card  " });
    expect(result.ok && result.value.name).toBe("Card");
  });

  it("accepts a name of exactly 60 characters and rejects 61", () => {
    const ok = validateDebtInput({ ...validDebt, name: "a".repeat(MAX_NAME_LENGTH) });
    const tooLong = validateDebtInput({
      ...validDebt,
      name: "a".repeat(MAX_NAME_LENGTH + 1),
    });
    expect(ok.ok).toBe(true);
    expect(tooLong.ok).toBe(false);
  });

  it("counts the length after trimming", () => {
    const padded = ` ${"a".repeat(MAX_NAME_LENGTH)} `;
    expect(validateDebtInput({ ...validDebt, name: padded }).ok).toBe(true);
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(validateDebtInput({ ...validDebt, name: "   " }).ok).toBe(false);
  });

  it("accepts APR 0 and 1", () => {
    expect(validateDebtInput({ ...validDebt, apr: 0 }).ok).toBe(true);
    expect(validateDebtInput({ ...validDebt, apr: 1 }).ok).toBe(true);
  });

  it("rejects APR 1.01 and negative APR", () => {
    expect(validateDebtInput({ ...validDebt, apr: 1.01 }).ok).toBe(false);
    expect(validateDebtInput({ ...validDebt, apr: -0.01 }).ok).toBe(false);
  });

  it("rejects NaN and non-integer money amounts", () => {
    expect(validateDebtInput({ ...validDebt, balanceCents: Number.NaN }).ok).toBe(false);
    expect(validateDebtInput({ ...validDebt, balanceCents: 10.5 }).ok).toBe(false);
    expect(validateDebtInput({ ...validDebt, minimumPaymentCents: 0.1 }).ok).toBe(false);
  });

  it("rejects a balance above the maximum money limit", () => {
    expect(
      validateDebtInput({ ...validDebt, balanceCents: MAX_MONEY_CENTS + 1 }).ok,
    ).toBe(false);
  });

  it("reports an error for the failing field", () => {
    const result = validateDebtInput({ ...validDebt, apr: 2 });
    expect(!result.ok && result.errors.map((e) => e.field)).toEqual(["apr"]);
  });

  it("rejects input that is not an object", () => {
    expect(validateDebtInput(null).ok).toBe(false);
  });
});

describe("validateSubscriptionInput", () => {
  const valid = { name: "Stream", amountCents: 1599, cadence: "monthly", usage: "never" };

  it("accepts a valid subscription and defaults active to true", () => {
    const result = validateSubscriptionInput(valid);
    expect(result.ok && result.value.active).toBe(true);
  });

  it("rejects a zero amount, NaN amount and bad cadence", () => {
    expect(validateSubscriptionInput({ ...valid, amountCents: 0 }).ok).toBe(false);
    expect(validateSubscriptionInput({ ...valid, amountCents: Number.NaN }).ok).toBe(false);
    expect(validateSubscriptionInput({ ...valid, cadence: "daily" }).ok).toBe(false);
  });
});

describe("validateTransactionInput", () => {
  it("accepts a transaction dated today", () => {
    expect(validateTransactionInput(validTransaction, NOW).ok).toBe(true);
  });

  it("rejects a future date", () => {
    const result = validateTransactionInput({ ...validTransaction, date: "2025-06-16" }, NOW);
    expect(!result.ok && result.errors[0]).toEqual({
      field: "date",
      message: "The date cannot be in the future.",
    });
  });

  it("rejects an impossible calendar date", () => {
    expect(
      validateTransactionInput({ ...validTransaction, date: "2025-02-30" }, NOW).ok,
    ).toBe(false);
  });

  it("rejects non-integer and NaN amounts", () => {
    expect(validateTransactionInput({ ...validTransaction, amountCents: 1.5 }, NOW).ok).toBe(false);
    expect(
      validateTransactionInput({ ...validTransaction, amountCents: Number.NaN }, NOW).ok,
    ).toBe(false);
  });

  it("trims the description", () => {
    const result = validateTransactionInput(
      { ...validTransaction, description: "  Coffee " },
      NOW,
    );
    expect(result.ok && result.value.description).toBe("Coffee");
  });
});

describe("amounts inside validation messages", () => {
  const message = (result: ReturnType<typeof validateIncome>) => (!result.ok ? result.errors[0].message : null);
  it("drops .00 for whole-dollar limits", () => {
    expect(message(validateIncome(99))).toBe("Enter an amount of at least $1.");
    expect(message(validateIncome(MAX_MONEY_CENTS + 1))).toBe("Enter an amount of at most $1,000,000.");
  });
  it("keeps the cents when the amount has them", () => {
    expect(message(validatePaymentAmount(0, { balanceCents: 180000 }))).toBe(
      "Enter an amount of at least $0.01.",
    );
    expect(message(validatePaymentAmount(1001, { balanceCents: 1000 }))).toBe(
      "The payment cannot be more than the balance. The balance is $10.",
    );
    expect(message(validatePaymentAmount(1251, { balanceCents: 1250 }))).toBe(
      "The payment cannot be more than the balance. The balance is $12.50.",
    );
  });
});

describe("validatePaymentAmount", () => {
  const debt = { balanceCents: 180000 };

  it("accepts a payment equal to the balance", () => {
    expect(validatePaymentAmount(180000, debt)).toEqual({ ok: true, value: 180000 });
  });

  it("rejects a payment above the balance with the balance in the message", () => {
    const result = validatePaymentAmount(180001, debt);
    expect(!result.ok && result.errors[0].message).toBe(
      "The payment cannot be more than the balance. The balance is $1,800.",
    );
  });

  it("rejects zero, non-integer and NaN payments", () => {
    expect(validatePaymentAmount(0, debt).ok).toBe(false);
    expect(validatePaymentAmount(10.5, debt).ok).toBe(false);
    expect(validatePaymentAmount(Number.NaN, debt).ok).toBe(false);
  });

  it("rejects a payment above the maximum money limit", () => {
    expect(
      validatePaymentAmount(MAX_MONEY_CENTS + 1, { balanceCents: MAX_MONEY_CENTS * 2 }).ok,
    ).toBe(false);
  });
});
