# CashCrypt — Project Structure Steering

## Directory Layout

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
│   │   ├── layout.tsx          # Root layout (fonts, global styles, Dexie provider)
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
│   │   └── globals.css         # Tailwind base + CSS custom properties
│   │
│   ├── components/
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
│   │       └── Toast.tsx
│   │
│   ├── lib/
│   │   ├── db/                 # Dexie schema and migrations
│   │   │   ├── schema.ts       # Table definitions and types
│   │   │   └── db.ts           # Dexie instance (singleton)
│   │   ├── haunting/           # Pure haunting engine
│   │   │   ├── index.ts        # Public API: computeHouseState()
│   │   │   ├── config.ts       # All weights, thresholds, and score bands (single source of truth)
│   │   │   ├── lightScore.ts   # Financial snapshot → light score (0–100)
│   │   │   ├── decay.ts        # Light score → decay level (1–5)
│   │   │   ├── zombies.ts      # Subscriptions → zombie list
│   │   │   ├── ghosts.ts       # Transactions → ghost list + poltergeist check
│   │   │   └── types.ts        # HouseState, Zombie, Ghost, Poltergeist types
│   │   ├── exorcism/           # Pure exorcism planner
│   │   │   ├── index.ts        # Public API: generateExorcismPlan()
│   │   │   └── types.ts        # ExorcismAction type
│   │   ├── moments/
│   │   │   └── queue.ts        # Plays moments one at a time; supports skip (Promise-based queue)
│   │   ├── demo/
│   │   │   └── seed.ts         # Five named demo scenarios (one per decay level)
│   │   └── utils/              # Shared helpers (formatting, date utils, etc.)
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
│   │   ├── lightScore.test.ts
│   │   ├── decay.test.ts
│   │   ├── zombies.test.ts
│   │   └── ghosts.test.ts
│   └── exorcism/
│       └── planner.test.ts
│
├── .gitignore
├── LICENSE
├── README.md
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

## Module Boundaries

- `src/lib/haunting/` and `src/lib/exorcism/` must have **zero React, Dexie, or Next.js imports**. They are plain TypeScript.
- `src/lib/db/` is the only place that imports Dexie.
- `src/lib/moments/queue.ts` is framework-agnostic: no React imports. It operates on `Promise<void>` functions only.
- `src/hooks/` bridges Dexie and the haunting engine for React components.
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
