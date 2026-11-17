import { describe, expect, it } from "vitest";
import { HAUNTING_CONFIG, validateConfig } from "@/lib/haunting/config";
import type { HauntingConfig } from "@/lib/haunting/config";

function withOverrides(overrides: Partial<HauntingConfig>): HauntingConfig {
  return { ...HAUNTING_CONFIG, ...overrides };
}

describe("validateConfig", () => {
  it("returns no problems for the shipped config", () => {
    expect(validateConfig(HAUNTING_CONFIG)).toEqual([]);
  });

  it("reports a problem when WEIGHT_FACTOR_A is less than twice WEIGHT_FACTOR_C", () => {
    expect(validateConfig(withOverrides({ WEIGHT_FACTOR_A: 0.9 })).length).toBeGreaterThan(0);
  });

  it("reports a problem when WEIGHT_FACTOR_B is less than twice WEIGHT_FACTOR_C", () => {
    expect(validateConfig(withOverrides({ WEIGHT_FACTOR_B: 0.5 })).length).toBeGreaterThan(0);
  });

  it("reports a problem for a non-positive small expense threshold", () => {
    expect(validateConfig(withOverrides({ SMALL_EXPENSE_THRESHOLD_CENTS: 0 })).length).toBeGreaterThan(0);
  });

  it("reports a problem for a non-positive poltergeist ratio", () => {
    expect(validateConfig(withOverrides({ POLTERGEIST_RATIO: -0.1 })).length).toBeGreaterThan(0);
  });

  it("reports a problem for a non-positive MOMENTUM_MAX", () => {
    expect(validateConfig(withOverrides({ MOMENTUM_MAX: 0 })).length).toBeGreaterThan(0);
  });

  it("reports a problem for each negative momentum coefficient", () => {
    expect(validateConfig(withOverrides({ COEFF_EXTRA_PRINCIPAL: -1 })).length).toBeGreaterThan(0);
    expect(validateConfig(withOverrides({ COEFF_SUB_CANCEL_COST: -1 })).length).toBeGreaterThan(0);
    expect(validateConfig(withOverrides({ COEFF_ACTIONS_COMPLETED: -1 })).length).toBeGreaterThan(0);
  });

  it("reports a problem when decay bands are misordered", () => {
    expect(validateConfig(withOverrides({ BAND_L2_MIN: 85 })).length).toBeGreaterThan(0);
    expect(validateConfig(withOverrides({ BAND_L3_MIN: 60 })).length).toBeGreaterThan(0);
    expect(validateConfig(withOverrides({ BAND_L4_MIN: 45 })).length).toBeGreaterThan(0);
  });

  it("reports a problem when BAND_L1_MIN reaches 100 or BAND_L5_MIN is not 0", () => {
    expect(validateConfig(withOverrides({ BAND_L1_MIN: 100 })).length).toBeGreaterThan(0);
    expect(validateConfig(withOverrides({ BAND_L5_MIN: 5 })).length).toBeGreaterThan(0);
  });

  it("does not throw and reports problems for NaN and Infinity values", () => {
    const nan = withOverrides({ WEIGHT_FACTOR_A: Number.NaN, BAND_L3_MIN: Number.NaN });
    const inf = withOverrides({ MOMENTUM_MAX: Number.POSITIVE_INFINITY });
    expect(() => validateConfig(nan)).not.toThrow();
    expect(() => validateConfig(inf)).not.toThrow();
    expect(validateConfig(nan).length).toBeGreaterThan(0);
    expect(validateConfig(inf).length).toBeGreaterThan(0);
  });

  it("does not throw and reports problems for missing fields or non-object input", () => {
    const { WEIGHT_FACTOR_B: _omitted, ...partial } = HAUNTING_CONFIG;
    void _omitted;
    for (const input of [partial, {}, null, undefined, 42, "config", []]) {
      expect(() => validateConfig(input)).not.toThrow();
      expect(validateConfig(input).length).toBeGreaterThan(0);
    }
  });
});

describe("config module", () => {
  it("can be imported without throwing", async () => {
    await expect(import("@/lib/haunting/config")).resolves.toBeDefined();
  });
});
