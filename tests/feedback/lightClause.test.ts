import { describe, expect, it } from "vitest";
import {
  CLAUSE_SEPARATOR,
  EXPENSE_CLAUSE,
  GHOST_EXPENSE_CLAUSE,
  LIGHT_FULL_SCORE,
  LIGHT_NOISE_EPSILON,
  MINUS_SIGN,
  getLightClause,
  joinToastText,
} from "@/lib/utils/lightClause";

describe("getLightClause table rows", () => {
  it("returns 'Light unchanged' when a score is not finite", () => {
    expect(getLightClause(Number.NaN, 10)).toBe("Light unchanged");
    expect(getLightClause(10, Number.POSITIVE_INFINITY)).toBe("Light unchanged");
    expect(getLightClause(Number.NEGATIVE_INFINITY, Number.NaN)).toBe("Light unchanged");
  });

  it("returns 'Light already full' for 100 to 100", () => {
    expect(getLightClause(LIGHT_FULL_SCORE, LIGHT_FULL_SCORE)).toBe("Light already full");
  });

  it("returns 'Light unchanged' for no change below 100", () => {
    expect(getLightClause(40, 40)).toBe("Light unchanged");
    expect(getLightClause(40, 40 + LIGHT_NOISE_EPSILON / 2)).toBe("Light unchanged");
  });

  it("returns 'Light rises slightly' for a tiny rise", () => {
    expect(getLightClause(40, 40.049)).toBe("Light rises slightly");
  });

  it("returns 'Light dims slightly' for a tiny drop", () => {
    expect(getLightClause(40, 39.951)).toBe("Light dims slightly");
  });

  it("returns a signed value with one decimal otherwise", () => {
    expect(getLightClause(40, 40.3)).toBe("Light +0.3");
    expect(getLightClause(40, 38.7)).toBe(`Light ${MINUS_SIGN}1.3`);
    expect(getLightClause(40, 42)).toBe("Light +2.0");
  });
});

describe("getLightClause rounding", () => {
  it("rounds 0.05 up to +0.1", () => {
    expect(getLightClause(0, 0.05)).toBe("Light +0.1");
  });
  it("treats 0.049 as a slight rise", () => {
    expect(getLightClause(0, 0.049)).toBe("Light rises slightly");
  });
  it("rounds -0.05 away from zero to −0.1", () => {
    expect(getLightClause(0.05, 0)).toBe(`Light ${MINUS_SIGN}0.1`);
  });
  it("treats -0.049 as a slight dim", () => {
    expect(getLightClause(0.049, 0)).toBe("Light dims slightly");
  });
  it("reads the measured values", () => {
    expect(getLightClause(32, 32.112)).toBe("Light +0.1");
    expect(getLightClause(32, 37.217)).toBe("Light +5.2");
  });
});

describe("joinToastText", () => {
  it("returns the base alone without a clause", () => {
    expect(joinToastText("Income saved", null)).toBe("Income saved");
  });
  it("joins base and clause with the separator", () => {
    expect(joinToastText("Income saved", "Light +3.1")).toBe(`Income saved${CLAUSE_SEPARATOR}Light +3.1`);
    expect(joinToastText("Ghost added: $8", GHOST_EXPENSE_CLAUSE)).toBe(
      "Ghost added: $8 \u00b7 feeds the Poltergeist, doesn't dim the light",
    );
    expect(joinToastText("Expense added: $20", EXPENSE_CLAUSE)).toBe(
      "Expense added: $20 \u00b7 doesn't change the light",
    );
  });
});
