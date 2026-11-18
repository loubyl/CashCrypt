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
  - 46 fast-check properties, every one tagged with a `design.md` property number. All 20 properties in `design.md` (1–20) have at least one test, and no test uses a number that is not in `design.md`.
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
