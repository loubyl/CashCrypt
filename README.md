# 🏚️ CashCrypt

> *Your money habits haunt your house.*

CashCrypt is a local-first personal finance web app where your financial health is reflected as a living, decaying haunted house. Debt crumbles the walls. Recurring subscriptions shamble through the basement as zombies. Small daily expenses swarm as ghosts — and when they pile up, they merge into a monster. Pay your debts and cancel your subscriptions to bring the light back.

Built for the **Kiroween 2026 Hackathon** — Costume Contest category.

---

## ✨ Features

- **Haunted House Dashboard** — an animated SVG house with 5 decay levels driven by your real financial data.
- **Zombie Subscriptions** — every recurring charge is a zombie in the basement. Cancel one and watch it disappear.
- **Ghost Expenses** — small daily transactions orbit the house as translucent ghosts. Let them pile up and they merge into a Poltergeist monster.
- **Weekly Exorcism Plan** — three concrete, prioritized actions generated every week to improve your financial health.
- **Demo Crypt** — one-click seeded dataset covering all five decay levels. No sign-up needed.
- **Local-First** — all data lives in your browser (IndexedDB). No accounts, no server, no telemetry. Export your data at any time.
- **CSV Import** — import transactions from any bank export. No API keys required.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 24+

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
npm test             # run all tests
npm run test:ui      # Vitest UI in the browser
```

### Build

```bash
npm run build
npm start
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| House graphics | Inline SVG |
| Local storage | Dexie.js (IndexedDB) |
| Testing | Vitest + fast-check |
| Deploy | Vercel |

---

## 🗂️ Project Structure

See [`.kiro/steering/structure.md`](.kiro/steering/structure.md) for the full directory layout and module boundary rules.

Key directories:

```
src/lib/haunting/   — pure functions: financial data → house state
src/lib/exorcism/   — pure functions: house state → 3-action exorcism plan
src/lib/db/         — Dexie schema and migrations
src/components/     — React components (house SVG, creatures, UI)
src/hooks/          — React hooks bridging Dexie and the haunting engine
```

---

## 🔒 Privacy

CashCrypt stores your data exclusively in your browser. Nothing is ever sent to a server. You can export your full dataset as JSON at any time from the Settings panel.

---

## 📄 License

[MIT](./LICENSE)
