// Single source of truth for every numeric constant of the haunting engine.
// Importing this module never validates or throws; call validateConfig explicitly.

export const WEIGHT_FACTOR_A = 1.0; // minimumPayment / income
export const WEIGHT_FACTOR_B = 2.5; // balance / annualIncome
export const WEIGHT_FACTOR_C = 0.5; // subscriptionCost / income

// Momentum coefficients
export const MOMENTUM_MAX = 15; // maximum momentum bonus
export const COEFF_EXTRA_PRINCIPAL = 30; // weight for extraPrincipal / monthlyIncome
export const COEFF_SUB_CANCEL_COST = 100; // weight for canceledCost / monthlyIncome
export const COEFF_ACTIONS_COMPLETED = 1.0; // points per completed exorcism action

// Half-open decay bands (lower boundaries)
export const BAND_L1_MIN = 80; // [80, 100]
export const BAND_L2_MIN = 60; // [60, 80)
export const BAND_L3_MIN = 40; // [40, 60)
export const BAND_L4_MIN = 20; // [20, 40)
export const BAND_L5_MIN = 0; // [0, 20)

export const SMALL_EXPENSE_THRESHOLD_CENTS = 1500; // $15.00
export const POLTERGEIST_RATIO = 0.1;

export const CADENCE_WEEKLY_FACTOR = 52 / 12; // ≈ 4.3333
export const CADENCE_YEARLY_FACTOR = 1 / 12; // ≈ 0.0833

// Supporting constants so that no other module needs a numeric literal
export const WINDOW_DAYS = 30; // rolling window for ghosts and momentum
export const SCORE_MIN = 0; // lower bound of lightScore and baseScore
export const SCORE_MAX = 100; // upper bound of lightScore and baseScore
export const CENTS_PER_DOLLAR = 100; // used only by the Cents_Boundary
export const MIN_INCOME_CENTS = 100; // incomes below this take the zero-income path
export const MONTHS_PER_YEAR = 12; // annual income = monthly income × 12

export type HauntingConfig = {
  WEIGHT_FACTOR_A: number;
  WEIGHT_FACTOR_B: number;
  WEIGHT_FACTOR_C: number;
  MOMENTUM_MAX: number;
  COEFF_EXTRA_PRINCIPAL: number;
  COEFF_SUB_CANCEL_COST: number;
  COEFF_ACTIONS_COMPLETED: number;
  BAND_L1_MIN: number;
  BAND_L2_MIN: number;
  BAND_L3_MIN: number;
  BAND_L4_MIN: number;
  BAND_L5_MIN: number;
  SMALL_EXPENSE_THRESHOLD_CENTS: number;
  POLTERGEIST_RATIO: number;
  CADENCE_WEEKLY_FACTOR: number;
  CADENCE_YEARLY_FACTOR: number;
  WINDOW_DAYS: number;
  SCORE_MIN: number;
  SCORE_MAX: number;
  CENTS_PER_DOLLAR: number;
  MIN_INCOME_CENTS: number;
  MONTHS_PER_YEAR: number;
};

export const HAUNTING_CONFIG: HauntingConfig = {
  WEIGHT_FACTOR_A,
  WEIGHT_FACTOR_B,
  WEIGHT_FACTOR_C,
  MOMENTUM_MAX,
  COEFF_EXTRA_PRINCIPAL,
  COEFF_SUB_CANCEL_COST,
  COEFF_ACTIONS_COMPLETED,
  BAND_L1_MIN,
  BAND_L2_MIN,
  BAND_L3_MIN,
  BAND_L4_MIN,
  BAND_L5_MIN,
  SMALL_EXPENSE_THRESHOLD_CENTS,
  POLTERGEIST_RATIO,
  CADENCE_WEEKLY_FACTOR,
  CADENCE_YEARLY_FACTOR,
  WINDOW_DAYS,
  SCORE_MIN,
  SCORE_MAX,
  CENTS_PER_DOLLAR,
  MIN_INCOME_CENTS,
  MONTHS_PER_YEAR,
};

const CONFIG_KEYS = Object.keys(HAUNTING_CONFIG) as (keyof HauntingConfig)[];

function readField(config: unknown, key: string): unknown {
  if (typeof config !== "object" || config === null) return undefined;
  return (config as Record<string, unknown>)[key];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Returns human-readable problems with a config, or [] when it is valid.
 * Accepts any value and never throws.
 */
export function validateConfig(config: unknown): string[] {
  const problems: string[] = [];
  const values: Partial<Record<keyof HauntingConfig, number>> = {};

  for (const key of CONFIG_KEYS) {
    const value = readField(config, key);
    if (isFiniteNumber(value)) {
      values[key] = value;
    } else {
      problems.push(`${key} must be a finite number`);
    }
  }

  // Each check runs only when all the fields it reads are finite numbers.
  const has = (...keys: (keyof HauntingConfig)[]): boolean =>
    keys.every((key) => values[key] !== undefined);
  const v = (key: keyof HauntingConfig): number => values[key] as number;

  if (has("WEIGHT_FACTOR_A", "WEIGHT_FACTOR_C") && v("WEIGHT_FACTOR_A") < 2 * v("WEIGHT_FACTOR_C")) {
    problems.push(
      `WEIGHT_FACTOR_A (${v("WEIGHT_FACTOR_A")}) must be ≥ 2 × WEIGHT_FACTOR_C (${v("WEIGHT_FACTOR_C")})`,
    );
  }
  if (has("WEIGHT_FACTOR_B", "WEIGHT_FACTOR_C") && v("WEIGHT_FACTOR_B") < 2 * v("WEIGHT_FACTOR_C")) {
    problems.push(
      `WEIGHT_FACTOR_B (${v("WEIGHT_FACTOR_B")}) must be ≥ 2 × WEIGHT_FACTOR_C (${v("WEIGHT_FACTOR_C")})`,
    );
  }
  if (has("WEIGHT_FACTOR_C") && v("WEIGHT_FACTOR_C") < 0) {
    problems.push("WEIGHT_FACTOR_C must be ≥ 0");
  }
  if (has("SMALL_EXPENSE_THRESHOLD_CENTS") && v("SMALL_EXPENSE_THRESHOLD_CENTS") <= 0) {
    problems.push("SMALL_EXPENSE_THRESHOLD_CENTS must be > 0");
  }
  if (has("POLTERGEIST_RATIO") && v("POLTERGEIST_RATIO") <= 0) {
    problems.push("POLTERGEIST_RATIO must be > 0");
  }
  if (has("MOMENTUM_MAX") && v("MOMENTUM_MAX") <= 0) {
    problems.push(`MOMENTUM_MAX (${v("MOMENTUM_MAX")}) must be > 0`);
  }
  if (has("COEFF_EXTRA_PRINCIPAL") && v("COEFF_EXTRA_PRINCIPAL") < 0) {
    problems.push("COEFF_EXTRA_PRINCIPAL must be ≥ 0");
  }
  if (has("COEFF_SUB_CANCEL_COST") && v("COEFF_SUB_CANCEL_COST") < 0) {
    problems.push("COEFF_SUB_CANCEL_COST must be ≥ 0");
  }
  if (has("COEFF_ACTIONS_COMPLETED") && v("COEFF_ACTIONS_COMPLETED") < 0) {
    problems.push("COEFF_ACTIONS_COMPLETED must be ≥ 0");
  }

  // Band boundaries: strictly descending L1 > L2 > L3 > L4 > L5, L1 below the
  // score maximum, and L5 exactly 0.
  const bandKeys = ["BAND_L1_MIN", "BAND_L2_MIN", "BAND_L3_MIN", "BAND_L4_MIN", "BAND_L5_MIN"] as const;
  for (let i = 0; i < bandKeys.length - 1; i += 1) {
    const upper = bandKeys[i];
    const lower = bandKeys[i + 1];
    if (has(upper, lower) && v(upper) <= v(lower)) {
      problems.push(`${upper} (${v(upper)}) must be > ${lower} (${v(lower)})`);
    }
  }
  if (has("BAND_L1_MIN", "SCORE_MAX") && v("BAND_L1_MIN") >= v("SCORE_MAX")) {
    problems.push(`BAND_L1_MIN (${v("BAND_L1_MIN")}) must be < SCORE_MAX (${v("SCORE_MAX")})`);
  }
  if (has("BAND_L5_MIN", "SCORE_MIN") && v("BAND_L5_MIN") !== v("SCORE_MIN")) {
    problems.push(`BAND_L5_MIN (${v("BAND_L5_MIN")}) must equal SCORE_MIN (${v("SCORE_MIN")})`);
  }

  return problems;
}
