# CashCrypt — Tech Steering

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | File-based routing, React Server Components, easy Vercel deploy |
| Language | TypeScript (strict mode) | Safety for the haunting engine's pure functions |
| Styling | Tailwind CSS | Utility-first, good dark-mode support, purges unused CSS |
| Chrome animation | Framer Motion (Motion) | Declarative, spring-based, `useReducedMotion` built in; owns all chrome micro-interactions |
| Scene animation | GSAP (core + MotionPathPlugin, DrawSVGPlugin, MorphSVGPlugin) + `@gsap/react` | Multi-step timelines, path-following, SVG morph; owns the house scene and all moments |
| House graphics | Inline SVG | Full programmatic control; animated exclusively with GSAP |
| Local storage | Dexie.js (IndexedDB wrapper) | Schema versioning, typed queries, works offline |
| Testing | Vitest + fast-check | Unit tests + property-based tests for the haunting engine |
| Deploy | Vercel | Zero-config Next.js deploy |

## Architecture Principles

### Local-First
- All user data is stored exclusively in the browser via Dexie (IndexedDB).
- No server-side data storage, no authentication, no session tokens.
- The app works fully offline after the first load.
- Users can export all data as a JSON file; they can re-import it later.

### Haunting Engine
- A set of **pure, deterministic TypeScript functions** in `src/lib/haunting/`.
- Input: snapshot of financial data (debts, subscriptions, transactions, income).
- Output: `HouseState` (light score 0–100, decay level 1–5, list of zombies, list of ghosts, poltergeist flag).
- The **light score** (0–100, higher = healthier) is computed from two factors:
  - (a) monthly minimum debt payments / monthly income
  - (b) total debt balance / annual income
- The decay level is derived from light score bands: 80–100 → 1 Pristine, 60–79 → 2 Uneasy, 40–59 → 3 Haunted, 20–39 → 4 Crumbling, 0–19 → 5 Condemned.
- All weights, ratios, and band boundaries live in a single config object in `src/lib/haunting/config.ts`. No magic numbers elsewhere in the engine.
- Invariant: paying down any debt balance must always raise or keep the light score (covered by fast-check property tests).
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
- The **default demo** starts at decay level 4 with an active Poltergeist and 5–6 zombies with mixed usage.
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
fast-check
@testing-library/react
@testing-library/user-event
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
pnpm dev          # development server
pnpm build        # production build
pnpm test         # run Vitest
pnpm test:ui      # Vitest UI
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
```

## Deployment

- Target: Vercel (hobby or pro tier).
- No server-side environment variables required for v1 (all logic is client-side).
- `next export` is not used; standard Next.js SSR/SSG on Vercel.
