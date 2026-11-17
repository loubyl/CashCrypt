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
