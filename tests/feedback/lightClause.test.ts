import { describe, expect, it } from "vitest";
import {
  CLAUSE_SEPARATOR,
  EXPENSE_CLAUSE,
  GHOST_ASLEEP_CLAUSE,
  GHOST_EXPENSE_CLAUSE,
  GHOST_WOKE_CLAUSE,
  LIGHT_FULL_SCORE,
  LIGHT_NOISE_EPSILON,
  MINUS_SIGN,
  getGhostClause,
  getLightClause,
  getPoltergeistStage,
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

describe("getPoltergeistStage", () => {
  it("is awake when the Poltergeist was awake before and after", () => {
    expect(getPoltergeistStage(true, true)).toBe("awake");
  });
  it("is woke when the expense wakes it", () => {
    expect(getPoltergeistStage(false, true)).toBe("woke");
  });
  it("is asleep when there is no Poltergeist after", () => {
    expect(getPoltergeistStage(false, false)).toBe("asleep");
    expect(getPoltergeistStage(true, false)).toBe("asleep");
  });
});
describe("getGhostClause", () => {
  const change = (poltergeistBefore: boolean, poltergeistAfter: boolean, centsToWake: number | null) => ({
    poltergeistBefore,
    poltergeistAfter,
    centsToWake,
  });
  it("says it feeds the Poltergeist when it was awake before and after", () => {
    expect(getGhostClause(change(true, true, null))).toBe(GHOST_EXPENSE_CLAUSE);
  });
  it("says it woke the Poltergeist when this expense wakes it", () => {
    expect(getGhostClause(change(false, true, null))).toBe(GHOST_WOKE_CLAUSE);
    expect(GHOST_WOKE_CLAUSE).toBe("woke the Poltergeist, doesn't dim the light");
  });
  it("names the amount that wakes the Poltergeist when there is none after", () => {
    expect(getGhostClause(change(false, false, 49_551))).toBe(
      "doesn't dim the light \u00b7 $495.51 more wakes the Poltergeist",
    );
    expect(getGhostClause(change(false, false, 12_000))).toBe(
      "doesn't dim the light \u00b7 $120 more wakes the Poltergeist",
    );
  });
  it("omits the amount when the Poltergeist cannot wake", () => {
    expect(getGhostClause(change(false, false, null))).toBe(GHOST_ASLEEP_CLAUSE);
  });
  it("never claims a Poltergeist when the reading failed", () => {
    expect(getGhostClause(null)).toBe(GHOST_ASLEEP_CLAUSE);
    expect(getGhostClause(undefined)).toBe(GHOST_ASLEEP_CLAUSE);
  });
  it("joins to the toast text of the level-2 $3 expense", () => {
    expect(joinToastText("Ghost added: $3", getGhostClause(change(false, false, 49_701)))).toBe(
      "Ghost added: $3 \u00b7 doesn't dim the light \u00b7 $497.01 more wakes the Poltergeist",
    );
  });
});
