# CashCrypt — Project Structure Steering

## Directory Layout

The tree below is the target layout. Built so far: `src/app/` (layout, placeholder home, `/styleguide`, `globals.css`), `src/components/styleguide/`, the 13 primitive files and `motionTokens.ts` in `src/components/ui/`, `src/lib/haunting/`, `src/lib/utils/`, and the tests in `tests/haunting/`, `tests/design-system/`, `tests/ui/` and `tests/utils/`. Everything else (the other routes, `house/`, `moments/`, the feature component folders, `src/lib/db/`, `src/lib/exorcism/`, `src/lib/moments/`, `src/lib/demo/`, `src/hooks/`, `src/types/`, `tests/exorcism/`) is planned for later specs and does not exist yet.

```
CashCrypt/
├── .kiro/
│   ├── steering/
│   │   ├── product.md
│   │   ├── tech.md
│   │   ├── structure.md
│   │   ├── design-system.md
│   │   ├── visual-language.md
│   │   └── conventions.md
│   └── settings/
├── public/                     # Static assets (images, icons, etc.)
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout (fonts, global styles, ToastRegion; Dexie provider planned)
│   │   ├── page.tsx            # Home — house dashboard
│   │   ├── transactions/
│   │   │   └── page.tsx        # Transaction list + manual entry + CSV import
│   │   ├── subscriptions/
│   │   │   └── page.tsx        # Subscription (zombie) manager
│   │   ├── debts/
│   │   │   └── page.tsx        # Debt manager — list, add debt, log payment
│   │   ├── exorcism/
│   │   │   └── page.tsx        # Weekly exorcism plan
│   │   ├── settings/
│   │   │   └── page.tsx        # Settings — sound toggle, data export / import, clear data
│   │   ├── styleguide/
│   │   │   └── page.tsx        # /styleguide route; renders StyleguideContent
│   │   └── globals.css         # Tailwind v4 entry, :root tokens, @theme inline aliases, base layer
│   │
│   ├── components/
│   │   ├── styleguide/
│   │   │   └── StyleguideContent.tsx   # Living styleguide: every primitive and token
│   │   ├── house/              # SVG house and all its animated states (GSAP)
│   │   │   ├── HouseScene.tsx  # Root component; composes all house layers
│   │   │   ├── HouseBase.tsx   # Static structural SVG
│   │   │   ├── DecayLayer.tsx  # Overlay that reflects decay level 1–5
│   │   │   ├── ZombieBasement.tsx
│   │   │   ├── GhostSwarm.tsx
│   │   │   ├── Poltergeist.tsx
│   │   │   └── GraveyardRow.tsx    # Tombstone trophies for banished subscriptions
│   │   ├── moments/            # One-shot GSAP moment animations (one file per moment)
│   │   │   ├── ShovelMoment.tsx        # Cancel subscription → shovel bonk → tombstone
│   │   │   ├── CandleOrbMoment.tsx     # Log debt payment → orb flies to house
│   │   │   ├── SigilMoment.tsx         # Poltergeist exorcised → sigil circle draw
│   │   │   ├── SpiritJarMoment.tsx     # Ghosts captured → spiral into jar
│   │   │   └── ThreeCandlesMoment.tsx  # Weekly plan completed → three candles light
│   │   ├── exorcism/
│   │   │   ├── ExorcismPlan.tsx
│   │   │   └── ExorcismPlanAction.tsx   # Wraps ExorcismActionRow with plan-level logic
│   │   ├── transactions/
│   │   │   ├── TransactionForm.tsx
│   │   │   └── CsvImport.tsx
│   │   ├── subscriptions/
│   │   │   └── SubscriptionCard.tsx
│   │   ├── debts/
│   │   │   ├── DebtCard.tsx        # Displays one debt; includes "Log a Payment" action
│   │   │   └── DebtForm.tsx        # Add / edit a debt (name, balance, APR, min payment)
│   │   ├── demo/
│   │   │   └── DemoScenarioSwitcher.tsx  # Jumps to any of the 5 demo decay levels
│   │   └── ui/                 # Generic, reusable primitives (Crypt UI design system)
│   │       ├── Button.tsx
│   │       ├── QuickAction.tsx             # 52px circle quick-action with label
│   │       ├── BalanceHero.tsx             # Hero number + delta chip
│   │       ├── Card.tsx
│   │       ├── ListRow.tsx                 # Icon avatar + title/subtitle + right-aligned amount
│   │       ├── ExorcismActionRow.tsx        # ListRow variant: round checkbox + ecto impact amount
│   │       ├── Chip.tsx                    # Pill badge: tinted background + icon + text
│   │       ├── SegmentedControl.tsx
│   │       ├── Input.tsx                   # Radius-16, floating label, money-input variant
│   │       ├── LightScoreBar.tsx           # 10px pill track, blood→candle→ecto fill
│   │       ├── BottomSheet.tsx             # Sheet on mobile, modal on desktop (single component)
│   │       ├── Toast.tsx                   # One toast (presentational)
│   │       ├── ToastRegion.tsx             # Exports ToastRegion and useToast; mounted in layout.tsx
│   │       └── motionTokens.ts             # Framer Motion duration/distance constants (mirror the CSS tokens)
│   │
│   ├── lib/
│   │   ├── db/                 # Dexie schema and migrations
│   │   │   ├── schema.ts       # Table definitions and types
│   │   │   └── db.ts           # Dexie instance (singleton)
│   │   ├── haunting/           # Pure haunting engine
│   │   │   ├── index.ts        # Public API: computeHouseState(), cents boundary, re-exports
│   │   │   ├── config.ts       # All weights, momentum coefficients, thresholds, bands + validateConfig()
│   │   │   ├── lightScore.ts   # Snapshot → baseScore = 100 / (1 + S) (factors A, B, C)
│   │   │   ├── momentum.ts     # In-window events → momentum (0 to MOMENTUM_MAX)
│   │   │   ├── decay.ts        # lightScore → decay level, levelProgress, windowBrightness
│   │   │   ├── zombies.ts      # Subscriptions → cadence normalisation + zombie list
│   │   │   ├── ghosts.ts       # Transactions → ghost list + poltergeist check
│   │   │   ├── dates.ts        # Pure calendar-date math: dateToJulian, isInWindow (no imports)
│   │   │   ├── testArbitraries.ts  # fast-check generators (test-only, never imported by app code)
│   │   │   └── types.ts        # FinancialSnapshot, FinancialEvent, HouseState, Zombie, Ghost, Poltergeist
│   │   ├── exorcism/           # Pure exorcism planner
│   │   │   ├── index.ts        # Public API: generateExorcismPlan()
│   │   │   └── types.ts        # ExorcismAction type
│   │   ├── moments/
│   │   │   └── queue.ts        # Plays moments one at a time; supports skip (Promise-based queue)
│   │   ├── demo/
│   │   │   └── seed.ts         # Five named demo scenarios (one per decay level)
│   │   └── utils/              # Pure UI helpers (framework-agnostic)
│   │       ├── money.ts            # Money input sanitising, blur formatting, currency parts
│   │       ├── score.ts            # Score clamping, fill percent, score text and breakdown
│   │       ├── delta.ts            # Delta chip presentation (sign, icon, tone)
│   │       ├── segmentedNav.ts     # Arrow/Home/End navigation over enabled segments
│   │       ├── focusTrap.ts        # Focusable selector, next focus index, inert skip rule
│   │       └── toastReducer.ts     # Toast queue reducer and live-region choice
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useHouseState.ts    # Subscribes to Dexie, returns live HouseState
│   │   ├── useExorcismPlan.ts
│   │   └── useDemo.ts          # Loads / clears demo seed data, exposes scenario switcher
│   │
│   └── types/                  # Shared domain types not tied to a single module
│       └── finance.ts          # Transaction, Subscription, Income, Debt, DebtPayment
│
├── tests/                      # Vitest test files mirror src/lib/ structure
│   ├── haunting/
│   │   ├── config.test.ts          # shipped config passes validateConfig
│   │   ├── lightScore.test.ts      # baseScore, monotonicity, bounds, determinism
│   │   ├── momentum.test.ts        # momentum bounds, window, in-window monotonicity, L4 weekly plan
│   │   ├── decay.test.ts           # band mapping, levelProgress, windowBrightness
│   │   ├── zombies.test.ts
│   │   ├── ghosts.test.ts
│   │   ├── dates.test.ts           # isInWindow boundaries, leap years, year boundaries
│   │   ├── integration.test.ts     # cancellation strict monotonicity, end-to-end properties
│   │   ├── robustness.test.ts      # extreme inputs, zero income, empty arrays
│   │   └── staticChecks.test.ts    # source scan: banned APIs/imports, no numeric literals outside config.ts and dates.ts
│   ├── exorcism/
│   │   └── planner.test.ts
│   ├── design-system/          # Token, contrast, focus-ring and source-scan tests (node)
│   │   ├── contrast.test.ts
│   │   ├── focusRing.test.ts
│   │   ├── sourceScan.test.ts
│   │   ├── tokens.test.ts
│   │   └── helpers/contrast.ts
│   ├── ui/                     # Component and page tests (jsdom project)
│   │   ├── setup.ts            # Vitest setup file: jest-dom, cleanup, matchMedia stub, reduced-motion mock
│   │   ├── helpers/            # axe.ts, motion.ts, viewport.ts
│   │   └── *.test.ts(x)        # One file per primitive, plus styleguide and home page tests
│   └── utils/                  # Unit tests for src/lib/utils/ (one file per helper)
│
├── .gitignore
├── LICENSE
├── README.md
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

## Tailwind v4 integration

There is no `tailwind.config.ts`. Tailwind CSS v4 is configured in CSS:

- `next.config.ts` registers a Turbopack loader rule for `*.css` files that runs `@tailwindcss/turbopack`.
- `src/app/globals.css` starts with `@import "tailwindcss";`, declares the design-system tokens in `:root`, and maps them to utilities in an `@theme inline` block.

## Vitest setup

`vitest.config.ts` defines two projects. `node` runs `tests/**` except `tests/ui/**`. `ui` runs `tests/ui/**` in jsdom with `tests/ui/setup.ts` as its setup file.

## Module Boundaries

- `src/lib/haunting/` and `src/lib/exorcism/` must have **zero React, Dexie, or Next.js imports**. They are plain TypeScript.
- `src/lib/db/` is the only place that imports Dexie.
- `src/lib/moments/queue.ts` is framework-agnostic: no React imports. It operates on `Promise<void>` functions only.
- `src/hooks/` bridges Dexie and the haunting engine for React components. It is reserved for those bridges.
- A hook that is part of a primitive's contract (for example `useToast`) is exported from that primitive's file and lives beside it in `src/components/ui/`, not in `src/hooks/`.
- `src/components/` never imports from `src/lib/db/` directly; it uses hooks.
- **Framer Motion** is imported only in `src/components/ui/` and in chrome-layer components. Never inside `src/components/house/` or `src/components/moments/`.
- **GSAP** is imported only in `src/components/house/` and `src/components/moments/`. Never inside `src/components/ui/`.

## File Naming

- React components: `PascalCase.tsx`
- Non-component TypeScript: `camelCase.ts`
- Test files: `<subject>.test.ts` (or `.test.tsx` for component tests)
- One component per file; no barrel files inside `house/` or deeply nested directories.

## Import Alias

All imports use `@/` as the root alias for `src/`:

```ts
import { computeHouseState } from "@/lib/haunting";
import { HouseScene } from "@/components/house/HouseScene";
```
