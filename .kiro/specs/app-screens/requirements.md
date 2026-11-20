# Requirements Document

## Introduction

CashCrypt has a finished haunting engine (`src/lib/haunting/`) and a finished chrome design system (`src/components/ui/`), but no persistence, no weekly plan and no real screens. This feature connects them into a working, local-first app.

It delivers, in priority order:

1. **Data layer** (`src/lib/db/`, `src/hooks/`): a Dexie schema, atomic mutations that follow the data-layer rule in `product.md`, and a pure adapter from stored rows to the engine's `FinancialSnapshot`.
2. **Exorcism planner** (`src/lib/exorcism/`): a pure, deterministic `generateExorcismPlan` that returns exactly three distinct actions, always including the extra-payment action when one exists, stored once per calendar week. Cancellation and extra-payment actions have a "Do it" button that opens the matching sheet, and the existing cancel and payment Mutations complete the action automatically.
3. **Demo Crypt**: a second Dexie database, separate from the user's real data, with five seed scenarios, a scenario switcher, "Reset demo", a demo-only "Skip to next week" control and a visible "Demo mode" indicator.
4. **Screens**: Landing, Dashboard (`/`), `/exorcism`, `/subscriptions`, `/debts`, `/transactions`, `/settings`, and a navigation shell (bottom tab bar on mobile, sidebar from 1024px), built only from existing primitives.
5. **Tests**: data-layer tests with `fake-indexeddb`, adapter and planner properties, component and integration tests per screen, and an axe check on every screen.

Out of scope: the house SVG scene and every GSAP moment (the Dashboard shows a clearly marked placeholder), the sound toggle, accounts and sync, and bank integrations. Two requirements are optional and come last, in this order: CSV import (Requirement 32) and JSON export and import (Requirement 33). "Clear all data" is required and stays in Settings (Requirement 27).

All code, comments, tests and UI text are in English. Money is stored and computed as integer cents; the engine receives decimal dollars through the adapter and converts back to cents at its own boundary.

### Decisions recorded by this spec

- **Demo calibration values.** The Calibration_Path (Requirement 17) follows the stored plan of each week and asserts the values that the Haunting_Engine computes through the real Mutations. The test reports them and requires that the decay level improves at least once within two weeks. No fixed target level or light score is required. For the default `level-4` demo, each of the two weekly plans contains one cancellation, one `reduce_small_expenses` action and the forced extra payment (see "Debt must always be addressed").
- **Debt must always be addressed.** WHEN an `extra_payment` candidate exists, the plan always includes it. If it would rank below the top three, it takes the third slot and the other two slots keep their priority order (the best two non-extra-payment items). Rationale: interest saved understates the structural effect that paying principal has on the house, because principal lowers the debt balance factor of the light score (factor B) and the minimum-payment pressure, not only the interest bill. Ranking by interest saved alone would let small cancellations push debt out of the plan every week. The final list is still sorted by `priorityCents`, so the forced extra payment may appear last.
- **Delta on the Dashboard.** "Delta since last week" is computed against the light score stored when the current Weekly_Plan was generated (the start of the Plan_Week), because past balances cannot be reconstructed from the current rows.
- **Plan actions do the work.** For `cancel_subscription` and `extra_payment` actions, a "Do it" button opens the matching sheet pre-filled. The existing Mutations `cancelSubscription` and `logPayment` complete the matching action of the current Weekly_Plan in their own Dexie transaction (Requirement 8). Ticking stays available for every action, for things done outside the app. `fallback` and `reduce_small_expenses` actions are completed by ticking only. A completion creates at most one `exorcism_action_completed` Event per action, whichever way it happens.
- **Current week.** The "current week" of a Mutation is `getPlanWeekStart(now)`, with `now` being the Local_Date passed to that Mutation. A Mutation never generates a Weekly_Plan; when none exists for that week, no automatic completion happens.
- **Extra-payment suggestion.** The planner suggests one extra payment, on the highest-APR debt, equal to 10% of monthly income rounded down to whole dollars (this yields $300 for the $3,000 persona). The Plan_Action stores this amount as `suggestedAmountCents`, and the "Do it" button pre-fills the Log payment sheet with the minimum monthly payment plus that amount, limited to the balance.
- **Poltergeist action rounding.** The `reduce_small_expenses` action uses the Poltergeist excess (the 30-day small-expense total minus the Poltergeist threshold) rounded up to whole dollars, and the same rounded figure is used for the title, `priorityCents` and `monthlyAmountCents`, so that title and figures agree.
- **Demo persona APRs.** Requirement 17 fixes the APR of each `level-4` debt (22%, 18% and 12%) so that the ranking by interest saved is deterministic.

## Glossary

- **App**: The CashCrypt Next.js application.
- **Crypt**: One Dexie database holding one set of user data. There are two: the Real_Crypt and the Demo_Crypt.
- **Real_Crypt**: The Dexie database named `cashcrypt` that holds the user's own data.
- **Demo_Crypt**: The Dexie database named `cashcrypt-demo` that holds demo data. It never shares tables, rows or a connection with the Real_Crypt.
- **Active_Crypt**: The Crypt selected by the Mode_Store, or none when the Mode_Store is empty.
- **Mode_Store**: A `localStorage` entry (`cashcrypt:mode`, value `demo` or `real`) that records which Crypt is active. It holds no financial data.
- **Data_Layer**: The code in `src/lib/db/`: schema, database factory, mutations, queries, optional export and import, and the Snapshot_Adapter.
- **Cents**: A non-negative integer amount of money in hundredths of a dollar. All money in the Data_Layer, the Planner and the screens is Cents until formatted for display.
- **Local_Date**: The user's local calendar date as `YYYY-MM-DD`, read from an injectable Clock function.
- **Clock**: A function `() => Local_Date` passed into every Data_Layer function that needs "now". Production code passes the real local date; tests pass a fixed date.
- **Demo_Now**: The Local_Date stored in the Demo_Crypt profile and used as "now" while the Demo_Crypt is active.
- **Profile**: The single row of a Crypt that stores monthly income in Cents, and in the Demo_Crypt also the Demo_Now and the current scenario id.
- **Debt**: A row with name, balance (Cents), APR (fraction from 0 to 1) and minimum monthly payment (Cents).
- **Subscription**: A row with name, amount (Cents per cadence period), cadence (`weekly`, `monthly`, `yearly`), usage (`often`, `rarely`, `never`) and `active`.
- **Transaction**: A row with amount (Cents), description, category and date. Only expenses are stored.
- **Event**: A row of type `debt_payment`, `subscription_canceled` or `exorcism_action_completed` with a date, optional `amountCents`, optional `extraPrincipalCents` and a reference key used for idempotency. The reference key of an `exorcism_action_completed` Event is `plan:<weekKey>:<actionId>`, and the reference key of a `subscription_canceled` Event is `cancel:<subscriptionId>`.
- **Mutation**: A Data_Layer function that changes stored data. Each Mutation runs as exactly one Dexie transaction.
- **Snapshot_Adapter**: The pure function that maps Crypt rows plus a Local_Date to the engine's `FinancialSnapshot`.
- **Haunting_Engine**: The pure engine in `src/lib/haunting/` whose public API is `computeHouseState`.
- **House_State**: The engine output (light score, base score, momentum, decay level, zombies, ghosts, Poltergeist).
- **Poltergeist**: The engine's merged small-expense monster, present when the 30-day small-expense total exceeds `POLTERGEIST_RATIO` of monthly income. Its engine fields are `totalAmount` (Cents), `transactionCount` and `byCategory` (a record of category name to Cents).
- **Poltergeist_Excess**: The amount by which `poltergeist.totalAmount` exceeds the Poltergeist threshold (`POLTERGEIST_RATIO` times monthly income in Cents), rounded up to a whole number of dollars and expressed in Cents (a multiple of 100). It is 0 when the total does not exceed the threshold.
- **Ghost**: A small expense below `SMALL_EXPENSE_THRESHOLD_CENTS` inside the 30-day window.
- **Planner**: The pure function `generateExorcismPlan(houseState, snapshot)` in `src/lib/exorcism/`.
- **Plan_Action**: One `ExorcismAction` produced by the Planner, with a stable `id`, `kind` (`cancel_subscription`, `extra_payment`, `reduce_small_expenses` or `fallback`), title, subtitle, `targetId` (optional; a subscription id, a debt id or a category name), `suggestedAmountCents` (only for `extra_payment`: the suggested extra payment), `monthlyAmountCents` (the figure shown to the user), `priorityCents` (the ranking score) and `done`.
- **Priority**: The Planner ranking score in Cents: for a cancellation, monthly cost × usage weight (`never` 1.0, `rarely` 0.6, `often` 0.2), rounded to whole Cents; for an extra payment, the monthly interest saved; for a `reduce_small_expenses` action, the Poltergeist_Excess.
- **Do_It_Button**: The "Do it" Button shown in the ExorcismActionRow area of a not-done `cancel_subscription` or `extra_payment` Plan_Action whose target still qualifies, on the Dashboard plan card and on the Exorcism Screen. It opens the matching sheet pre-filled.
- **Auto_Completion**: The completion of a Plan_Action by `cancelSubscription` or `logPayment` inside the Mutation's own Dexie transaction, as defined in Requirement 8.
- **Current_Week_Key**: `getPlanWeekStart(now)`, where `now` is the Local_Date passed to the Mutation or query.
- **Plan_Week**: A calendar week that starts on Monday, identified by the Local_Date of its Monday.
- **Weekly_Plan**: The stored row for one Plan_Week: week key, the three Plan_Actions with their `done` state, and the light score at generation time (`startLightScore`).
- **Plan_Service**: The Data_Layer code that reads or creates the Weekly_Plan of the current Plan_Week.
- **Demo_Scenario**: One of five seed datasets, one per decay level, identified `level-1` to `level-5`.
- **Calibration_Path**: The demo sequence defined in Requirement 17, in which each week does exactly what that week's stored Weekly_Plan says, in its order, and then Skip_Week runs. On `level-4`, each stored plan holds one cancellation (Wraithcast in week 1, Dirgebox in week 2), one `reduce_small_expenses` action and the forced extra payment on Scarlet Moth Card.
- **Skip_Week**: The demo-only control that advances Demo_Now by 7 days.
- **Screen**: A routed page: Landing, Dashboard, Exorcism, Subscriptions, Debts, Transactions or Settings.
- **Navigation_Shell**: The layout that provides the Tab_Bar or the Sidebar around every Screen except Landing.
- **Tab_Bar**: The bottom navigation bar shown below 1024px.
- **Sidebar**: The side navigation shown from 1024px.
- **Primitives**: The components in `src/components/ui/`.
- **Hook**: A function in `src/hooks/` that bridges the Active_Crypt (through `dexie-react-hooks`) and the Haunting_Engine for components.
- **Export_File**: The JSON document produced by the optional Settings export (Requirement 33), with `app: "cashcrypt"`, a numeric `version`, and the Crypt tables.
- **Placeholder_Area**: The labelled region on the Dashboard reserved for the house scene of the next spec.
- **Axe_Check**: The existing axe-core test helper in `tests/ui/helpers/axe.ts`.

## Requirements

### Requirement 1: Dependencies and module boundaries

**User Story:** As a maintainer, I want persistence code isolated behind clear boundaries, so that the engine, the planner and the components stay framework-agnostic and testable.

#### Acceptance Criteria

1. THE App SHALL declare `dexie` and `dexie-react-hooks` as dependencies and `fake-indexeddb` as a development dependency in `package.json`.
2. THE Data_Layer SHALL be the only code that imports `dexie`; `dexie-react-hooks` SHALL be imported only in `src/hooks/`.
3. THE Planner and the Snapshot_Adapter SHALL import no React, Dexie or Next.js module.
4. THE Components in `src/components/` SHALL read and write Crypt data only through Hooks.
5. THE App SHALL place Framer Motion imports only in `src/components/ui/` and chrome-layer components, and SHALL import no GSAP module in this feature.
6. WHEN a source-scan test runs, THE Test_Suite SHALL fail if a file outside `src/lib/db/` imports `dexie`, or if a file in `src/components/` imports from `@/lib/db/` directly.

### Requirement 2: Dexie schema and database factory

**User Story:** As a developer, I want a versioned Dexie schema created by a factory, so that the Real_Crypt, the Demo_Crypt and tests all use identical tables.

#### Acceptance Criteria

1. THE Data_Layer SHALL provide a factory that opens a Crypt by database name and returns a typed Dexie instance with the tables `profile`, `debts`, `subscriptions`, `transactions`, `events` and `weeklyPlans`.
2. THE Data_Layer SHALL declare schema version 1 with primary keys and the indexes needed for these queries: transactions by date, events by date, events by reference key, and weekly plans by week key.
3. THE Data_Layer SHALL enforce a unique index on the week key of `weeklyPlans`, so that one Plan_Week has at most one Weekly_Plan.
4. THE Data_Layer SHALL enforce a unique index on the reference key of `events`, so that one cancellation per Subscription and one completion per Plan_Action of a Plan_Week cannot be stored twice.
5. THE Data_Layer SHALL store every money field as Cents and every date field as a `YYYY-MM-DD` string.
6. THE Data_Layer SHALL name the Real_Crypt `cashcrypt` and the Demo_Crypt `cashcrypt-demo`, and SHALL expose one lazily created singleton per name for application code.
7. THE Data_Layer SHALL define row types in `src/lib/db/schema.ts` and shared domain types in `src/types/finance.ts`, with no `any` type.
8. THE Data_Layer SHALL name tables in plural camelCase.

### Requirement 3: Clock injection and calendar utilities

**User Story:** As a developer, I want "now" injected and calendar math pure, so that tests control time and the demo can move time forward.

#### Acceptance Criteria

1. THE Data_Layer SHALL provide `getLocalDate(date?: Date)` that returns the local-time year, month and day of the given date (default: the current moment) formatted as `YYYY-MM-DD`.
2. THE Data_Layer SHALL receive "now" as a Clock or a Local_Date argument in every Mutation and every query that depends on the date, and SHALL NOT read the system clock inside them.
3. THE App SHALL provide pure calendar functions `addDays(localDate, days)` and `getPlanWeekStart(localDate)` that return the Local_Date of the Monday of the week containing the argument.
4. FOR ALL valid Local_Dates and integer day offsets, `addDays(addDays(d, n), -n)` SHALL equal `d` (round-trip property).
5. FOR ALL valid Local_Dates, `getPlanWeekStart(d)` SHALL be a Monday, SHALL be no later than `d` and SHALL be no more than 6 days before `d`.
6. IF a calendar function receives a string that is not a real `YYYY-MM-DD` date, THEN THE function SHALL throw a `RangeError` whose message names the invalid value.
7. WHILE the Demo_Crypt is active, THE App SHALL use the Demo_Now as "now" for every Hook, Mutation and Screen.
8. WHILE the Real_Crypt is active, THE App SHALL use `getLocalDate()` evaluated at the time of each read or write as "now".

### Requirement 4: Snapshot adapter

**User Story:** As a developer, I want one pure mapping from stored rows to the engine input, so that every screen shows the same House_State for the same data.

#### Acceptance Criteria

1. THE Snapshot_Adapter SHALL accept the Profile, the debts, the subscriptions, the transactions, the events and a Local_Date, and SHALL return a `FinancialSnapshot` whose `now` equals the Local_Date.
2. THE Snapshot_Adapter SHALL convert every Cents value to decimal dollars by dividing by 100, so that the engine's `Math.round(x * 100)` recovers the original Cents exactly.
3. THE Snapshot_Adapter SHALL include inactive Subscriptions and Debts with a balance of 0 in the snapshot, with `active` and `balance` unchanged.
4. THE Snapshot_Adapter SHALL pass events through as engine `FinancialEvent` objects with `type`, `date`, `amountCents` and `extraPrincipalCents` unchanged, except that it SHALL omit every `subscription_canceled` Event whose Subscription (reference key `cancel:<subscriptionId>`) is currently active: cancellation momentum only counts while the Subscription stays canceled. The stored Event is kept, so canceling again restores it with its original date (Requirement 7.5).
5. THE Snapshot_Adapter SHALL preserve the count and order of debts, subscriptions and transactions, and the order of the events it passes through; the event count is the stored count minus the `subscription_canceled` Events omitted by criterion 4.
6. THE Snapshot_Adapter SHALL return a new object and SHALL leave its inputs unmodified.
7. FOR ALL generated Crypt rows with money up to the maximum money value, `Math.round(adapted.amount * 100)` SHALL equal the stored Cents for every debt balance, minimum payment, subscription amount, transaction amount and the monthly income (round-trip property).
8. WHEN the Profile does not exist, THE Snapshot_Adapter SHALL treat monthly income as 0.
9. THE Data_Layer SHALL define one maximum money value of 100,000,000 Cents ($1,000,000) as a named constant, and every input validator SHALL reject larger values.

### Requirement 5: Mutation atomicity and validation

**User Story:** As a user, I want every action to save completely or not at all, so that my balances and my light score never disagree.

#### Acceptance Criteria

1. THE Data_Layer SHALL run each Mutation inside exactly one Dexie read-write transaction that covers every table the Mutation touches, which for `logPayment`, `cancelSubscription` and `completePlanAction` includes `weeklyPlans`.
2. IF any step of a Mutation throws, THEN THE Data_Layer SHALL leave every table unchanged and SHALL surface the error to the caller.
3. IF a Mutation receives an amount that is not a finite integer of Cents greater than 0, or that exceeds the maximum money value, THEN THE Mutation SHALL reject with a validation error and SHALL write nothing.
4. IF a Mutation references a row id that does not exist, THEN THE Mutation SHALL reject with a not-found error and SHALL write nothing.
5. THE Data_Layer SHALL provide Mutations to set monthly income, add and edit a Debt, add and edit a Subscription, add a Transaction, log a payment, cancel a Subscription, reactivate a Subscription and complete or uncomplete a Plan_Action.
6. WHEN a Mutation adds a row, THE Data_Layer SHALL create its id with a generator injected through the Mutation options, so that tests produce stable ids.
7. IF a name field is empty after trimming whitespace or longer than 60 characters, THEN THE Mutation SHALL reject with a validation error.
8. IF a Debt APR is not a finite number from 0 to 1 inclusive, THEN THE Mutation SHALL reject with a validation error.

### Requirement 6: Log a payment

**User Story:** As a user, I want a logged payment to lower my debt and lift my light score, so that paying down debt visibly helps.

#### Acceptance Criteria

1. WHEN `logPayment(debtId, amountCents, now)` succeeds, THE Data_Layer SHALL reduce the Debt balance by `amountCents` and SHALL create exactly one `debt_payment` Event dated `now`, in the same Dexie transaction.
2. WHEN the payment is larger than the Debt's minimum monthly payment, THE Data_Layer SHALL set `extraPrincipalCents` on the Event to `amountCents` minus the minimum monthly payment.
3. WHEN the payment is equal to or smaller than the Debt's minimum monthly payment, THE Data_Layer SHALL set `extraPrincipalCents` to 0.
4. IF `amountCents` is greater than the Debt balance, THEN THE Data_Layer SHALL reject with a validation error that states the current balance and SHALL write nothing.
5. IF the Debt balance is 0, THEN THE Data_Layer SHALL reject the payment with a validation error and SHALL write nothing.
6. FOR ALL valid Crypts, Debts and payment amounts, the light score computed after `logPayment` SHALL be greater than or equal to the light score computed before it (monotonicity property, through the Snapshot_Adapter and `computeHouseState`).
7. FOR ALL valid payments, the sum of the Debt balance after the payment and `amountCents` SHALL equal the balance before the payment (conservation property).
8. WHEN `logPayment` succeeds with `extraPrincipalCents` above 0 on the Debt that is the target of an `extra_payment` Plan_Action of the Weekly_Plan of the Current_Week_Key, THE Data_Layer SHALL complete that Plan_Action in the same Dexie transaction, following Requirement 8 criteria 7 to 10.

### Requirement 7: Cancel a subscription

**User Story:** As a user, I want canceling a subscription to remove its zombie once and reward me once, so that momentum cannot be farmed.

#### Acceptance Criteria

1. WHEN `cancelSubscription(subscriptionId, now)` succeeds on an active Subscription, THE Data_Layer SHALL set `active` to `false` and SHALL create one `subscription_canceled` Event dated `now`, in the same Dexie transaction.
2. THE Data_Layer SHALL set the Event `amountCents` to the Subscription's monthly cost computed by the Haunting_Engine's cadence normalization, which the Haunting_Engine public API SHALL export without changing any computed output.
3. THE Data_Layer SHALL keep the canceled Subscription row, with all fields except `active` unchanged, and SHALL record the cancellation date on the row so that the graveyard can show it.
4. WHEN `cancelSubscription` is called on a Subscription that is already inactive, THE Data_Layer SHALL write nothing and SHALL resolve without error.
5. WHEN a Subscription is reactivated and canceled again, THE Data_Layer SHALL NOT create a second `subscription_canceled` Event for that Subscription.
6. WHEN `reactivateSubscription(subscriptionId, now)` succeeds, THE Data_Layer SHALL set `active` to `true`, SHALL clear the cancellation date and SHALL create no Event. In the same Dexie transaction, IF the Weekly_Plan of the Current_Week_Key has a done `cancel_subscription` Plan_Action that targets that Subscription, THEN THE Data_Layer SHALL uncomplete it (so its Do_It_Button is offered again) and SHALL leave its `exorcism_action_completed` Event in place (Requirement 8.3). From then on the Subscription's `subscription_canceled` Event no longer counts for momentum (Requirement 4.4).
7. FOR ALL valid Crypts, canceling an active valid Subscription SHALL leave every other row unchanged, except the matching Plan_Action and its `exorcism_action_completed` Event under Auto_Completion, and SHALL create at most one `subscription_canceled` Event across any sequence of repeated cancel and reactivate calls (idempotence property).
8. FOR ALL valid Crypts with income above 0 and a light score above 0 and below 100, the light score after canceling an active valid Subscription SHALL be strictly greater than before.
9. WHEN `cancelSubscription` succeeds on an active Subscription that is the target of a `cancel_subscription` Plan_Action of the Weekly_Plan of the Current_Week_Key, THE Data_Layer SHALL complete that Plan_Action in the same Dexie transaction, following Requirement 8 criteria 7 to 10.

### Requirement 8: Complete a plan action

**User Story:** As a user, I want ticking a plan action to count once, so that the weekly plan rewards effort without double counting.

#### Acceptance Criteria

1. WHEN `completePlanAction(weekKey, actionId, now)` succeeds on an action that has never been completed, THE Data_Layer SHALL set the action's `done` to `true` and its completion date to `now`, and SHALL create one `exorcism_action_completed` Event dated `now`, in the same Dexie transaction.
2. WHEN the same Plan_Action is completed again after being unchecked, THE Data_Layer SHALL set `done` to `true` and SHALL NOT create another Event.
3. WHEN `uncompletePlanAction(weekKey, actionId)` succeeds, THE Data_Layer SHALL set `done` to `false` and SHALL leave the existing Event in place.
4. IF the Weekly_Plan or the action does not exist, THEN THE Data_Layer SHALL reject with a not-found error and SHALL write nothing.
5. WHEN a Plan_Action is completed by `completePlanAction` (ticking), THE Data_Layer SHALL change no Debt, Subscription or Transaction row; those rows change only through the Mutations `logPayment` and `cancelSubscription`, which the "Do it" flow calls.
6. FOR ALL sequences of complete and uncomplete calls on one Plan_Action, the number of `exorcism_action_completed` Events for that action SHALL be 0 if it was never completed and 1 otherwise (idempotence property).
7. THE Data_Layer SHALL use the reference key `plan:<weekKey>:<actionId>` for the `exorcism_action_completed` Event, whether the action is completed by ticking or by Auto_Completion, so that both paths share one key and at most one Event exists per Plan_Action.
8. WHEN Auto_Completion applies, THE Data_Layer SHALL set the action's `done` to `true` and its completion date to `now`, and SHALL create one `exorcism_action_completed` Event dated `now`, in the same Dexie transaction as the Debt or Subscription change.
9. IF the Plan_Action is already `done`, or an Event with its reference key already exists, THEN Auto_Completion SHALL create no second Event, SHALL leave the completion date unchanged and SHALL set `done` to `true`.
10. IF no Weekly_Plan exists for the Current_Week_Key, or no Plan_Action of the matching kind has the changed row as its target, THEN THE Mutation SHALL perform no Auto_Completion, SHALL write nothing to `weeklyPlans` and SHALL NOT generate a Weekly_Plan.
11. IF any step of Auto_Completion throws, THEN THE Data_Layer SHALL roll back the whole Mutation, including the Debt or Subscription change and its Event, and SHALL surface the error.
12. WHEN `cancelSubscription` is called on an already inactive Subscription, or `logPayment` creates `extraPrincipalCents` equal to 0, THE Data_Layer SHALL perform no Auto_Completion.
13. FOR ALL sequences of `logPayment`, `cancelSubscription`, `completePlanAction` and `uncompletePlanAction` calls within one Plan_Week, the number of `exorcism_action_completed` Events per Plan_Action SHALL be at most 1 (idempotence property).

### Requirement 9: Debt, subscription, income and transaction data entry

**User Story:** As a user, I want to enter my income, debts, subscriptions and expenses manually, so that the house reflects my real finances.

#### Acceptance Criteria

1. WHEN `setMonthlyIncome(cents)` succeeds, THE Data_Layer SHALL create or update the single Profile row and SHALL accept values from 100 Cents up to the maximum money value.
2. IF the monthly income is below 100 Cents, THEN THE Data_Layer SHALL reject it with a validation error, and the Landing onboarding and the Settings screen SHALL show that error.
3. WHEN `addDebt` or `editDebt` succeeds, THE Data_Layer SHALL store name, balance, APR and minimum monthly payment, and SHALL create no Event.
4. WHEN `addSubscription` or `editSubscription` succeeds, THE Data_Layer SHALL store name, amount, cadence, usage and `active`, and SHALL create no Event.
5. WHEN `addTransaction` succeeds, THE Data_Layer SHALL store amount, description, category and a date that is not later than `now`, and SHALL create no Event.
6. IF a Transaction date is later than `now`, THEN THE Data_Layer SHALL reject it with a validation error.
7. THE Data_Layer SHALL provide queries for transactions in the 30-day window ending on a given Local_Date, sorted by date descending then by id, using the same window boundaries as `isInWindow`.

### Requirement 10: Hooks

**User Story:** As a component author, I want live hooks that return ready-to-render data, so that screens re-render when the Crypt changes.

#### Acceptance Criteria

1. THE App SHALL provide a `useCrypt` Hook that returns the Active_Crypt (`demo`, `real` or none), the Dexie instance for it and a function to switch it, reading and writing the Mode_Store.
2. THE App SHALL provide a `useHouseState` Hook that uses `useLiveQuery` to read the Active_Crypt tables, builds the snapshot with the Snapshot_Adapter and returns the House_State, the snapshot and the loading state.
3. WHEN any Active_Crypt table that feeds the snapshot changes, THE `useHouseState` Hook SHALL return an updated House_State without a page reload.
4. THE App SHALL provide a `useExorcismPlan` Hook that returns the Weekly_Plan of the current Plan_Week and the Mutations to complete and uncomplete its actions.
5. THE App SHALL provide a `useDemo` Hook that exposes the current scenario, the load-scenario, reset and Skip_Week functions and the Demo_Now.
6. WHILE a live query has not returned, THE Hooks SHALL report a loading state, and Screens SHALL render a skeleton that uses the existing skeleton-shimmer animation and sets `aria-busy="true"` on the loading region.
7. IF the browser cannot open IndexedDB, THEN THE Screens SHALL render a Card that states "Your browser is blocking local storage, so CashCrypt cannot save your crypt here." with a link to the Landing page.
8. THE `useHouseState` Hook SHALL be the only way a Screen obtains a House_State, so that no Screen calls `computeHouseState` with its own snapshot.

### Requirement 11: Planner structure and determinism

**User Story:** As a user, I want a plan with exactly three clear actions, so that I know what to do this week.

#### Acceptance Criteria

1. THE Planner SHALL return an array of exactly three Plan_Actions for every valid input.
2. THE Planner SHALL return Plan_Actions whose `id` values are pairwise distinct and are derived from the action kind and target (for example `cancel:<subscriptionId>`, `pay:<debtId>`, `reduce:<category>`, `fallback:<key>`), so that the same suggestion has the same id on every run.
3. THE Planner SHALL return Plan_Actions with `done` set to `false`.
4. THE Planner SHALL produce an identical output for identical inputs and SHALL NOT read the clock or a random source.
5. THE Planner SHALL NOT mutate its inputs.
6. THE Planner SHALL return Plan_Actions sorted by `priorityCents` non-increasing (descending), with ties broken by real candidates before fallbacks, then by `id` ascending in code-point order, and THE Planner SHALL apply this sort to the final list after the forced inclusion of Requirement 12 criterion 15, so that a forced `extra_payment` action sits at the position its `priorityCents` gives it.
7. THE Planner SHALL define every weight, ratio and fallback key as a named constant in `src/lib/exorcism/config.ts`, with no numeric literal elsewhere in the Planner.
8. IF the snapshot contains non-finite or negative numbers, THEN THE Planner SHALL treat them as 0 and SHALL still return exactly three Plan_Actions without throwing.

### Requirement 12: Planner candidates and scoring

**User Story:** As a user, I want the plan to suggest the cancellations and payments that free the most money, so that each week's effort counts.

#### Acceptance Criteria

1. THE Planner SHALL create one `cancel_subscription` candidate for each Subscription in the House_State zombie list (valid and active), with `targetId` set to the subscription id.
2. THE Planner SHALL NOT create a candidate for an inactive Subscription or for a Subscription that is not valid according to the Haunting_Engine.
3. THE Planner SHALL set a cancellation candidate's `priorityCents` to its monthly cost times the usage weight (`never` 1.0, `rarely` 0.6, `often` 0.2), rounded to whole Cents, and its `monthlyAmountCents` to the full monthly cost.
4. THE Planner SHALL create at most one `extra_payment` candidate, for the Debt with a balance above 0 that has the highest APR, with ties broken by the larger balance and then by `debtId` ascending.
5. THE Planner SHALL set the suggested extra payment to the smaller of that Debt's balance and 10% of monthly income rounded down to whole dollars, SHALL store it as the candidate's `suggestedAmountCents`, and SHALL NOT create the candidate when the suggested amount is 0 Cents.
6. THE Planner SHALL set an extra-payment candidate's `priorityCents` and `monthlyAmountCents` to the suggested extra payment times APR divided by 12, rounded to whole Cents.
7. THE Planner SHALL NOT create an extra-payment candidate for a Debt whose balance is 0.
8. THE Planner SHALL write Plan_Action titles in plain language with exact money, for example "Cancel Wraithcast — saves $120/mo" and "Pay $300 extra on Scarlet Moth Card — saves $5.50/mo in interest". Whole-dollar amounts omit ".00"; other amounts keep two decimals ("$15.49/mo").
9. THE Planner SHALL write each Plan_Action subtitle so that it names the Screen where the action is carried out ("Open Subscriptions to cancel it", "Open Debts to log the payment", "Open Transactions to review it").
10. WHILE the House_State has a Poltergeist, THE Planner SHALL create at most one `reduce_small_expenses` candidate, targeting the category with the largest value in `poltergeist.byCategory`, with ties broken by the category name that is smallest in code-point order, and ignoring categories whose value is not a finite number above 0.
11. THE Planner SHALL set the `reduce_small_expenses` candidate's `id` to `reduce:<category>`, its `targetId` to the category name, and its title to "Cut <category> by $X this month to dispel the Poltergeist", where `$X` is the Poltergeist_Excess in whole dollars without cents.
12. THE Planner SHALL compute the Poltergeist_Excess as the smallest whole-dollar amount, in Cents, that is not smaller than `poltergeist.totalAmount` minus `POLTERGEIST_RATIO` times monthly income in Cents, and SHALL set the candidate's `priorityCents` and `monthlyAmountCents` both to the Poltergeist_Excess, so that title and figures agree.
13. IF the House_State has no Poltergeist, or `poltergeist.byCategory` has no category with a finite value above 0, or the Poltergeist_Excess is 0, THEN THE Planner SHALL create no `reduce_small_expenses` candidate.
14. THE Planner SHALL write the `reduce_small_expenses` subtitle as "Open Transactions to review it. Tick it when you are done."
15. WHEN an `extra_payment` candidate exists, THE Planner SHALL include it in the output, so that debt is always addressed; this holds because interest saved understates the structural effect that paying principal has on the house.
16. WHEN an `extra_payment` candidate exists, THE Planner SHALL select the output in this way: rank every candidate and every fallback with the ordering of Requirement 11 criterion 6; IF the `extra_payment` candidate is within the first three of that ranking, THEN THE Planner SHALL return those three Plan_Actions unchanged; OTHERWISE THE Planner SHALL return the first two Plan_Actions of that ranking that are not `extra_payment` actions, plus the `extra_payment` candidate, and SHALL then sort the three by Requirement 11 criterion 6.
17. THE Planner SHALL treat `reduce_small_expenses` candidates as ordinary non-extra items in criterion 16, so that a `reduce_small_expenses` candidate keeps its slot when it ranks among the best two non-extra items and gives up its slot only when two other non-extra items outrank it.

### Requirement 13: Planner fallbacks

**User Story:** As a user with few subscriptions or debts, I still want three useful actions, so that the weekly plan is never empty.

#### Acceptance Criteria

1. WHEN fewer than three candidates exist (counting the `extra_payment` candidate, the `cancel_subscription` candidates and the `reduce_small_expenses` candidate), THE Planner SHALL fill the remaining slots with `fallback` Plan_Actions taken in a fixed order from a list of at least three, each with a distinct key.
2. THE fallback list SHALL contain "Set aside $X for an emergency fund", "Review last week's small expenses" and "Review your subscription list".
3. THE Planner SHALL compute `$X` as 5% of monthly income rounded down to whole dollars, and WHEN that amount is 0 THE Planner SHALL use the title "Set aside a small amount for an emergency fund".
4. THE Planner SHALL set a fallback's `priorityCents` and `monthlyAmountCents` to 0.
5. WHEN a candidate and a fallback have the same `priorityCents`, THE Planner SHALL rank the candidate first.
6. WHEN there are three or more candidates, THE Planner SHALL include no fallback, because a fallback has `priorityCents` 0 and a candidate wins every tie against a fallback; this holds also when the `extra_payment` candidate is forced in, since the other two slots are then filled by candidates or by fallbacks only when fewer than two non-extra candidates exist.
7. FOR ALL valid inputs, the fallbacks in the output SHALL appear after every candidate with a larger `priorityCents` and after the `extra_payment` Plan_Action when one is present.
8. THE App SHALL offer no Do_It_Button for a `fallback` or a `reduce_small_expenses` Plan_Action, which the user completes by ticking only.
9. WHEN an `extra_payment` candidate exists and fewer than two non-extra candidates exist, THE Planner SHALL fill the remaining non-extra slots with fallbacks in their fixed order, and the `extra_payment` Plan_Action SHALL stay in the output.

### Requirement 14: Weekly plan persistence

**User Story:** As a user, I want this week's plan to stay the same while I work through it, so that ticking an action does not reshuffle my list.

#### Acceptance Criteria

1. WHEN a Screen needs the plan and no Weekly_Plan exists for the current Plan_Week of the Active_Crypt, THE Plan_Service SHALL generate one with the Planner from the current House_State and snapshot, and SHALL store it with `startLightScore` set to the light score at that moment.
2. WHEN a Weekly_Plan already exists for the current Plan_Week, THE Plan_Service SHALL return it unchanged and SHALL NOT call the Planner.
3. WHEN the user completes or unchecks a Plan_Action, THE Plan_Service SHALL change only that action's `done` state and completion date; the action list and its order SHALL stay the same.
4. WHEN two plan reads happen concurrently for the same Plan_Week, THE Plan_Service SHALL store exactly one Weekly_Plan, relying on the unique week-key index.
5. WHEN the current Plan_Week changes (because the Local_Date or the Demo_Now crosses a Monday), THE Plan_Service SHALL generate a new Weekly_Plan on the next read and SHALL keep earlier Weekly_Plans stored.
6. WHEN a stored Plan_Action's target no longer qualifies (the Subscription is canceled or the Debt is paid off), THE Exorcism Screen and the Dashboard plan card SHALL keep the action in the list, SHALL keep its checkbox usable and SHALL show no Do_It_Button for it. A target that was handled through `cancelSubscription` or `logPayment` in the same Plan_Week already shows the action as done through Auto_Completion.
7. THE App SHALL leave Plan_Actions without a regenerate control in this version.

### Requirement 15: Planner property tests

**User Story:** As a maintainer, I want the planner's guarantees checked on arbitrary inputs, so that regressions are caught.

#### Acceptance Criteria

1. THE Test_Suite SHALL include fast-check properties for the Planner with at least 100 runs each, tagged `// Feature: app-screens, Property N: <text>`.
2. THE Test_Suite SHALL assert that the output always has length exactly 3.
3. THE Test_Suite SHALL assert that Plan_Action ids are pairwise distinct.
4. THE Test_Suite SHALL assert that calling the Planner twice on the same input gives deeply equal output.
5. THE Test_Suite SHALL assert that `priorityCents` is non-increasing along the output, including when the `extra_payment` Plan_Action was forced in below the top three by priority (the final list is sorted after the forced inclusion, so the forced action sits at its priority position, usually last).
6. THE Test_Suite SHALL assert that no Plan_Action targets an inactive Subscription, and that no Plan_Action targets a Debt with a balance of 0.
7. THE Test_Suite SHALL assert that the Planner does not mutate its inputs and does not throw for inputs containing `NaN`, `Infinity`, negative values and empty arrays.
8. THE Test_Suite SHALL assert that a `reduce_small_expenses` Plan_Action is never present when the House_State has no Poltergeist, that the output contains at most one, that its `id` is `reduce:<category>` for the category with the largest `byCategory` value (ties by smallest category name), and that its `priorityCents` and `monthlyAmountCents` are equal and a multiple of 100.
9. THE Test_Suite SHALL include unit tests for the L4 persona (which has an active Poltergeist: 30 transactions of $12.00 in the category "Coffee") that assert the exact week 1 output, in this order: first the $120 "never" cancellation with the title "Cancel Wraithcast — saves $120/mo" (`priorityCents` 12000), second "Cut Coffee by $60 this month to dispel the Poltergeist" (`reduce:Coffee`, `priorityCents` and `monthlyAmountCents` 6000), third the forced extra payment on the 22% $18,000 debt with the title "Pay $300 extra on Scarlet Moth Card — saves $5.50/mo in interest" (`pay:<debtId>`, `priorityCents` and `monthlyAmountCents` 550, `suggestedAmountCents` 30000). The $60.00 "rarely" cancellation, "Cancel Dirgebox — saves $60/mo" (`priorityCents` 3600), and the other cancellations rank above the extra payment but are not included, because the forced extra payment takes the third slot.
10. THE Test_Suite SHALL include a unit test that, when the `extra_payment` candidate already ranks within the top three (for example a snapshot with one cancellation candidate of lower priority than the extra payment), asserts that the output equals the plain top three and that no candidate is dropped.
11. THE Test_Suite SHALL include a fast-check property that, WHENEVER any Debt has a balance above 0 Cents and the suggested extra payment of Requirement 12 criterion 5 (computed from the sanitized income and the sanitized balance of the highest-APR Debt with a balance above 0) is above 0 Cents, the output contains exactly one `extra_payment` Plan_Action, and WHENEVER no Debt has a balance above 0 or the suggested amount is 0, the output contains none.
12. THE Test_Suite SHALL keep the properties of criteria 2 to 8 true together with criterion 11: for every generated input the output has exactly three Plan_Actions, pairwise distinct ids (the forced `extra_payment` id `pay:<debtId>` cannot equal a `cancel:`, `reduce:` or `fallback:` id), `priorityCents` non-increasing, no inactive Subscription or paid-off Debt as a target, and a `reduce_small_expenses` Plan_Action only when a Poltergeist exists.
13. THE Test_Suite SHALL include unit tests for an empty snapshot that asserts three fallbacks, and for the cases of Requirement 12 criterion 13 (no Poltergeist, empty `byCategory`, excess 0) that assert no `reduce_small_expenses` candidate.

### Requirement 16: Demo Crypt isolation and mode switching

**User Story:** As a user, I want to try the demo without risking my real data, so that exploring is safe.

#### Acceptance Criteria

1. THE App SHALL open the Demo_Crypt and the Real_Crypt as two different Dexie databases and SHALL perform every read and write against the Active_Crypt only.
2. WHEN the user selects "Enter the demo crypt", THE App SHALL set the Mode_Store to `demo`, SHALL load the default Demo_Scenario (`level-4`) if the Demo_Crypt has no Profile, and SHALL navigate to the Dashboard.
3. THE App SHALL leave every Real_Crypt table unchanged while the Demo_Crypt is active and every operation on it runs, including seeding, reset and Skip_Week.
4. THE App SHALL leave every Demo_Crypt table unchanged while the Real_Crypt is active.
5. WHEN a Demo_Scenario is loaded, THE Demo_Service SHALL replace all Demo_Crypt contents in one Dexie transaction and SHALL NOT read or write the Real_Crypt.
6. FOR ALL operations in the Demo_Service, a snapshot of every Real_Crypt table taken before and after SHALL be identical (isolation property, tested with `fake-indexeddb`).
7. IF the Mode_Store holds a value other than `demo` or `real`, THEN THE App SHALL treat it as empty.

### Requirement 17: Demo scenarios and calibration

**User Story:** As a judge or presenter, I want five ready-made houses, one per decay level, so that I can show every state quickly.

#### Acceptance Criteria

1. THE Demo_Service SHALL provide five Demo_Scenarios `level-1` to `level-5`, defined in `src/lib/demo/seed.ts`, built from the personas in the Calibration Table of the haunting-engine `design.md`.
2. WHEN a Demo_Scenario is loaded with empty events, THE Haunting_Engine SHALL return a light score of 87.22, 62.74, 42.74, 32.74 and 17.07 (two-decimal rounding) and decay levels 1, 2, 3, 4 and 5 for `level-1` to `level-5`.
3. THE default Demo_Scenario `level-4` SHALL contain a $3,000 monthly income, the debts "Scarlet Moth Card" ($18,000, $400 minimum, APR 22%), "Car loan" ($6,000, $150 minimum, APR 18%) and "Student loan" ($2,000, $60 minimum, APR 12%), and five monthly Subscriptions: "Wraithcast" ($120.00, `never`), "Dirgebox" ($60.00, `rarely`), "Gravelift Gym" ($50.00, `often`), "Mistlocker" ($30.00, `often`) and "Gloom Gazette" ($15.49, `never`).
4. THE `level-4` scenario SHALL contain 30 Transactions of $12.00 each in the category "Coffee" and with the description "Coffee", whose dates all fall within the 23 days ending on the Demo_Now, so that the Poltergeist is active on the first day and still active after one Skip_Week.
5. THE scenarios `level-1` to `level-3` SHALL each contain at least three Ghosts and no Poltergeist, and `level-5` SHALL contain an active Poltergeist.
6. THE seed data SHALL use deterministic ids and SHALL date every Transaction relative to the Demo_Now at load time.
7. THE Demo_Service SHALL store the Demo_Now (the Local_Date when the scenario was loaded) and the scenario id in the Demo_Crypt Profile, and SHALL generate and store the Weekly_Plan for the current Plan_Week at load time.
8. WHEN the Calibration_Path is executed through the real Mutations on `level-4`, THE Test_Suite SHALL read the light score, base score, momentum and decay level from the Haunting_Engine at the start, after week 1 and after week 2, SHALL report them in the test output, and SHALL assert that the decay level after week 2 is lower in number (a better level) than the decay level at the start. The Test_Suite SHALL require no fixed target level and no fixed light score. With the Planner rules of Requirement 12 criteria 15 to 17, the stored plans on `level-4` are: week 1 (starting 2025-06-02) the $120.00 "never" cancellation ("Cancel Wraithcast — saves $120/mo"), "Cut Coffee by $60 this month to dispel the Poltergeist" and the $300.00 extra payment on the 22% debt, Scarlet Moth Card; week 2 (starting 2025-06-09) "Cut Coffee by $60 this month to dispel the Poltergeist", the $60.00 "rarely" cancellation ("Cancel Dirgebox — saves $60/mo") and the $300.00 extra payment on Scarlet Moth Card ("Pay $300 extra on Scarlet Moth Card — saves $5.50/mo in interest"). The expected reported values are: start 32.74 (base 32.74, momentum 0.00, level 4), after week 1 43.49 (base 33.49, momentum 10.00, level 3), after week 2 49.16 (base 34.16, momentum 15.00, level 3).
9. THE Calibration_Path SHALL be: in each week, read the stored Weekly_Plan of that week and do exactly what it says, in its stored order. For a `cancel_subscription` action, call `cancelSubscription` on its target. For an `extra_payment` action, call `logPayment` on its target Debt with the Debt's minimum monthly payment plus the action's `suggestedAmountCents`. For every action that is not done after those Mutations (a `reduce_small_expenses` or `fallback` action), call `completePlanAction`. Then call Skip_Week, except after week 2.
10. WHEN the Calibration_Path runs, THE Test_Suite SHALL assert that each action of the week ends with `done` equal to `true`, and that exactly three `exorcism_action_completed` Events exist per week, including the Events created by Auto_Completion.
11. THE seed data SHALL define fictional, non-trademarked names for every row of the five scenarios. Rows with no listed name below are named in `seed.ts` with the same rule. The Calibration numbers of criteria 2 to 4 stay unchanged:
   - `level-1`: debt "Personal loan" ($3,000); subscription "Music streaming" ($15); Transactions described "Coffee", "Snack" and "Bus fare".
   - `level-2`: debts "Furniture loan" ($8,000) and "Laptop loan" ($2,000); subscriptions "Movie streaming" ($50) and "Music streaming" ($15); Transactions described "Coffee", "Snack" and "Bus fare".
   - `level-3`: debts "Home repair loan" ($15,000) and "Store card" ($5,000); subscriptions "Movie streaming" ($80), "Gym membership" ($50) and "News digest" ($15); Transactions described "Coffee", "Snack" and "Bus fare".
   - `level-4`: the debts, subscriptions and "Coffee" Transactions of criteria 3 and 4.
   - `level-5`: debts "Family loan" ($35,000), "Card balance" ($12,000) and "Tuition loan" ($5,000); subscriptions "Cable bundle" ($200), "Movie streaming" ($100), "Gym membership" ($80), "Meal kit" ($60), "Cloud storage" ($30) and "News digest" ($15); Transactions described "Coffee", "Snack", "Bus fare", "Lunch" and "Vending machine".
12. THE seed data SHALL contain no real brand name in any debt name, Subscription name or Transaction description. WHEN a scan test reads every row name and description of all five scenarios, THE test SHALL compare them case-insensitively and by whole word against the named constant `FORBIDDEN_BRAND_NAMES` (Visa, Mastercard, Netflix, Spotify, Amazon, Apple, Disney, Hulu, YouTube) and SHALL fail when any row contains one of them.

### Requirement 18: Demo controls and indicator

**User Story:** As a presenter, I want clear demo controls and an obvious demo marker, so that the video is easy to drive and nobody mistakes demo data for real data.

#### Acceptance Criteria

1. WHILE the Demo_Crypt is active, THE Navigation_Shell SHALL show a "Demo mode" Chip, with the Demo_Now date as text, on every Screen except Landing.
2. WHILE the Demo_Crypt is active, THE Dashboard and the Settings screen SHALL show a Demo controls Card that contains the scenario switcher, a "Reset demo" Button and a "Skip to next week" Button.
3. THE scenario switcher SHALL be a SegmentedControl with five options labelled "Level 1" to "Level 5", whose selected option is the current scenario id, named by the visible label "Start scenario" so that it is not read as the current house level.
4. WHEN the user selects another scenario, THE Demo_Service SHALL load it, replacing the Demo_Crypt contents, and THE App SHALL announce "Loaded demo level N" in an `aria-live="polite"` region.
5. WHEN the user activates "Reset demo", THE Demo_Service SHALL reload the current scenario with Demo_Now set to the current Local_Date, and THE App SHALL show a toast "Demo reset".
6. WHEN the user activates "Skip to next week", THE Demo_Service SHALL set Demo_Now to Demo_Now plus 7 days in the Demo_Crypt Profile, and THE App SHALL show a toast that states the new date.
7. WHILE the Real_Crypt is active, THE App SHALL NOT render the Demo controls Card, the Skip_Week control or the "Demo mode" Chip.
8. IF Skip_Week is called while the Real_Crypt is active, THEN THE Demo_Service SHALL reject the call and SHALL change no data.
9. WHEN Skip_Week crosses into a new Plan_Week, THE Plan_Service SHALL generate a new Weekly_Plan on the next read, so that the Exorcism Screen shows a fresh plan.
10. WHEN Skip_Week runs, THE Demo_Service SHALL leave all Debts, Subscriptions, Transactions and Events unchanged.

### Requirement 19: Navigation shell

**User Story:** As a user, I want familiar banking-app navigation, so that I can move between screens in one tap.

#### Acceptance Criteria

1. WHILE the viewport is narrower than 1024px, THE Navigation_Shell SHALL show a Tab_Bar fixed to the bottom with links to Home (`/`), Exorcism (`/exorcism`), Subscriptions (`/subscriptions`), Debts (`/debts`) and Transactions (`/transactions`), and a link to Settings (`/settings`) in the page header.
2. WHILE the viewport is 1024px wide or wider, THE Navigation_Shell SHALL show a Sidebar with links to all six destinations, each with an icon and a text label.
3. THE Navigation_Shell SHALL render the navigation as a `<nav>` landmark with an accessible name, and SHALL set `aria-current="page"` on the link of the current route.
4. THE Navigation_Shell SHALL give every link a touch target of at least 44px by 44px and a visible focus ring from the `--focus-ring` token.
5. THE Navigation_Shell SHALL use Lucide icons at 20px with stroke 2 and a text label beside or below every icon.
6. WHILE no Active_Crypt exists, THE App SHALL render the Landing page at `/` without the Navigation_Shell, and every other route SHALL redirect to `/`.
7. THE Navigation_Shell SHALL use a main column of at most 560px on screens narrower than 1024px and a two-column card grid from 1024px, in line with `design-system.md`.
8. THE Navigation_Shell SHALL add bottom padding so that no Tab_Bar overlaps the last item of a Screen.

### Requirement 20: Landing and onboarding

**User Story:** As a first-time visitor, I want to try the demo or start my own crypt in one tap, so that I can see value immediately.

#### Acceptance Criteria

1. WHILE no Active_Crypt exists, THE Landing Screen SHALL show the "CashCrypt" wordmark as the `h1` in the wordmark font, the one-line pitch "Your money habits haunt your house. Pay down the haunting, and the lights come back on.", an "Enter the demo crypt" primary Button and a "Start my own crypt" secondary Button.
2. WHEN the user activates "Enter the demo crypt", THE Landing Screen SHALL follow Requirement 16 criterion 2.
3. WHEN the user activates "Start my own crypt", THE Landing Screen SHALL open a BottomSheet titled "Your monthly income" with a money Input labelled "Monthly income" and a primary "Create my crypt" Button.
4. WHEN the user submits a valid monthly income, THE App SHALL create the Real_Crypt Profile, set the Mode_Store to `real` and navigate to the Dashboard.
5. IF the monthly income is empty, below $1.00 or above the maximum money value, THEN THE onboarding sheet SHALL keep the sheet open, SHALL show an error message on the Input and SHALL create no data.
6. WHEN a Real_Crypt Profile already exists and the Mode_Store is empty, THE Landing Screen SHALL show a "Continue to my crypt" Button that sets the Mode_Store to `real`.
7. THE Landing Screen SHALL show exactly one primary Button.
8. THE Landing Screen SHALL keep a link to `/styleguide`.

### Requirement 21: Dashboard

**User Story:** As a user, I want one screen that shows how haunted my house is and what to do next, so that I understand my finances at a glance.

#### Acceptance Criteria

1. THE Dashboard SHALL show one BalanceHero with `format="score"`, label "Light score", the light score from the House_State and `showMax`, and no other `hero`-scale number.
2. WHEN the displayed light score differs from the displayed `startLightScore` of the current Weekly_Plan (both floored), THE Dashboard SHALL show a BalanceHero delta that states the signed difference followed by "this week", with direction and intent matching the sign.
3. WHEN the two floored scores are equal, THE Dashboard SHALL show no delta.
4. THE Dashboard SHALL show a LightScoreBar with the light score, the base score and the momentum, so that the displayed breakdown reads like "39 = 33 base + 6 momentum". Because the BalanceHero in the same card already shows the score, the LightScoreBar SHALL show the distance from the displayed score to the next healthier level instead of a second score number ("17 to Level 2" at 43), and nothing in its place at level 1.
5. THE Dashboard SHALL show four QuickActions in this order: "Log payment", "Add expense", "Import CSV" and "Exorcise".
6. WHEN the user activates "Log payment", THE Dashboard SHALL open the Log payment BottomSheet of Requirement 25, and WHEN there is no Debt with a balance above 0, THE QuickAction SHALL be disabled.
7. WHEN the user activates "Add expense", THE Dashboard SHALL open the Add expense BottomSheet of Requirement 26.
8. WHEN the user activates "Exorcise", THE Dashboard SHALL navigate to `/exorcism`.
9. WHILE CSV import is not implemented, THE "Import CSV" QuickAction SHALL be disabled.
10. THE Dashboard SHALL show a Card titled "This week's exorcism" with a "See all" action to `/exorcism` and three ExorcismActionRows from the stored Weekly_Plan, each with its title, subtitle and impact text, and with a Do_It_Button as defined in Requirement 22 criteria 9 to 11.
11. WHILE the House_State has a Poltergeist, THE Dashboard SHALL show a warning banner built from a Card and a Chip with the text "A Poltergeist is haunting you: $X in small expenses in 30 days" with `$X` taken from `poltergeist.totalAmount`, and the banner SHALL include an icon and the text, not only a color.
12. THE Dashboard SHALL show a Placeholder_Area that is labelled in visible text "House scene arrives in the next update" and that shows the decay level number and name ("Level 4 — Crumbling") as text.
13. THE Dashboard SHALL show the decay level name and number as text outside the Placeholder_Area, in an `aria-live="polite"` visually hidden region that updates when the level changes (for example "House is now Crumbling — light score 28").
14. THE Dashboard SHALL show at most one primary Button.
15. WHEN a QuickAction Mutation succeeds, THE Dashboard SHALL update the light score and the plan card without a page reload.

### Requirement 22: Exorcism screen

**User Story:** As a user, I want to see this week's three actions and the money they free, so that I can work through them and see progress.

#### Acceptance Criteria

1. THE Exorcism Screen SHALL show the week's date range (Monday to Sunday) and a progress line "N of 3 done".
2. THE Exorcism Screen SHALL show the three Plan_Actions of the stored Weekly_Plan as ExorcismActionRows in stored order, with impact text such as "+$120/mo" or "+$5.50/mo" for actions whose `monthlyAmountCents` is above 0.
3. WHEN the user toggles an ExorcismActionRow, THE Exorcism Screen SHALL call the matching complete or uncomplete Mutation, and WHEN it completes an action the Screen SHALL show a success toast that states the money figure ("+$120/mo freed") or "Action completed" for an action with no amount.
4. THE Exorcism Screen SHALL show "Money freed this week" as the sum of `monthlyAmountCents` of the actions that are done, formatted as currency per month, next to "of $T/mo possible" where `$T` is the sum over all three actions.
5. WHEN all three actions are done, THE Exorcism Screen SHALL show a Card with the candle-colored flame icon, the text "Exorcism complete. The lights flicker back on." and the week's result from floored scores, "Light score S → C · Level N — <name>", where S is the plan's `startLightScore`, C the current light score and N the current decay level ("Light score 32 → 43 · Level 3 — Haunted"). The Card SHALL appear inside a polite live region that is present before it appears, so screen readers announce it.
6. WHILE a Mutation is running for a row, THE ExorcismActionRow SHALL be disabled.
7. IF a Mutation fails, THEN THE Exorcism Screen SHALL leave the row state unchanged and SHALL show an error toast with the message "Could not save that action. Try again."
8. WHILE at least one action is not done, THE Exorcism Screen SHALL show a short explanation under the list: "Tap Do it to make the change here, or tick an action you did somewhere else." WHEN all three actions are done, THE explanation SHALL be hidden.
9. WHILE a `cancel_subscription` or `extra_payment` Plan_Action is not done and its target still qualifies (the Subscription is active, or the Debt balance is above 0), THE ExorcismActionRow area SHALL show a secondary "Do it" Button with the accessible name "Do it: <action title>", on the Exorcism Screen and on the Dashboard plan card.
10. WHEN the user activates the Do_It_Button of a `cancel_subscription` action, THE Screen SHALL open the cancel confirmation BottomSheet of Requirement 23 criterion 5 for that Subscription, and WHEN the user activates the Do_It_Button of an `extra_payment` action, THE Screen SHALL open the Log payment BottomSheet of Requirement 25 for that Debt, pre-filled with the Debt's minimum monthly payment plus the action's `suggestedAmountCents`, limited to the Debt balance.
11. WHEN the sheet opened by a Do_It_Button completes its Mutation, THE Screen SHALL show the toast of that Mutation, SHALL show the Plan_Action as done through Auto_Completion without a page reload, and SHALL NOT show a second toast for the completion.
12. THE Exorcism Screen SHALL keep the checkbox of every Plan_Action usable, including those with a Do_It_Button, so that the user can tick actions done outside the App.
13. THE Exorcism Screen SHALL render no more than one primary Button.
14. WHEN a Plan_Action is done, THE ExorcismActionRow SHALL show "Done <Mon D>" from its `completedOn` (for example "Done Nov 19", formatted with `formatMonthDay`) instead of its instruction subtitle, on the Exorcism Screen and on the Dashboard plan Card.

### Requirement 23: Subscriptions screen

**User Story:** As a user, I want to see my zombies, cancel the ones I do not use and keep a graveyard, so that canceling feels rewarding.

#### Acceptance Criteria

1. THE Subscriptions Screen SHALL list every active Subscription as a ListRow with its name, a subtitle that states the cadence ("Monthly"; the usage is shown once, in the usage Chip, which sits inside the row so the row's focus ring encloses it), and its monthly cost as the amount, sorted by monthly cost descending.
2. THE Subscriptions Screen SHALL show the usage as text and a Chip, and SHALL NOT rely on color alone.
3. THE Subscriptions Screen SHALL show a primary "Add subscription" Button that opens a BottomSheet with Inputs for name and amount, a SegmentedControl for cadence and a SegmentedControl for usage.
4. WHEN the user selects a Subscription row, THE Subscriptions Screen SHALL open a BottomSheet that shows its details (the monthly cost "$60/mo", plus a cadence line with the original amount only when the cadence is not monthly, for example "Yearly · $120 per year"), a SegmentedControl to change the usage and a primary "Cancel subscription" Button (canceling a zombie is the good action; the `danger` variant is only for destructive data actions such as deleting a row).
5. WHEN the user activates "Cancel subscription", or activates the Do_It_Button of a `cancel_subscription` Plan_Action, THE App SHALL ask for confirmation in a BottomSheet that states "Cancel Wraithcast — saves $120/mo" with a secondary "Keep it" Button and a primary "Cancel subscription" Button.
6. WHEN the user confirms, THE Subscriptions Screen SHALL call `cancelSubscription` and SHALL show a success toast "+$120/mo saved" with the exact monthly cost.
7. THE Subscriptions Screen SHALL show a "Graveyard" Card that lists every inactive Subscription as a ListRow with its name, "R.I.P. $X/mo" and the cancellation date, and WHEN the list is empty THE Card SHALL show "No tombstones yet. Suspiciously quiet."
8. WHEN the user selects a graveyard row, THE Subscriptions Screen SHALL offer a secondary "Bring it back" Button (reviving a zombie is allowed but not encouraged, so it is not a primary Button) that calls `reactivateSubscription` and SHALL show a toast that states the monthly cost returning.
9. WHEN there are no active Subscriptions, THE Subscriptions Screen SHALL show the empty state "No zombies in the basement. Suspiciously quiet."
10. THE Subscriptions Screen SHALL show the total monthly cost of active Subscriptions in a summary Card.
11. IF the Add subscription form has an empty name, a missing amount or an amount of 0, THEN THE form SHALL show an error on the field and SHALL create no row.

### Requirement 24: Debts screen

**User Story:** As a user, I want to see, add and edit my debts and log payments, so that paying down debt shows up in my light score.

#### Acceptance Criteria

1. THE Debts Screen SHALL list every Debt as a ListRow with its name, a subtitle "APR X% · Minimum $Y/mo" and its balance as the amount, sorted by balance descending.
2. THE Debts Screen SHALL show the total debt balance in a summary Card.
3. THE Debts Screen SHALL show a primary "Add debt" Button that opens a BottomSheet with Inputs for name, current balance, APR (entered as a percentage) and minimum monthly payment.
4. THE Debts Screen SHALL store the entered APR percentage as a fraction from 0 to 1 and SHALL show it back as a percentage.
5. WHEN the user selects a Debt row, THE Debts Screen SHALL open a BottomSheet with an "Edit debt" form and a "Log payment" Button.
6. THE Debts Screen SHALL render a Debt with a balance of 0 with the row subtitle "Paid off" instead of "APR X% · Minimum $Y/mo" (stated once, with no Chip in the row), SHALL show a "Paid off" Chip in its detail BottomSheet, and SHALL disable "Log payment" for it.
7. WHEN there are no Debts, THE Debts Screen SHALL show the empty state "No debts. The walls are holding."
8. IF the Add debt form has an empty name, a negative or missing balance, an APR outside 0 to 100 percent, or a missing minimum payment, THEN THE form SHALL show an error on each invalid field and SHALL create no row.
9. WHEN an edit changes a Debt balance, THE Debts Screen SHALL create no Event, since only the Log payment action records progress.

### Requirement 25: Log payment sheet

**User Story:** As a user, I want a payment sheet with a big money input and a clear result, so that logging a payment takes seconds.

#### Acceptance Criteria

1. THE Log payment BottomSheet SHALL show the Debt name, the current balance and the minimum monthly payment as one sentence formatted per Requirement 28.8 ("Balance $18,000. Minimum $400/mo."), and a money Input labelled "Payment amount".
2. WHEN more than one Debt has a balance above 0 and the sheet opens from the Dashboard, THE sheet SHALL first list those Debts as ListRows so that the user picks one.
3. WHEN the user opens the sheet from a Debt, THE money Input SHALL be pre-filled with the minimum monthly payment, limited to the balance.
4. THE Log payment BottomSheet SHALL show a primary "Save payment" Button, and WHEN the payment is larger than the minimum THE sheet SHALL show the text "$X goes above your minimum" with `$X` equal to the extra principal. WHILE the amount shows a validation error, THE sheet SHALL hide that text, so the green hint never appears next to an error.
5. WHEN the user submits a valid amount, THE sheet SHALL call `logPayment`, close, and show a success toast "Payment saved. $X off your balance." with the exact amount.
6. IF the amount is empty, is 0 or is above the Debt balance, THEN THE sheet SHALL stay open, SHALL show an error message on the Input that names the problem and SHALL write nothing.
7. THE Log payment BottomSheet SHALL trap focus, close on Escape and return focus to the control that opened it, as the BottomSheet primitive provides.
8. WHEN the sheet opens from the Do_It_Button of an `extra_payment` Plan_Action, THE sheet SHALL skip the Debt picker, SHALL show that Debt and SHALL pre-fill the money Input with the minimum monthly payment plus the action's `suggestedAmountCents`, limited to the Debt balance, instead of the pre-fill of criterion 3.
9. WHEN the sheet opened by a Do_It_Button shows a payment larger than the minimum, THE sheet SHALL show the text of criterion 4.

### Requirement 26: Transactions screen and Add expense sheet

**User Story:** As a user, I want to record small expenses and see which ones are ghosts, so that I understand what drains me.

#### Acceptance Criteria

1. THE Transactions Screen SHALL list the Transactions of the 30-day window ending on the current "now", newest first, each as a ListRow with its description, a subtitle with the category and the date, and its amount shown as an outflow.
2. THE Transactions Screen SHALL mark every Transaction that qualifies as a Ghost (amount above 0 and below `SMALL_EXPENSE_THRESHOLD_CENTS`) with a "Ghost" Chip that has an icon and text.
3. THE Transactions Screen SHALL show a summary Card with the total of small expenses in the window, the Poltergeist threshold (`POLTERGEIST_RATIO` times monthly income) and, WHILE the Poltergeist is active, the text "The Poltergeist is awake."
4. THE Transactions Screen SHALL show a primary "Add expense" Button that opens the Add expense BottomSheet.
5. THE Add expense BottomSheet SHALL contain a money Input labelled "Amount", a text Input labelled "What was it?" and a SegmentedControl for the category with the options "Coffee", "Food", "Transport" and "Other", and SHALL date the Transaction with the current "now".
6. WHEN the user submits a valid expense, THE sheet SHALL call `addTransaction`, close, and show a toast that states the amount, and WHERE the amount is below the small-expense threshold THE toast SHALL read "Ghost added: $X".
7. IF the amount is empty or 0, or the description is empty, THEN THE sheet SHALL stay open, SHALL show an error on each invalid field and SHALL write nothing.
8. WHEN no Transaction exists in the window, THE Transactions Screen SHALL show the empty state "No ghosts this month. The house is quiet."

### Requirement 27: Settings screen

**User Story:** As a user, I want to control my income, my data and which crypt I see, so that I stay in charge of my information.

#### Acceptance Criteria

1. THE Settings Screen SHALL show a money Input labelled "Monthly income" with the current value and a "Save income" Button, and WHEN saved THE Screen SHALL call `setMonthlyIncome` and show the toast "Income saved".
2. THE Settings Screen SHALL show a SegmentedControl "Crypt" with the options "Demo crypt" and "My crypt" that sets the Mode_Store.
3. WHEN the user selects "My crypt" and no Real_Crypt Profile exists, THE Settings Screen SHALL open the onboarding sheet of Requirement 20.
4. THE Settings Screen SHALL provide a "Clear all data" control that acts on the Real_Crypt only.
5. WHILE the Demo_Crypt is active, THE Settings Screen SHALL disable "Clear all data" and, WHERE export and import is implemented, "Export data" and "Import data", and SHALL show the hint "Switch to your own crypt to use this."
6. WHERE export and import is implemented (Requirement 33), THE Settings Screen SHALL provide "Export data" and "Import data" controls that act on the Real_Crypt only, placed above "Clear all data".
7. WHEN the user activates "Clear all data", THE Settings Screen SHALL ask for confirmation in a BottomSheet, and WHEN confirmed THE Data_Layer SHALL delete every Real_Crypt row in one Dexie transaction and THE App SHALL return to Landing.
8. THE Settings Screen SHALL show the Demo controls Card of Requirement 18 while the Demo_Crypt is active.
9. THE Settings Screen SHALL show no sound toggle in this version.

### Requirement 28: Empty states, microcopy and money display

**User Story:** As a user, I want plain, exact numbers with a little spooky flavor in the right places, so that the app is clear and never pressures me.

#### Acceptance Criteria

1. THE Screens SHALL write numbers and instructions in plain, exact language and SHALL limit spooky flavor to titles, empty states and celebrations.
2. THE Screens SHALL write all UI text in English in sentence case, except the wordmark.
3. THE Screens SHALL NOT joke about the user's debt and SHALL NOT use fear to pressure a decision.
4. THE Screens SHALL show every money figure as text in the chrome, formatted with the existing money helpers following criterion 8, with tabular digits in lists.
5. WHEN a Mutation changes money, THE App SHALL show a toast that states the exact figure, using the Toast primitive with the `success` tone for savings and payments.
6. THE Screens SHALL show an empty state, with one line of text and a clear next action, wherever a list can be empty (Subscriptions, Graveyard, Debts, Transactions, Exorcism plan before it loads).
7. WHILE the Weekly_Plan is being generated, THE Dashboard and the Exorcism Screen SHALL show a skeleton for the plan rows.
8. THE App SHALL format money inside sentences (Plan_Action titles, impact text, toasts, sheet headings and validation messages) with `formatCentsShort`: whole-dollar amounts omit ".00" ("$120/mo", "$60", "$300", "$1,800") and other amounts keep two decimals ("$5.50/mo", "$15.49/mo"). List row titles and subtitles are text and follow the same rule ("Minimum $400/mo", "APR 22% · Minimum $400/mo"). Only balances shown as figures (the BalanceHero, summary totals) and the amount column of list rows SHALL keep `formatCents` with cents ("$18,000.00", "$12.00").

### Requirement 29: Design-system conformance

**User Story:** As a maintainer, I want the new screens to obey the existing design system and its automated scans, so that the app stays visually and technically consistent.

#### Acceptance Criteria

1. THE Screens SHALL be built from the Primitives plus native elements, and SHALL add no new primitive.
2. THE Screens SHALL pass only layout utilities in `className` on Primitives, so that the existing className layout-only scan passes.
3. THE Screens SHALL use design tokens and Tailwind token utilities and SHALL contain no color literal, so that the existing token and hex scans pass.
4. THE Screens SHALL use `text-on-accent` for any text or icon on a solid accent fill.
5. THE Screens SHALL show no more than one primary Button and no more than one `hero`-scale number per Screen.
6. THE Screens SHALL use no card borders, no gradients other than the LightScoreBar and no Halloween clip-art in the chrome.
7. THE Screens SHALL use Server Components by default and `"use client"` only for files that use Hooks, state or event handlers.
8. WHEN `prefers-reduced-motion: reduce` is active, THE Screens SHALL add no motion beyond what the Primitives already provide.
9. THE App SHALL keep every existing test and scan passing, except the placeholder home page test, which this feature replaces with Landing and Dashboard tests.
10. THE App SHALL keep the `/styleguide` route working and unchanged.

### Requirement 30: Accessibility

**User Story:** As a user of assistive technology, I want every screen to be operable and understandable, so that the app works for me.

#### Acceptance Criteria

1. THE Screens SHALL each render exactly one `h1` and a `main` landmark.
2. THE Screens SHALL give every interactive element an accessible name through a visible label, `aria-label` or `aria-labelledby`.
3. THE Screens SHALL announce results of Mutations through the Toast live regions, and SHALL announce a scenario change and a decay level change through `aria-live="polite"`.
4. THE Screens SHALL show every status that uses color (usage, Ghost, Paid off, Demo mode, Poltergeist, done) with an icon and text.
5. WHEN a BottomSheet closes, THE Screens SHALL return focus to the control that opened it. WHEN that control no longer exists because its row moved to another list (a Subscription canceled into the Graveyard, or brought back to Zombies), THE Screen SHALL focus the moved row in its new list, and focus SHALL never be left on `<body>`.
6. THE Screens SHALL be fully operable with the keyboard alone, including the Tab_Bar, the Sidebar, every sheet and every form.
7. WHEN the Axe_Check runs on a Screen in each of the states "empty real crypt", "populated real crypt", "demo level 4" and "loading", THE Test_Suite SHALL report zero violations.

### Requirement 31: Test suite

**User Story:** As a maintainer, I want the new code covered at the right level, so that regressions in data, planning and screens are caught early.

#### Acceptance Criteria

1. THE Test_Suite SHALL run the Data_Layer and Demo_Service tests in the `node` Vitest project against `fake-indexeddb`, with a unique database name per test and cleanup after each test.
2. THE Test_Suite SHALL include unit tests for each Mutation that assert the exact rows after success and the unchanged rows after each rejection.
3. THE Test_Suite SHALL include tests that force a failure inside a Mutation (for example by stubbing the Event write) and assert that no table changed, proving atomicity.
4. THE Test_Suite SHALL include fast-check properties, tagged `// Feature: app-screens, Property N: <text>` with at least 100 runs, for the Snapshot_Adapter (round-trip of Cents, count conservation, no mutation), for `logPayment` (monotonicity and conservation), for `cancelSubscription` (idempotence and strict improvement), for `completePlanAction` and Auto_Completion (at most one `exorcism_action_completed` Event per Plan_Action), for the calendar functions, and for the Planner (Requirement 15), and WHERE export and import is implemented, for its round-trip.
5. THE Test_Suite SHALL include a Demo_Service test that asserts the isolation property of Requirement 16 and the five scenario scores of Requirement 17.
6. THE Test_Suite SHALL include the Calibration_Path integration test of Requirement 17, which reads each week's stored plan and reports the light score, base score, momentum and decay level at the start, after week 1 and after week 2.
7. THE Test_Suite SHALL include Data_Layer tests for Auto_Completion: completion by `cancelSubscription` and by `logPayment` with extra principal above 0, no completion for a payment with extra principal 0, no second Event when the action was ticked first, no completion and no generated plan when no Weekly_Plan exists for the Current_Week_Key, no completion for a plan of another week, and a full rollback when the Event write is forced to fail.
8. THE Test_Suite SHALL include one component or integration test file per Screen, using Testing Library and `user-event`, that asserts the main flow of that Screen (render, empty state, a successful action with its toast, and an invalid input) against a `fake-indexeddb` Crypt. The Dashboard and Exorcism tests SHALL also assert the Do_It_Button flow for a cancellation and for an extra payment (sheet pre-filled, action shown as done afterwards) and the absence of a Do_It_Button on fallback and `reduce_small_expenses` actions.
9. THE Test_Suite SHALL include a test of the Navigation_Shell for both layouts (below and from 1024px), `aria-current` and the redirect when no Active_Crypt exists.
10. THE Test_Suite SHALL include source-scan tests for the module boundaries of Requirement 1.
11. WHEN a bug is fixed during this feature, THE developer SHALL temporarily reintroduce the bug, confirm that the new test fails with a counterexample or a clear assertion failure, restore the fix, confirm the test passes and record the check and the counterexample in the task summary, as `conventions.md` requires.
12. THE Test_Suite SHALL keep `npm test`, `npm run lint` and `npm run typecheck` passing.
13. THE Test_Suite SHALL use test descriptions written as plain English sentences and SHALL use no snapshot tests for pure functions.
14. THE Test_Suite SHALL include a seed-name scan test that reads every debt name, Subscription name and Transaction description of the five Demo_Scenarios, compares them case-insensitively and by whole word against the named constant `FORBIDDEN_BRAND_NAMES` (Visa, Mastercard, Netflix, Spotify, Amazon, Apple, Disney, Hulu, YouTube) defined in the test file, and fails when any row contains one of them.

### Requirement 32: CSV import (optional, last)

**User Story:** As a user, I want to import transactions from a CSV file, so that I do not retype my expenses.

#### Acceptance Criteria

1. WHERE CSV import is implemented, THE App SHALL provide a pure `parseTransactionsCsv(text)` that returns validated Transactions or row-level errors with line numbers.
2. WHERE CSV import is implemented, THE App SHALL provide a pure `serializeTransactionsCsv(transactions)` that writes the same format.
3. WHERE CSV import is implemented, FOR ALL valid Transaction lists, `parseTransactionsCsv(serializeTransactionsCsv(list))` SHALL return a list deeply equal to the input (round-trip property).
4. WHERE CSV import is implemented, THE Import CSV QuickAction SHALL open a BottomSheet with a hidden native file input, a preview of the first rows in JetBrains Mono and a primary "Import N transactions" Button.
5. WHERE CSV import is implemented, IF any row is invalid, THEN THE sheet SHALL show the line number and the problem and SHALL import nothing.
6. WHERE CSV import is implemented, THE Data_Layer SHALL store all imported rows in one Dexie transaction and SHALL create no Event.
7. WHERE CSV import is implemented, THE Import CSV QuickAction SHALL be enabled.

### Requirement 33: Export and import (optional, last)

**User Story:** As a user, I want to export my data and import it later without loss, so that my information is portable and safe.

#### Acceptance Criteria

1. WHERE export and import is implemented, THE Data_Layer SHALL provide a pure `serializeExport(rows)` that returns the Export_File as a JSON string and a pure `parseExport(text)` that returns validated rows or a list of validation errors.
2. WHERE export and import is implemented, THE Export_File SHALL contain `app: "cashcrypt"`, `version: 1`, an `exportedAt` timestamp, the Profile, and the debts, subscriptions, transactions, events and weeklyPlans tables.
3. WHERE export and import is implemented, FOR ALL valid row sets, `parseExport(serializeExport(rows))` SHALL return rows deeply equal to the input (round-trip property, `exportedAt` excluded).
4. WHERE export and import is implemented, WHEN the user imports a file that passes validation, THE Data_Layer SHALL replace all Real_Crypt rows with the file contents in one Dexie transaction after the user confirms in a BottomSheet.
5. WHERE export and import is implemented, IF the file is not valid JSON, has a different `app`, has an unsupported `version`, or contains a row with a missing field, a non-integer or negative Cents value, an invalid date or a duplicate id, THEN THE Data_Layer SHALL write nothing and THE Settings Screen SHALL show an error that names the first problem.
6. WHERE export and import is implemented, IF the import transaction fails, THEN THE Data_Layer SHALL leave the previous Real_Crypt data unchanged.
7. WHERE export and import is implemented, WHEN an import succeeds, THE Settings Screen SHALL show a toast that states how many debts, subscriptions and transactions were imported.
8. WHERE export and import is implemented, WHEN the user activates "Export data", THE Settings Screen SHALL download a file named `cashcrypt-export-YYYY-MM-DD.json` that contains the Export_File.
9. WHERE export and import is implemented, THE Settings Screen SHALL read the selected file with a native file input that is visually hidden and triggered by the "Import data" Button.
