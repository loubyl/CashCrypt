# 🏚️ CashCrypt

> *Your money habits haunt your house.*

**Live app: [cash-crypt.vercel.app](https://cash-crypt.vercel.app)** — try the demo crypt, no sign-up.

CashCrypt is a local-first personal finance web app where your financial health is reflected as a living, decaying haunted house. Debt crumbles the walls. Recurring subscriptions shamble through the basement as zombies. Small daily expenses swarm as ghosts — and when they pile up, they merge into a monster. Pay your debts and cancel your subscriptions to bring the light back.

Built for the **Kiroween 2026 Hackathon** — Costume Contest category.

> **Status: work in progress.** The app works end to end: the dashboard shows the haunted house scene and the light score, and debts, subscriptions, transactions, the weekly plan, settings and the demo crypt are all functional. The animated house scene (SVG house, creatures and moments) is built. Sound and CSV import are not built yet.

---

## ✨ What works today

- **Light score and decay level** — the pure haunting engine (`src/lib/haunting/`) turns your income, debts, subscriptions, transactions and recent actions into a light score (0–100) and a decay level (1–5). The dashboard shows both.
- **Debts** — add, edit and delete debts (name, balance, APR, minimum payment) and log payments. A payment lowers the balance and can raise the score; a paid-off debt no longer counts its minimum payment.
- **Zombie subscriptions** — add, edit and delete recurring subscriptions with a usage level (often, rarely, never), cancel them into the graveyard and bring them back.
- **Ghost expenses** — add and delete expenses. Small ones are ghosts; when the 30-day total of small expenses passes the threshold, a Poltergeist banner appears on the dashboard.
- **Weekly exorcism plan** — three prioritized actions per week (see below).
- **Demo crypt** — a seeded crypt with five scenarios, one per decay level. No sign-up needed.
- **Local-first** — all data lives in your browser (IndexedDB). No accounts, no server, no telemetry.

## 🧭 Not built yet

- The spirit-jar moment (ghosts captured).
- Sound.
- CSV import.
- Data export and import as JSON. Settings currently offers income, crypt switching and "Clear all data".

---

## 🎃 Demo flow

1. Open the app. With no data, the landing page shows **Enter the demo crypt**.
2. The demo opens at decay level 4 with a Poltergeist and several subscriptions.
3. On the dashboard (and in Settings while in the demo), the **Demo controls** card lets you:
   - pick a scenario from **Level 1** to **Level 5**,
   - **Reset demo** to reload the current scenario,
   - **Skip to next week** to move the demo date seven days ahead, so a new weekly plan is generated.
4. Complete the plan actions to see the score rise.
5. Use **Start my own crypt** on the landing page, or the "Crypt" switch in Settings, to move to your own data. Switching never touches the demo data or your real data.

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

Fallbacks, such as setting aside an emergency fund, fill any slot without a real candidate. **Do it** performs the change from the plan (it opens the cancel or payment sheet) and completes the action when you confirm. You can also tick an action you did elsewhere. Completed actions, extra payments and cancellations add momentum to the light score.

## 💡 How the light score works

The light score (0–100) is a base score plus momentum. The base score is `100 / (1 + S)`, where `S` weighs your minimum payments, total debt and subscription cost, each relative to your income. Momentum (0–15) rewards the last 30 days of extra payments, cancellations and completed plan actions. The score sets one of five decay levels in bands of 20 (80–100 Pristine down to 0–19 Condemned). Details: [haunting-engine spec](.kiro/specs/haunting-engine/requirements.md).

## 🤖 Built with Kiro

- **Specs** in [`.kiro/specs/`](.kiro/specs): `haunting-engine`, `design-system-foundation` and `app-screens`, each written as requirements → design → tasks before the code.
- **Steering** in [`.kiro/steering/`](.kiro/steering): product, tech, structure, conventions, design system and visual language.
- **Property-based tests** with fast-check for every module: 73 properties, 141 property-based tests. Each spec's design defines the properties, and fast-check tests (`fc.assert`) check them, tagged with the property number: haunting-engine 20 properties / 46 tests, design-system-foundation 18 / 37, app-screens 35 / 58. A mutation-check rule in the steering requires every bug-fix test to fail when the bug is put back.
- **1111 tests** in 117 files, plus axe checks on every screen and a keyboard test suite.
- **Development journal** in [`docs/kiro-journal.md`](docs/kiro-journal.md): what the reviews, tests and manual checks caught along the way.

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
src/app/            — routes: / (landing or dashboard), /transactions, /subscriptions, /debts, /exorcism, /settings, /styleguide
src/lib/haunting/   — pure functions: financial data → house state
src/lib/exorcism/   — pure functions: house state → 3-action weekly plan
src/lib/db/         — Dexie schema, mutations and weekly plan storage
src/lib/demo/       — demo scenario seeds and service
src/lib/validation/ — input validators
src/lib/utils/      — pure UI helpers (money, calendar, score text, plan view)
src/hooks/          — React hooks bridging Dexie and the haunting engine
src/components/     — screens, shell, dashboard, sheets, exorcism plan, demo controls
src/components/ui/  — Crypt UI primitives
src/components/styleguide/ — the /styleguide page content
src/components/house/   — SVG house scene and creatures (GSAP)
src/components/moments/ — one-shot moment animations (GSAP)
src/lib/scene/          — pure scene model
src/lib/moments/        — moment queue
```

---

## 🔒 Privacy

CashCrypt stores your data exclusively in your browser. Nothing is ever sent to a server. You can delete your real data at any time with "Clear all data" in Settings. JSON export is planned and not built yet.

---

## 📄 License

[MIT](./LICENSE)
