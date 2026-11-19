# Implementation Plan: App Screens

## Overview

This plan connects the finished haunting engine and chrome primitives into a working, local-first app. Implementation language is TypeScript (the design uses TypeScript throughout). The order is fixed so the app becomes usable early: data layer first, then mutations with auto-completion, the planner, the plan service, the demo crypt (with its calibration test), hooks, the shell and Landing, and then one screen at a time, ending with the accessibility pass, steering and README updates, and two optional features (CSV, export/import).

Top-level task numbers differ from the group numbers because checkpoints take their own numbers. Each top-level title carries its group number, for example "Group 6".

Conventions that apply to every task:
- Property tests carry the tag `// Feature: app-screens, Property N: <text>` and run at least 100 iterations (`{ numRuns: 100 }`).
- Each property test lives in its own file at `tests/<area>/properties/pNN-<slug>.test.ts` so tasks in the same wave never write the same file. Database-backed properties open a fresh `openCrypt("test-" + counter, { indexedDB, IDBKeyRange })` from `fake-indexeddb` per iteration and delete it afterwards.
- Test descriptions are plain English sentences. No snapshot tests for pure functions.
- Mutation check (`conventions.md`): where a test covers a bug fix or a rule that was easy to get wrong (marked "Mutation check" below), temporarily reintroduce the bug, confirm the test fails with a counterexample or a clear assertion failure, restore the fix, confirm it passes, and record the check and the counterexample in the task summary. Leave no trace of the mutation in the code.
- The agent never starts a dev server. Manual browser checks are requested from the user.

## Tasks

- [x] 1. Group 1: Dependencies, calendar, schema, factory, adapter and engine exports
  - [x] 1.1 Install dependencies
    - Run `npm install dexie dexie-react-hooks` and `npm install -D fake-indexeddb`; confirm all three appear in `package.json` (Dexie 4 line)
    - _Requirements: 1.1_

  - [x] 1.2 Export cadence normalization and money conversion from the engine
    - In `src/lib/haunting/index.ts`, also export `normalizeSubscription`, `dollarsToCents` and the `SubscriptionInCents` type; change no computed output and add no numeric literal
    - Run `tests/haunting/staticChecks.test.ts` and the rest of `tests/haunting/` to confirm they still pass
    - _Requirements: 7.2_

  - [x] 1.3 Implement calendar utilities
    - Create `src/lib/utils/calendar.ts` with `LocalDate`, `Clock`, `getLocalDate`, `addDays`, `getPlanWeekStart`, `getWeekEnd`, `formatWeekRange`
    - Validate with a strict regex plus a real-calendar check, use `Date.UTC` arithmetic, throw `RangeError` naming the invalid value, use named constants for day-of-week values
    - _Requirements: 3.1, 3.3, 3.5, 3.6_

  - [x] 1.4 Implement cents helpers
    - Create `src/lib/utils/cents.ts` with `formatCents`, `formatCentsPerMonth`, `formatCentsShort` (money inside sentences, Requirement 28.8), `parseMoneyToCents`, `centsToMoneyText`, `aprPercentToFraction`, `aprFractionToPercent`, using integer math only (no float rounding)
    - _Requirements: 4.2, 4.9, 24.4, 28.4_

  - [x] 1.5 Write property test for day arithmetic round trip
    - **Property 1: Day arithmetic round trip**
    - **Validates: Requirements 3.3, 3.4**

  - [x] 1.6 Write property test for plan week start
    - **Property 2: Plan week start is the Monday on or before the date**
    - **Validates: Requirements 3.3, 3.5**

  - [x] 1.7 Write property test for invalid dates
    - **Property 3: Invalid dates are rejected with the offending value**
    - **Validates: Requirements 3.6**

  - [x] 1.8 Write property test for money and APR text round trip
    - **Property 27: Money and APR text round trip**
    - **Validates: Requirements 24.4, 28.4**

  - [x] 1.9 Write unit tests for calendar and cents helpers
    - Create `tests/utils/calendar.test.ts` and `tests/utils/cents.test.ts`: leap years, year boundaries, `getLocalDate` uses local fields, `$120.00` and `$3,000.00` formatting, `"300.00"` parses to 30000, invalid text returns `null`
    - _Requirements: 3.1, 3.3, 3.5, 3.6, 28.4_

  - [x] 1.10 Define shared domain types
    - Create `src/types/finance.ts` with `LocalDate`, `Cadence`, `Usage`, `ScenarioId`, `ProfileRow`, `DebtRow`, `SubscriptionRow`, `TransactionRow`, `EventRow`, `StoredPlanAction`, `WeeklyPlanRow`, `CryptRows`, `DebtInput`, `SubscriptionInput`, `TransactionInput`, with no `any`
    - Create `src/lib/exorcism/types.ts` with `ExorcismActionKind` and `ExorcismAction` (types only)
    - _Requirements: 2.5, 2.7_

  - [x] 1.11 Implement pure input validators
    - Create `src/lib/validation/limits.ts` (`MAX_MONEY_CENTS` = 100,000,000, `MIN_INCOME_CENTS_INPUT`, `MAX_NAME_LENGTH` = 60) and `src/lib/validation/inputs.ts` (`validateIncome`, `validateDebtInput`, `validateSubscriptionInput`, `validateTransactionInput`, `validatePaymentAmount`) returning `ValidationResult` with `{ field, message }` errors
    - Payment errors state the balance ("The balance is $1,800."); no React, Dexie or Next.js imports
    - _Requirements: 4.9, 5.3, 5.7, 5.8, 6.4, 6.5, 9.1, 9.2, 9.5, 9.6_

  - [x] 1.12 Write unit tests for validators
    - Create `tests/validation/inputs.test.ts`: limits at 99/100 cents income, name trimming and 60-character cap, APR 0 and 1 accepted and 1.01 rejected, future transaction date rejected, payment above balance message, non-integer and `NaN` amounts rejected
    - _Requirements: 4.9, 5.3, 5.7, 5.8, 6.4, 6.5, 9.2, 9.6_

  - [x] 1.13 Implement Dexie schema, factory and errors
    - Create `src/lib/db/schema.ts` (`CRYPT_DB_NAME` = `cashcrypt`, `DEMO_DB_NAME` = `cashcrypt-demo`, version 1 stores `profile`, `debts`, `subscriptions`, `transactions`, `events` with unique `&refKey`, `weeklyPlans` keyed by `weekKey`, re-export of `MAX_MONEY_CENTS`), `src/lib/db/crypt.ts` (`openCrypt(name, opts?)` with injectable `indexedDB` and `IDBKeyRange`, lazy `getCryptDb(name)` singleton, `assertDemoDb`, `assertRealDb`) and `src/lib/db/errors.ts` (`DbValidationError`, `DbNotFoundError`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 1.14 Implement the mode store
    - Create `src/lib/db/modeStore.ts` with `readMode`, `writeMode`, `clearMode`, `subscribeMode` for key `cashcrypt:mode`; any value other than `demo` or `real` reads as `null`; in-tab listener set plus the `storage` event
    - _Requirements: 16.7_

  - [x] 1.15 Write schema tests
    - Create `tests/db/schema.test.ts` against `fake-indexeddb`: tables and indexes exist, duplicate `weekKey` is rejected, duplicate `refKey` is rejected, many `debt_payment` events without `refKey` are allowed, real and demo names differ
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 31.1_

  - [x] 1.16 Write property test for mode store
    - **Property 32: Unknown mode values read as empty**
    - **Validates: Requirements 16.7**

  - [x] 1.17 Implement the snapshot adapter
    - Create `src/lib/db/snapshotAdapter.ts` with pure `toFinancialSnapshot(rows, now)`: cents divided by 100, inactive subscriptions and zero-balance debts kept, events passed through unchanged, income 0 without a Profile, new object returned, inputs untouched
    - Import no React, Dexie or Next.js module
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8_

  - [x] 1.18 Write property test for cents surviving the dollars boundary
    - **Property 4: Cents survive the dollars boundary**
    - **Validates: Requirements 4.2, 4.7**

  - [x] 1.19 Write property test for adapter structure and purity
    - **Property 5: The snapshot adapter preserves structure and purity**
    - **Validates: Requirements 4.1, 4.3, 4.4, 4.5, 4.6, 4.8**

- [x] 2. Group 2: Mutations with auto-completion
  - [x] 2.1 Implement queries
    - Create `src/lib/db/queries.ts` with `readAllRows(db)`, `getTransactionsInWindow(db, now)` (same boundaries as `isInWindow`, sorted by date descending then id ascending) and `getPlan(db, weekKey)`
    - _Requirements: 9.7_

  - [x] 2.2 Implement data-entry mutations
    - Create `src/lib/db/mutations.ts` with `MutationContext` (`now`, injectable `newId`), `setMonthlyIncome`, `addDebt`, `editDebt`, `addSubscription` (stores `active: true`), `editSubscription` (never changes `active`), `addTransaction` and `clearAllData` (real crypt only via `assertRealDb`)
    - Note: every profile write (in `setMonthlyIncome` and anywhere else the Profile is written) must use `id: PROFILE_ID` from `src/lib/db/schema.ts` (type `ProfileRecord`), since `ProfileRow` itself has no primary key
    - Validate first so no transaction opens on invalid input; each mutation runs in exactly one `db.transaction("rw", ...)`; throw `DbValidationError` or `DbNotFoundError`; none creates an Event
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 27.7_

  - [x] 2.3 Implement payment, cancellation and plan-action mutations with auto-completion
    - In `src/lib/db/mutations.ts` add `logPayment`, `cancelSubscription`, `reactivateSubscription`, `completePlanAction`, `uncompletePlanAction` and the internal `autoCompletePlanAction(db, kind, targetId, now)`
    - `logPayment`: reduce balance, one `debt_payment` Event with `extraPrincipalCents = max(0, amount - minimum)`, auto-complete the `extra_payment` action only when extra principal is above 0
    - `cancelSubscription`: inactive is a no-op returning `{ changed: false }`; otherwise set `active: false` and `canceledOn`, add one `subscription_canceled` Event with `refKey` `cancel:<id>` and the engine's normalized monthly cost, only when no Event has that key; then auto-complete the `cancel_subscription` action
    - Completion uses `refKey` `plan:<weekKey>:<actionId>`, creates at most one Event, keeps `completedOn` when already done; auto-completion reads `getPlanWeekStart(now)`, never generates a plan, and any throw aborts the whole transaction; the transaction table list includes `weeklyPlans`
    - _Requirements: 5.1, 5.2, 6.1, 6.2, 6.3, 6.4, 6.5, 6.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.9, 8.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12_

  - [x] 2.4 Write unit tests for every mutation
    - Create `tests/db/mutations.test.ts`: exact rows after each success, unchanged tables after each rejection, injected id generator gives stable ids, forced failure (`vi.spyOn(db.events, "add").mockRejectedValueOnce(...)`) leaves every table unchanged
    - _Requirements: 5.1, 5.2, 5.6, 31.2, 31.3_

  - [x] 2.5 Write auto-completion tests
    - Create `tests/db/autoCompletion.test.ts` with the cases of Requirement 31.7: completion by cancel, completion by payment with extra principal, no completion for extra principal 0, no second Event when ticked first, no completion and no generated plan when no plan exists, no completion for a plan of another week, full rollback when the Event write fails
    - Mutation check: temporarily remove the "extra principal above 0" condition and confirm the extra-0 case fails
    - _Requirements: 8.8, 8.9, 8.10, 8.11, 8.12, 31.7_

  - [x] 2.6 Write property test for invalid mutation input
    - **Property 6: Invalid mutation input is rejected and writes nothing**
    - **Validates: Requirements 4.9, 5.3, 5.4, 5.7, 5.8, 6.4, 6.5, 8.4, 9.1, 9.2, 9.5, 9.6**

  - [x] 2.7 Write property test for logging a payment
    - **Property 7: Logging a payment moves exactly the right rows**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.7**

  - [x] 2.8 Write property test for payment monotonicity
    - **Property 8: A payment never lowers the light score**
    - **Validates: Requirements 6.6**

  - [x] 2.9 Write property test for canceling a subscription
    - **Property 9: Canceling a subscription changes only that subscription and records one event**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.7**

  - [x] 2.10 Write property test for cancel and reactivate sequences
    - **Property 10: Cancel and reactivate sequences never farm momentum**
    - **Validates: Requirements 7.4, 7.5, 7.6, 7.7**

  - [x] 2.11 Write property test for strict score improvement on cancel
    - **Property 11: Canceling a subscription strictly raises the score**
    - **Validates: Requirements 7.8**

  - [x] 2.12 Write property test for at-most-once plan completion
    - **Property 12: Plan actions complete at most once**
    - Mutation check: temporarily remove the existing-`refKey` check and confirm the property fails with a counterexample
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.5, 8.6, 8.7, 8.13**

  - [x] 2.13 Write property test for atomic auto-completion
    - **Property 13: Auto-completion happens together with the change, or not at all**
    - Include the rollback clause by forcing the completion write to fail and comparing every table with its pre-call snapshot
    - Mutation check: temporarily make auto-completion run outside the mutation's transaction and confirm the rollback case fails
    - **Validates: Requirements 6.8, 7.9, 8.8, 8.9, 8.10, 8.11, 8.12**

  - [x] 2.14 Write property test for the 30-day transaction query
    - **Property 14: The 30-day transaction query matches the engine window**
    - **Validates: Requirements 9.7**

- [x] 3. Group 3: Planner
  - [x] 3.1 Implement the planner
    - Create `src/lib/exorcism/config.ts` (`PLAN_SIZE`, `USAGE_WEIGHTS`, basis-point constants, `MONTHS_PER_YEAR_FOR_INTEREST`, `FLOAT_NOISE_EPSILON`, `FALLBACK_KEYS`) and `src/lib/exorcism/index.ts` with `generateExorcismPlan(houseState, snapshot)`
    - Sanitize hostile numbers to 0; build cancellation, extra-payment (highest APR, ties by balance then id; 10% of income floored to whole dollars; interest saved = `round(suggested × apr / 12)`), Poltergeist (`reduce:<category>`, excess rounded up to whole dollars) and three fallback candidates; sort by `priorityCents` descending, real before fallback, then `id` ascending by code point; force the extra payment into the third slot when it ranks below the top three, then re-sort
    - Import no React, Dexie or Next.js module; never read the clock or a random source; never mutate inputs
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.10, 12.11, 12.12, 12.13, 12.15, 12.16, 12.17, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.9_

  - [x] 3.2 Write planner static checks
    - Create `tests/exorcism/staticChecks.test.ts`: no numeric literals in `src/lib/exorcism/` outside `config.ts` except 0, 1, -1; fallback ids sort in the fixed key order
    - _Requirements: 11.7, 13.5_

  - [x] 3.3 Write planner unit tests
    - Create `tests/exorcism/planner.test.ts`: exact L4 persona week 1 output of Requirement 15.9 (Wraithcast, `reduce:Coffee`, forced `pay:` action with title "Pay $300 extra on Scarlet Moth Card — saves $5.50/mo in interest"); extra payment inside the top three gives the plain top three; empty snapshot gives three fallbacks; no Poltergeist, empty `byCategory` and excess 0 give no `reduce_small_expenses`
    - _Requirements: 15.9, 15.10, 15.13_

  - [x] 3.4 Write property test for plan structure
    - **Property 15: The plan always has three distinct, sorted, pending actions**
    - Final re-sort removed as redundant: `extra` is outside the top three, so the first two non-extra actions are `ranking[0]` and `ranking[1]`, already in order. Before removing it, the generator was measured to force the extra payment in about 11% of cases (100% in the dedicated forced generator), and property 15 was confirmed to detect a wrong order (putting `extra` first fails both properties)
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.6, 13.5, 13.7, 15.2, 15.3, 15.5, 15.12**

  - [x] 3.5 Write property test for planner determinism and purity
    - **Property 16: The planner is deterministic and pure**
    - **Validates: Requirements 11.4, 11.5, 15.4, 15.7**

  - [x] 3.6 Write property test for hostile input
    - **Property 17: The planner tolerates hostile input**
    - **Validates: Requirements 11.8, 15.7**

  - [x] 3.7 Write property test for cancellation and debt targets
    - **Property 18: Cancellation and debt targets are real and scored by the formula**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.6, 12.7, 15.6**

  - [x] 3.8 Write property test for forced debt inclusion
    - **Property 19: Debt is always addressed with the right payment**
    - Mutation check: temporarily drop the forced inclusion and confirm the property fails
    - **Validates: Requirements 12.4, 12.5, 12.15, 15.11**

  - [x] 3.9 Write property test for the Poltergeist action
    - **Property 20: The Poltergeist action is precise and optional**
    - **Validates: Requirements 12.10, 12.11, 12.12, 12.13, 15.8**

  - [x] 3.10 Write property test for selection against a reference model
    - **Property 21: Selection matches the reference rule**
    - Implement a second, simple reference selection directly from Requirement 12 criteria 16 and 17 inside the test
    - **Validates: Requirements 12.16, 12.17, 13.1, 13.6, 13.9, 15.10**

  - [x] 3.11 Write property test for fallbacks
    - **Property 22: Fallbacks fill only what is missing**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.6, 13.9**

- [x] 4. Group 4: Plan service
  - [x] 4.1 Implement `ensureWeeklyPlan`
    - Create `src/lib/db/plans.ts`: one `rw` transaction over all tables; return the existing row for `getPlanWeekStart(now)` without calling the planner; otherwise adapt rows, call `computeHouseState` and `generateExorcismPlan`, and add the row with `startLightScore` and `generatedOn`; catch a primary-key `ConstraintError` and answer with a fresh `get`
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.7_

  - [x] 4.2 Write property test for one plan per week
    - **Property 23: One plan per week, unchanged once stored**
    - Include concurrent `ensureWeeklyPlan` calls per date
    - Mutation check: temporarily remove the existing-row early return and confirm the property fails
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 18.9**

  - [x] 4.3 Write plan service unit tests
    - Create `tests/db/plans.test.ts`: generated plan has three actions and the current light score as `startLightScore`; second read returns the same row without calling the planner (spy); new Monday generates a new row and keeps the old one; completing and unchecking changes only that action's `done` and `completedOn`
    - _Requirements: 14.1, 14.2, 14.3, 14.5_

- [x] 5. Group 5: Demo service and seeds with the calibration test
  - [x] 5.1 Implement scenario seeds
    - Create `src/lib/demo/seed.ts` with `buildScenario(id, demoNow)` for `level-1` to `level-5` using the fictional names of Requirement 17.11, deterministic ids (`demo:<scenario>:debt:<slug>`, `demo:<scenario>:tx:<index>`), transactions dated `addDays(demoNow, -offset)` and the `level-4` data of Requirement 17.3 and 17.4 (30 × $12.00 "Coffee" within 23 days)
    - Use no real brand name in any debt name, subscription name or transaction description
    - _Requirements: 17.1, 17.3, 17.4, 17.5, 17.6, 17.11, 17.12_

  - [x] 5.2 Implement the demo service
    - Create `src/lib/demo/service.ts` with `loadScenario`, `skipWeek`, `resetDemo`; each starts with `assertDemoDb`; `loadScenario` clears every table, bulk-adds the seed, stores `demoNow` and `scenarioId` in the Profile and runs the plan generation of `ensureWeeklyPlan` in one transaction; `skipWeek` only moves `demoNow` by 7 days; `resetDemo` reloads the current scenario with the given today
    - _Requirements: 16.3, 16.5, 17.7, 18.5, 18.6, 18.8, 18.9, 18.10_

  - [x] 5.3 Write property test for scenario determinism and scores
    - **Property 30: Scenarios are deterministic and date-independent**
    - Also assert the level-4 Poltergeist is still active at `addDays(demoNow, 7)` and exact level-4 content of Requirement 17.3 and 17.4 in `tests/demo/seed.test.ts`
    - **Validates: Requirements 17.1, 17.2, 17.4, 17.5, 17.6**

  - [x] 5.4 Write the brand-free seed scan test
    - Create `tests/demo/seedBrandScan.test.ts` with the named constant `FORBIDDEN_BRAND_NAMES` (Visa, Mastercard, Netflix, Spotify, Amazon, Apple, Disney, Hulu, YouTube) defined in the test file; read every debt name, subscription name and transaction description of all five scenarios and compare case-insensitively and by whole word; fail when any row matches
    - Mutation check: temporarily rename one seed row to contain "Netflix", confirm the scan fails and names the row, then restore it
    - _Requirements: 17.12, 31.14_

  - [x] 5.5 Write demo service tests
    - Create `tests/demo/service.test.ts`: all five scenarios give the Calibration scores after `loadScenario`; a plan is stored at load; `skipWeek` and `resetDemo` reject on the Real_Crypt and write nothing; reset shows demoNow equal to the passed today
    - _Requirements: 16.5, 17.2, 17.7, 18.5, 18.8, 31.5_

  - [x] 5.6 Write property test for demo isolation
    - **Property 29: Demo operations never touch the real crypt**
    - **Validates: Requirements 16.1, 16.3, 16.4, 16.5, 16.6**

  - [x] 5.7 Write property test for skipping a week
    - **Property 31: Skipping a week only moves the date**
    - **Validates: Requirements 18.6, 18.8, 18.10**

  - [x] 5.8 Write the calibration path integration test
    - Create `tests/demo/calibration.test.ts` on `level-4` starting 2025-06-02 through the real mutations: each week read the stored plan, do what it says in stored order (`cancelSubscription` for cancellations, `logPayment` with minimum plus `suggestedAmountCents` for the extra payment, `completePlanAction` for anything not done), call `skipWeek` after week 1 only
    - Assert every action is `done` and exactly three `exorcism_action_completed` Events exist per week; print light score, base score, momentum and decay level at start, after week 1 and after week 2 (expected 32.74 / 32.74 / 0.00 / L4, then 43.49 / 33.49 / 10.00 / L3, then 49.16 / 34.16 / 15.00 / L3); assert the decay level number after week 2 is lower than at the start; require no fixed target score
    - _Requirements: 17.8, 17.9, 17.10, 31.6_

- [ ] 6. Checkpoint - Data layer, planner and demo
  - Run `npm test`, `npm run lint` and `npm run typecheck`; ensure all tests pass, ask the user if questions arise.

- [x] 7. Group 6: Hooks and CryptProvider
  - [x] 7.1 Implement `CryptProvider` and `useCrypt`
    - Create `src/hooks/useCrypt.tsx`: `useSyncExternalStore` over the mode store (server snapshot `"unknown"`), lazy opening of the two databases, status `loading | none | demo | real | unavailable` (`unavailable` when `db.open()` rejects), `hasRealProfile` from a read-only live query, `setMode`, `clearMode`; the provider accepts `{ openDb, storage, getClock }` props for tests; treat `real` without a Profile as `none`
    - `dexie-react-hooks` is imported only in `src/hooks/`
    - _Requirements: 1.2, 10.1, 10.7, 16.1, 16.7_

  - [x] 7.2 Implement `useNow`, `useCryptData` and `useHouseState`
    - Create `src/hooks/useNow.ts` (demo: Profile `demoNow`; real: `getLocalDate()` refreshed on `visibilitychange` and `focus`), `src/hooks/useCryptData.ts` (one `useLiveQuery` over every table) and `src/hooks/useHouseState.ts` (`useMemo` over `toFinancialSnapshot` and `computeHouseState`; the only source of a House_State for screens)
    - _Requirements: 3.7, 3.8, 10.2, 10.3, 10.6, 10.8_

  - [x] 7.3 Implement `useCryptActions` and `MutationResult`
    - Create `src/hooks/useCryptActions.ts` with `MutationResult` and `MutationError` (`validation`, `not-found`, `unknown`) and bound actions `setIncome`, `addDebt`, `editDebt`, `addSubscription`, `editSubscription`, `addTransaction`, `logPayment`, `cancelSubscription`, `reactivateSubscription`, `clearAll`; each injects the current `db` and `now` and maps thrown errors to results
    - _Requirements: 5.1, 5.2, 5.5, 10.4_

  - [x] 7.4 Implement `useExorcismPlan` and `useDemo`
    - Create `src/hooks/useExorcismPlan.ts` (plan for the current week, `toggleAction`, calls `ensureWeeklyPlan` from an effect when the live query reports no plan for the week) and `src/hooks/useDemo.ts` (`scenarioId`, `demoNow`, `loadScenario`, `reset`, `skipWeek`, `enterDemo` that sets the mode and seeds `level-4` when the Demo_Crypt has no Profile)
    - _Requirements: 10.4, 10.5, 14.1, 16.2, 18.4, 18.5, 18.6_

  - [x] 7.5 Create the UI test helper `renderWithCrypt`
    - Create `tests/ui/helpers/crypt.tsx`: wraps the tree in `CryptProvider` with a `fake-indexeddb` factory, an in-memory `Storage`, a fixed clock and `ToastRegion`; options `{ mode, seed, now, width }`; helper `seedReal(...)`; `vi.mock("next/navigation")` for `useRouter` and `usePathname`
    - _Requirements: 31.8, 31.9_

  - [x] 7.6 Write hook tests
    - Create `tests/ui/hooks.test.tsx`: `useHouseState` returns a new House_State after a mutation without reload, reports loading before the first query result, `useCrypt` reports `unavailable` when `open()` rejects, demo mode uses `demoNow` as now
    - _Requirements: 3.7, 3.8, 10.2, 10.3, 10.6, 10.7_

  - [x] 7.7 Write module boundary source scans
    - Create `tests/db/moduleBoundaries.test.ts`: only `src/lib/db/` imports `dexie`; only `src/hooks/` imports `dexie-react-hooks`; no `@/lib/db/` or `@/lib/demo/` import under `src/components/`; no `computeHouseState` call under `src/components/`; no `Date.now`, `new Date(` or `Math.random` under `src/lib/exorcism/` and the pure db files; no React import in `src/lib/exorcism/`, `src/lib/validation/` and the adapter; no GSAP import in this feature
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 10.8, 31.10_

  - [x] 7.8 Wire `CryptProvider` into the root layout
    - In `src/app/layout.tsx` render `<CryptProvider><ToastRegion>{children}</ToastRegion></CryptProvider>` and keep fonts and global styles unchanged
    - _Requirements: 10.1, 29.7_

- [x] 8. Group 7: Navigation shell and Landing
  - [x] 8.1 Implement the navigation shell and common components
    - Move `src/app/page.tsx` into `src/app/(app)/page.tsx` and add `src/app/(app)/layout.tsx` rendering `AppShell`; keep `src/app/styleguide/` outside the group and unchanged
    - Create `src/components/shell/{AppShell,NavLink,TabBar,Sidebar,DemoChip}.tsx` and `src/components/common/{PageHeader,Skeleton,EmptyState,StorageBlockedCard}.tsx`: one `<nav aria-label="Main">` chosen with `matchMedia("(min-width: 1024px)")`, `aria-current="page"` from `usePathname()`, 44px targets, Lucide icons 20px stroke 2 with text labels, "Demo mode" Chip with the Demo_Now date, `router.replace("/")` in an effect when no Active_Crypt on a non-root route, bottom padding for the Tab_Bar plus safe area, `max-w-content` column below 1024px and a two-column grid from 1024px, skeleton with `animate-shimmer` and `aria-busy="true"`, blocked-storage Card text of Requirement 10.7
    - _Requirements: 10.6, 10.7, 18.1, 18.7, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 29.1, 29.2, 29.3, 30.1_

  - [x] 8.2 Implement Landing, onboarding and the home route
    - Create `src/components/sheets/OnboardingSheet.tsx` (BottomSheet "Your monthly income", money Input "Monthly income", primary "Create my crypt", keeps the sheet open and sets `Input.error` from `validateIncome`), `src/components/landing/Landing.tsx` (wordmark `h1`, pitch line, one primary "Enter the demo crypt", secondary "Start my own crypt" or "Continue to my crypt" when a Real_Crypt Profile exists, link to `/styleguide`) and `src/components/screens/HomeScreen.tsx` (skeleton while loading, Landing with no Active_Crypt, otherwise a minimal `Dashboard` stub component showing the light score from `useHouseState`)
    - Make `src/app/(app)/page.tsx` export `metadata` and render `HomeScreen`; delete `tests/ui/home.page.test.tsx`
    - _Requirements: 9.2, 16.2, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 29.9, 30.1_

  - [x] 8.3 Write navigation shell tests
    - Create `tests/ui/shell.test.tsx` using `setViewportWidth`: Tab_Bar below 1024px and Sidebar from 1024px, exactly one `<nav>`, `aria-current` on the active link (and `/` matches exactly), 44px targets, redirect to `/` with no Active_Crypt on another route, "Demo mode" Chip only in demo mode, bottom padding present
    - _Requirements: 18.1, 18.7, 19.1, 19.2, 19.3, 19.4, 19.6, 31.9_

  - [x] 8.4 Write Landing tests
    - Create `tests/ui/landing.test.tsx`: wordmark and pitch render, one primary Button, "Enter the demo crypt" sets mode `demo`, seeds `level-4` and navigates to `/`, onboarding creates the Profile and sets mode `real`, income of $0.99 keeps the sheet open with an error and writes nothing, "Continue to my crypt" appears when a Profile exists, link to `/styleguide` present
    - _Requirements: 16.2, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 31.8_

- [x] 9. Group 8: Dashboard
  - [x] 9.1 Implement pure plan and score view helpers
    - Create `src/lib/utils/planView.ts` (`summarizePlan`, `getDoItTarget`, `getPaymentPrefill`, `getExtraAboveMinimum`, `getActionImpactText`, `getToastForCompletion`) and `src/lib/utils/scoreView.ts` (`getScoreDelta`, `getLevelLabel`, `getLevelAnnouncement`)
    - _Requirements: 21.2, 21.3, 21.13, 22.1, 22.3, 22.4, 22.9, 25.3, 25.4, 25.8_

  - [x] 9.2 Write property test for Do it targets and pre-fill
    - **Property 24: Do it is offered only where it can work, with a safe pre-fill**
    - **Validates: Requirements 13.8, 14.6, 22.9, 22.10, 25.3, 25.4, 25.8, 25.9**

  - [x] 9.3 Write property test for the plan summary
    - **Property 25: The plan summary adds up**
    - **Validates: Requirements 22.1, 22.4, 22.5**

  - [x] 9.4 Write property test for the weekly delta
    - **Property 26: The weekly delta appears only when the displayed score changed**
    - **Validates: Requirements 21.2, 21.3**

  - [x] 9.5 Make `ExorcismActionRow.impactText` optional
    - In `src/components/ui/ExorcismActionRow.tsx` make `impactText` optional and skip rendering the impact span when it is omitted; extend `tests/ui/ExorcismActionRow.test.tsx` with a case asserting no impact span, and confirm existing cases still pass
    - _Requirements: 22.2, 28.6_

  - [x] 9.6 Implement `LogPaymentSheet`
    - Create `src/components/sheets/LogPaymentSheet.tsx` with props `debts`, `initialDebtId?`, `prefillCents?`: Debt picker (ListRows) when several debts have a balance and none is given, debt name, balance and minimum, money Input "Payment amount" pre-filled with the minimum limited to the balance (or `prefillCents`), "$X goes above your minimum" text, primary "Save payment", error on the Input for empty, 0 or above-balance amounts while the sheet stays open, success toast "Payment saved. $X off your balance."
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9, 28.5_

  - [x] 9.7 Implement `CancelSubscriptionSheet`
    - Create `src/components/sheets/CancelSubscriptionSheet.tsx` stating "Cancel <name> — saves $X/mo" with a secondary "Keep it" and a primary "Cancel subscription" Button; on confirm call `cancelSubscription` and show the success toast "+$X/mo saved"
    - _Requirements: 23.5, 23.6, 28.5_

  - [x] 9.8 Implement `AddExpenseSheet`
    - Create `src/components/sheets/AddExpenseSheet.tsx`: money Input "Amount", text Input "What was it?", category SegmentedControl (Coffee, Food, Transport, Other), dated with `now`, errors on empty amount, 0 or empty description with the sheet kept open, toast "Ghost added: $X" below `SMALL_EXPENSE_THRESHOLD_CENTS`
    - _Requirements: 26.5, 26.6, 26.7_

  - [x] 9.9 Implement the plan card with Do it
    - Create `src/components/exorcism/ExorcismPlan.tsx` (`variant="card"` or `"page"`, owns the Do it sheets, skeleton while the plan is generated) and `src/components/exorcism/ExorcismPlanAction.tsx` (`ExorcismActionRow` id `plan-<weekKey>-<actionId>`, secondary Do it Button named `Do it: <title>` shown only when `getDoItTarget` returns a target, checkbox always usable, row disabled while its mutation runs)
    - Do it opens `CancelSubscriptionSheet` or `LogPaymentSheet` (pre-filled); the completed action appears done through Auto_Completion with no second toast; focus moves to that row's checkbox when the Do it button disappears; ticking uses `useExorcismPlan().toggleAction` with the toast of `getToastForCompletion` and the error toast "Could not save that action. Try again."
    - _Requirements: 14.6, 14.7, 22.2, 22.3, 22.6, 22.7, 22.9, 22.10, 22.11, 22.12, 28.7, 30.5_

  - [x] 9.10 Implement `DemoControls`
    - Create `src/components/demo/DemoControls.tsx`: Card with a "Level 1" to "Level 5" SegmentedControl, "Reset demo" and "Skip to next week" Buttons, toasts "Demo reset" and the new date, polite live region "Loaded demo level N"; rendered only while the Demo_Crypt is active
    - _Requirements: 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 30.3_

  - [x] 9.11 Implement `PoltergeistBanner` and `ScenePlaceholder`
    - Create `src/components/dashboard/PoltergeistBanner.tsx` (Card with Chip icon and text "A Poltergeist is haunting you: $X in small expenses in 30 days") and `src/components/dashboard/ScenePlaceholder.tsx` (visible "House scene arrives in the next update" and the level label such as "Level 4 — Crumbling")
    - _Requirements: 21.11, 21.12, 30.4_

  - [x] 9.12 Implement the Dashboard and wire it into the home route
    - Create `src/components/dashboard/Dashboard.tsx` (replace the stub from task 8.2): one `BalanceHero` `format="score"` with `showMax` and the delta from `getScoreDelta`, `LightScoreBar` with base and momentum and `caption={getNextLevelText(...)}` instead of a second score number, four QuickActions (Log payment disabled with no debt balance, Add expense, Import CSV disabled, Exorcise navigates to `/exorcism`), "This week's exorcism" Card with "See all" using `ExorcismPlan`, Poltergeist banner, scene placeholder, `DemoControls` in demo mode, visually hidden `aria-live="polite"` level announcement, at most one primary Button
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10, 21.11, 21.12, 21.13, 21.14, 21.15, 29.5, 30.3_

  - [x] 9.13 Write Dashboard tests
    - Create `tests/ui/dashboard.test.tsx` against a `fake-indexeddb` crypt: render with the L4 demo, light score and breakdown, delta appears only when floored scores differ, QuickAction order and disabled states, Poltergeist banner, placeholder text, live region, Skip to next week generates a new plan
    - Do it flows: the cancellation Do it opens the cancel sheet and the action shows done afterwards with one toast; the extra-payment Do it opens the Log payment sheet pre-filled with minimum plus $300 and shows done afterwards; no Do it on `fallback` or `reduce_small_expenses` actions; ticking works; an invalid payment keeps the sheet open
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.11, 21.12, 21.13, 21.15, 22.9, 22.10, 22.11, 31.8_

  - [x] 9.14 Write sheet tests
    - Create `tests/ui/sheets.test.tsx` covering `LogPaymentSheet` (picker, pre-fill, above-minimum text, empty, 0 and above-balance errors, focus returns to the opener on close), `CancelSubscriptionSheet` ("Keep it" writes nothing, confirm writes and toasts) and `AddExpenseSheet` (valid ghost toast, invalid fields)
    - _Requirements: 23.5, 23.6, 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 26.5, 26.6, 26.7, 30.5_

- [x] 10. Checkpoint - Dashboard and demo flow
  - Run `npm test`, `npm run lint`, `npm run typecheck` and `npm run build`; ensure all pass and fix any failure. The agent does not start a dev server.
  - Ask the user to do a manual browser check by running `npm run dev` in their own terminal: open the app, press "Enter the demo crypt", confirm the Dashboard shows the light score (32 at level 4) and "This week's exorcism" with three actions, tick one action and use "Do it" on another, confirm the score and the done state update without a reload, then press "Skip to next week" and confirm a fresh plan appears. Wait for the user's confirmation or reported problems before continuing, ask the user if questions arise.

- [x] 11. Group 9: Exorcism screen with Do it flows
  - [x] 11.1 Implement the Exorcism screen
    - Create `src/components/screens/ExorcismScreen.tsx` and `src/app/(app)/exorcism/page.tsx` (Server Component with `metadata`): week range from `formatWeekRange`, "N of 3 done", `ExorcismPlan variant="page"` in stored order, "Money freed this week" with "of $T/mo possible" from `summarizePlan`, explanation "Tap Do it to make the change here, or tick an action you did somewhere else.", "Exorcism complete. The lights flicker back on." when all three are done, skeleton while generating, at most one primary Button
    - _Requirements: 22.1, 22.2, 22.4, 22.5, 22.8, 22.13, 28.6, 28.7, 30.1_

  - [x] 11.2 Write Exorcism screen tests
    - Create `tests/ui/exorcism.screen.test.tsx`: progress line and money freed update after ticking, completion message when all three are done, failed mutation shows "Could not save that action. Try again." and leaves the row unchanged, row disabled while saving, Do it flows for a cancellation and for an extra payment (sheet pre-filled, action done afterwards, one toast), no Do it on `fallback` and `reduce_small_expenses` actions, checkbox stays usable on actions with Do it, skeleton shown while loading
    - _Requirements: 22.1, 22.3, 22.4, 22.5, 22.6, 22.7, 22.9, 22.10, 22.11, 22.12, 31.8_

- [ ] 12. Group 10: Subscriptions
  - [ ] 12.1 Implement subscription list helpers
    - Create `src/lib/utils/listViews.ts` with `sortSubscriptionsByMonthlyCost` (using the engine's `normalizeSubscription`) and `sortDebtsByBalance`
    - _Requirements: 23.1, 24.1_

  - [ ] 12.2 Implement the Subscriptions screen
    - Create `src/components/screens/SubscriptionsScreen.tsx` and `src/app/(app)/subscriptions/page.tsx`: active rows ("Monthly · Rarely used") sorted by monthly cost with a usage Chip (icon and text), summary Card with total monthly cost, primary "Add subscription" sheet (name, amount, cadence and usage SegmentedControls, field errors for empty name and amount 0), details sheet with usage change and danger "Cancel subscription" that opens `CancelSubscriptionSheet`, Graveyard Card with "R.I.P. $X/mo" and cancellation date, "Bring it back" calling `reactivateSubscription`, empty states "No zombies in the basement. Suspiciously quiet." and "No tombstones yet. Suspiciously quiet."
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.9, 23.10, 23.11, 28.6, 30.1, 30.4_

  - [ ] 12.3 Write Subscriptions screen tests
    - Create `tests/ui/subscriptions.test.tsx`: sorted rows and subtitles, total card, empty states, add flow with toast, invalid add (empty name, amount 0) creates no row, cancel flow toast "+$120/mo saved" and graveyard entry, "Bring it back" toast, focus returns to the opener after the sheet closes
    - _Requirements: 23.1, 23.3, 23.6, 23.7, 23.8, 23.9, 23.10, 23.11, 31.8_

- [ ] 13. Group 11: Debts and Log payment sheet
  - [ ] 13.1 Implement the Debts screen
    - Create `src/components/screens/DebtsScreen.tsx` and `src/app/(app)/debts/page.tsx`: rows sorted by balance with subtitle "APR X% · Minimum $Y/mo", total debt summary Card, primary "Add debt" sheet (name, balance, APR as percent stored through `aprPercentToFraction`, minimum payment) with per-field errors, row sheet with "Edit debt" form and "Log payment" opening `LogPaymentSheet` for that debt, "Paid off" Chip with "Log payment" disabled at balance 0, empty state "No debts. The walls are holding.", edits create no Event
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9, 25.3, 28.6, 30.1, 30.4_

  - [ ] 13.2 Write Debts screen tests
    - Create `tests/ui/debts.test.tsx`: sorted rows and subtitles, total card, empty state, add flow, invalid add (empty name, negative balance, APR 101%, missing minimum) shows errors and creates no row, edit keeps the Event count unchanged, Log payment from a debt pre-fills the minimum and shows the balance drop, "Paid off" Chip and disabled button at balance 0
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9, 31.8_

- [ ] 14. Group 12: Transactions and Add expense
  - [ ] 14.1 Add transaction view helpers
    - In `src/lib/utils/listViews.ts` add `toTransactionRows(rows, now, income)` (30-day window via `isInWindow`, newest first, Ghost flag via `isSmallExpense`) and `getSmallExpenseSummary(...)` (small-expense total, Poltergeist threshold as `POLTERGEIST_RATIO` times income, awake flag)
    - _Requirements: 26.1, 26.2, 26.3_

  - [ ] 14.2 Write property test for list views
    - **Property 28: List views are permutations in the right order, with ghosts marked correctly**
    - **Validates: Requirements 23.1, 24.1, 26.1, 26.2**

  - [ ] 14.3 Implement the Transactions screen
    - Create `src/components/screens/TransactionsScreen.tsx` and `src/app/(app)/transactions/page.tsx`: summary Card (small-expense total, threshold, "The Poltergeist is awake." when active), rows with description, "category · date" subtitle and outflow amount, "Ghost" Chip with icon and text, primary "Add expense" opening `AddExpenseSheet`, empty state "No ghosts this month. The house is quiet."
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.8, 28.6, 30.1, 30.4_

  - [ ] 14.4 Write Transactions screen tests
    - Create `tests/ui/transactions.test.tsx`: window and order, Ghost chip only below the threshold, summary Card and Poltergeist text, empty state, add expense flow with "Ghost added: $X" toast and updated list, invalid expense keeps the sheet open and writes nothing
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.6, 26.7, 26.8, 31.8_

- [ ] 15. Group 13: Settings
  - [ ] 15.1 Implement the Settings screen
    - Create `src/components/screens/SettingsScreen.tsx` and `src/app/(app)/settings/page.tsx`: money Input "Monthly income" with "Save income" (toast "Income saved", error below $1.00), "Crypt" SegmentedControl (Demo crypt, My crypt) that opens the onboarding sheet when no Real_Crypt Profile exists, `DemoControls` while in demo mode, "Clear all data" with a confirmation sheet that calls `clearAll` and returns to Landing, disabled with the hint "Switch to your own crypt to use this." while the Demo_Crypt is active, no sound toggle
    - _Requirements: 9.2, 27.1, 27.2, 27.3, 27.4, 27.5, 27.7, 27.8, 27.9, 30.1_

  - [ ] 15.2 Write Settings screen tests
    - Create `tests/ui/settings.test.tsx`: income save toast and invalid income error, crypt switch updates the mode store, onboarding opens when switching to "My crypt" without a Profile, clear all data confirmation empties only the real crypt and returns to Landing, clear control disabled with the hint in demo mode, Demo controls shown only in demo mode, no sound toggle
    - _Requirements: 9.2, 27.1, 27.2, 27.3, 27.4, 27.5, 27.7, 27.8, 27.9, 31.8_

- [ ] 16. Checkpoint - All screens
  - Run `npm test`, `npm run lint`, `npm run typecheck` and `npm run build`; ensure all pass, ask the user if questions arise.

- [ ] 17. Group 14: Final axe and keyboard pass, steering and README updates
  - [ ] 17.1 Write the axe test for every screen
    - Create `tests/ui/screens.axe.test.tsx` using `expectNoAxeViolations` for Landing, Dashboard, Exorcism, Subscriptions, Debts, Transactions and Settings in the states "empty real crypt", "populated real crypt", "demo level 4" and "loading"; fix any violation found in the screens
    - _Requirements: 30.1, 30.2, 30.7_

  - [ ] 17.2 Write the keyboard operability test
    - Create `tests/ui/keyboard.test.tsx` with `user-event`: Tab reaches every Tab_Bar and Sidebar link, every sheet traps focus, Escape closes it and focus returns to the opener, forms submit with Enter, the Do it button and checkbox are reachable and operable; fix any gap found
    - _Requirements: 19.4, 30.5, 30.6_

  - [ ] 17.3 Update `structure.md`
    - In `.kiro/steering/structure.md` add `src/components/{shell,common,landing,dashboard,sheets,settings,screens,demo}/`, `src/lib/validation/`, `src/lib/utils/{calendar,cents,planView,scoreView,listViews}.ts`, `src/hooks/useCrypt.tsx` and the other hooks, `src/app/(app)/`, `tests/db/`, `tests/demo/`, `tests/validation/`, and the `tests/<area>/properties/` convention; update the "Built so far" sentence
    - _Requirements: 29.9_

  - [ ] 17.4 Update the README
    - In `README.md` describe the working app: demo flow ("Enter the demo crypt", Skip to next week), local-first storage in two Dexie databases, the weekly plan with Do it, scripts, and a note that the house scene and sound are not built yet
    - _Requirements: 29.9_

  - [ ] 17.5 Run the full verification
    - Run `npm test`, `npm run lint`, `npm run typecheck` and `npm run build`; confirm the design-system scans (className layout-only, hex literals, tokens) and `/styleguide` tests still pass and that every property test in `tests/**/properties/` carries its `// Feature: app-screens, Property N` tag; fix failures
    - _Requirements: 29.2, 29.3, 29.9, 29.10, 31.12_

- [ ] 18. Group 15: CSV import (optional)
  - [ ]* 18.1 Implement CSV parsing and serialization
    - Create `src/lib/db/csv.ts` with pure `parseTransactionsCsv(text)` (header `date,description,category,amount`, dollars with two decimals, quoted fields with doubled quotes, `{ ok: true; rows } | { ok: false; errors: { line; message }[] }`) and `serializeTransactionsCsv(transactions)`
    - _Requirements: 32.1, 32.2_

  - [ ]* 18.2 Write property test for the CSV round trip
    - **Property 33: CSV round trip**
    - **Validates: Requirements 32.1, 32.2, 32.3, 32.5**

  - [ ]* 18.3 Implement the CSV import mutation
    - In `src/lib/db/csv.ts` add `importTransactions(db, rows, ctx)` storing all rows in one Dexie transaction with no Event, and expose `importCsv` from `useCryptActions`; add tests in `tests/db/csv.test.ts` including no write on any invalid row
    - _Requirements: 32.5, 32.6_

  - [ ]* 18.4 Implement the CSV import sheet and enable the QuickAction
    - Create `src/components/sheets/CsvImportSheet.tsx` (hidden native file input, preview of the first rows in JetBrains Mono, primary "Import N transactions", line-numbered errors, nothing imported on error) and enable the "Import CSV" QuickAction in `Dashboard.tsx`
    - _Requirements: 32.4, 32.5, 32.7_

  - [ ]* 18.5 Write CSV import UI tests
    - Create `tests/ui/csvImport.test.tsx`: valid file previews and imports with a toast, invalid row shows its line number and imports nothing, QuickAction enabled
    - _Requirements: 32.4, 32.5, 32.7_

- [ ] 19. Group 16: Export and import (optional)
  - [ ]* 19.1 Implement export serialization and validation
    - Create `src/lib/db/exportImport.ts` with pure `serializeExport(rows)` (`app: "cashcrypt"`, `version: 1`, `exportedAt`, all tables) and `parseExport(text)` validating the envelope, every row's fields, integer non-negative cents, real dates and unique ids per table, returning the first problem as a message
    - _Requirements: 33.1, 33.2, 33.5_

  - [ ]* 19.2 Write property test for export round trip and safe import
    - **Property 34: Export round trip and safe import**
    - **Validates: Requirements 33.1, 33.2, 33.3, 33.5, 33.6**

  - [ ]* 19.3 Implement export reading and replace-all import
    - In `src/lib/db/exportImport.ts` add `exportRows(db)` and `replaceAllRows(db, rows)` (one Dexie transaction, previous data kept when it fails), expose `exportData` and `importData` from `useCryptActions`; add `tests/db/exportImport.test.ts` for the file name `cashcrypt-export-YYYY-MM-DD.json` and rollback on failure
    - _Requirements: 33.4, 33.6, 33.8_

  - [ ]* 19.4 Implement the Settings export and import controls
    - In `SettingsScreen.tsx` add "Export data" (downloads the file) and "Import data" (visually hidden native file input triggered by the button, confirmation sheet, error naming the first problem, success toast with the imported counts) above "Clear all data", disabled with the hint in demo mode
    - _Requirements: 27.5, 27.6, 33.4, 33.5, 33.7, 33.8, 33.9_

  - [ ]* 19.5 Write export and import UI tests
    - Create `tests/ui/exportImport.test.tsx`: export produces the named file, valid import replaces data after confirmation and shows counts, invalid file shows the first problem and writes nothing, controls disabled in demo mode
    - _Requirements: 27.5, 27.6, 33.4, 33.5, 33.7, 33.8_

## Notes

- Tasks marked with `*` (groups 15 and 16) are optional and can be skipped without affecting the required app. All other test tasks are required because `conventions.md` makes unit and property tests part of the work.
- The three Do it sheets (`LogPaymentSheet`, `CancelSubscriptionSheet`, `AddExpenseSheet`) and `ExorcismPlan` are built in group 8 because the Dashboard plan card and quick actions need them; groups 9 to 12 reuse them.
- Property test files live in `tests/<area>/properties/` so parallel tasks never write the same file.
- Each task references specific requirements for traceability; checkpoints give incremental validation.
- Property tests validate universal correctness properties; unit and component tests validate specific examples and edge cases.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.10", "1.14"] },
    { "id": 1, "tasks": ["1.5", "1.6", "1.7", "1.8", "1.9", "1.11", "1.16", "1.17"] },
    { "id": 2, "tasks": ["1.12", "1.13", "1.18", "1.19"] },
    { "id": 3, "tasks": ["1.15", "2.1", "2.2", "3.1"] },
    { "id": 4, "tasks": ["2.3", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "3.11", "4.1", "5.1"] },
    { "id": 5, "tasks": ["2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "2.12", "2.13", "2.14", "4.2", "4.3", "5.2", "5.3", "5.4"] },
    { "id": 6, "tasks": ["5.5", "5.6", "5.7", "5.8"] },
    { "id": 7, "tasks": ["7.1"] },
    { "id": 8, "tasks": ["7.2", "7.3", "7.5", "7.8"] },
    { "id": 9, "tasks": ["7.4", "8.1"] },
    { "id": 10, "tasks": ["7.6", "7.7", "8.2", "8.3"] },
    { "id": 11, "tasks": ["8.4", "9.1", "9.5"] },
    { "id": 12, "tasks": ["9.2", "9.3", "9.4", "9.6", "9.7", "9.8", "9.10", "9.11"] },
    { "id": 13, "tasks": ["9.9", "9.14"] },
    { "id": 14, "tasks": ["9.12"] },
    { "id": 15, "tasks": ["9.13"] },
    { "id": 16, "tasks": ["11.1", "12.1"] },
    { "id": 17, "tasks": ["11.2", "12.2", "13.1", "14.1", "15.1"] },
    { "id": 18, "tasks": ["12.3", "13.2", "14.2", "14.3", "15.2"] },
    { "id": 19, "tasks": ["14.4"] },
    { "id": 20, "tasks": ["17.1", "17.2", "17.3", "17.4"] },
    { "id": 21, "tasks": ["17.5", "18.1", "19.1"] },
    { "id": 22, "tasks": ["18.2", "18.3", "19.2", "19.3"] },
    { "id": 23, "tasks": ["18.4", "19.4"] },
    { "id": 24, "tasks": ["18.5", "19.5"] }
  ]
}
```
