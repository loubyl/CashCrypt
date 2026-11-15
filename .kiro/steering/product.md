# CashCrypt — Product Steering

## Vision

CashCrypt is a personal finance web app where your money habits haunt your house.
Financial health has a direct, visual consequence: a living, breathing haunted house that decays or recovers based on your real data.

## Core Metaphor

| Financial reality | Haunted-house representation |
|---|---|
| Outstanding debt | House structural decay (5 levels, driven by the light score) |
| Recurring subscriptions | Zombies in the basement |
| Accumulating small daily expenses | Ghosts that swarm and merge into a Poltergeist |
| Paying down debt | Light score rises, windows brighten, cracks seal |
| Canceling a subscription | A zombie disappears from the basement |

## User Goals

1. **See at a glance** how healthy their finances are without reading a table of numbers.
2. **Understand what is draining them** — which subscriptions and spending habits are the ghosts.
3. **Know exactly what to do next** — a weekly exorcism plan with three prioritized, concrete actions.

## Key Features

### House Dashboard
- Animated SVG house whose decay level (1–5) is derived from the **light score** (0–100) computed by the haunting engine.
- Each decay level has distinct visual states (see `visual-language.md`). Window light intensity interpolates continuously with the light score within a level, so every payment produces a visible change.
- Clicking any creature opens a detail panel for that financial item.

### Debts
- Debts are a first-class entity with four fields: name, current balance, APR, and minimum monthly payment.
- The "Log a Payment" action reduces a debt's balance and always raises or keeps the light score.
- Each debt is shown as a `DebtCard` on the `/debts` page.

### Zombies (Subscriptions)
- Each active recurring subscription is one zombie in the basement.
- Zombie size scales with monthly cost relative to income.
- Each subscription has a **usage** field: `often | rarely | never` (user-entered). The exorcism planner weighs cancellation value by usage.
- Canceling a subscription triggers a "banishment" animation and the zombie disappears.

### Ghosts (Small Daily Expenses)
- Transactions below `SMALL_EXPENSE_THRESHOLD` (default $15) spawn ghosts.
- Ghosts orbit the house individually.
- There is one global **Poltergeist**. When the 30-day rolling total of small expenses exceeds `POLTERGEIST_RATIO` (default 10% of monthly income), all ghosts merge into it.
- At decay level 5, if the Poltergeist exists it is the sole light source in the scene; if it does not exist, faint moonlight provides the only illumination.

### Exorcism Plan
- Generated every week (or on demand).
- Always exactly three actions, ranked by monthly money freed.
- Candidate actions: canceling a subscription (scored by monthly cost × usage weight, where `never` scores highest and `often` lowest — exact weights in `tech.md`) or making an extra debt payment (monthly interest saved).
- If fewer than three candidates exist, fill with fallback actions (e.g., "Set aside $X for an emergency fund", "Review last week's small expenses").
- Written in plain, actionable language ("Cancel Spotify — saves $11.99/mo").
- The user marks each action as done; completion triggers a mini-exorcism animation.

### Demo Crypt
- The default demo starts at **decay level 4** with an active Poltergeist and 5–6 zombies with mixed usage (`often`, `rarely`, `never`), so completing the exorcism plan produces a visible improvement.
- A **demo scenario switcher** lets judges jump directly to any of the five decay levels.
- Seed data never overwrites existing user data.

## Data Input
- Manual entry of transactions, subscriptions, income, and debts (name, balance, APR, minimum monthly payment).
- "Log a Payment" action on any debt reduces its balance.
- CSV import for transactions (no bank APIs, no server-side data).

## Privacy Model
- Strictly local-first: all data lives in the user's browser (IndexedDB).
- No accounts, no login, no telemetry.
- Users can export their data as JSON at any time.

## Out of Scope (v1)
- Bank API integrations.
- Multi-device sync.
- Budgeting categories beyond the metaphor (debt / subscriptions / small expenses).
- Mobile native app.
