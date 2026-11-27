# 🏚️ CashCrypt

> *Your money habits haunt your house.*

**Live app: [cash-crypt.vercel.app](https://cash-crypt.vercel.app)** — try the demo crypt, no sign-up.

**Demo video:** coming soon.

CashCrypt is a local-first personal finance web app where your financial health is reflected as a living, decaying haunted house. Debt crumbles the walls. Recurring subscriptions shamble through the basement as zombies. Small daily expenses swarm as ghosts — and when they pile up, they merge into a monster. Pay your debts and cancel your subscriptions to bring the light back.

Built for the **Kiroween 2026 Hackathon** — Costume Contest category.

---

## ✨ What works today

- **Light score and decay level** — the pure haunting engine (`src/lib/haunting/`) turns your income, debts, subscriptions, transactions and recent actions into a light score (0–100) and a decay level (1–5). The dashboard shows both.
- **Debts** — add, edit and delete debts (name, balance, APR, minimum payment) and log payments. A payment lowers the balance and can raise the score; a paid-off debt no longer counts its minimum payment.
- **Zombie subscriptions** — add, edit and delete recurring subscriptions with a usage level (often, rarely, never), cancel them into the graveyard and bring them back.
- **Ghost expenses** — add and delete expenses. Small ones are ghosts; when the 30-day total of small expenses passes the threshold, a Poltergeist banner appears on the dashboard.
- **Weekly exorcism plan** — three prioritized actions per week (see below).
- **Animated house scene** — an SVG house at five decay levels with zombies, ghosts, the Poltergeist and a graveyard, animated with GSAP. One-shot **Moments** play after a real action, one at a time, and a click or any key skips them:
  - cancel a subscription: a cartoon shovel buries the zombie and a tombstone rises;
  - an extra debt payment: a candle flame sends a light orb to the house and the windows brighten;
  - the Poltergeist is bound: a sigil circle draws under it;
  - the weekly plan is completed: three candles light up;
  - the decay level changes: dawn when it improves, a crack and a shutter when it worsens;
  - a small expense feeds or wakes the Poltergeist: it swells and spirit particles burst out;
  - a small expense adds a ghost: the ghost fades in at its place;
  - a plan action that lifts the light after the Poltergeist is gone: the windows flicker once.

  With `prefers-reduced-motion` each Moment collapses to a short fade.
- **Toasts that state the light change** — each action says what happened to the money and to the light, for example "+$120/mo saved · Light +5.2". A **View** button opens the changed row, which is highlighted ("New" or "Updated") and focused.
- **Guide** — on entering the demo, a card explains the crypt and names the first step. **Show me** scrolls to it and marks the row "Start here". **How it works** brings the card back, in the demo and in your own crypt.
- **Landing preview** — the landing page shows the level-4 demo house before you enter, with a three-line "How it works".
- **Demo crypt** — a seeded crypt with five scenarios, one per decay level. No sign-up needed.
- **Local-first** — all data lives in your browser (IndexedDB). No accounts, no server, no telemetry.

## 🧭 Not built yet

- Sound.
- Data export and import as JSON. Settings offers income, crypt switching and "Clear all data".
- CSV import. The Dashboard no longer shows an "Import CSV" action.

---

## 🎃 Demo flow

1. Open the app. With no data, the landing page shows the level-4 house preview and **Enter the demo crypt**.
2. The demo opens at decay level 4 with a Poltergeist and several subscriptions. The **Guide** names the first step. **Show me** scrolls to it, and **Got it** hides the card.
3. Tick a cancel or a payment action in the plan, or press **Do it**. Its sheet opens, and confirming plays the Moment and shows the toast with the light change. Press any key or click to skip a Moment.
4. Use **View** in the toast to open the changed row, highlighted.
5. On the dashboard (and in Settings while in the demo), the **Demo controls** card lets you:
   - pick a scenario from **Level 1** to **Level 5**,
   - **Reset demo** to reload the current scenario,
   - **Skip to next week** to move the demo date seven days ahead, so a new weekly plan is generated.
6. Complete the plan actions to see the score rise.
7. Use **Start my own crypt** on the landing page, or the "Crypt" switch in Settings, to move to your own data. Switching never touches the demo data or your real data.

## 💾 Local-first storage

Data is stored in IndexedDB through Dexie, in two separate databases:

| Database | Purpose |
|---|---|
| `cashcrypt` | Your real data |
| `cashcrypt-demo` | The demo crypt |

The demo never reads or writes the real database, and demo-only operations (load scenario, skip a week, reset) refuse to run on `cashcrypt`. **Clear all data** in Settings deletes your real crypt only, and is disabled while the demo is active.

## 🕯️ Weekly exorcism plan

Each week the app generates exactly three actions, one per creature:

- **Zombie:** cancel a subscription, ranked by its monthly cost × a usage weight (never-used subscriptions rank highest).
- **Poltergeist:** cut its top small-expense category by the amount that puts small expenses back under the threshold.
- **Debt:** an extra payment on the highest-APR debt. It is always included, even when it would rank lower.

Fallbacks, such as setting aside an emergency fund, fill any slot without a real candidate. **Do it**, or ticking a cancel or payment action, opens its sheet and completes the action when you confirm. Other actions tick directly. Completed real actions, extra payments and cancellations add momentum to the light score.

**Welcome suggestions (fallbacks) add no light.** Ticking one marks it done, and the toast says it doesn't change the light. A new crypt's plan refreshes when you add data, so its suggestions follow your first debt or subscription.

## 💡 How the light score works

The light score (0–100) is a base score plus momentum. The base score is `100 / (1 + S)`, where `S` weighs your minimum payments, total debt and subscription cost, each relative to your income. Momentum (0–15) rewards the last 30 days of extra payments, cancellations and completed plan actions. The score sets one of five decay levels in bands of 20 (80–100 Pristine down to 0–19 Condemned). Details: [haunting-engine spec](.kiro/specs/haunting-engine/requirements.md).

## 🤖 Built with Kiro

- **Specs** in [`.kiro/specs/`](.kiro/specs): `haunting-engine`, `design-system-foundation`, `app-screens`, `house-scene` and `action-feedback`, each written as requirements → design → tasks before the code. `action-feedback` came from a manual UX review of the deployed demo.
- **Steering** in [`.kiro/steering/`](.kiro/steering): product, tech, structure, conventions, design system and visual language, plus two manual commands: `/spec-drift-check` (a read-only comparison of the changed files with a spec's design and tasks) and `/journal-draft` (drafts a dated journal entry from the commits).
- **Hook "Full check after agent work"** ([`.kiro/hooks/`](.kiro/hooks)): a Stop trigger that runs `npm test`, `npx tsc --noEmit` and `npm run lint`, strictly one after another, after a turn that changed code or root config. It skips turns that changed only documentation or Kiro config.
- **Property-based tests** with fast-check: 103 properties defined in the five designs and 227 property-based tests (`fc.assert`), each tagged with its property number. By spec: haunting-engine 20 properties / 46 tests, design-system-foundation 18 / 37, app-screens 37 / 58, house-scene 20 / 72, action-feedback 8 / 14. The `house-scene` count includes the properties that `action-feedback` extended.
- **Mutation-check rule** in the conventions steering: every test added for a bug fix must fail when the bug is put back, and the failing assertion is reported.
- **1649 tests** in 195 files, plus axe checks on every screen and a keyboard test suite.
- **Browser checks** in `scripts/check-moments.mjs`: it drives a local production build in headless Chrome and checks every Moment, the Guide, the Landing, focus and layout at several widths. It runs at normal speed and with frames 700 ms apart (`RAF_THROTTLE_MS=700`), which emulates a slow or background tab. The script header explains how to run it.
- **Development journal** in [`docs/kiro-journal.md`](docs/kiro-journal.md): what the reviews, tests and manual checks caught along the way.

### What Kiro caught

- **Ghosts piled on one spot.** Found in a manual review of the scene: the id hash gave nearly equal values to ids that differ in the last digit. The fix and a spacing property are in [the 2026-11-24 entry](docs/kiro-journal.md#2026-11-24--house-scene-phases-a-and-b-what-the-manual-checkpoints-and-the-new-tooling-caught).
- **Nine mismatches between code and design.** The first `/spec-drift-check` run on `house-scene` found them (same entry).
- **The payment Moment stalled in a throttled tab.** GSAP's lag smoothing shortened long frame gaps. The headless check with 700 ms frames found it, and every Moment now runs on the wall clock ([2026-11-26 entry](docs/kiro-journal.md#2026-11-26--house-scene-phases-c-to-e-what-the-moment-checks-and-the-deployed-reviews-caught)).
- **The plan checkbox lost keyboard focus while saving**, because it was briefly disabled. jsdom cannot show this, so a browser check samples the focus every 5 ms ([2026-11-27 entry](docs/kiro-journal.md#2026-11-27--action-feedback-complete-what-the-browser-checks-the-mutation-checks-and-the-deployed-reviews-caught)).
- **A toast said "feeds the Poltergeist" when there was none.** A deployed review found it, and the toast and the Moment now share one rule (same 2026-11-27 entry).

---

## 🚀 Getting Started

### Prerequisites

- Node.js 24+ and npm

### Install

```bash
npm install
```

### Develop

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Test

```bash
npm test                          # run all tests once (node and ui projects)
npx vitest --run --project node   # node project only: tests/**, excluding tests/ui/
npx vitest --run --project ui     # ui project only: jsdom component tests in tests/ui/
npm run test:ui                   # Vitest UI in the browser
```

Vitest is configured with two projects in `vitest.config.ts`. The `node` project runs the pure-logic, token, contrast and source-scan tests. The `ui` project runs component tests in a jsdom environment.

### Style guide (`/styleguide`)

The `/styleguide` route is a living reference for the Crypt UI design system. It renders the tokens (surfaces, text, accents, type scale, radius and font families) and one section per primitive in `src/components/ui/`, in their different states: Button, QuickAction, BalanceHero, Card, ListRow, Chip, SegmentedControl, Input, BottomSheet, Toast, LightScoreBar and ExorcismActionRow.

The page is marked `noindex, nofollow`, so search engines do not list it.

To open it, start the dev server and visit [http://localhost:3000/styleguide](http://localhost:3000/styleguide):

```bash
npm run dev
```

### Build

```bash
npm run build
npm start
```

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Run all Vitest tests once |
| `npm run test:ui` | Vitest UI in the browser |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` then `tsc --noEmit` |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime and package manager | Node.js 24, npm |
| Framework | Next.js 16.4.6 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Chrome animation | Framer Motion (Motion) |
| Scene animation | GSAP + `@gsap/react` |
| House graphics | Inline SVG |
| Local storage | Dexie.js (IndexedDB) |
| Testing | Vitest + fast-check, Testing Library, axe-core |
| Deploy | Vercel |

---

## 🗂️ Project Structure

See [`.kiro/steering/structure.md`](.kiro/steering/structure.md) for the full directory layout and module boundary rules.

Key directories:

```
src/app/                   — routes: / (landing or dashboard), /transactions, /subscriptions, /debts, /exorcism, /settings, /styleguide
src/components/ui/         — Crypt UI primitives (Button, Card, ListRow, Toast, BottomSheet, ...)
src/components/house/      — SVG house scene and creatures (GSAP)
src/components/moments/    — one-shot Moment animations (GSAP) and the Moment host
src/components/shell/      — app shell: sidebar, tab bar, skip link, demo chip
src/components/screens/    — one component per route
src/components/dashboard/  — Dashboard, Guide, Poltergeist banner
src/components/landing/    — Landing page with the house preview
src/components/feedback/   — row highlight and action toasts
src/components/sheets/     — bottom-sheet forms and confirmations
src/components/exorcism/   — weekly plan and plan actions
src/components/demo/       — demo controls
src/components/common/     — empty state, page header, skeleton
src/components/styleguide/ — the /styleguide page content
src/lib/haunting/          — pure engine: financial data → house state
src/lib/exorcism/          — pure planner: house state → 3-action weekly plan
src/lib/scene/             — pure scene model (layout, windows, Moment geometry)
src/lib/moments/           — Moment queue, hold and request planning
src/lib/db/                — Dexie schema, mutations, queries and weekly plan storage
src/lib/demo/              — demo scenario seeds, service and Landing preview
src/lib/validation/        — input validators
src/lib/utils/             — pure UI helpers (money, calendar, score text, plan view, light clause)
src/hooks/                 — React hooks bridging Dexie and the engine
src/types/                 — shared domain types
tests/                     — Vitest tests (node and jsdom projects), property tests in properties/
scripts/check-moments.mjs  — headless Chrome checks against a production build
.kiro/                     — specs, steering, hooks
docs/kiro-journal.md       — development journal
```

---

## 🔒 Privacy

CashCrypt stores your data exclusively in your browser. Nothing is ever sent to a server. You can delete your real data at any time with "Clear all data" in Settings. JSON export and import are not built.

---

## 🙏 Credits

- **Fonts**, loaded with `next/font/google` in `src/app/layout.tsx`: [Manrope](https://fonts.google.com/specimen/Manrope), [Inter](https://fonts.google.com/specimen/Inter), [Cinzel](https://fonts.google.com/specimen/Cinzel) and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono), all under the SIL Open Font License 1.1.
- **[Lucide](https://lucide.dev)** icons (ISC license).
- **[GSAP](https://gsap.com)** with `@gsap/react`, under GSAP's free standard license.
- **[Framer Motion](https://www.framer.com/motion/)** (MIT) and **[Dexie](https://dexie.org)** (Apache-2.0).
- **Reference image.** The image in `.kiro/specs/house-scene/references/` was generated with Google Gemini and used only as a style reference for the house art. It is not shipped in the app, and all SVG art is drawn in the repository.
- **Demo data.** All names, amounts and subscriptions in the demo crypt are fictional.

---

## 📄 License

[MIT](./LICENSE)
