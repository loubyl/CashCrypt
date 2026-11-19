# CashCrypt — Tech Steering

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.4.6 (App Router) | File-based routing, React Server Components, easy Vercel deploy |
| Language | TypeScript (strict mode) | Safety for the haunting engine's pure functions |
| Styling | Tailwind CSS v4 | Utility-first. Configured in CSS (`src/app/globals.css`, `@theme inline`); there is no `tailwind.config.ts`. Compiled in Turbopack via the `@tailwindcss/turbopack` loader rule in `next.config.ts` |
| Chrome animation | Framer Motion (Motion) | Declarative, spring-based, `useReducedMotion` built in; owns all chrome micro-interactions |
| Scene animation | GSAP (core + MotionPathPlugin, DrawSVGPlugin, MorphSVGPlugin) + `@gsap/react` | Multi-step timelines, path-following, SVG morph; owns the house scene and all moments |
| House graphics | Inline SVG | Full programmatic control; animated exclusively with GSAP |
| Local storage | Dexie.js (IndexedDB wrapper) | Schema versioning, typed queries, works offline |
| Testing | Vitest + fast-check + jsdom + axe-core | Unit and property-based tests for the engine; jsdom project for component tests; axe-core for accessibility checks |
| Deploy | Vercel | Zero-config Next.js deploy |

## Architecture Principles

### Local-First
- All user data is stored exclusively in the browser via Dexie (IndexedDB).
- No server-side data storage, no authentication, no session tokens.
- The app works fully offline after the first load.
- Users can export all data as a JSON file; they can re-import it later.

### Haunting Engine
- A set of **pure, deterministic TypeScript functions** in `src/lib/haunting/`.
- Input: `FinancialSnapshot` = `monthlyIncome`, `debts`, `subscriptions` (amount + cadence + usage), `transactions`, `events`, and a reference `now` date (`YYYY-MM-DD`). The engine never reads the clock.
- Money enters as decimal dollars and is converted once to **integer cents** (`Math.round(x * 100)`) at the engine boundary; all sums and output amounts are integer cents.
- Output: `HouseState` = `lightScore`, `baseScore`, `momentum`, `decayLevel` (1–5), `windowBrightness`, `levelProgress`, `zombies`, `ghosts`, `poltergeist`.
- **Light score** (real number 0–100, higher = healthier) = `min(100, baseScore + momentum)`:
  - `baseScore = 100 / (1 + S)` with `S = WEIGHT_FACTOR_A·A + WEIGHT_FACTOR_B·B + WEIGHT_FACTOR_C·C`, where
    - A = monthly minimum debt payments / monthly income
    - B = total debt balance / annual income
    - C = monthly cost of valid active subscriptions / monthly income (debt factors weigh more than C)
  - `momentum` (0 to `MOMENTUM_MAX`) rewards recent effort: extra principal paid, monthly cost of subscriptions canceled, and exorcism actions completed, all from `events` dated in the 30-calendar-day window ending on `now`. It is 0 when monthly income is below 100 cents.
- The decay level uses half-open bands on the real-valued score: [80, 100] → 1 Pristine, [60, 80) → 2 Uneasy, [40, 60) → 3 Haunted, [20, 40) → 4 Crumbling, [0, 20) → 5 Condemned. The UI displays `Math.floor(lightScore)` with the breakdown (for example "39 = 33 base + 6 momentum").
- All weights, momentum coefficients, thresholds, cadence factors, and band boundaries live in `src/lib/haunting/config.ts`, with a pure `validateConfig(config): string[]` that never throws. No magic numbers elsewhere in the engine.
- Invariants (fast-check): paying down any debt balance never lowers the score; increasing a balance or minimum payment never raises it; canceling a subscription strictly raises it (when income > 0 and 0 < score < 100); events outside the window have no effect; adding an in-window event never lowers the score; momentum stays within [0, `MOMENTUM_MAX`].
- No side effects, no I/O, no React imports.
- Every function is covered by Vitest unit tests.
- Property-based tests with fast-check verify invariants (decay level always 1–5, zombie count equals subscription count, output always has a valid light score).

### Exorcism Planner
- Also a pure function in `src/lib/exorcism/`.
- Input: `HouseState` + financial snapshot.
- Output: exactly three `ExorcismAction` objects, sorted by monthly money freed.
- Candidate scoring: canceling a subscription = its monthly cost × usage weight (`never` = 1.0, `rarely` = 0.6, `often` = 0.2); extra debt payment = monthly interest saved.
- If fewer than three real candidates exist, the planner fills remaining slots with fallback actions (e.g., "Set aside $X for an emergency fund", "Review last week's small expenses").
- Each `ExorcismAction` has a `done: boolean` field; marking it done is persisted in Dexie.
- Covered by Vitest tests; fast-check checks that output always has length exactly 3.

### Demo Crypt
- Seed data defined in `src/lib/demo/seed.ts`, organized as five named scenarios (one per decay level).
- The **default demo** starts at decay level 4 (score 32.74) with an active Poltergeist and 5 zombies with mixed usage. A realistic weekly plan ($300 extra principal, cancel a $15.49 never-used subscription, 3 actions completed) lifts the score to about 39.5 in week 1 and, kept up for four weeks, moves the house up one level to L3.
- A **scenario switcher** component in the UI allows jumping directly to any of the five levels.
- Loaded into Dexie on demand; never overwrites existing user data.
- A single "Try the Demo Crypt" button in the UI triggers the default (level 4) scenario.

## Animation Architecture

### Library ownership
- **Framer Motion** owns all chrome micro-interactions: button press, sheet open/close, toast entrance, number count-up, list item enter/exit. State-driven, spring-based.
- **GSAP** (with `@gsap/react`) owns the house scene and all moment animations: shovel arc, candle-orb path, sigil stroke-draw, ghost-to-Poltergeist morph, atmospheric loops. Multi-step imperative timelines.
- Never animate the same SVG element with both libraries. If Framer Motion wraps a container, GSAP does not touch elements inside it, and vice versa.

### GSAP license
GSAP is used under its standard **no-charge license** (Club GreenSock is not required for this project's use case). The `gsap` and `@gsap/react` packages from npm cover all needed plugins at no cost. If a Club plugin (MorphSVGPlugin, DrawSVGPlugin) is used, the license terms must be reviewed before shipping.

### GSAP scoping
- All GSAP code lives in `src/components/house/` and `src/components/moments/`.
- Use `useGSAP()` from `@gsap/react` for all hook-based usage; it handles cleanup automatically.
- Each moment is exported as `playXMoment(target, options): Promise<void>` so callers can `await` or skip it.
- Moments are queued through `src/lib/moments/queue.ts`; two moments never overlap.

- Path aliases: `@/` maps to `src/`.
- All environment variables that must be public are prefixed `NEXT_PUBLIC_`.
- No secrets ever committed to the repository.
- `src/lib/` holds framework-agnostic logic; `src/components/` holds React components.
- Server Components by default; add `"use client"` only where interactivity requires it.
- Framer Motion variants defined alongside their component, not in a global file.
- Dexie schema and migrations live in `src/lib/db/`.
- GSAP timelines are created inside `useGSAP()` and never in module scope.

## Key Dependencies (expected)

```
next
react
react-dom
typescript
tailwindcss
framer-motion
gsap
@gsap/react
dexie
lucide-react
vitest
@vitest/coverage-v8
@vitest/ui
fast-check
@testing-library/react
@testing-library/user-event
jsdom
axe-core
```

### Fonts (`next/font/google`)

Four families, all loaded in `src/app/layout.tsx` via `next/font/google`. Self-hosted at build time; no external font requests at runtime.

| Family | Weights | Usage |
|---|---|---|
| **Manrope** | 700, 800 | Display, balances, page and card titles |
| **Inter** | 400, 500, 600 | All body text, labels, UI copy |
| **Cinzel** | 500 | Wordmark and house nameplate only |
| **JetBrains Mono** | 400 | CSV data preview only |

## Commands

```bash
npm run dev          # development server
npm run build        # production build
npm test             # run Vitest
npm run test:ui      # Vitest UI
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
```

Node.js version: **24**.

## Deployment

- Target: Vercel (hobby or pro tier).
- No server-side environment variables required for v1 (all logic is client-side).
- `next export` is not used; standard Next.js SSR/SSG on Vercel.
