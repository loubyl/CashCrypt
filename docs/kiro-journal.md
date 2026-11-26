# Kiro development journal

A dated log of how Kiro features shaped CashCrypt, kept for the Kiroween write-up and blog post. Each entry records the date, the Kiro feature used, what happened, and what it changed. Entries are short and factual.

## 2026-11-15 — Steering: foundational docs

- **Kiro feature:** Steering
- **What happened:** Starting from an empty folder and a product description, the agent generated the foundational steering docs (`product.md`, `tech.md`, `structure.md`). Three more followed: `visual-language.md`, `conventions.md` and `design-system.md`. The design system is a Revolut-style dark fintech UI. It keeps a separate "scene" register for the haunted house, so the chrome stays calm and the spooky parts live in the scene.
- **What it changed:** Every later conversation started with the same shared context: stack, folder layout, tokens, naming and language rules. Visual rules were split into two files, one for chrome (`design-system.md`) and one for the house scene (`visual-language.md`).

## 2026-11-15 — Steering audit

- **Kiro feature:** Steering
- **What happened:** Asked the agent to audit all steering docs for contradictions and duplicated definitions, with a clear precedence: `design-system.md` wins for tokens, typography and UI components, `visual-language.md` for the scene, `product.md` for behavior. It found and fixed 11 conflicts, including:
  - duplicated thresholds and usage weights defined in more than one file
  - a component name collision between a page-level exorcism component and the UI primitive
  - a reduced-motion rule written for Framer Motion that did not apply to GSAP scene components
  - a missing `settings` route that the design system's sound toggle needed
- **What it changed:** Each fact now has one owner file and the others reference it. The steering docs became a consistent base for the specs that followed.

## 2026-11-16 — Spec review: requirements

- **Kiro feature:** Spec (requirements)
- **What happened:** Reviewing the `haunting-engine` requirements caught problems that property-based tests would have failed on:
  - integer-only decay bands combined with a real-valued light score
  - a strict-increase property that is impossible at score 0
  - throwing at module initialization, which would have produced a blank screen
  - refunds (negative or zero amounts) turning into ghosts
  - float money breaking exact sums
- **What it changed:** Bands became half-open on a real-valued score. The strictness property now applies only when `monthlyIncome > 0` and `0 < lightScore < 100`. Config validation moved into a pure `validateConfig` that returns a list of problems and never throws. Only amounts above 0 can create ghosts. Money is handled as integer cents, so `byCategory` sums exactly to `totalAmount`.

## 2026-11-16 — Spec review: design

- **Kiro feature:** Spec (design)
- **What happened:** The calibration table in the design showed that a realistic weekly plan for the default L4 persona ($300 extra principal plus canceling a $15.49 subscription) moved the light score by only +0.25 points. A user would not see that change.
- **What it changed:** Added a 30-day momentum component, with coefficients and a cap in `config.ts`. Momentum rewards extra principal, canceled subscription cost and completed exorcism actions. With it, the same plan gives +6.8 points in week 1 and moves the house up one level (L4 to L3) in week 2. The demo plan was also replaced with this realistic one. This was caught at design time, before any code existed. In a vibe-coded flow the same problem would likely have shown up only after the UI was built.

## 2026-11-17 — Vibe: scaffolding Next.js 16 into a non-empty repo

- **Kiro feature:** Vibe (with steering as the checklist)
- **What happened:** The repo already held steering docs, specs, `README.md`, `LICENSE` and `docs/`, so `create-next-app` could not run in place. The agent generated the app in a temporary folder outside the project, moved the files to the root with a no-overwrite `mv`, merged `.gitignore` (`.kiro/` stays tracked) and deleted the temporary folder. It then added Vitest, `@vitest/coverage-v8`, `fast-check` and the npm scripts from `tech.md`. The generator installed Next.js 16.4.6 instead of the 15 written in `tech.md`, so the steering doc was updated to the exact installed version. Three things broke on the first checks and were fixed:
  - **`@types/node`:** the scaffold pinned `^20`, which conflicted with Vitest 5. It was raised to `^24` to match Node 24 instead of forcing the install.
  - **ESM config:** Vitest warned that `vitest.config.ts` used ESM syntax in a CommonJS package. Adding `"type": "module"` to `package.json` fixed it.
  - **`next typegen` before `tsc`:** `npm run typecheck` failed on the `LayoutProps` type, which Next generates only during a build. The script is now `next typegen && tsc --noEmit`.
- **What it changed:** `typecheck`, `test`, `lint` and `build` all pass on a clean tree with no app features added. The build also warned about a stray `package-lock.json` in the home folder. Setting `turbopack.root` to the project directory in `next.config.ts` removed the warning. Steering and README now name the same stack versions.

## 2026-11-17 — Spec: task 1 rewritten after the scaffold

- **Kiro feature:** Spec (tasks)
- **What happened:** The `haunting-engine` task list was generated before the Next.js 16 app was scaffolded, so task 1 still said to create `package.json`, `tsconfig.json` and `vitest.config.ts`. Those files now existed and had to be left alone. Task 1 was rewritten from "create tooling" to "verify existing tooling" (strict mode, `tests/` included, `@/` alias, Vitest and fast-check installed, `npm test` and `npm run typecheck` passing). The checks used temporary tests, one importing a module through `@/` and one running a fast-check property, which were deleted afterwards. The task and its sub-task were marked done without touching any config file. The task list Overview was updated to say the project already provides the tooling.
- **What it changed:** The plan matches the repo as it is, and the spec no longer asks the agent to overwrite working configuration. It also made the purity rule precise: "no Next.js, React or Dexie" applies only to imports inside `src/lib/haunting/`, not to the project's dependencies.

## 2026-11-17 — Spec: off-by-one in the 30-day window

- **Kiro feature:** Spec (requirements, design and tasks kept in sync with code)
- **What happened:** Cross-checking the date tests against the wording of the requirement, the agent found that `now − 30` was treated as inside the window, which made it 31 days long. The code, the tests, `requirements.md`, `design.md` and `tasks.md` all agreed with each other, so nothing failed. The intended rule is "the 30 calendar days ending on `now`, inclusive": `now − 29` through `now` are inside, `now − 30` and earlier are outside, and future dates are outside. All five were aligned in one pass, and the window length still comes from `WINDOW_DAYS` in `config.ts`.
- **What it changed:** A new test sweeps 120 consecutive days and asserts that exactly `WINDOW_DAYS` of them fall inside the window, so the window size can no longer drift from the constant. The engine's momentum and ghost numbers did not move. The lesson for the write-up: tests that were written from the same wrong assumption pass, and only a review against the requirement text caught it.

## 2026-11-17 — Steering: module-level property tests by default

- **Kiro feature:** Steering
- **What happened:** Reviews of the first module tests showed that the task list deferred every property-based test to the end-to-end task (task 12, on `computeHouseState`). As a result, `lightScore.test.ts` and `decay.test.ts` had example tests only. Module-level properties were added: Property 13 for `lightScore` (the base score is positive and strictly decreasing in the weighted sum), and Properties 2 and 3 for `decay` at 500 runs each (band consistency including `Math.floor`, level progress in [0, 1], window brightness non-decreasing), plus tests for `NaN` and `Infinity` inputs.
- **What it changed:** A new rule in the Testing section of `conventions.md` requires every module test file in `tests/haunting/` to include fast-check properties for its own invariants (bounds, conservation, no mutation, robustness to `NaN`, `Infinity` and negative values), in addition to the end-to-end properties. The remaining test sub-tasks now say so explicitly, so the agent adds module properties without being asked.

## 2026-11-17 — Property-based testing: Property 14 guards the window fix

- **Kiro feature:** Spec (tasks), property-based testing with fast-check
- **What happened:** Added Property 14 (calendar arithmetic and window size) to `design.md` and as sub-task 3.3, then implemented it in `dates.test.ts`. It runs 500 times per property over valid dates from 1900 to 2100 and checks four things: consecutive days differ by exactly 1 Julian day, exactly `WINDOW_DAYS` dates fall inside the window for any `now`, future dates are never inside, and malformed strings never throw. The day counts are cross-checked against `Date.UTC`, used only inside the test; `dates.ts` still never touches `Date`. To prove the properties protect the earlier off-by-one fix, the `>=` bug was reintroduced on purpose. The window-size property failed immediately with a counterexample. The original example tests had passed with the same bug, because they were written from the same wrong assumption. The fix was then restored.
- **What it changed:** The window rule is now enforced by a property that states the rule itself, not by examples that copy one person's reading of it. A deliberate mutation is a cheap way to confirm a new property can actually fail.

## 2026-11-17 — Milestone: haunting engine spec complete

- **Kiro feature:** Spec, property-based testing with fast-check
- **What happened:** All tasks (1–14) in the `haunting-engine` spec are checked. Counted from the repo:
  - 10 test files in `tests/haunting/`, 209 tests, all passing.
  - 20 properties, 46 property-based tests: the 20 properties are defined in `design.md` (1–20), and they are checked by 46 fast-check tests (`fc.assert` calls), every one tagged with its `design.md` property number. All 20 properties have at least one test, and no test uses a number that is not in `design.md`.
  - Properties per file: `dates` P14 · `decay` P2, P3 · `ghosts` P8, P19, P20 · `integration` P5, P7 · `lightScore` P1, P4, P6, P13 · `momentum` P10, P11 · `robustness` P9, P12 · `zombies` P15–P18.
- **Calibration results covered by tests:**
  - Five demo personas land on levels 1–5 with scores 87.22, 62.74, 42.74, 32.74 and 17.07 (`integration.test.ts`).
  - The L4 weekly plan goes 32.74 → 39.50 in week 1 (still level 4) → 45.73 in week 2 (level 3), then 48.45 and 48.68 with momentum capped (`momentum.test.ts`).
  - The L4 Poltergeist forms with 30 × $12 = $360 on $3,000 income (above the $300 threshold), and 30 × $9 = $270 stays as 30 separate ghosts (`ghosts.test.ts`).
- **Issues caught, by when they were found:**
  - **Requirements review** ([details](#2026-11-16--spec-review-requirements)): integer-only bands with a real-valued score, a strict property impossible at score 0, throwing at module init, refunds becoming ghosts.
  - **Design review** ([requirements](#2026-11-16--spec-review-requirements), [design](#2026-11-16--spec-review-design)): float money (switched to integer cents), and the realistic-plan calibration that led to the momentum component.
  - **Implementation:**
    - The 30-day off-by-one ([details](#2026-11-17--spec-off-by-one-in-the-30-day-window), [guard](#2026-11-17--property-based-testing-property-14-guards-the-window-fix)).
    - Property tests deferred to the end, fixed with a steering rule ([details](#2026-11-17--steering-module-level-property-tests-by-default)).
    - "valid" wrongly included "active". It was found because canceled subscriptions must become graveyard tombstones, so they have to stay valid while being excluded from zombies and Factor C.
    - A flaky property: the malformed-date generator could produce valid dates (for example `2100-12-21` through the "no padding" template). It was fixed with an independently tested calendar oracle, after which 20 out of 20 runs passed.
    - While implementing the static check, numeric literal types in `types.ts` (`DecayLevel = 1 | 2 | 3 | 4 | 5`) violated the rule and were moved to `config.ts`.
  - **End-to-end properties (task 12)** found no new bugs, which confirms the earlier reviews caught them before or during implementation.
- **Test-construction findings in the L4 trajectory:** a realistic weekly plan has to change the snapshot as well as add events. An extra payment must also reduce the debt balance, and a cancellation counts once, because a subscription can only be canceled once. The cancellation event is added in week 1 only, and the subscription leaves the list from then on. This became the data-layer rule in [`product.md`](../.kiro/steering/product.md) (Data Input → "Data-layer rule: user actions and momentum events"): each user action updates the snapshot and creates its event in one operation, and a subscription produces at most one `subscription_canceled` event.

## 2026-11-18 — Property-based testing + Steering: the money input comma, both ways

- **Kiro feature:** Property-based testing with fast-check, Steering
- **What happened:** The money input dropped commas, so typing "15,49" stored 1549, 100 times the intended amount. A first fix made the first comma the decimal point whenever there was no ".". That fixed "15,49", but made "1,000" mean 1.00, 1000 times off in the other direction. The final rule uses the fact that cents never have 3 digits: when there is no ".", a comma followed by exactly 3 digits (then another comma or the end) is a thousands separator, so "1,000" → 1000 and "1,234,567" → 1234567. Otherwise the first comma is the decimal point, so "15,49" → 15.49 and "12,5" → 12.5. With a ".", commas are always thousands separators. Property 16 covers decimal commas and Property 17 covers thousands groups. With the old logic restored, each failed with a counterexample: Property 16 with `["", "0"]` when commas were dropped, and Property 17 with `["0", ["000"]]` with the first fix. Requirement 13.10 and `design.md` now describe the rule.
- **What it changed:** The agent had started this "reintroduce the bug and watch the test fail" check on its own in several tasks (the date window, the Card accessible name, both money fixes). It most likely picked up the technique from the journal and design docs in the repo, which describe it. It is now a rule in the Testing section of `conventions.md`, so it happens on every bug fix, not only when the agent happens to remember it. Related: [Property 14 guards the window fix](#2026-11-17--property-based-testing-property-14-guards-the-window-fix).
## 2026-11-18 — Manual review + tests: what automated checks missed in design-system-foundation
- **Kiro feature:** Spec, steering, property-based testing
- **What happened:** Findings in `design-system-foundation` that automated checks missed, or caught only after a person looked:
  - **Focus ring (most important).** Manual keyboard testing showed no focus ring on any primitive (WCAG 2.4.7). In Tailwind v4, `outline-none` sets `--tw-outline-style: none` and `outline-2` reads that variable, so the ring had color, width and offset but no style. More than 500 tests and axe passed because jsdom does not render CSS. The fix is `focus-visible:outline-solid`. A test now compiles the real Tailwind CSS and checks the ring, and a scan requires the ring classes on the element that actually receives focus (see Decision 6b in `design.md`). After a visual review, Input got a single-line focus style: candle, or blood when invalid.
  - **Accent contrast.** Visual review of the styleguide found light text on accent fills at 1.6–2.6:1. axe cannot measure this in jsdom. This led to an on-accent token, a rule in the design system steering, and contrast tests, including each accent on its 14% tint.
  - **BottomSheet.** Component tests found that focus did not return to the trigger on close.
  - **Card.** The action's accessible name lost its space ("See allDebts"), and the test used a regex that hid it. The fix is a separate text node and an exact-name test.
  - **Spec reviews before code.** BalanceHero would have shown a red arrow when the light score rises, so direction and intent were split. `className` overrides do not work reliably with Tailwind, so `className` is layout-only, enforced by a scan. The inert background would have silenced `next-route-announcer`.
  - **Scans and contrast tests moved to task 1**, a lesson from the haunting engine. On its first run the color scan flagged hex values in the create-next-app scaffold.
  - **Environment.** A hydration warning came from a Chrome extension (confirmed in incognito). Duplicate `routes.d 3.ts` files came from iCloud syncing the project folder, so the project was moved out of iCloud. A "green" build once served stale CSS from the `.next` cache.
- **What it changed:** Checks that depend on rendered CSS no longer rely on jsdom alone. The ring test compiles real Tailwind output and the contrast tests cover accents on their tints. Checks that only look for a string somewhere in a file now target the element that matters. The "break it on purpose and watch the test fail" step from [the money input entry](#2026-11-18--property-based-testing--steering-the-money-input-comma-both-ways) was applied to some of these fixes, not all:
  - **Focus ring and Input:** mutation-checked.
  - **BottomSheet:** the focus-return test was confirmed to fail on the previous code.
  - **Card:** the fix predates the mutation rule.
  - **Contrast:** guarded by tests that assert ink fails on accent fills, not by a mutation check.
## 2026-11-18 — Milestone: first production deploy on Vercel
- **Kiro feature:** Spec (checkpoint)
- **What happened:** After checkpoint 11 of `design-system-foundation`, the app was deployed to production on Vercel at https://cash-crypt.vercel.app. It serves the placeholder home and `/styleguide` (8 primitives). The suite had 515 tests at the time of the deploy.
- **What it changed:** Every push to `main` now redeploys automatically.
## 2026-11-19 — Milestone: design-system-foundation spec complete
- **Kiro feature:** Spec, property-based testing with fast-check
- **What happened:** Tasks 1–20 of `design-system-foundation` are checked. Tasks 18–20 were finished on 2026-11-19. The one open sub-task is the optional 13.4 (droplet burst on the exorcism checkbox), skipped on purpose because it does not affect any other requirement. Counted from the repo:
  - 13 primitives in `src/components/ui/` (BalanceHero, BottomSheet, Button, Card, Chip, ExorcismActionRow, Input, LightScoreBar, ListRow, QuickAction, SegmentedControl, Toast, ToastRegion), plus `motionTokens.ts`.
  - 30 test files for this spec: 4 in `tests/design-system/`, 20 in `tests/ui/`, 6 in `tests/utils/`.
  - 601 tests in the whole suite (40 files, all passing). 209 of them belong to the haunting engine, so 392 belong to this spec.
  - 18 fast-check properties, numbered 1–18 in `design.md`, each with at least one test. They use 36 `fc.assert` calls in 7 files. Per file: `money` P1, P2, P3, P7, P16, P17, P18 · `score` P4, P5, P6, P8 · `delta` P9 · `segmentedNav` P10, P11 · `focusTrap` P12, P15 · `toastReducer` P13 · `contrast` P14.
- **Primitives and decisions not covered in the earlier entries:**
  - **LightScoreBar:** the gradient is sized as a percentage of the fill, so it always spans the full track. At 30% the fill shows the first 30% of the blood → candle → ecto gradient, not a squeezed copy of all of it.
  - **ExorcismActionRow:** `design-system.md` says the whole row dims when done. The title and subtitle already did, and the impact amount now also moves from ecto to `text-ink-tertiary`. The "+" and "/mo" text stays, and the contrast test requires at least 4.5:1 on the card surface.
  - **QuickAction:** the 52px circle with its label.
  - **BalanceHero:** the delta chip takes direction (up or down) and intent (good or bad) as separate inputs, so a rising light score shows an up arrow in a green success chip and a rising debt shows a red one (Property 9). The rising light score case (up arrow, green success chip) was verified visually in the browser by the user. The spec review that found this is in [Manual review + tests](#2026-11-18--manual-review--tests-what-automated-checks-missed-in-design-system-foundation).
  - **SegmentedControl:** roving tabindex. The selected segment, or the first enabled one when nothing is selected, is the only tab stop. Arrow, Home and End keys skip disabled segments and wrap (Properties 10 and 11).
- **Final accessibility pass (task 18):**
  - `styleguide.axe.test.tsx` runs axe on the whole `StyleguideContent` inside a `ToastRegion` in six states: sheet closed, sheet open, and each of the four toast tones visible, all triggered through the real buttons. Only `color-contrast` is disabled, because jsdom has no layout. Contrast is covered by `contrast.test.ts` instead. There are no selector exclusions.
  - `styleguide.keyboard.test.tsx` checks that Tab follows DOM order and skips disabled controls, that no `tabindex` is above 0, that there is exactly one `<main>` and one `<h1>`, that heading levels never skip, that every interactive element has an accessible name, and that no fixed-width class can overflow a 375px viewport.
- **Docs audit (task 18 docs checked against the repo):** the audit found two kinds of inaccurate steering. `structure.md` listed planned folders (`house/`, `moments/`, `db/`, `exorcism/`, `hooks/` and others) as if they existed, and its layout comment still mentioned a Dexie provider. `conventions.md` said the className scan rejects visual utilities "outside `src/components/ui/`". The scan only checks elements whose tag is imported from `@/components/ui/*`, and for dynamic class strings it checks only the literal fragments. Both files now say what is built and what the scan covers, so future sessions start from accurate context. The audit also expanded the Color_Utility_Map to one row per variable, as Requirement 24.2 asks. It found that the Color_Utility_Map test did not cover `--color-scrim`, so a test entry was added after a mutation check. `README.md` got a status note and an exact list of the styleguide sections.
- **What it changed:** the spec is closed with the counts above, taken from the repo and not from memory. Documentation that feeds later sessions was checked against the code before the spec was marked done. Earlier findings are in [Manual review + tests](#2026-11-18--manual-review--tests-what-automated-checks-missed-in-design-system-foundation) and [the money input entry](#2026-11-18--property-based-testing--steering-the-money-input-comma-both-ways).
## 2026-11-19 — Spec 3 (app-screens): what the requirements review caught
- **Kiro feature:** Spec review (requirements), web search
- **What happened:** The requirements for the `app-screens` spec were reviewed before any code was written. Four issues came up:
  - **Ticking a plan action only marked it done; it did not perform it.** A user could check "Cancel StreamMax" while the subscription stayed active, so the score never moved. The requirements now add a "Do it" button that opens the matching sheet, pre-filled. `cancelSubscription` and `logPayment` with extra principal also complete the matching plan action in the same Dexie transaction. Completion is idempotent through the `refKey` `plan:<weekKey>:<actionId>`, which is a unique index, so the same action never creates a second event.
  - **The planner never proposed an action for the Poltergeist.** The ghosts could merge into a Poltergeist and nothing in the plan addressed it. The planner now has a `reduce_small_expenses` candidate that targets the Poltergeist's top category.
  - **Debt was never in the weekly plan, so the light barely moved.** An `extra_payment` action on the highest-APR debt is now always included. If it would rank below the top three, it takes the third slot. The three weekly actions now map to the three creatures (zombie, Poltergeist, debt) and to the three planned scene moments.
  - **The first seed brand names collided with real companies.** Kiro searched the web, replaced them with fictional names, and the spec requires a test, `tests/demo/seedBrandScan.test.ts`, with a `FORBIDDEN_BRAND_NAMES` list (Visa, Mastercard, Netflix, Spotify, Amazon, Apple, Disney, Hulu, YouTube).
- **Calibration:** the spec requires a calibration test, `tests/demo/calibration.test.ts`, that follows the stored plan on the level-4 demo persona through the real mutations. It pins the light score at 32.74 (level 4) at the start, 43.49 after week 1 (base 33.49, momentum 10.00, level 3) and 49.16 after week 2 (base 34.16, momentum 15.00, level 3).
- **Status:** these are requirements and task definitions only. At the time of this entry neither test exists, and no mutation check has been run for them.
- **What it changed:** the plan is now something the user can act on from one screen, and every weekly action has a measurable effect on the score. The brand and calibration rules are written into the spec, so they get implemented as tests and are not left to memory. Related: [Spec review: requirements](#2026-11-16--spec-review-requirements).
## 2026-11-19 — Spec 3 (app-screens): data layer to Dashboard — what the tests caught
- **Kiro feature:** Spec (tasks), property-based testing with fast-check, Steering (mutation rule)
- **What happened, by task group:**
  - **Group 2 (mutations).** Mutation checks on plan auto-completion. With the existing-`refKey` check removed, fast-check found the sequence `payExtra, payExtra`, which completed the same plan action twice. Moving auto-completion outside the mutation's transaction made the rollback test fail.
  - **Flaky p13.** Under parallel load, a property test ran past the 5 s timeout and kept running in the background. Its global `vi.restoreAllMocks()` then removed the spy of the next test, which failed with "resolved instead of rejecting". The fix is a local `mockRestore()` on the test's own spy and a 60 s timeout for the property tests. The `ConstraintError` first reported could not be reproduced in about 70,000 cases, and the root cause found was in the test, not the code.
  - **Group 3 (planner).** Property 20 found that tie-breaking compared UTF-16 code units instead of code points. The counterexample is `{"😀":1,"～":1}`: "～" (U+FF5E) must win, but in UTF-16 "😀" sorts first. The mutation check showed that only the dedicated tie test catches this, so the counterexample is also a fixed unit test. A redundant re-sort after forcing the extra payment was removed, after measuring that the general generator forces the extra payment in about 11% of cases and that property 15 asserts the order.
  - **Group 4 (weekly plan).** The first "one plan per week" test still passed with the existing-row early return removed. The `ConstraintError` fallback re-read the stored row, so the result looked identical. The test now counts planner calls.
  - **Group 5 (demo).** The calibration test printed 32.74 → 43.49 → 49.16 but did not assert them, while an earlier journal entry said it pinned them. It now asserts each step with `toBeCloseTo(value, 2)` plus the decay level. Changing `COEFF_EXTRA_PRINCIPAL` or `WEIGHT_FACTOR_B` makes it fail.
  - **Group 6 (hooks), a bug in the code.** `useLiveQuery` (dexie-react-hooks 4.4) keeps its previous result while it re-subscribes after its deps change. Switching between the real and the demo crypt therefore showed the other crypt's debts and plan for several renders. The fix tags each result with its database (and week, for the plan) and drops results that don't match the current ones. A test records every render across real → demo → real and fails when any render shows the other crypt's data. The hydration tests use `renderToString` and then `hydrateRoot`. A control case with mismatched markup proves they can detect a hydration error.
  - **Groups 7–8 (shell, onboarding, Dashboard).** Onboarding must write the Profile before switching to real mode, and a mutation check on that order confirms the test catches a reversal. `AddExpenseSheet` showed the same message for an empty amount and for 0. It now shows "Enter the amount." and "Enter an amount above $0." respectively, each with its own test.
- **Pattern:** several of these bugs were in the tests, not the code:
  - a `toContain` that also accepted a longer string ("The balance is $1,800." matched "$1,800.00.");
  - a test that printed values instead of asserting them;
  - a test that accepted either of two messages;
  - generators that rarely produced the edge case.

  The mutation rule in `conventions.md` is what surfaced them. A test that still passes with the bug put back does not cover the fix.
- **Checkpoint 10:** 931 tests in 97 files pass, as do lint, typecheck and `npm run build`. The demo flow was also checked manually in the browser.
- **What it changed:** for every fix in this spec, the mutation check now comes before a test is accepted, and test-side bugs are fixed in the test instead of being worked around in the code. Related: [the money input entry](#2026-11-18--property-based-testing--steering-the-money-input-comma-both-ways), [Spec 3 requirements review](#2026-11-19--spec-3-app-screens-what-the-requirements-review-caught).
## 2026-11-20 — Spec 3 (app-screens) complete: what manual checks on the deployed app caught
- **Kiro feature:** Spec (requirements, design, tasks), property-based testing with fast-check, Steering (mutation rule)
- **Manual checks of the deployed demo.** After each screen, the demo was used in the browser. These issues passed every test and axe:
  - The cancel confirmation used the red `danger` button, although canceling a zombie is the good action. It is now `primary`, and `danger` is reserved for deleting data.
  - The light score appeared twice on the Dashboard. The bar now shows the distance to the next level ("17 to Level 2") instead of a second number.
  - Plan titles were truncated to one line, which hid the savings. Titles now wrap to two lines.
  - Done actions kept their instructions ("Open Subscriptions to cancel it"). They now show "Done Nov 19".
  - "Exorcism complete" was plain text below the cards. It is now a Card with the week's result ("Light score 32 → 43 · Level 3 — Haunted"), announced politely to screen readers.
- **Focus bug.** After canceling or reviving a subscription, the row that opened the sheet moved to the other list (Zombies or Graveyard). The sheet could not return focus to it, so focus fell to `<body>`. The screen now focuses the moved row in its new list. The new tests fail on the old code.
- **Logic gap found by trying the app.** Canceling a subscription and then bringing it back kept its cancellation momentum: +2 for Dirgebox in the level-4 demo. The fixes:
  - **Snapshot adapter:** `subscription_canceled` events only count while the subscription stays canceled. The stored event is kept, so canceling again restores it with its original date (Property 35).
  - **Plan action:** reviving a subscription also reopens its plan action for the current week, so "Do it" shows again.
  - **Deletion:** deleting a revived (active) subscription also deletes its cancellation event. Otherwise the undone cancellation would count again once no active row hides it (Property 37).
- **Paid-off debts.** A debt with a balance of 0 still counted its minimum payment in factor A. This was fixed in the snapshot adapter, which passes a minimum of 0 for paid-off debts, and not in the closed haunting-engine spec. The stored minimum is unchanged (Property 36).
- **Deletion was missing from the spec.** Requirements, design and a new task group were written before any code, first for debts and subscriptions, then for transactions. The rules:
  - payment and cancellation events that still stand are kept;
  - plan actions that target a deleted row stay in the frozen plan without "Do it", and can still be ticked;
  - focus moves to the list heading after a delete.
- **Money input.** Grouping thousands on blur ("2,500.00") also required changing `parseMoneyToCents`, which only accepted `^\d*(\.\d{0,2})?$`. Without the parser change, every money form would have rejected its own committed value. The mutation check (the old parser restored) broke at least six tests across the debt, payment and money-input suites.
- **Copy rules that emerged:**
  - Amounts inside sentences use `formatCentsShort`: plan titles, impact text, toasts, sheet headings, validation messages and row subtitles ("$120/mo", "$5.50/mo"). Only amount columns and balances shown as figures keep cents (Requirement 28.8).
  - Every color-coded state has an icon and visible text (Requirement 30.4). This ruled out an icon-only "Ghost" marker: ghost transactions now end their subtitle with "Ghost" ("Nov 19 · Ghost").
- **Task scheduling.** Kiro's task scheduler runs tasks in dependency waves. The Transactions subtasks waited in waves with unrelated tasks until they were dispatched manually.
- **Final state:**
  - 1111 tests in 117 files, all passing.
  - axe on 7 screens (Landing, Dashboard, Exorcism, Subscriptions, Debts, Transactions, Settings) in 4 states: empty real crypt, populated real crypt, demo level 4, and loading. `color-contrast` is skipped in jsdom; contrast is covered by `contrast.test.ts`.
  - A keyboard test suite.
  - Typecheck, lint and build pass.
- **What it changed:** using the deployed app after each screen caught product and accessibility issues that tests and axe cannot see. When a fix touched a closed spec (the engine, the design-system primitives), it went into the data layer or an additive primitive change, and the spec was updated first. Related: [data layer to Dashboard](#2026-11-19--spec-3-app-screens-data-layer-to-dashboard--what-the-tests-caught), [requirements review](#2026-11-19--spec-3-app-screens-what-the-requirements-review-caught).

## 2026-11-24 — house-scene phases A and B: what the manual checkpoints and the new tooling caught
- **Kiro feature:** Spec (design, tasks with manual checkpoints), Hooks, Steering (manual-inclusion commands), property-based testing with fast-check
- **What was built (`house-scene` spec, tasks marked done in `tasks.md` up to checkpoint 2):**
  - **Scene model (`src/lib/scene/`):** config with `validateSceneConfig`, window opacity curve, level feature table, id hashing, layout, and a level-aware summary. Properties 1–13 and 19–20 live in `tests/scene/properties/`.
  - **Static house (phase A):** `HouseBase`, `DecayLayer`, `ForegroundLayer`, `WindowsLayer` and `HouseScene`, mounted on the Dashboard in place of `ScenePlaceholder`. Checkpoint 1 is checked.
  - **Creatures and motion (phase B):** `ZombieBasement`, `GhostSwarm`, `Poltergeist`, `GraveyardRow`, `SceneLabels` and `AmbientMotion`, plus `gsap` and `@gsap/react` as dependencies. Checkpoint 2 is checked.
  - **Art pass:** a `wonk` value in the feature table (0.04, 0.25, 0.5, 0.75, 1 for levels 1 to 5) that scales deterministic irregularities (rotations, tilt, picket lean). Also a taller central tower, shingle rows, chimney smoke, a spirit-colored Poltergeist and larger zombies.
- **Kiro surfaces added (commit `71f6f4a`):**
  - **Hook "Full check after agent work":** a Stop trigger that runs `npm test`, `npx tsc --noEmit` and `npm run lint` after a turn that changed `src/`, `tests/` or root config.
  - **Two manual-inclusion steering files:** `spec-drift-check.md` (`/spec-drift-check`, read-only) and `journal-draft.md` (`/journal-draft`, this entry).
- **Bugs and gaps, and how each was found:**
  - **Checkpoint 1, manual review on the deployed app.** The first static house used the decay tints as the wall color and read as a suburban house. Tests cannot judge looks, so only the review caught it. A concept image made with an image model was saved as the style reference (`.kiro/specs/house-scene/references/house-reference-1.jpg`; the folder is `references`, plural). All SVG art is built in the repo. Walls are now fixed slate constants (`SCENE_WALL`, `SCENE_WALL_SHADE`), and `DECAY_TINTS` are a 10% overlay (commit `d0b4be7`, `design.md` "Walls"). The image was made by the developer with an image model (Gemini); the developer confirmed this.
  - **Checkpoint 2, ghosts piled up on one spot (manual review, then fixed in the hash).** FNV-1a gave almost the same value to ids that differ only in the last digit (`demo:level-2:tx:0` to `:3`, about 0.004 apart), so the ghosts shared a lane and a phase. `hashId` now ends with a murmur3 fmix32 finalizer (`src/lib/scene/hash.ts`, `design.md` C1). A minimum-spacing rule was added (`GHOST_MIN_REST_DISTANCE`, `GHOST_PHASE_STEPS`) and covered by Property 20 in `p20-ghost-spread.test.ts`. The checkpoint 2 report in the Kiro session says 8 bugs were reintroduced on purpose, including removing the fmix32 finalizer. The new tests failed in all 8 cases, then the files were restored and hash-checked (source: Kiro session report, not stored in the repo).
  - **Checkpoint 2, wrong summary text.** At level 4 the scene summary said "no ghosts", because the engine empties `ghosts` when the Poltergeist forms and keeps the count in `poltergeist.transactionCount`. `countGhosts` in `src/lib/scene/index.ts` now adds both, so the demo reads "30 ghosts, Poltergeist awake". Property 12 now compares against `expectedGhostTotal` in `tests/scene/arbitraries.ts`.
  - **First `/spec-drift-check` run, 9 mismatches between code and `design.md`:** stale property numbers, salts and functions the design did not document, and the wording of Property 5. `design.md` changed in commit `e70bf8d`, for example the hash paragraph now mentions the finalizer. The report was shared in the Kiro session and is not stored in the repo. It listed 9 mismatches: 7 in `design.md`, 1 in `tasks.md`, and 1 undecided between code and design (the ghost phase salt).
  - **Two UI test timeouts caused by the hook.** The hook ran tests, tsc and lint in parallel. Its prompt now says to run them strictly one after another and never in parallel or in the background (diff in commit `e70bf8d`). The two timeouts were `dashboard.test.tsx` (`renderDemo`, `findAllByRole`) and `styleguide.keyboard.test.tsx`, both at 5000 ms. They appeared in the hook output on 2026-11-24. Measured afterwards: the suite alone takes about 18 to 20 s, with tsc and lint in parallel about 25 s, and inside the hook about 35 s (source: hook output and measurements in the Kiro session).
- **Unexpected:**
  - Kiro rendered the scene in headless Chrome on its own to compare it with the reference image. This is reported in the checkpoint 1 and checkpoint 2 reports of the Kiro session; no script or log of it is stored in the repo.
- **Note:** the hook change and the `design.md` and `visual-language.md` edits share commit `e70bf8d` with the checkpoint 2 code.
- **What it changed:** the visual review found problems no test could express (wall color, ghost clustering), and the tests were then written for the cause, not for the picture. The drift check and the sequential hook are now part of the workflow. Related: [Spec 3 complete](#2026-11-20--spec-3-app-screens-complete-what-manual-checks-on-the-deployed-app-caught), [data layer to Dashboard](#2026-11-19--spec-3-app-screens-data-layer-to-dashboard--what-the-tests-caught).

## 2026-11-25 — house-scene: steering and docs brought in line with the code
- **Kiro feature:** Steering, Specs
- **What happened:** Task 18.5 updated `structure.md` (new `src/lib/scene/`, `src/lib/moments/`, house and moment files, the `.ts` moment modules, and the hooks `useSceneModel`, `useActionObserver` and `useElementWidth`) and removed the "scene not built" statements from `README.md`. `visual-language.md` already states that the level 2 to 4 window percentages are nominal and that the real curve is in `src/lib/scene/config.ts`.
- **Note:** the file list was taken from the filesystem, not from the design. The spirit-jar moment has no file yet and `ScenePlaceholder.tsx` is no longer used.
