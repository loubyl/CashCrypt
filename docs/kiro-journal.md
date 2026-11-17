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
