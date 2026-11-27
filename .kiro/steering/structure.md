# CashCrypt — Project Structure Steering

## Directory Layout

The tree below is the target layout. Built so far: `src/app/` (root layout, `globals.css`, `/styleguide`, and the `(app)` route group with `/`, `/transactions`, `/subscriptions`, `/debts`, `/exorcism` and `/settings`), `src/components/{ui,styleguide,shell,common,landing,dashboard,sheets,screens,demo,exorcism,feedback,house,moments}/`, `src/hooks/`, `src/types/`, `src/lib/{haunting,exorcism,db,demo,validation,utils,scene,moments}/`, and the tests in `tests/{haunting,exorcism,db,demo,validation,design-system,ui,utils,scene,moments,feedback}/`. The house scene is built: `HouseScene` is mounted on the Dashboard, and the moment modules (`ShovelMoment`, `CandleOrbMoment`, `SigilMoment`, `ThreeCandlesMoment`, `LevelChangeMoment`, `PoltergeistFeedMoment`, `GhostArrivalMoment`, `CandleFlickerMoment`) are `.ts` files loaded lazily through `momentLoader.ts`. Action feedback is built: toasts with a measured light clause (`src/lib/utils/lightClause.ts`), the row highlight (`src/components/feedback/`), the Dashboard `CryptGuide`, and the Landing demo preview (`src/lib/demo/preview.ts`). The old `ScenePlaceholder.tsx` was deleted. Not built yet: `src/components/{transactions,subscriptions,debts}/` feature folders, `src/components/settings/`, the spirit-jar moment, and CSV import. The settings screen lives in `src/components/screens/SettingsScreen.tsx`.

Test convention: property-based tests live in `tests/<area>/properties/pNN-<slug>.test.ts`, one file per numbered design property, tagged `// Feature: <spec>, Property N: <text>` (for example `tests/db/properties/p07-log-payment.test.ts`). Example-based tests stay beside them in `tests/<area>/`.

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
│   │   ├── layout.tsx          # Root layout (fonts, global styles, CryptProvider, ToastRegion)
│   │   ├── (app)/              # Route group for the app screens; URLs have no "(app)" segment
│   │   │   ├── layout.tsx      # Wraps every screen in AppShell
│   │   │   ├── page.tsx        # Home: Landing or Dashboard (renders HomeScreen)
│   │   │   ├── transactions/
│   │   │   │   └── page.tsx    # Transaction list + manual entry (CSV import planned)
│   │   │   ├── subscriptions/
│   │   │   │   └── page.tsx    # Subscription (zombie) manager
│   │   │   ├── debts/
│   │   │   │   └── page.tsx    # Debt manager — list, add debt, log payment
│   │   │   ├── exorcism/
│   │   │   │   └── page.tsx    # Weekly exorcism plan
│   │   │   └── settings/
│   │   │       └── page.tsx    # Settings — data export / import, clear data
│   │   ├── styleguide/
│   │   │   └── page.tsx        # /styleguide route; renders StyleguideContent
│   │   └── globals.css         # Tailwind v4 entry, :root tokens, @theme inline aliases, base layer
│   │
│   ├── components/
│   │   ├── styleguide/
│   │   │   └── StyleguideContent.tsx   # Living styleguide: every primitive and token
│   │   ├── house/              # SVG house and all its animated states (GSAP)
│   │   │   ├── HouseScene.tsx  # Root component; composes all house layers (one role="img")
│   │   │   ├── HouseBase.tsx   # Static structural SVG
│   │   │   ├── DecayLayer.tsx  # Overlay that reflects decay level 1–5
│   │   │   ├── ForegroundLayer.tsx # Ground, fence, trees and fog in front of the house
│   │   │   ├── WindowsLayer.tsx    # Window glow driven by the opacity curve
│   │   │   ├── ZombieBasement.tsx
│   │   │   ├── GhostSwarm.tsx
│   │   │   ├── Poltergeist.tsx
│   │   │   ├── GraveyardRow.tsx    # Tombstone trophies for banished subscriptions
│   │   │   ├── SceneLabels.tsx     # Level name and nameplate labels
│   │   │   ├── AmbientMotion.tsx   # Continuous GSAP loops (fog, fireflies, bats, sway)
│   │   │   └── houseGeometry.ts    # Shared SVG coordinates and shapes
│   │   ├── moments/            # One-shot GSAP moment animations. Play modules are .ts (no JSX); art is in MomentArt.tsx
│   │   │   ├── ShovelMoment.ts         # Cancel subscription → shovel bonk → tombstone
│   │   │   ├── CandleOrbMoment.ts      # Log extra payment → orb flies to house, windows flare
│   │   │   ├── SigilMoment.ts          # Poltergeist bound → sigil circle draw
│   │   │   ├── ThreeCandlesMoment.ts   # Weekly plan completed → three candles light
│   │   │   ├── LevelChangeMoment.ts    # Decay level improves (dawn) or worsens (creak)
│   │   │   ├── PoltergeistFeedMoment.ts # Small expense feeds (or wakes) the Poltergeist
│   │   │   ├── GhostArrivalMoment.ts   # Small expense adds a ghost (or pulses the overflow marker)
│   │   │   ├── CandleFlickerMoment.ts  # Fallback plan action ticked → windows flicker
│   │   │   ├── MomentArt.tsx           # SVG art shared by the moments (shovel, tombstone, flame, orb, sigil, candles)
│   │   │   ├── MomentHost.tsx          # Moment_Layer: runs the queue, skip on click or Esc
│   │   │   ├── momentLoader.ts         # Lazy registry of the play modules
│   │   │   ├── driveOnWallClock.ts     # Drives timelines on the wall clock
│   │   │   └── sheetGate.ts            # Holds moments while a sheet is open
│   │   ├── shell/              # App chrome around every screen
│   │   │   ├── AppShell.tsx    # Layout: Sidebar ≥1024px, TabBar below, main landmark
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TabBar.tsx
│   │   │   ├── NavLink.tsx
│   │   │   ├── SkipLink.tsx
│   │   │   └── DemoChip.tsx    # "Demo mode" marker with the demo date
│   │   ├── common/             # Shared screen pieces
│   │   │   ├── EmptyState.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── StorageBlockedCard.tsx
│   │   ├── landing/
│   │   │   └── Landing.tsx     # Home with no Active_Crypt
│   │   ├── dashboard/
│   │   │   ├── CryptGuide.tsx  # Next-step guide card on the Dashboard
│   │   │   ├── Dashboard.tsx
│   │   │   └── PoltergeistBanner.tsx
│   │   ├── feedback/           # Action feedback: toasts and row highlight
│   │   │   ├── RowHighlightProvider.tsx # Pending highlight, useRequestHighlight, useRowHighlight
│   │   │   └── useActionToast.ts       # Toast with light clause and "View" action
│   │   ├── sheets/             # BottomSheet-based forms and confirmations
│   │   │   ├── OnboardingSheet.tsx
│   │   │   ├── LogPaymentSheet.tsx
│   │   │   ├── AddExpenseSheet.tsx
│   │   │   ├── CancelSubscriptionSheet.tsx
│   │   │   ├── DeleteConfirmSheet.tsx
│   │   │   └── useFocusFirstInvalid.ts # Focuses the first invalid Field after a failed submit
│   │   ├── screens/            # One Client Component per route, rendered by the page files
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── TransactionsScreen.tsx
│   │   │   ├── SubscriptionsScreen.tsx
│   │   │   ├── DebtsScreen.tsx
│   │   │   ├── ExorcismScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   ├── demo/
│   │   │   └── DemoControls.tsx  # Jumps to any of the 5 demo decay levels, reset, skip a week
│   │   ├── exorcism/
│   │   │   ├── ExorcismPlan.tsx
│   │   │   └── ExorcismPlanAction.tsx   # Wraps ExorcismActionRow with plan-level logic
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
│   │   ├── db/                 # Dexie data layer (the only importer of dexie)
│   │   │   ├── schema.ts       # Table definitions and versions
│   │   │   ├── crypt.ts        # Opening helpers for the crypt database (injectable in tests)
│   │   │   ├── modeStore.ts    # Which Crypt is active ("demo" or "real"); no financial data
│   │   │   ├── mutations.ts    # One function per user action, one Dexie transaction each
│   │   │   ├── queries.ts      # Read-only queries
│   │   │   ├── plans.ts        # Weekly plan service
│   │   │   ├── refKeys.ts      # Reference keys of idempotent events
│   │   │   ├── snapshotAdapter.ts  # Stored rows (cents) → FinancialSnapshot
│   │   │   └── errors.ts       # Typed data-layer errors
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
│   │   │   ├── config.ts       # Every number and key used by the planner
│   │   │   └── types.ts        # ExorcismAction type
│   │   ├── scene/              # Pure scene model (no React, no GSAP)
│   │   │   ├── index.ts        # Public API: buildSceneModel(), countGhosts()
│   │   │   ├── config.ts       # Scene-only colors, decay tints, window opacity curve, validateSceneConfig()
│   │   │   ├── features.ts     # Level feature table (what appears at each decay level, wonk)
│   │   │   ├── hash.ts         # Deterministic id hashing (FNV-1a + fmix32)
│   │   │   ├── layout.ts       # Positions for zombies, ghosts, graveyard
│   │   │   ├── windows.ts      # Window opacity from the light score
│   │   │   ├── momentGeometry.ts   # Paths and sizes for the moments
│   │   │   ├── summary.ts      # Level-aware text summary of the scene
│   │   │   └── types.ts
│   │   ├── moments/            # Framework-agnostic moment queue
│   │   │   ├── queue.ts        # Plays moments one at a time; supports skip (Promise-based queue)
│   │   │   ├── hold.ts         # Holds requests until the UI is ready
│   │   │   ├── requests.ts     # Builds moment requests from user actions and level changes
│   │   │   └── types.ts
│   │   ├── demo/
│   │   │   ├── preview.ts      # Landing preview of the demo house (no Dexie)
│   │   │   ├── seed.ts         # Five named demo scenarios (one per decay level)
│   │   │   └── service.ts      # Load a scenario, skip a week, reset (Demo_Crypt only)
│   │   ├── validation/         # Pure input validators (never throw; no React, Dexie or Next)
│   │   │   ├── inputs.ts       # Validators returning a ValidationResult
│   │   │   └── limits.ts       # Shared input limits
│   │   └── utils/              # Pure UI helpers (framework-agnostic)
│   │       ├── calendar.ts         # Calendar-date arithmetic and plan week start
│   │       ├── cents.ts            # Cents/dollars conversion and money text
│   │       ├── planView.ts         # Plan presentation: Do it targets, summary
│   │       ├── scoreView.ts        # Light score view data and weekly delta
│   │       ├── listViews.ts        # Row view models for transactions, subscriptions and debts
│   │       ├── money.ts            # Money input sanitising, blur formatting, currency parts
│   │       ├── score.ts            # Score clamping, fill percent, score text and breakdown
│   │       ├── delta.ts            # Delta chip presentation (sign, icon, tone)
│   │       ├── segmentedNav.ts     # Arrow/Home/End navigation over enabled segments
│   │       ├── focusTrap.ts        # Focusable selector, initial focus rule, next focus index, inert skip rule
│   │       ├── lightClause.ts      # Toast light clause ("Light +5.2") and ghost clause
│   │       ├── destinations.ts     # Highlight targets: paths, labels, row DOM ids
│   │       └── toastReducer.ts     # Toast queue reducer and live-region choice
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useCrypt.tsx        # CryptProvider + useCrypt(): active crypt, status, mode switching
│   │   ├── useCryptData.ts     # Live query over every table of the Active_Crypt
│   │   ├── useCryptActions.ts  # User actions (log payment, cancel, delete, ...) over db mutations
│   │   ├── useNow.ts           # Today's date (local date, or the demo date in the Demo_Crypt)
│   │   ├── useHouseState.ts    # Returns live HouseState
│   │   ├── useSceneModel.ts    # HouseState + crypt data → SceneModel for HouseScene
│   │   ├── useActionObserver.ts # Watches user actions and level changes, queues moments
│   │   ├── useElementWidth.ts  # Measures an element's width (scene size, label placement)
│   │   ├── useReducedMotionPreference.ts # prefers-reduced-motion for scene code
│   │   ├── useExorcismPlan.ts  # Current weekly plan
│   │   └── useDemo.ts          # Loads / resets demo data, skips a week
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
│   │   ├── planner.test.ts
│   │   ├── staticChecks.test.ts
│   │   └── properties/         # p15–p22, one file per property
│   ├── db/                     # Data layer tests (fake-indexeddb)
│   │   ├── schema.test.ts, mutations.test.ts, queries.test.ts, plans.test.ts, autoCompletion.test.ts, snapshotAdapter.test.ts, moduleBoundaries.test.ts
│   │   └── properties/         # p04–p14, p23, p32, p35–p37
│   ├── demo/                   # Seed, service, calibration and brand-scan tests
│   │   └── properties/         # p29–p31
│   ├── validation/
│   │   └── inputs.test.ts
│   ├── design-system/          # Token, contrast, focus-ring and source-scan tests (node)
│   │   ├── contrast.test.ts
│   │   ├── focusRing.test.ts
│   │   ├── sourceScan.test.ts
│   │   ├── tokens.test.ts
│   │   └── helpers/contrast.ts
│   ├── ui/                     # Component and page tests (jsdom project)
│   │   ├── setup.ts            # Vitest setup file: jest-dom, cleanup, matchMedia stub, reduced-motion mock
│   │   ├── helpers/            # axe.ts, crypt.tsx, motion.ts, viewport.ts
│   │   └── *.test.ts(x)        # One file per primitive, plus styleguide, screen, sheet and hook tests
│   ├── feedback/               # Action feedback: clause, destinations, guide step, preview
│   │   └── properties/         # p01–p07
│   └── utils/                  # Unit tests for src/lib/utils/ (one file per helper)
│       └── properties/         # p01–p03, p24–p28
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
