# Requirements Document

## Introduction

The Haunting Engine is a pure, deterministic TypeScript module located at `src/lib/haunting/`. It converts a financial snapshot — monthly income, debts, subscriptions, transactions, and a reference calendar date `now` — into a `HouseState` that drives the animated house scene in CashCrypt. The module has no side effects: no React imports, no Dexie access, no calls to `Date.now()`, and no randomness. Every threshold, weight, and band boundary is sourced exclusively from `src/lib/haunting/config.ts`. The public API is a single function, `computeHouseState(snapshot: FinancialSnapshot): HouseState`.

## Glossary

- **Haunting_Engine**: The pure TypeScript module at `src/lib/haunting/` and its public function `computeHouseState`.
- **Financial_Snapshot**: The input object containing `monthlyIncome`, `debts`, `subscriptions`, `transactions`, `events`, and `now`.
- **Structurally_Valid_Snapshot**: A Financial_Snapshot where `monthlyIncome` is a finite number ≥ 0; `debts`, `subscriptions`, `transactions`, and `events` are non-null arrays; all monetary amounts are finite numbers in [0, 1e12] (expressed in dollars at input, converted to integer cents at the Cents_Boundary); `now` is a valid calendar date string in `YYYY-MM-DD` format; and all required fields are present and of the correct type. After conversion, valid `monthlyIncome` is either 0 or ≥ 100 cents.
- **HouseState**: The output object containing `lightScore`, `baseScore`, `momentum`, `decayLevel`, `zombies`, `ghosts`, `poltergeist`, `windowBrightness`, and `levelProgress`.
- **Light_Score**: A real number in [0, 100] representing overall financial health; higher is healthier. Computed as `min(100, baseScore + momentum)`. It is a continuous value; the UI displays `Math.floor(lightScore)` alongside a breakdown such as "32 base + 6 momentum".
- **Base_Score**: The component of Light_Score derived from the static snapshot: `100 / (1 + S)`, or exactly 0 or 100 on the zero-income path. It reflects the user's current debt and subscription burden.
- **Momentum**: A bonus in [0, MOMENTUM_MAX] added to Base_Score to reflect positive financial actions taken within the 30-Day_Window. It is computed from extra principal payments, subscription cancellations, and completed exorcism actions. All coefficients and MOMENTUM_MAX live in Config. Momentum is always 0 when monthly income is below 100 cents.
- **Decay_Level**: An integer in {1, 2, 3, 4, 5} derived from the Light_Score using half-open bands; 1 is Pristine, 5 is Condemned.
- **Zombie**: A representation of one valid active subscription, with shape `{ subscriptionId: string; name: string; monthlyCost: number; usage: "often" | "rarely" | "never" }`. `monthlyCost` is expressed in integer cents.
- **Ghost**: A representation of one qualifying small-expense transaction within the 30-day window, with shape `{ transactionId: string; amount: number; description: string; category: string; date: string }`. `amount` is expressed in integer cents.
- **Poltergeist**: A merged entity present when the rolling small-expense total exceeds the threshold, with shape `{ totalAmount: number; transactionCount: number; byCategory: Record<string, number> }`. All amounts are integer cents. `byCategory` values sum exactly to `totalAmount` because integer addition is used throughout.
- **Cents_Boundary**: The single point where decimal dollar amounts from external input are converted to integer cents using `Math.round(x * 100)`. This conversion happens once at the start of `computeHouseState`, before any arithmetic. All internal sums, comparisons, and output amounts (`monthlyCost`, `totalAmount`, ghost `amount`, `byCategory` values) use integer cents. Valid `monthlyIncome` is either 0 or ≥ 100 cents ($1.00).
- **Window_Brightness**: `lightScore / 100` — a number in [0.0, 1.0] that moves monotonically with `lightScore`. It represents overall darkness of the house scene independently of decay level.
- **Level_Progress**: The fractional position of `lightScore` within its current Decay_Level's half-open band, in [0.0, 1.0]. It represents how close the house is to the next level transition.
- **Config**: The single source of truth at `src/lib/haunting/config.ts` for all weights, thresholds, momentum coefficients, and band boundaries.
- **validateConfig**: A pure exported function `validateConfig(config): string[]` that returns a list of human-readable problem descriptions, or an empty array if the config is valid. It never throws.
- **Factor_A**: Sum of minimum monthly payments of all debts divided by `monthlyIncome`.
- **Factor_B**: Sum of all debt balances divided by annual income (`monthlyIncome × 12`).
- **Factor_C**: Sum of normalized `monthlyCost` of all valid active subscriptions divided by `monthlyIncome`.
- **Normalized_MonthlyCost**: The subscription cost expressed as a monthly amount: `amount` for `monthly` cadence; `amount × (52/12)` for `weekly`; `amount / 12` for `yearly`. Cadence conversion factors are constants in Config.
- **SMALL_EXPENSE_THRESHOLD**: Config constant; a transaction qualifies as a small expense only if its `amount` is strictly greater than 0 and strictly less than this value (default 15.00).
- **POLTERGEIST_RATIO**: Config constant; the Poltergeist appears when the 30-day small-expense total is strictly greater than `POLTERGEIST_RATIO × monthlyIncome` (default 0.10).
- **FinancialEvent**: An input event object with shape `{ type: "debt_payment" | "subscription_canceled" | "exorcism_action_completed"; date: string; amountCents?: number; extraPrincipalCents?: number }`. Dates are YYYY-MM-DD. Only events whose `date` falls within the 30-Day_Window contribute to Momentum.
- **MOMENTUM_MAX**: Config constant; the maximum value Momentum can reach (default 15). Prevents Momentum from dominating the score.
- **Extra_Principal**: For a `debt_payment` event, the amount paid above the debt's `minimumMonthlyPayment` in integer cents. Stored in `extraPrincipalCents`.
- **Calendar_Date**: A date represented as a `YYYY-MM-DD` string with no time-zone component.
- **30-Day_Window**: The set of Calendar_Dates `d` such that `now − 30 days ≤ d ≤ now`, computed entirely from `now` in the Financial_Snapshot. Dates strictly after `now` are excluded.

## Requirements

### Requirement 1: Configuration as the Single Source of Truth

**User Story:** As a developer, I want all thresholds, weights, and band boundaries to live in one config file and be validated by a pure function, so that I can tune the engine safely without introducing silent misconfiguration.

#### Acceptance Criteria

1. THE Haunting_Engine SHALL read all numeric thresholds, weights, and band boundary values exclusively from the single Config module file; no numeric literal governing scoring, banding, cadence conversion, or creature spawning shall appear outside that file.
2. IF a numeric constant governing scoring, banding, cadence conversion, or creature spawning is not defined in Config, THEN THE Haunting_Engine SHALL fail at build time via a TypeScript compilation error or a configured lint rule, not at runtime.
3. THE Config SHALL export at minimum the following named constants with SCREAMING_SNAKE_CASE identifiers: `SMALL_EXPENSE_THRESHOLD`, `POLTERGEIST_RATIO`, `WEIGHT_FACTOR_A`, `WEIGHT_FACTOR_B`, `WEIGHT_FACTOR_C`, `CADENCE_WEEKLY_FACTOR`, `CADENCE_YEARLY_FACTOR`, `MOMENTUM_MAX`, `COEFF_EXTRA_PRINCIPAL`, `COEFF_SUB_CANCEL_COST`, `COEFF_ACTIONS_COMPLETED`, and the five half-open band lower boundaries `BAND_L1_MIN`, `BAND_L2_MIN`, `BAND_L3_MIN`, `BAND_L4_MIN`, `BAND_L5_MIN`.
4. THE Config module SHALL export a pure function `validateConfig(config): string[]` that returns an empty array when all constraints are satisfied, or a list of human-readable problem descriptions otherwise. `validateConfig` SHALL never throw for any input.
5. WHEN the shipped default Config is imported, calling `validateConfig` with it SHALL return an empty array. This criterion SHALL be verified by a Vitest unit test.
6. THE Haunting_Engine SHALL NOT throw at module initialization due to config values. All config validation is performed by `validateConfig` and is the caller's responsibility.

---

### Requirement 2: Light Score Computation

**User Story:** As a user, I want the app to calculate a single financial health number from my debts and subscriptions, so that the house decay level reflects my real financial situation.

#### Acceptance Criteria

1. WHEN `computeHouseState` is called with a Financial_Snapshot, THE Haunting_Engine SHALL compute Factor_A as the sum of all debt `minimumMonthlyPayment` values divided by `monthlyIncome`.
2. WHEN `computeHouseState` is called with a Financial_Snapshot, THE Haunting_Engine SHALL compute Factor_B as the sum of all debt `balance` values divided by (`monthlyIncome × 12`).
3. WHEN `computeHouseState` is called with a Financial_Snapshot, THE Haunting_Engine SHALL compute Factor_C as the sum of Normalized_MonthlyCost for all valid active subscriptions divided by `monthlyIncome`.
4. THE Haunting_Engine SHALL perform all factor arithmetic using integer cents obtained after the Cents_Boundary conversion. The factors A, B, and C are dimensionless ratios; dividing integer cents by integer cents produces a floating-point ratio that is then passed to the light score formula.
5. THE Haunting_Engine SHALL apply weights `WEIGHT_FACTOR_A`, `WEIGHT_FACTOR_B`, and `WEIGHT_FACTOR_C` from Config to the three factors, where `WEIGHT_FACTOR_A` is at least twice `WEIGHT_FACTOR_C` and `WEIGHT_FACTOR_B` is at least twice `WEIGHT_FACTOR_C`.
6. THE Haunting_Engine SHALL compute Base_Score using a formula that is strictly decreasing in the weighted sum and that never produces exactly 0 for any finite positive weighted sum. The exact formula is `100 / (1 + S)` as specified in design.md; `computeHouseState` SHALL invoke it without inlining the formula.
7. WHEN `computeHouseState` is called, THE Haunting_Engine SHALL compute Light_Score as `min(100, baseScore + momentum)`.
8. IF `monthlyIncome` is 0 and at least one debt with a non-zero balance exists or at least one valid active subscription exists, THEN THE Haunting_Engine SHALL set Light_Score to 0.
9. IF `monthlyIncome` is 0 and no debts with non-zero balances exist and no valid active subscriptions exist, THEN THE Haunting_Engine SHALL set Light_Score to 100.
10. THE Light_Score SHALL always be a finite real number in [0, 100] after clamping.

---

### Requirement 3: Momentum Computation

**User Story:** As a user, I want positive financial actions I take this month to visibly boost my light score right away, so that the house responds to my effort even before my debt balance meaningfully changes.

#### Acceptance Criteria

1. WHEN `computeHouseState` is called, THE Haunting_Engine SHALL compute Momentum by summing contributions from all FinancialEvents whose `date` falls within the 30-Day_Window.
2. THE Haunting_Engine SHALL compute the extra-principal contribution as `COEFF_EXTRA_PRINCIPAL × (sum of extraPrincipalCents for all in-window debt_payment events) / monthlyIncomeCents`.
3. THE Haunting_Engine SHALL compute the subscription-cancellation contribution as `COEFF_SUB_CANCEL_COST × (sum of amountCents for all in-window subscription_canceled events) / monthlyIncomeCents`.
4. THE Haunting_Engine SHALL compute the actions contribution as `COEFF_ACTIONS_COMPLETED × (count of in-window exorcism_action_completed events)`.
5. THE Haunting_Engine SHALL clamp Momentum to [0, MOMENTUM_MAX] after summing the three contributions.
6. IF `monthlyIncomeCents` is less than 100 (the zero-income path), THE Haunting_Engine SHALL set Momentum to 0, so that the zero-income Light_Score values defined in Requirement 2 (exactly 0 or exactly 100) are preserved.
7. FinancialEvents whose `date` is strictly outside the 30-Day_Window SHALL contribute 0 to Momentum.
8. WHEN `computeHouseState` is called, THE Haunting_Engine SHALL include `baseScore` and `momentum` as separate fields in `HouseState` so the UI can display the breakdown.
9. IF the `events` array is absent or empty, THE Haunting_Engine SHALL treat Momentum as 0 and complete without throwing.

---

### Requirement 4: Decay Level Derivation

**User Story:** As a user, I want the app to translate my health number into one of five decay levels, so that the house scene displays the correct visual state.

#### Acceptance Criteria

1. IF Light_Score is in [80, 100], THEN THE Haunting_Engine SHALL set Decay_Level to 1 (Pristine).
2. IF Light_Score is in [60, 80), THEN THE Haunting_Engine SHALL set Decay_Level to 2 (Uneasy).
3. IF Light_Score is in [40, 60), THEN THE Haunting_Engine SHALL set Decay_Level to 3 (Haunted).
4. IF Light_Score is in [20, 40), THEN THE Haunting_Engine SHALL set Decay_Level to 4 (Crumbling).
5. IF Light_Score is in [0, 20), THEN THE Haunting_Engine SHALL set Decay_Level to 5 (Condemned).
6. THE Haunting_Engine SHALL derive all band boundaries from Config.
7. IF Light_Score is outside [0, 100] due to a floating-point edge case, THEN THE Haunting_Engine SHALL clamp it to [0, 100] before deriving the Decay_Level.

---

### Requirement 5: Window Brightness and Level Progress

**User Story:** As a user, I want the house scene to reflect both my overall financial health and how far I am from the next decay level transition, so that every payment produces a visible change.

#### Acceptance Criteria

1. WHEN `computeHouseState` is called, THE Haunting_Engine SHALL compute `windowBrightness` as `lightScore / 100`, yielding a value in [0.0, 1.0].
2. `windowBrightness` SHALL be monotonically non-decreasing with respect to `lightScore`: for any two snapshots A and B where `lightScore_A ≤ lightScore_B`, `windowBrightness_A ≤ windowBrightness_B`.
3. WHEN `computeHouseState` is called, THE Haunting_Engine SHALL compute `levelProgress` as `(lightScore − bandLow) / (bandHigh − bandLow)`, where `bandLow` is the inclusive lower boundary of the current Decay_Level band and `bandHigh` is the exclusive upper boundary, except for Level 1 where `bandHigh` is 100 (inclusive) and the formula yields 1.0 when `lightScore` is exactly 100.
4. THE Haunting_Engine SHALL clamp `levelProgress` to [0.0, 1.0] to absorb any floating-point rounding errors.
5. WHEN `lightScore` equals `bandLow` for any band other than Level 1, THE Haunting_Engine SHALL set `levelProgress` to 0.0.
6. WHEN `lightScore` is exactly 100, THE Haunting_Engine SHALL set both `windowBrightness` and `levelProgress` to 1.0.

---

### Requirement 6: Zombie Generation

**User Story:** As a user, I want each valid active subscription to appear as a zombie in the house basement, so that I can visually count how many recurring charges are haunting me.

#### Acceptance Criteria

1. WHEN `computeHouseState` is called, THE Haunting_Engine SHALL produce exactly one Zombie per valid active subscription.
2. A subscription is **valid** for zombie generation if `active` is `true`, `subscriptionId` is a non-empty string, `name` is a non-empty string, `amount` is a finite number > 0, `cadence` is one of `"weekly"`, `"monthly"`, or `"yearly"`, and `usage` is one of `"often"`, `"rarely"`, or `"never"`.
3. THE Haunting_Engine SHALL compute `monthlyCost` for each valid subscription by applying the cadence conversion from Config: `amount` for `"monthly"`, `amount × CADENCE_WEEKLY_FACTOR` for `"weekly"`, `amount × CADENCE_YEARLY_FACTOR` for `"yearly"`.
4. THE Haunting_Engine SHALL produce each Zombie with shape `{ subscriptionId, name, monthlyCost, usage }` where `monthlyCost` is the computed Normalized_MonthlyCost.
5. IF a subscription has `active` set to `true` but fails any validity criterion from Acceptance Criterion 2, THEN THE Haunting_Engine SHALL exclude it from the `zombies` list and from Factor_C without throwing.
6. WHEN the `subscriptions` list is empty or contains no valid active subscriptions, THE Haunting_Engine SHALL return an empty `zombies` array.

---

### Requirement 7: Ghost Generation

**User Story:** As a user, I want each qualifying small daily expense from the last 30 calendar days to appear as a ghost orbiting my house, so that I can see my spending habits haunting me.

#### Acceptance Criteria

1. WHEN `computeHouseState` is called, THE Haunting_Engine SHALL identify every transaction whose `amount` is strictly greater than 0 and strictly less than `SMALL_EXPENSE_THRESHOLD`, and whose `date` (a Calendar_Date string) falls within the 30-Day_Window `[now − 30 days, now]`. Transactions with `amount ≤ 0` or with a `date` strictly after `now` SHALL never qualify.
2. IF no Poltergeist exists, THEN THE Haunting_Engine SHALL produce one Ghost per qualifying transaction, where each Ghost has shape `{ transactionId, amount, description, category, date }` populated from the source transaction.
3. WHEN no qualifying transactions exist, THE Haunting_Engine SHALL return an empty `ghosts` array and `null` for `poltergeist`.
4. THE Haunting_Engine SHALL determine the 30-Day_Window exclusively from `now` in the Financial_Snapshot and SHALL never call `Date.now()` or `new Date()`.
5. IF a Poltergeist exists, THEN THE Haunting_Engine SHALL return an empty `ghosts` array.

---

### Requirement 8: Poltergeist Formation

**User Story:** As a user, I want all my small-expense ghosts to merge into a Poltergeist when my overall small spending is out of control, so that the visual state escalates to signal a serious spending pattern.

#### Acceptance Criteria

1. WHEN the sum of `amount` values of all qualifying small-expense transactions — those with `amount` strictly greater than 0 and strictly less than `SMALL_EXPENSE_THRESHOLD` and `date` within the 30-Day_Window — is strictly greater than `POLTERGEIST_RATIO × monthlyIncome`, THE Haunting_Engine SHALL set `poltergeist` to a Poltergeist object with shape `{ totalAmount, transactionCount, byCategory }` where `totalAmount` equals that sum, `transactionCount` equals the count of qualifying transactions, and `byCategory` is a map from each category string to the sum of `amount` values for qualifying transactions in that category.
2. THE `byCategory` values in the Poltergeist SHALL sum exactly to `totalAmount` because all amounts are integer cents and no floating-point rounding occurs after the Cents_Boundary.
3. IF a Poltergeist is set, THEN THE Haunting_Engine SHALL set the `ghosts` array to empty.
4. IF the qualifying sum is less than or equal to `POLTERGEIST_RATIO × monthlyIncome`, THEN THE Haunting_Engine SHALL set `poltergeist` to `null`.
5. IF `monthlyIncome` is 0 and qualifying transactions exist, THEN THE Haunting_Engine SHALL set `poltergeist` to `null` and produce one Ghost per qualifying transaction.

---

### Requirement 9: Monotonicity — Debt Payment

**User Story:** As a user, I want to know that logging a payment always improves or maintains my health score, so that I am never penalized for paying down debt.

#### Acceptance Criteria

1. WHEN a new Financial_Snapshot is derived from an original by reducing one or more debt `balance` values by an amount of at least 0.01 each — with all other fields unchanged and no resulting balance going below 0 — THE Haunting_Engine SHALL produce a Light_Score greater than or equal to the Light_Score from the original snapshot.
2. IF a debt balance in a Financial_Snapshot is 0.00, THEN THE Haunting_Engine SHALL treat the debt as fully paid and assign it no downward influence on the Light_Score.
3. WHEN Light_Score is already 100 and one or more debt balances are reduced, THE Haunting_Engine SHALL keep Light_Score at 100.

---

### Requirement 10: Monotonicity — Debt Increase

**User Story:** As a user, I want to know that increasing a debt balance or minimum payment always worsens or maintains my score, so that the engine accurately reflects the financial cost of taking on more debt.

#### Acceptance Criteria

1. WHEN a new Financial_Snapshot is derived from an original by increasing any single debt's `balance` by at least 0.01 with all other fields unchanged, THE Haunting_Engine SHALL produce a Light_Score less than or equal to the Light_Score from the original snapshot.
2. WHEN a new Financial_Snapshot is derived from an original by increasing any single debt's `minimumMonthlyPayment` by at least 0.01 with all other fields unchanged, THE Haunting_Engine SHALL produce a Light_Score less than or equal to the Light_Score from the original snapshot.
3. IF a Financial_Snapshot contains a debt with a `balance` or `minimumMonthlyPayment` that is negative, THEN THE Haunting_Engine SHALL treat that value as 0 and complete without throwing.

---

### Requirement 11: Subscription Cancellation Effect

**User Story:** As a user, I want canceling a subscription to strictly improve my light score, so that the exorcism action produces a meaningful and visible reward.

#### Acceptance Criteria

1. WHEN `monthlyIncome` is strictly greater than 0 and the original Light_Score is strictly between 0 and 100, WHEN a new Financial_Snapshot is derived from the original by setting exactly one valid active subscription's `active` flag to `false` with all other fields unchanged, THE Haunting_Engine SHALL produce a Light_Score strictly greater than the original Light_Score.
2. WHEN the original Light_Score is exactly 100 and a subscription is canceled, THE Haunting_Engine SHALL keep Light_Score at 100.
3. WHEN the original Light_Score is exactly 0 and a subscription is canceled while `monthlyIncome` is 0, THE Haunting_Engine SHALL keep Light_Score at 0.
4. WHEN a new Financial_Snapshot is derived from an original by setting exactly one valid active subscription's `active` flag to `false`, THE Haunting_Engine SHALL produce a `zombies` array containing exactly one fewer entry than the original, where the missing entry is the one with the matching `subscriptionId`.
5. IF a Financial_Snapshot contains no valid active subscriptions, THEN THE Haunting_Engine SHALL return Light_Score and the `zombies` array unchanged.

---

### Requirement 12: Purity and Determinism

**User Story:** As a developer, I want `computeHouseState` to be a pure function, so that tests are deterministic, results are cacheable, and the engine never causes unexpected side effects.

#### Acceptance Criteria

1. THE Haunting_Engine SHALL produce structurally identical `HouseState` output — where structurally identical means every corresponding field has the same value under deep value equality — when called any number of times with Financial_Snapshots that have the same field values, regardless of object reference identity.
2. THE Haunting_Engine SHALL not invoke `Date.now()`, `Math.random()`, `performance.now()`, `crypto.getRandomValues()`, or any function that reads from or writes to a file, network, database, or console.
3. THE Haunting_Engine SHALL not import from React, Dexie, Next.js, or any browser API module (including DOM, Web Storage, Fetch, and Web Workers APIs).
4. THE Haunting_Engine SHALL not mutate any field of any input object, any element of any input array, or any element of the `events` array.

---

### Requirement 13: Robustness and Error Handling

**User Story:** As a developer, I want the engine to handle any structurally valid input without throwing, so that bad data from an import or edge case never crashes the application.

#### Acceptance Criteria

1. WHEN `computeHouseState` receives a Financial_Snapshot with an empty `debts` array, THE Haunting_Engine SHALL complete without throwing and return a `HouseState` where all numeric fields are finite numbers (not `NaN` or `Infinity`).
2. WHEN `computeHouseState` receives a Financial_Snapshot with an empty `subscriptions` array, THE Haunting_Engine SHALL complete without throwing and return a `HouseState` where all numeric fields are finite numbers.
3. WHEN `computeHouseState` receives a Financial_Snapshot with an empty `transactions` array, THE Haunting_Engine SHALL complete without throwing and return a `HouseState` where all numeric fields are finite numbers.
4. WHEN `computeHouseState` receives a Financial_Snapshot where all debt APR values are 0, THE Haunting_Engine SHALL complete without throwing and return a `HouseState` where all numeric fields are finite numbers.
5. IF `computeHouseState` receives a Financial_Snapshot where `monthlyIncome` is 0, THEN THE Haunting_Engine SHALL complete without throwing and return a Light_Score of 0 if any debt has a non-zero balance or any valid active subscription exists, or a Light_Score of 100 otherwise.
6. WHEN `computeHouseState` receives transaction amounts or debt balances up to 1e12, THE Haunting_Engine SHALL complete without producing `Infinity` or `NaN` in any field of the returned `HouseState` and without throwing.
7. IF `computeHouseState` receives a Financial_Snapshot where any debt balance or transaction amount is negative, THEN THE Haunting_Engine SHALL treat that value as 0 and complete without throwing.
8. WHEN `computeHouseState` receives a Financial_Snapshot where the `events` array is empty, THE Haunting_Engine SHALL complete without throwing and return Momentum of 0.
9. WHEN `computeHouseState` receives a Financial_Snapshot where all events have dates outside the 30-Day_Window, THE Haunting_Engine SHALL complete without throwing and return Momentum of 0.

---

### Requirement 14: Correctness Properties for Property-Based Testing

**User Story:** As a developer, I want a formal set of property-based acceptance criteria, so that fast-check tests can verify the engine's invariants across thousands of arbitrary valid inputs.

#### Acceptance Criteria

1. FOR ALL Structurally_Valid_Snapshots, THE Haunting_Engine SHALL return a `lightScore` in [0, 100], a `baseScore` in [0, 100], a `momentum` in [0, MOMENTUM_MAX], a Decay_Level in {1, 2, 3, 4, 5}, a `windowBrightness` in [0.0, 1.0], and a `levelProgress` in [0.0, 1.0]. *(Bounds invariant)*
2. FOR ALL Structurally_Valid_Snapshots, THE Haunting_Engine SHALL return a Decay_Level consistent with the half-open band containing `lightScore`: Level 1 for [80, 100], Level 2 for [60, 80), Level 3 for [40, 60), Level 4 for [20, 40), Level 5 for [0, 20). *(Band consistency invariant)*
3. FOR ALL Structurally_Valid_Snapshots, THE Haunting_Engine SHALL return `windowBrightness` equal to `lightScore / 100` clamped to [0.0, 1.0], and `levelProgress` equal to `(lightScore − bandLow) / (bandHigh − bandLow)` clamped to [0.0, 1.0] using the Config boundaries of the returned Decay_Level. *(Output consistency invariant)*
4. FOR ALL Structurally_Valid_Snapshots, calling THE Haunting_Engine twice with the same input SHALL produce `HouseState` objects that are structurally equal field-by-field under deep value equality. *(Determinism property)*
5. FOR ALL Structurally_Valid_Snapshots where `monthlyIncome` is strictly greater than 0 and the returned Light_Score is strictly between 0 and 100 and at least one valid active subscription with `monthlyCost ≤ 1e7` exists, WHEN a new snapshot is derived by setting exactly one such subscription's `active` field to `false` with all other fields unchanged, THE Haunting_Engine SHALL return a strictly higher Light_Score and a `zombies` array of length exactly one less. *(Subscription cancellation strict monotonicity)*
6. FOR ALL Structurally_Valid_Snapshots, WHEN a new snapshot is derived by increasing exactly one debt's `balance` by a finite positive amount ≤ 1e12 with all other fields unchanged, THE Haunting_Engine SHALL return a Light_Score less than or equal to the original. *(Debt balance increase monotonicity)*
7. FOR ALL Structurally_Valid_Snapshots, WHEN a new snapshot is derived by increasing exactly one debt's `minimumMonthlyPayment` by a finite positive amount ≤ 1e12 with all other fields unchanged, THE Haunting_Engine SHALL return a Light_Score less than or equal to the original. *(Minimum payment increase monotonicity)*
8. FOR ALL Structurally_Valid_Snapshots, WHEN a new snapshot is derived by reducing exactly one debt's `balance` by a finite positive amount such that the result remains ≥ 0 with all other fields unchanged, THE Haunting_Engine SHALL return a Light_Score greater than or equal to the original. *(Debt payment monotonicity)*
9. FOR ALL Structurally_Valid_Snapshots where `poltergeist` is `null`, THE Haunting_Engine SHALL return a `ghosts` array whose length equals the count of transactions with `amount` strictly greater than 0 and strictly less than `SMALL_EXPENSE_THRESHOLD` and `date` within the 30-Day_Window `[now − 30 days, now]`. *(Ghost conservation property)*
10. FOR ALL Structurally_Valid_Snapshots where `poltergeist` is not `null`, THE Haunting_Engine SHALL return an empty `ghosts` array and a Poltergeist whose `totalAmount` equals the sum of `amount` for all qualifying small-expense transactions, `transactionCount` equals their count, and `byCategory` values sum to `totalAmount`. *(Poltergeist conservation property)*
11. FOR ALL Structurally_Valid_Snapshots including those with zero `monthlyIncome`, empty arrays, all-zero APRs, and amounts up to 1e12, THE Haunting_Engine SHALL complete without throwing any exception. *(Robustness property)*
12. FOR ALL Structurally_Valid_Snapshots where `monthlyIncome` is 0, the `debts` array is empty, and no valid active subscriptions exist, THE Haunting_Engine SHALL return Light_Score equal to 100. *(Zero-income, zero-obligation edge case)*
13. FOR ALL pairs of Structurally_Valid_Snapshots A and B that are identical except that `lightScore_B > lightScore_A`, THE Haunting_Engine SHALL return `windowBrightness_B ≥ windowBrightness_A`. *(Window brightness monotonicity)*
14. FOR ALL Structurally_Valid_Snapshots, `Math.floor(lightScore)` SHALL belong to the same Decay_Level band as `lightScore` itself. *(Floor-score band consistency)*
15. FOR ALL Structurally_Valid_Snapshots, `momentum` SHALL be in [0, MOMENTUM_MAX] where MOMENTUM_MAX is the Config constant. *(Momentum bounds)*
16. FOR ALL Structurally_Valid_Snapshots, FinancialEvents whose `date` is strictly outside the 30-Day_Window SHALL produce the same `momentum` as a snapshot with those events removed. *(Out-of-window events have no effect)*
17. FOR ALL Structurally_Valid_Snapshots, WHEN a new snapshot is derived from the original by adding one FinancialEvent with a `date` within the 30-Day_Window and a non-negative `extraPrincipalCents` or `amountCents`, THE Haunting_Engine SHALL return a `lightScore` greater than or equal to the original. *(Adding an in-window event never lowers lightScore)*
18. FOR ALL Structurally_Valid_Snapshots, all existing monotonicity properties for `baseScore` (Req 14 AC6, AC7, AC8) SHALL hold when `momentum` is held constant, because `lightScore = min(100, baseScore + momentum)` and `baseScore` retains all prior monotonicity guarantees. *(Momentum does not break existing monotonicity)*
19. FOR ALL Structurally_Valid_Snapshots where `monthlyIncome` is 0, `momentum` SHALL equal 0 and `lightScore` SHALL equal `baseScore`. *(Zero-income momentum neutrality)*
