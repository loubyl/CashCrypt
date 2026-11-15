# CashCrypt — Conventions Steering

## Language

- All **code** (variable names, function names, type names, constants) is written in **English**.
- All **comments** in source files are written in **English**.
- All **documentation** (README, steering files, inline JSDoc, test descriptions) is written in **English**.
- All **UI text** visible to the end user (labels, buttons, tooltips, error messages, the exorcism plan) is written in **English**.
- **Chat replies to the project owner** (this conversation) are always in **Spanish**.

## Code Style

- TypeScript strict mode is always on (`"strict": true` in `tsconfig.json`).
- No `any` types. Use `unknown` with type guards when the shape is truly unknown.
- Prefer `type` over `interface` for plain data shapes; use `interface` only when extension or merging is intentional.
- Named exports only — no default exports except for Next.js page and layout files (required by the framework).
- Pure functions are preferred. Side effects are isolated to hooks and `src/lib/db/`.
- No magic numbers or magic strings: extract to named constants.
- Functions should be short and single-purpose. If a function needs a comment to explain what it does, consider splitting it.

## Naming

| Thing | Convention | Example |
|---|---|---|
| React components | PascalCase | `HouseScene`, `ZombieBasement` |
| Hooks | camelCase, `use` prefix | `useHouseState`, `useDemo` |
| Pure functions | camelCase, verb | `computeHouseState`, `generateExorcismPlan` |
| Types / interfaces | PascalCase | `HouseState`, `ExorcismAction` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_DECAY_LEVEL`, `GHOST_THRESHOLD_RATIO` |
| CSS custom properties | kebab-case, following the prefixes in `design-system.md` | `--surface-card`, `--accent-candle`, `--text-primary` |
| Tailwind config tokens | camelCase in JS, kebab-case in class names | `surfaceCard` → `bg-surface-card` |
| Test files | Same name as subject + `.test.ts(x)` | `decay.test.ts` |
| Dexie table names | plural camelCase | `transactions`, `subscriptions` |

## File and Component Rules

- One React component per file. The file name matches the component name exactly.
- Colocate component-specific types and constants at the top of the same file. Move to `src/types/` only when shared.
- Framer Motion `variants` objects are defined in the same file as the component that uses them. This applies to chrome components only (`src/components/ui/`); GSAP scene components in `src/components/house/` and `src/components/moments/` do not use Framer Motion variants.
- Never import React components inside `src/lib/`. That directory is framework-agnostic.
- Never import Dexie directly in a component. Use hooks from `src/hooks/`.

## Testing

- Every function in `src/lib/haunting/` and `src/lib/exorcism/` has at least one Vitest unit test.
- Property-based tests with fast-check cover invariants (output range, output length, no thrown exceptions on arbitrary valid input).
- Test descriptions use plain English sentences: `"returns decay level 5 when light score is 10"`.
- No snapshot tests for pure functions — assert on specific output values.

## Git

- Commit messages follow Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `style:`, `refactor:`.
- Branch names: `feat/<short-description>`, `fix/<short-description>`.
- Never commit secrets, `.env` files, or any file listed in `.gitignore`.
- The `.kiro/` folder is **never** gitignored — it is part of the project definition.

## Accessibility (enforcement)

- Every interactive element has an accessible name (via visible label, `aria-label`, or `aria-labelledby`).
- Color is never the sole differentiator for any state or status (see `visual-language.md`).
- Chrome components (`src/components/ui/`) use Framer Motion's `useReducedMotion()` hook to disable animations.
- Scene components (`src/components/house/`, `src/components/moments/`) check `window.matchMedia('(prefers-reduced-motion: reduce)')` and skip or collapse GSAP timelines accordingly (see `visual-language.md` → `prefers-reduced-motion`).
- Run `axe` or equivalent in development to catch regressions early.
