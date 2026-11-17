# Implementation Plan: Haunting Engine

## Overview

Implement the pure, deterministic haunting engine in `src/lib/haunting/` with TypeScript strict mode, following the dependency DAG in design.md: verification of the existing tooling, then `types.ts`, `config.ts`, `dates.ts`, `lightScore.ts`, `momentum.ts`, `decay.ts`, `zombies.ts`, `ghosts.ts`, `index.ts` (Cents_Boundary + `computeHouseState`), `testArbitraries.ts`, and finally the property, integration, robustness and static-check tests in `tests/haunting/`.

Scope limits: no UI, no Dexie, no exorcism planner. Only files listed in design.md under `src/lib/haunting/` and `tests/haunting/` are created, plus one extra static-check test, `tests/haunting/staticChecks.test.ts`. The Next.js 16 project already provides `package.json`, `tsconfig.json` and `vitest.config.ts` (with Vitest, `@vitest/coverage-v8` and `fast-check` installed), so no tooling files are created or overwritten.

Conventions (steering `conventions.md`): Node 24, npm, named exports only, no `any`, English comments, no numeric literals governing scoring, banding, cadence, windowing or spawning outside `config.ts`. Design.md's config lists the core constants; where the engine needs another number (window length of 30 days, score bounds, cents per dollar, minimum valid income of 100 cents, months per year), add a named constant to `config.ts` instead of using a literal.

Test conventions: every property test carries the tag `// Feature: haunting-engine, Property N: <property text>` and runs at least 100 iterations (`{ numRuns: 100 }` or higher). Test descriptions are plain English sentences.

## Tasks

- [x] 1. Verify the existing project tooling
  - [x] 1.1 Verify and adjust the existing `package.json`, `tsconfig.json` and `vitest.config.ts`
    - The Next.js 16 app was already scaffolded into the repo, so `package.json`, `tsconfig.json` and `vitest.config.ts` already exist. Do NOT recreate or overwrite them; only verify them and make the smallest adjustment if a check fails.
    - Verify `tsconfig.json` has `"strict": true`, includes the `tests/` directory (the existing `**/*.ts` glob covers it) and maps `@/*` to `src/*` in `paths`.
    - Verify `vitest.config.ts` uses the node environment, includes `tests/**/*.test.{ts,tsx}` and resolves `@/` to `src/` (a temporary probe test importing `@/...` must pass, then be deleted).
    - Verify `vitest`, `@vitest/coverage-v8` and `fast-check` are installed and that the `test` (`vitest --run`) and `typecheck` (`next typegen && tsc --noEmit`) scripts exist.
    - Verify `npm test` and `npm run typecheck` both pass.
    - Scope of the purity rule: "no Next.js, React or Dexie" applies only to imports inside `src/lib/haunting/` (enforced by `tests/haunting/staticChecks.test.ts`). It does not restrict the project's dependencies; Next.js and React are installed at the project level.
    - Status: all checks above passed on 2026-11-17 (`strict: true`, `tests/` covered by `**/*.ts`, `@/` alias resolved by the probe test, `vitest` 5.1.0, `@vitest/coverage-v8` 5.1.0 and `fast-check` 4.10.2 installed, `npm test` and `npm run typecheck` exit 0), so no file changes were needed.
    - _Requirements: 12.3, 14.4_

- [x] 2. Define types and configuration
  - [x] 2.1 Create `src/lib/haunting/types.ts`
    - Export `Cadence`, `Usage`, `InputDebt`, `InputSubscription`, `InputTransaction`, `FinancialEventType`, `FinancialEvent`, `FinancialSnapshot`, `InternalDebt`, `InternalSubscription`, `InternalTransaction`, `InternalSnapshot`, `SubscriptionInCents`, `CentsSnapshot`, `Zombie`, `Ghost`, `Poltergeist`, `HouseState` exactly as in design.md.
    - Prefer `type` aliases for plain data shapes (steering conventions); no `any`.
    - _Requirements: 2.4, 3.8, 6.4, 7.2, 8.1_

  - [x] 2.2 Create `src/lib/haunting/config.ts` with `HauntingConfig` and `validateConfig`
    - Export every constant from design.md: `WEIGHT_FACTOR_A`, `WEIGHT_FACTOR_B`, `WEIGHT_FACTOR_C`, `MOMENTUM_MAX`, `COEFF_EXTRA_PRINCIPAL`, `COEFF_SUB_CANCEL_COST`, `COEFF_ACTIONS_COMPLETED`, `BAND_L1_MIN` to `BAND_L5_MIN`, `SMALL_EXPENSE_THRESHOLD_CENTS`, `POLTERGEIST_RATIO`, `CADENCE_WEEKLY_FACTOR`, `CADENCE_YEARLY_FACTOR`.
    - Add the supporting constants the other modules need so they contain no literals: `WINDOW_DAYS` (30), `SCORE_MIN` (0), `SCORE_MAX` (100), `CENTS_PER_DOLLAR` (100), `MIN_INCOME_CENTS` (100), `MONTHS_PER_YEAR` (12).
    - Export a `HauntingConfig` type and a default `HAUNTING_CONFIG` object built from the constants.
    - Implement `validateConfig(config: HauntingConfig): string[]`: all checks from design.md plus the remaining band-order checks (`BAND_L1_MIN > BAND_L2_MIN > BAND_L3_MIN > BAND_L4_MIN > BAND_L5_MIN`, `BAND_L5_MIN === 0`). Never throws for any input, including non-finite or missing values; no module-initialisation validation.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 2.5_

  - [x] 2.3 Write unit tests for config in `tests/haunting/config.test.ts`
    - `validateConfig(HAUNTING_CONFIG)` returns `[]` (Req 1 AC5).
    - Invalid configs return non-empty problem lists: `WEIGHT_FACTOR_A < 2 × WEIGHT_FACTOR_C`, `WEIGHT_FACTOR_B < 2 × WEIGHT_FACTOR_C`, non-positive threshold, ratio and `MOMENTUM_MAX`, negative coefficients, misordered bands.
    - `validateConfig` does not throw for `NaN`, `Infinity` or missing fields.
    - Importing the config module does not throw.
    - _Requirements: 1.4, 1.5, 1.6_

- [x] 3. Implement pure date arithmetic
  - [x] 3.1 Create `src/lib/haunting/dates.ts`
    - Export `dateToJulian(yyyy, mm, dd)` and `isInWindow(date, now)` using Julian Day Number arithmetic. No imports from other files except, if needed, the window-days constant from `config.ts`; no `Date` object, no `Date.now()`.
    - The window is the `WINDOW_DAYS` calendar days ending on `now`, inclusive: `now − (WINDOW_DAYS − 1)` through `now` are inside; `now − WINDOW_DAYS` and earlier are outside; dates after `now` are outside.
    - Malformed date strings return `false` instead of throwing.
    - _Requirements: 3.1, 3.7, 7.1, 7.4, 12.2_

  - [x] 3.2 Write unit tests in `tests/haunting/dates.test.ts`
    - `now` is in the window; `now − 29` is in; `now − 30` is out; `now − 31` is out; `now + 1` is out; exactly `WINDOW_DAYS` days of a long range are inside.
    - Leap-year case (for example `now = 2024-03-01` with `2024-02-01` in and `2024-01-31` out; and a 2023 non-leap counterpart: `2023-01-31` in, `2023-01-30` out).
    - Year-boundary case (for example `now = 2025-01-10` with `2024-12-12` in and `2024-12-11` out).
    - `dateToJulian` known value (2000-01-01 → 2451545).
    - _Requirements: 3.1, 3.7, 7.1, 7.4_
  - [x] 3.3 Write module-level property tests in `tests/haunting/dates.test.ts`
    - **Property 14: Calendar arithmetic and window size**, required by the `conventions.md` Testing rule.
    - Tag `// Feature: haunting-engine, Property 14: ...`; ≥ 100 runs each; inline generator of valid calendar dates from 1900-01-01 to 2100-12-31 (no `testArbitraries.ts` yet).
    - Consecutive calendar days differ by exactly 1 in `dateToJulian`.
    - For any valid `now`, exactly `WINDOW_DAYS` dates fall inside the window, and they are `now − (WINDOW_DAYS − 1)` through `now`.
    - Dates after `now` are never inside the window.
    - Malformed strings (random strings, impossible months and days, wrong separators) never throw and make `isInWindow` return `false` on either argument.
    - _Requirements: 3.1, 3.7, 7.1, 7.4_

- [x] 4. Implement the light score base formula
  - [x] 4.1 Create `src/lib/haunting/lightScore.ts`
    - Export `computeWeightedSum(monthlyIncomeCents, debts, validActiveSubs)` returning `S = Wa·A + Wb·B + Wc·C` with A = Σ min payments / income, B = Σ balances / (income × months per year), C = Σ valid active monthly costs / income; negative values treated as 0.
    - Export `computeBaseScore(internal: InternalSnapshot)`: handle `monthlyIncomeCents < MIN_INCOME_CENTS` first (0 if any debt balance > 0 or any valid active subscription exists, otherwise 100), then `100 / (1 + S)` clamped to [0, 100]. Do not inline the formula in `index.ts`.
    - Compute Factor_C from the subscriptions' `valid` and `active` flags (do not import from `zombies.ts`, per the DAG).
    - All numbers come from `config.ts`; no division by zero.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9, 2.10, 10.3, 13.1, 13.2, 13.5, 13.7_

  - [x] 4.2 Write unit tests in `tests/haunting/lightScore.test.ts`
    - `computeWeightedSum` for hand-built internal inputs with exact expected S (for example the L1 persona: S ≈ 0.1465).
    - `computeBaseScore` returns 0 on zero income with a debt balance, 0 with a valid active subscription, and 100 with neither.
    - Negative balances and minimum payments are treated as 0.
    - Fully paid debt (balance 0) has no downward influence.
    - _Requirements: 2.1, 2.2, 2.3, 2.8, 2.9, 9.2, 10.3_

  - [x] 4.3 Write property tests for the base score formula in `tests/haunting/lightScore.test.ts`
    - **Property 13: Base score is positive and strictly decreasing in the weighted sum**
    - Tag: `// Feature: haunting-engine, Property 13: ...`; 200 runs each, using an inline realistic generator (income from `MIN_INCOME_CENTS` to $10,000, amounts ≤ 1e7 cents) until task 11.1 provides `testArbitraries.ts`.
    - Three properties: `computeBaseScore` is finite and in (0, 100] when income ≥ `MIN_INCOME_CENTS`; growing any one burden by ≥ 1 cent strictly raises S and strictly lowers the score; any two snapshots are ordered by S in reverse (pairs closer than floating-point resolution are skipped).
    - **Validates: Requirements 2.6**

- [x] 5. Implement momentum
  - [x] 5.1 Create `src/lib/haunting/momentum.ts`
    - Export `filterInWindowEvents(events, now)` (uses `isInWindow`) and `computeMomentum(events, monthlyIncomeCents, now)` following the 7 steps in design.md.
    - Returns 0 when `monthlyIncomeCents < MIN_INCOME_CENTS`; negative or non-finite event amounts contribute 0; result clamped to [0, `MOMENTUM_MAX`]; never throws; does not mutate inputs.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9, 12.4, 13.8, 13.9_

  - [x] 5.2 Write unit tests in `tests/haunting/momentum.test.ts`
    - Each contribution in isolation: extra principal ($300 on $3,000 income → 3.00), cancellation ($15.49 → ≈ 0.52), three completed actions → 3.00.
    - Clamp at `MOMENTUM_MAX`; zero-income returns 0; empty events returns 0; events outside the window (including future dates) return 0.
    - Negative and non-finite amounts contribute 0; input events array is not mutated.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9, 13.8, 13.9_

- [x] 6. Implement decay level, level progress and window brightness
  - [x] 6.1 Create `src/lib/haunting/decay.ts`
    - Export `computeDecayLevel(lightScore)`, `computeLevelProgress(lightScore, level)` and `computeWindowBrightness(lightScore)`.
    - Half-open bands from config ([80,100] → 1, [60,80) → 2, [40,60) → 3, [20,40) → 4, [0,20) → 5); clamp the score to [0, 100] first; `levelProgress` clamped to [0, 1]; level 1 uses upper bound 100 inclusive; `windowBrightness = lightScore / 100` clamped.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 6.2 Write unit tests in `tests/haunting/decay.test.ts`
    - Level for every band boundary: 100, 80, 79.999, 60, 59.999, 40, 39.999, 20, 19.999, 0.
    - Out-of-range inputs (−5, 105) are clamped.
    - `computeLevelProgress` is 0 at each band low (levels 2–5), 1.0 at score 100, and the exact fraction at a mid-band value (for example 39.50 in L4 → 0.975).
    - `computeWindowBrightness` returns 0, 0.5, 1 for scores 0, 50, 100.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 5.1, 5.3, 5.5, 5.6_
  - [x] 6.3 Write function-level property and non-finite tests in `tests/haunting/decay.test.ts`
    - **Property 2: Band consistency invariant** and **Property 3: Output consistency invariant**, stated on `computeDecayLevel`, `computeLevelProgress` and `computeWindowBrightness` directly. Tasks 12.2 and 12.3 still cover the same properties end to end through `computeHouseState`.
    - Tags `// Feature: haunting-engine, Property 2: ...` and `// Feature: haunting-engine, Property 3: ...`; 500 runs each over `fc.double` in [0, 100], integers in [0, 100] and the exact band boundaries (plus just below each).
    - Properties: the level matches the unique half-open band; `computeDecayLevel(Math.floor(s)) === computeDecayLevel(s)`; `levelProgress` is in [0, 1] and equals the position inside the band; `windowBrightness = s / 100` and is non-decreasing in `s`.
    - Unit tests: NaN → level 5, +Infinity → level 1, −Infinity → level 5; `computeLevelProgress` (for every level) and `computeWindowBrightness` return finite values in [0, 1] for those inputs.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 5.1, 5.2, 5.3, 5.4, 14.2, 14.3, 14.13, 14.14_

- [x] 7. Checkpoint - pure-math modules
  - Run `npm test` and `npm run typecheck`; ensure both pass, ask the user if questions arise.

- [x] 8. Implement subscriptions and zombies
  - [x] 8.1 Create `src/lib/haunting/zombies.ts`
    - Export `isValidSubscription`, `normalizeSubscription` (dollars already converted to cents by the caller; applies `CADENCE_WEEKLY_FACTOR` / `CADENCE_YEARLY_FACTOR` and rounds the monthly cost to integer cents), `computeZombies`, and `computeFactorC` as specified in design.md.
    - Keep money in integer cents: `Zombie.monthlyCost` is an integer.
    - Invalid-but-active subscriptions are silently excluded; returns `[]` for empty input; never throws.
    - `normalizeSubscription` accepts a `SubscriptionInCents` (already converted by the Cents_Boundary) and returns an `InternalSubscription` with `valid` set; `index.ts` performs the dollars-to-cents step before calling it. This matches design.md.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 2.3, 11.4, 11.5_

  - [x] 8.2 Write unit tests in `tests/haunting/zombies.test.ts`
    - Each cadence factor: monthly × 1, weekly × 52/12 (for example $10 weekly → 4333 cents), yearly × 1/12 (for example $120 yearly → 1000 cents).
    - Validity filter: empty id, empty name, amount ≤ 0, invalid cadence and invalid usage are each marked `valid: false` and excluded; excluded entries are also excluded from `computeFactorC`.
    - Canceled subscription (`active: false`, well-formed data): stays `valid: true`, produces no zombie and adds nothing to `computeFactorC`.
    - `computeZombies` returns one zombie per valid active subscription with shape `{ subscriptionId, name, monthlyCost, usage }` and `[]` for empty input.
    - `computeFactorC` returns 0 when income is 0 and the exact ratio otherwise.
    - Module-level properties (required by the `conventions.md` Testing rule, in addition to the end-to-end properties in task 12): tag each `// Feature: haunting-engine, Property N: ...` with ≥ 100 runs, using the matching `design.md` property number or a new numbered property added to `design.md` first; build generators inline if `testArbitraries.ts` does not exist yet.
      - `normalizeSubscription` always returns a non-negative integer `monthlyCostCents`, and subscriptions with `NaN`, `Infinity` or negative amounts come back with `valid: false` and never throw.
      - Conservation: `computeZombies` returns exactly one zombie per valid active subscription, with the same `subscriptionId`s, and never one for an invalid or inactive entry.
      - `computeFactorC` is finite and ≥ 0, is 0 when income is 0, `NaN` or below `MIN_INCOME_CENTS`, and does not change when invalid or inactive subscriptions are added.
      - No mutation: deep-frozen inputs do not throw and are unchanged after every exported function.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 2.3_

- [x] 9. Implement ghosts and the Poltergeist
  - [x] 9.1 Create `src/lib/haunting/ghosts.ts`
    - Export `isSmallExpense(amountCents)` (strictly between 0 and `SMALL_EXPENSE_THRESHOLD_CENTS`) and `computeGhostsAndPoltergeist(transactions, monthlyIncomeCents, now)` following design.md.
    - Poltergeist forms only when `monthlyIncomeCents ≥ MIN_INCOME_CENTS` and total is strictly greater than `POLTERGEIST_RATIO × monthlyIncomeCents`; then `ghosts` is `[]` and `byCategory` sums exactly to `totalAmount` (integer addition). Otherwise one ghost per qualifying transaction and `poltergeist: null`.
    - Negative amounts never qualify; future-dated transactions never qualify; inputs are not mutated.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 13.3, 13.7_

  - [x] 9.2 Write unit tests in `tests/haunting/ghosts.test.ts`
    - `isSmallExpense`: 0 and negative are false; 1 and 1499 are true; 1500 is false.
    - Window: transactions dated `now` and `now − 29` qualify; `now − 30`, `now − 31` and `now + 1` do not.
    - Below-threshold total produces one ghost per qualifying transaction and `poltergeist: null`; exactly equal to the threshold stays `null` (strict greater-than).
    - Above-threshold total produces the Poltergeist with correct `totalAmount`, `transactionCount`, `byCategory` (sum equals total) and empty `ghosts`.
    - Zero income with qualifying transactions: `poltergeist` is `null`, ghosts returned individually.
    - Empty transactions: `ghosts` is `[]` and `poltergeist` is `null`.
    - Module-level properties (required by the `conventions.md` Testing rule, in addition to the end-to-end properties in task 12): tag each `// Feature: haunting-engine, Property N: ...` with ≥ 100 runs, using the matching `design.md` property number or a new numbered property added to `design.md` first; build generators inline if `testArbitraries.ts` does not exist yet.
      - Property 8 at the function level on `computeGhostsAndPoltergeist`: with no Poltergeist, the ghost count equals the qualifying count and every ghost maps to a qualifying transaction; with a Poltergeist, `ghosts` is `[]`, `totalAmount` is the integer sum of qualifying amounts, `transactionCount` is their count and `byCategory` sums exactly to `totalAmount`.
      - Bounds: `isSmallExpense` is true only for finite amounts strictly between 0 and `SMALL_EXPENSE_THRESHOLD_CENTS`; transactions with `NaN`, `Infinity`, negative or zero amounts, or dated outside the window or in the future, never become ghosts or count toward the Poltergeist.
      - No mutation: deep-frozen transaction arrays do not throw and are unchanged.
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 10. Implement the public API and wire modules together
  - [x] 10.1 Create `src/lib/haunting/index.ts`
    - Internal (non-exported) `convertToCents(snapshot): CentsSnapshot`: the only place that calls `Math.round(x * CENTS_PER_DOLLAR)`; converts income, debt balances and minimum payments, subscription amounts and transaction amounts; sanitises negative or non-finite values to 0; passes event cents through after sanitising (non-finite or negative → 0); treats income between 1 and 99 cents as the zero-income path.
    - Export `computeHouseState(snapshot)`: convert, normalise subscriptions, `computeBaseScore`, `computeMomentum`, clamp `lightScore = min(SCORE_MAX, baseScore + momentum)` to [`SCORE_MIN`, `SCORE_MAX`], decay level, level progress, window brightness, zombies, ghosts and poltergeist, as in design.md. Do not mutate the input.
    - Re-export `validateConfig` and the types `FinancialSnapshot`, `HouseState`, `Zombie`, `Ghost`, `Poltergeist`, `FinancialEvent`.
    - No React, Dexie, Next.js or browser imports; no `Date.now()`, `new Date()` or `Math.random()`.
    - _Requirements: 2.4, 2.6, 2.7, 3.8, 4.7, 5.1, 12.1, 12.2, 12.3, 12.4, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [x] 10.2 Write unit tests for the calibration scenarios in `tests/haunting/integration.test.ts`
    - Build the five personas from the design.md calibration table (dollar inputs, empty events) and assert exact `lightScore` (to 2 decimals) and `decayLevel`: L1 → 87.22 / 1, L2 → 62.74 / 2, L3 → 42.74 / 3, L4 → 32.74 / 4, L5 → 17.07 / 5. For each, `momentum` is 0 and `baseScore === lightScore`.
    - Zero-income cases through `computeHouseState`: income 0 with a debt balance → `lightScore` 0 and level 5; income 0 with a valid active subscription → 0; income 0 with no debts and no valid active subscriptions → 100, level 1, `windowBrightness` 1, `levelProgress` 1; income of 50 cents behaves like zero income.
    - L4 exorcism before/after: canceling the $15.49 never-used subscription strictly raises the score and removes exactly that zombie.
    - Input immutability: a deep-frozen snapshot does not throw and is unchanged.
    - _Requirements: 2.6, 2.7, 2.8, 2.9, 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 11.1, 11.4, 12.4, 13.5_

  - [x] 10.3 Write unit tests for the L4 weekly-plan trajectory in `tests/haunting/momentum.test.ts`
    - Persona: L4 snapshot ($3,000 income, default demo debts and subscriptions) with the weekly plan stacked in the 30-day window: $300 extra principal on the $18,000 debt, cancel the $15.49 subscription (removed from the subscription list), and 3 completed exorcism actions per week, all dated in the window.
    - Assert exact `lightScore` (2 decimals) and `decayLevel` for weeks 1–4: 39.50 / L4, 45.73 / L3, 48.45 / L3, 48.68 / L3. Week 1 breakdown: `momentum` ≈ 6.52, base ≈ 32.99, `levelProgress` ≈ 0.98; weeks 3–4 have `momentum` equal to `MOMENTUM_MAX`.
    - The week-1 delta over the start (32.74) is within +5 and +8.
    - Task 5.2 left `momentum.test.ts` with example tests only, so this task also adds its module-level properties.
    - Module-level properties (required by the `conventions.md` Testing rule, in addition to the end-to-end properties in task 12): tag each `// Feature: haunting-engine, Property N: ...` with ≥ 100 runs, using the matching `design.md` property number or a new numbered property added to `design.md` first; build generators inline if `testArbitraries.ts` does not exist yet.
      - Properties 10 and 11 at the function level on `computeMomentum`: the result is always in [0, `MOMENTUM_MAX`]; it is 0 when income is below `MIN_INCOME_CENTS`; adding events dated outside the window (including future dates) does not change it; adding an in-window event with non-negative amounts never lowers it.
      - Robustness: events with `NaN`, `Infinity` or negative `amountCents` / `extraPrincipalCents` contribute 0 and never throw.
      - No mutation: deep-frozen event arrays do not throw and are unchanged.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.8_

  - [x] 10.4 Write the L4 Poltergeist unit test in `tests/haunting/ghosts.test.ts`
    - Through `computeHouseState`: 30 transactions of $12.00 within the window on $3,000 income gives total 36000 cents > 30000 cents, so `poltergeist` is non-null with `totalAmount` 36000, `transactionCount` 30, and `ghosts` is `[]`.
    - The same transactions at $9.00 each (27000 cents) give `poltergeist: null` and 30 ghosts.
    - _Requirements: 7.1, 7.5, 8.1, 8.3, 8.4_

- [x] 11. Create the fast-check generators
  - [x] 11.1 Create `src/lib/haunting/testArbitraries.ts`
    - Export `realisticSnapshot` and `extremeSnapshot` arbitraries, plus the derived-snapshot builders `payDebt`, `cancelSubscription`, `increaseDebtBalance`, `increaseMinimumPayment` and a `centsToSnapshot` helper that divides integer-cent values by 100 to build dollar-valued snapshots (exact Cents_Boundary round trip).
    - Bias `now` and event dates so in-window and out-of-window events are both frequent (offset in [−5, 45] days from `now`, computed with the Julian helper from `dates.ts`, no `Date.now()`).
    - Test-only: never imported by app code. Exempt from the static numeric-literal check.
    - Shared component arbitraries, also used to build the snapshot generators: `cadenceArb`, `usageArb`, `eventTypeArb`, `centsDebtArb`, `centsSubscriptionArb`, `eventPayloadArb`, `eventWithDate`, `eventOnDayArb`, plus the date helpers `julianToDate` and `shiftDays` (see design.md, "Shared exports").
    - Current users: `lightScore.test.ts` (`centsDebtArb`, `usageArb`), `momentum.test.ts` (`eventOnDayArb`), `zombies.test.ts` (`cadenceArb`, `usageArb`) and `ghosts.test.ts` (`shiftDays`). Module-specific hostile generators stay in those files. `realisticSnapshot`, `extremeSnapshot` and the derived-snapshot builders are reserved for task 12 and not imported yet.
    - _Requirements: 14.1, 14.5, 14.11_

- [x] 12. Property-based and robustness tests
  - [x] 12.1 Write property test for the bounds invariant in `tests/haunting/lightScore.test.ts`
    - **Property 1: Bounds invariant**
    - Tag: `// Feature: haunting-engine, Property 1: Bounds invariant`; ≥ 100 runs using `realisticSnapshot`.
    - Also asserts `baseScore` in [0, 100].
    - **Validates: Requirements 14.1**

  - [x] 12.2 Write property test for band consistency in `tests/haunting/decay.test.ts`
    - **Property 2: Band consistency invariant**
    - Tag: `// Feature: haunting-engine, Property 2: Band consistency invariant`; ≥ 100 runs. Includes the `Math.floor(lightScore)` same-band check.
    - **Validates: Requirements 14.2, 14.14**

  - [x] 12.3 Write property test for output consistency in `tests/haunting/decay.test.ts`
    - **Property 3: Output consistency invariant**
    - Tag: `// Feature: haunting-engine, Property 3: Output consistency invariant`; ≥ 100 runs. Checks `windowBrightness` and `levelProgress` formulas and that `windowBrightness` is monotone in `lightScore`.
    - **Validates: Requirements 14.3, 14.13**

  - [x] 12.4 Write property test for determinism in `tests/haunting/lightScore.test.ts`
    - **Property 4: Determinism**
    - Tag: `// Feature: haunting-engine, Property 4: Determinism`; ≥ 100 runs. Calls `computeHouseState` twice on a structured clone and compares with deep equality.
    - **Validates: Requirements 14.4**

  - [x] 12.5 Write property test for subscription cancellation in `tests/haunting/integration.test.ts`
    - **Property 5: Subscription cancellation strict monotonicity**
    - Tag: `// Feature: haunting-engine, Property 5: Subscription cancellation strict monotonicity`; ≥ 100 runs. Uses `fc.pre` / filtering for income > 0, score strictly in (0, 100), and a valid active subscription with `monthlyCostCents ≤ 1_000_000`; asserts strictly higher `lightScore` and one fewer zombie (the matching `subscriptionId`).
    - **Validates: Requirements 14.5**

  - [x] 12.6 Write property test for debt increase in `tests/haunting/lightScore.test.ts`
    - **Property 6: Debt increase monotonicity**
    - Tag: `// Feature: haunting-engine, Property 6: Debt increase monotonicity`; ≥ 100 runs. Covers both balance increase and minimum-payment increase.
    - **Validates: Requirements 14.6, 14.7**

  - [x] 12.7 Write property test for debt payment in `tests/haunting/integration.test.ts`
    - **Property 7: Debt payment monotonicity**
    - Tag: `// Feature: haunting-engine, Property 7: Debt payment monotonicity`; ≥ 100 runs. Includes the case where `lightScore` is already 100 and stays 100.
    - **Validates: Requirements 14.8**

  - [x] 12.8 Write property test for ghost and Poltergeist conservation in `tests/haunting/ghosts.test.ts`
    - **Property 8: Ghost-poltergeist conservation**
    - Tag: `// Feature: haunting-engine, Property 8: Ghost-poltergeist conservation`; ≥ 100 runs. Both branches: null poltergeist (ghost count equals qualifying count) and non-null poltergeist (empty ghosts, `totalAmount`, `transactionCount`, `byCategory` sum).
    - **Validates: Requirements 14.9, 14.10**

  - [x] 12.9 Write property test for robustness in `tests/haunting/robustness.test.ts`
    - **Property 9: Robustness**
    - Tag: `// Feature: haunting-engine, Property 9: Robustness`; ≥ 100 runs using `extremeSnapshot`. Asserts no throw and every numeric output field is finite.
    - **Validates: Requirements 14.11**

  - [x] 12.10 Write property test for momentum bounds in `tests/haunting/momentum.test.ts`
    - **Property 10: Momentum bounds**
    - Tag: `// Feature: haunting-engine, Property 10: Momentum bounds`; ≥ 100 runs. Momentum in [0, `MOMENTUM_MAX`], and 0 when income is 0.
    - **Validates: Requirements 14.15, 14.19**

  - [x] 12.11 Write property test for event window and monotonicity in `tests/haunting/momentum.test.ts`
    - **Property 11: Event window and monotonicity**
    - Tag: `// Feature: haunting-engine, Property 11: Event window and monotonicity`; ≥ 100 runs. Adding out-of-window or future events leaves `momentum` and `lightScore` unchanged; adding an in-window event with non-negative amounts never lowers `lightScore`.
    - **Validates: Requirements 14.16, 14.17, 14.18**

  - [x] 12.12 Write property test for the zero-income zero-obligation case in `tests/haunting/robustness.test.ts`
    - **Property 12: Zero-income zero-obligation edge case**
    - Tag: `// Feature: haunting-engine, Property 12: Zero-income zero-obligation edge case`; ≥ 100 runs. Income 0, empty debts and no valid active subscriptions give `lightScore === 100`.
    - **Validates: Requirements 14.12**

  - [x] 12.13 Write example-based robustness tests in `tests/haunting/robustness.test.ts`
    - Empty `debts`, `subscriptions`, `transactions` and `events` arrays; all-zero APRs; amounts at 1e12; negative debt balances, minimum payments and transaction amounts treated as 0; events all outside the window. Each completes without throwing and has finite numeric fields.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 10.3_

- [ ] 13. Static purity and no-magic-number check
  - [ ] 13.1 Create `tests/haunting/staticChecks.test.ts`
    - Read every `.ts` file in `src/lib/haunting/` with `node:fs`. In every file except the test-only `testArbitraries.ts`, fail on any of: `Date.now`, `new Date`, `Math.random`, `performance.now`, `crypto.getRandomValues`, `console.`, `fetch(`, `localStorage`, `window`/`document` references, and imports from `react`, `dexie`, `next` or any `next/*` module.
    - Numeric-literal rule: fail on any numeric literal other than `0`, `1` and `-1` (a negative one is the unary minus plus `1`). Exempt files: `config.ts`, `dates.ts` (the Julian Day formula is calendar arithmetic, not a tunable constant; document this exemption in a comment) and test files (`testArbitraries.ts`; files under `tests/` are not scanned at all). Ignore comments and string contents when scanning.
    - Assert that `Math.round(` combined with the cents constant appears only in `index.ts`.
    - Name each offending file and line in the failure message.
    - _Requirements: 1.1, 1.2, 12.2, 12.3, 7.4_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Run `npm test` and `npm run typecheck`; ensure both pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (property tests and extra example tests) and can be skipped for a faster MVP. Unit tests that design.md requires explicitly (calibration, weekly trajectory, Poltergeist case, zero-income, `isInWindow` boundaries, cadence factors, `validateConfig`) are not optional.
- Property tests come after `index.ts` and `testArbitraries.ts` because every property is stated on `computeHouseState`. Module-level unit tests sit directly after the module they cover.
- Each property test must run at least 100 iterations and carry the `// Feature: haunting-engine, Property N: ...` tag.
- Tasks that write to the same test file are placed in different waves of the dependency graph.
- This plan covers the engine only: no UI, Dexie or exorcism-planner code.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["2.3", "3.2", "4.1", "5.1", "6.1", "8.1", "9.1"] },
    { "id": 4, "tasks": ["3.3", "4.2", "5.2", "6.2", "8.2", "9.2", "10.1"] },
    { "id": 5, "tasks": ["4.3", "6.3", "10.2", "10.3", "10.4", "11.1", "13.1"] },
    { "id": 6, "tasks": ["12.1", "12.2", "12.5", "12.8", "12.9", "12.10"] },
    { "id": 7, "tasks": ["12.3", "12.4", "12.7", "12.11", "12.12"] },
    { "id": 8, "tasks": ["12.6", "12.13"] }
  ]
}
```
