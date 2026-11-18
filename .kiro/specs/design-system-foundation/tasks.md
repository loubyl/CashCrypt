# Implementation Plan: Design System Foundation

## Overview

Implement "Crypt UI" (`.kiro/steering/design-system.md`) as code, following the build order of Requirement 26 and the implementation order in design.md: the foundation increment (dependencies, Vitest projects, tokens, fonts, styleguide skeleton), then one increment per primitive (Button, Card, ListRow, Chip, Input with Money_Input, Toast + ToastRegion, BottomSheet, LightScoreBar, ExorcismActionRow, QuickAction, BalanceHero, SegmentedControl), then the closing pass (final axe run on `StyleguideContent`, keyboard test, steering and README updates) and the quality gates. The source scans and the contrast test are installed in the foundation increment (task 1) so they guard every later increment.

Scope limits: chrome register only. No scene, GSAP, Dexie, haunting engine or app screens. `src/lib/haunting/`, `tests/haunting/` and the haunting-engine spec are not modified (Req 25.5). The only new runtime dependencies are `framer-motion` and `lucide-react` (Req 25.6). The language is TypeScript (strict), named exports only, no `any`, English comments.

Increment rule (Req 26.2 to 26.4): every primitive task adds, in the same top-level task, the primitive, its `StyleguideContent` section (inserted in the Req 19.5 order, not in build order) and its Vitest tests. Pure helpers in `src/lib/utils/` carry their fast-check properties in the task that introduces them. Each increment must leave `npm run typecheck`, `npm run lint` and `npm test` passing, which includes the source scans (task 1.8) and the contrast test (task 1.9). Later tasks must not weaken, skip or narrow those tests.

Conventions that apply to every task:
- Read the relevant guide in `node_modules/next/dist/docs/` before touching Next.js specific files (`layout.tsx`, `page.tsx`, `next.config.ts`), per `AGENTS.md`.
- Primitives follow Req 5: `type` props, `className` for layout only, `ref` forwarded, `:focus-visible` ring, Framer variants in the same file, `useReducedMotion()` from `framer-motion`, `data-reduced-motion` attribute on the animated root, Lucide icons decorative with `aria-hidden="true"`. No hex values or color functions outside `globals.css`; no magic numbers (named constants).
- Property tests: tag `// Feature: design-system-foundation, Property N: <property text>`, use the property number from design.md, `{ numRuns: 100 }` or more. Test descriptions are plain English sentences. No snapshot tests.
- Component tests live in `tests/ui/<Primitive>.test.tsx` (jsdom project). Pure-helper tests live in `tests/utils/` and token and scan tests in `tests/design-system/` (node project).

## Tasks

- [x] 1. Foundation increment: dependencies, test infrastructure, tokens, fonts, styleguide skeleton
  - [x] 1.1 Install dependencies
    - Add `framer-motion` and `lucide-react` to `dependencies`.
    - Add `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom` and `axe-core` to `devDependencies` (no `vitest-axe`, no `jest-axe`).
    - Verify no other runtime dependency was added.
    - _Requirements: 5.12, 25.6_

  - [x] 1.2 Configure Vitest projects, jsdom setup and test helpers
    - Rewrite `vitest.config.ts` with `test.projects`: `node` (`tests/**/*.test.{ts,tsx}` excluding `tests/ui/**`, so `tests/haunting/` runs unchanged) and `ui` (`tests/ui/**/*.test.{ts,tsx}`, `environment: "jsdom"`, `setupFiles: ["./tests/ui/setup.ts"]`), both `extends: true`; keep the `@` alias, `passWithNoTests` and root-level `coverage`.
    - Create `tests/ui/setup.ts`: jest-dom matchers, explicit `cleanup()` in `afterEach`, `matchMedia` stub, partial `vi.mock("framer-motion")` that replaces only `useReducedMotion`, reset of reduced motion and viewport after each test.
    - Create `tests/ui/helpers/motion.ts` (`setReducedMotion`, `isReducedMotion`), `tests/ui/helpers/viewport.ts` (`installMatchMediaStub`, `setViewportWidth`, `resetViewport`) and `tests/ui/helpers/axe.ts` (`runAxe`, `formatViolations`, `expectNoAxeViolations`; WCAG A/AA and best-practice tags; only `color-contrast` disabled, named in a comment).
    - Add a JSX smoke test `tests/ui/smoke.test.tsx` that renders a `<div/>`. If it fails, add `@vitejs/plugin-react` as a dev dependency.
    - Verify `npm test` runs both projects and `tests/haunting/` still passes.
    - _Requirements: 22.1, 22.3, 22.8, 22.10, 23.1, 23.5, 23.6, 18.3, 18.5_

  - [x] 1.3 Create the token sheet in `src/app/globals.css`
    - Replace the `create-next-app` defaults (`--background`, `--foreground`, `prefers-color-scheme` block, Arial stack).
    - `:root`: surfaces, `--divider`, text tokens, `--border-control`, `--focus-ring`, accents, semantic aliases, 14% tinted accent variants through `color-mix`, data-viz palette, light-score gradient, duration tokens (120, 200, 280, 600ms), press scale 0.97, reduced-motion fade ceiling 150ms, page/card/gap spacing, content width 560px, scrim token (`--surface-void` at partial opacity).
    - `@theme inline` per design.md Decision 6: color aliases per the Color_Utility_Map (`ink`, `surface-*`, `candle`, `ecto`, `blood`, `ghost`, `spirit`, `control`, `focus`, `divider`, tint colors), radius (`pill`, `lg`, `md`), 4px spacing scale, overlay shadow, font-size tokens `hero` to `caption` with line-height, tracking and weight companions, `--font-display|sans|wordmark|mono` with system fallbacks, `--container-content`.
    - Color tokens stay in `:root` (not `@theme`) so Tailwind does not read `--text-*` as font sizes.
    - Base layer: `color-scheme: dark`, body background and color, Inter default, `scrollbar-gutter: stable`, `html[data-scroll-locked] body { overflow: hidden }`, `@keyframes shimmer` (1.6s) disabled under `prefers-reduced-motion: reduce`. No custom `tabular-nums` class.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 4.4, 4.5, 4.6, 14.8, 14.11_

  - [x] 1.4 Load fonts and update the root layout
    - In `src/app/layout.tsx` replace Geist with `next/font/google`: Manrope 700/800, Inter 400/500/600, Cinzel 500, JetBrains Mono 400, each with `display: "swap"` and CSS variables `--font-manrope`, `--font-inter`, `--font-cinzel`, `--font-jetbrains-mono`; apply all four variable classes to `<html>`.
    - Replace the scaffold `title` and `description` with the CashCrypt name and a one-sentence description. Keep the `LayoutProps<"/">` signature.
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 4.8, 4.9_

  - [x] 1.5 Create `src/components/ui/motionTokens.ts`
    - Export named constants mirroring the CSS durations: `PRESS_DURATION_S`, `TAB_DURATION_S`, `SHEET_DURATION_S`, `COUNT_DURATION_S`, `PRESS_SCALE`, `REDUCED_FADE_MAX_S`, `TOAST_RISE_PX`, plus the other shared motion numbers later primitives need (wiggle degrees, shake pixels, success morph ms, toast default duration).
    - Export the `LayoutClassName` type alias documented as layout-only and a small `getPressMotion(reduced)` helper that returns `{}` when reduced.
    - _Requirements: 2.6, 2.7, 5.8, 18.1, 18.2_

  - [x] 1.6 Create the styleguide route skeleton
    - `src/app/styleguide/page.tsx`: server component, no `"use client"`, exports `metadata = { title: "Styleguide", robots: { index: false, follow: false } }` and renders `<StyleguideContent />`.
    - `src/components/styleguide/StyleguideContent.tsx`: `"use client"`, named export, one `<main>`, one `<h1>`, `h2` per section, `h3` inside cards; single centered column (max 560px) below 1024px and a 2-column grid from 1024px, no horizontal scroll at 375px.
    - Tokens section: labelled swatches for every surface, text and accent token (token name plus hex written at runtime from `getComputedStyle` through a ref callback, no hex literal in source), type scale with token names, radius tokens and the four font families. Sentence-case copy.
    - Build the section list as a structure that later tasks append to in Req 19.5 order; a section for a not-yet-built primitive is omitted.
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.6, 19.14, 19.15, 19.16, 19.17, 19.18, 21.7, 26.6_

  - [x] 1.7 Write the token value test in `tests/design-system/tokens.test.ts`
    - Parse `src/app/globals.css` and assert every token value of Requirements 1 and 2 (surfaces, divider, text, control, focus equals candle, accents, semantic aliases, tinted variants, palette order, radii, spacing, shadow, durations, press scale, type scale, gradient, shimmer).
    - Assert every Color_Utility_Map entry in `@theme inline` references the matching CSS variable (for example `--color-ink: var(--text-primary)`).
    - Assert `motionTokens.ts` constants equal the CSS durations.
    - Assert `layout.tsx` loads the four families with the required weights and `display: "swap"`, and no Geist import remains.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 4.1, 4.2, 4.3, 4.7, 24.6, 24.7_

  - [x] 1.8 Install the source scans in `tests/design-system/sourceScan.test.ts`
    - Hex and color-function scan: every `.ts`, `.tsx` and `.css` file under `src/` except `src/app/globals.css`, `src/lib/haunting/`, `src/lib/exorcism/`, `src/components/house/` and `src/components/moments/`; failures report file and line.
    - Import scans on `src/components/ui/`: no GSAP, `@/lib/db`, `@/hooks` or `@/lib/haunting` imports, no default exports; `ExorcismActionRow.tsx` has no `@/lib/exorcism` import. `StyleguideContent` imports nothing from `@/lib/db`, `@/hooks`, `@/components/house` or `@/components/moments`. `src/app/styleguide/page.tsx` contains no `"use client"` directive.
    - `className` scan over every `.tsx` under `src/app/**` and `src/components/**` except `src/components/ui/**`: fails when a primitive imported from `@/components/ui/*` receives a visual utility (`bg-`, color `text-`, `border`, `rounded`, `p*-`, `shadow`, `font-`, `ring-`, `outline-`). Fixture strings prove `<Button className="bg-ecto">` is flagged and `<Button className="mt-4 w-full">` passes.
    - Every scan must pass when `src/components/ui/` is empty or does not exist yet (a missing directory or a directory with no `.tsx` files is not an error), so the sub-task can land before any primitive.
    - These scans keep running on every later increment through `npm test`. Later tasks must not weaken, skip, narrow or add exclusions to them, and the checkpoint and quality-gate steps (tasks 2, 8, 11, 17, 19 and 20) run them explicitly.
    - Create `tests/ui/styleguide.page.test.ts`, which imports the page module and asserts `metadata.robots` has `index` and `follow` false.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.4, 5.6, 5.8, 16.8, 17.9, 19.1, 19.2, 19.15, 22.11, 23.8_

  - [x] 1.9 Create the contrast helper and `tests/design-system/contrast.test.ts`
    - `tests/design-system/helpers/contrast.ts`: `parseHex`, `relativeLuminance`, `contrastRatio` (test-only).
    - Parse color tokens from `globals.css`; assert every pair of Req 20.1 to 20.5 meets its threshold (text on surfaces ≥4.5 except tertiary on overlay which is not used, `--border-control` ≥3 on void, card and raised, focus ring ≥3 on every surface, accents on card ≥4.5, void text on primary and danger buttons ≥4.5, done-state text on card ≥4.5) and that computed ratios match the published `design-system.md` values within 0.1.
    - **Property 14: Contrast ratio is bounded, symmetric and reflexive**
    - Runs on every later increment through `npm test`; later tasks must not weaken it.
    - **Validates: Requirements 17.5, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8**

- [x] 2. Checkpoint - foundation
  - Run `npm test` (including the source scans of 1.8 and the contrast test of 1.9), `npm run typecheck` and `npm run lint`; ensure all pass, ask the user if questions arise.

- [x] 3. Button increment
  - [x] 3.1 Create `src/components/ui/Button.tsx`
    - Variants `primary` (default), `secondary`, `ghost`, `danger`; sizes `sm` 36, `md` 44 (default), `lg` 52; pill radius; native `<button type="button">`; `sm` extends the hit area to 44px with a pseudo-element.
    - `loading`: spinner, `aria-busy="true"`, activation ignored, width kept by a fixed-width label wrapper. Disabled or loading never calls `onClick`.
    - Optional `leadingIcon` at 20px; icon-only form requires `aria-label` through a discriminated union.
    - `success`: label morphs to a check for 600ms, announced through a visually hidden `aria-live="polite"` span.
    - Press: `whileTap` scale 0.97 over 120ms unless reduced; `data-reduced-motion`; forward `ref`; Focus_Ring on `:focus-visible`.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.13, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 18.1, 18.3_

  - [x] 3.2 Add the Button section to `StyleguideContent`
    - All 4 variants × 3 sizes, plus disabled and loading for each variant, the `success` morph, leading icon and icon-only examples, each labelled with variant and state.
    - _Requirements: 19.5, 19.7, 19.14, 26.2_

  - [x] 3.3 Write component tests in `tests/ui/Button.test.tsx`
    - Role and accessible name, each variant and size reflected in output, default `type="button"`, disabled and loading do not call `onClick`, `aria-busy`, Enter and Space activate once (user-event), success announcement region, `// @ts-expect-error` for an icon-only button without `aria-label`.
    - Reduced motion: `setReducedMotion(true)`, assert `data-reduced-motion="true"` and no scale configured, same behavior.
    - _Requirements: 6.1, 6.6, 6.7, 6.8, 6.10, 6.11, 6.12, 18.5, 21.3, 22.4, 22.5, 22.6_

- [x] 4. Card increment
  - [x] 4.1 Create `src/components/ui/Card.tsx`
    - `--surface-card`, radius 24, padding 20, no border, outline or shadow; optional `title` rendered as a heading (`headingLevel`, default `h2`); `<section aria-labelledby>` when titled; optional `action` (`label` plus `href` or `onClick`) as a ghost link or button whose accessible name includes the title.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 5.2, 5.3, 5.4_

  - [x] 4.2 Add the Card section to `StyleguideContent`
    - Untitled, titled, and titled with action; labelled.
    - _Requirements: 19.5, 19.8, 19.14, 26.2_

  - [x] 4.3 Write component tests in `tests/ui/Card.test.tsx`
    - Titled card is a labelled region, heading level prop, action name includes the title, untitled card has no region role, no border classes.
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 22.4_

- [x] 5. ListRow increment
  - [x] 5.1 Create `src/components/ui/ListRow.tsx`
    - 64px row, 40px tinted circle avatar, `body-lg` title, `caption` secondary subtitle, right-aligned `tabular-nums` amount (≥15px), `+`/`−` sign as text with ecto or primary color for `in`/`out`, optional inset 1px divider.
    - Interactive form renders `<button>` or `<a>` with raised pressed surface and Focus_Ring; non-interactive form has no button or link role.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 20.9, 5.9, 5.10_

  - [x] 5.2 Add the ListRow section to `StyleguideContent`
    - Static row, interactive button row, link row, amount in/out, with and without divider, disabled where supported.
    - _Requirements: 19.5, 19.8, 19.14, 26.2_

  - [x] 5.3 Write component tests in `tests/ui/ListRow.test.tsx`
    - Role per form (button, link, none), sign text for in/out, title and subtitle, divider presence, Enter and Space call the handler once on the interactive row.
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 21.3, 22.4_

- [x] 6. Chip increment
  - [x] 6.1 Create `src/components/ui/Chip.tsx`
    - 24px pill, tinted background, full accent color for icon and text; tones `success`, `warning`, `danger`, `info`, `spirit`, `neutral`; required children label; icon required for every tone except `neutral` (discriminated union); `label` or `caption` scale, never below 12px.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 20.9_

  - [x] 6.2 Add the Chip section to `StyleguideContent`
    - Every tone with icon and label.
    - _Requirements: 19.5, 19.8, 19.14, 26.2_

  - [x] 6.3 Write component tests in `tests/ui/Chip.test.tsx`
    - Label rendered for each tone, icon present and `aria-hidden` for non-neutral tones, `// @ts-expect-error` for a missing icon on a colored tone.
    - _Requirements: 11.2, 11.3, 22.4_

- [x] 7. Input and Money_Input increment
  - [x] 7.1 Create `src/lib/utils/money.ts` (sanitizer and blur formatter)
    - Export `sanitizeMoneyInput(raw)` (result matches `^\d*(\.\d{0,2})?$`, idempotent, total) and `formatMoneyOnBlur(sanitized)` (`""` and `"."` give `""`, otherwise exactly 2 fractional digits). Named constants, no throw.
    - _Requirements: 13.10, 13.12, 13.13_

  - [x] 7.2 Create `src/components/ui/Input.tsx`
    - 52px, radius 16, card or raised fill, 1px `--border-control`, floating label bound by `htmlFor`/`id` (`useId` fallback) that stays readable in every state.
    - `error`: `aria-invalid`, icon plus text, `aria-describedby`, blood border, one 3 × 4px shake over 240ms when first shown (not when reduced). `hint` linked through `aria-describedby`. Disabled sets the native attribute and stays readable.
    - `variant="money"`: currency prefix in secondary, Manrope centered number at `title` size or larger, `inputMode="decimal"`, `tabular-nums`, `onChange` through `sanitizeMoneyInput`, `onBlur` through `formatMoneyOnBlur`.
    - Forward `ref` to the `<input>`.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 13.13, 5.9, 18.1_

  - [x] 7.3 Add the Input section to `StyleguideContent`
    - Text input and Money_Input in default, filled, error and disabled states, plus a hint example.
    - _Requirements: 19.5, 19.8, 19.12, 19.14, 26.2_

  - [x] 7.4 Write component tests in `tests/ui/Input.test.tsx`
    - Label is the accessible name, `aria-invalid` and `aria-describedby` for error and hint, disabled attribute, money input rejects letters and a second dot and caps at 2 decimals on typing, blur formats `5` to `5.00`, `inputmode="decimal"`, reduced motion shows the error without a shake (`data-reduced-motion`).
    - _Requirements: 13.2, 13.4, 13.6, 13.7, 13.8, 13.9, 13.10, 13.13, 18.5, 22.4, 22.6_

  - [x] 7.5 Write property tests in `tests/utils/money.test.ts`
    - **Property 1: Money sanitizer output is always well formed**
    - **Property 2: Money sanitizer is idempotent**
    - **Property 3: Money blur formatting yields exactly two decimals and preserves the value**
    - Generators: strings biased toward digits, `.`, `,`, `-`, `e`, whitespace. Add example edge cases (`""`, `"."`, `".5"`, `"1.234"`).
    - **Validates: Requirements 13.10, 13.12, 13.13**

- [x] 8. Checkpoint - first primitives
  - Run `npm test` (the source scans of 1.8 and the contrast test of 1.9 included, unmodified), `npm run typecheck` and `npm run lint`; ensure all pass, ask the user if questions arise.

- [x] 9. Toast and ToastRegion increment
  - [x] 9.1 Create `src/lib/utils/toastReducer.ts`
    - Export `ToastTone`, `ToastItem`, `ToastAction`, `toastReducer` (`show` appends, `dismiss` of an unknown id returns the same array reference) and `getToastRegion(tone)` (`success`, `info` polite; `warning`, `danger` assertive).
    - _Requirements: 15.3, 15.7, 15.8_

  - [x] 9.2 Create `src/components/ui/Toast.tsx`
    - Pill on `--surface-overlay` with overlay shadow, one line of `--text-primary`, a distinct icon shape per tone (ecto for success), optional ghost action button with a 44px target.
    - Timer calls `onDismiss` once after `duration` (default 4000ms); pointer enter/leave and focus in/out pause and resume it. Enter: rise 12px with fade, or ≤150ms fade when reduced; animated exit, immediate removal when reduced.
    - _Requirements: 15.1, 15.2, 15.10, 15.11, 15.12, 15.13, 15.14, 15.15, 15.16, 20.9_

  - [x] 9.3 Create `src/components/ui/ToastRegion.tsx` and mount it in the layout
    - `"use client"`; export `ToastRegion` and `useToast` (`show`, `dismiss`; stable callbacks in their own context, deterministic ids from a ref counter). `useToast` outside a region throws an error naming `useToast` and `ToastRegion`.
    - Render `{children}` plus a `data-inert-exempt` wrapper that always contains both live regions on first render: `role="status"` polite and `role="alert"` assertive.
    - Mount `<ToastRegion>` once in `src/app/layout.tsx` around `{children}`.
    - _Requirements: 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 26.5_

  - [x] 9.4 Add the Toast section to `StyleguideContent`
    - One trigger per tone calling `useToast().show`, plus one example with an action. No second `ToastRegion`.
    - _Requirements: 19.5, 19.9, 19.14, 15.5, 26.2_

  - [x] 9.5 Write component tests in `tests/ui/Toast.test.tsx` and `tests/ui/ToastRegion.test.tsx`
    - Both live regions exist before any toast; success and info land in `role="status"`, warning and danger in `role="alert"`; `show` returns an id, `dismiss` removes it and an unknown id changes nothing; `useToast` outside a region throws; auto-dismiss after `duration` with fake timers; hover and focus pause the timer; action button works; reduced motion removes the rise (`data-reduced-motion`).
    - _Requirements: 15.3, 15.4, 15.7, 15.8, 15.9, 15.12, 15.13, 15.15, 18.5, 22.6_

  - [x] 9.6 Write property tests in `tests/utils/toastReducer.test.ts`
    - **Property 13: Toast reducer adds to the matching region and ignores unknown dismissals**
    - **Validates: Requirements 15.3, 15.7, 15.8**

- [x] 10. BottomSheet increment
  - [x] 10.1 Create `src/lib/utils/focusTrap.ts`
    - Export `FOCUSABLE_SELECTOR`, `getNextFocusIndex(count, current, shift)` and `shouldSkipInert(tagName, hasInertExemptAttribute)` exactly as in design.md Decision 4. Total functions, never throw.
    - _Requirements: 14.3, 14.4_

  - [x] 10.2 Create `src/components/ui/BottomSheet.tsx`
    - `isClient` through `useSyncExternalStore`; `createPortal` into `document.body` inside `AnimatePresence`; `role="dialog"`, `aria-modal="true"`, `aria-labelledby` title; card surface, 24px radius (top radius plus drag handle below 1024px, full radius at 1024px and above); one DOM structure with responsive classes and a `matchMedia` query for the motion variant.
    - On open: record the previously focused element, set `inert` on `body` children except those matched by `shouldSkipInert`, restoring prior state on cleanup; set `data-scroll-locked` on `<html>`; focus the first focusable element or the dialog container.
    - Tab and Shift+Tab trap via `getNextFocusIndex`; Escape through a `document` keydown listener calls `onClose` once; scrim (`role="presentation"`, `aria-hidden`) click calls `onClose` once; 44px "Close" button with `aria-label="Close"`; focus restored on close even during the exit animation.
    - Spring `{ type: "spring", duration: 0.28, bounce: 0.1 }`; reduced motion uses an opacity fade ≤150ms.
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 14.11, 14.12, 18.1, 18.2_

  - [x] 10.3 Add the BottomSheet section to `StyleguideContent`
    - A trigger button that opens a sheet containing a title, an Input and two Buttons (so focus trapping is exercised); local `useState` for open state.
    - _Requirements: 19.5, 19.9, 19.14, 26.2_

  - [x] 10.4 Write component tests in `tests/ui/BottomSheet.test.tsx`
    - Dialog role, `aria-modal`, accessible name; focus moves in on open and returns to the trigger on close; Tab and Shift+Tab wrap inside the dialog; Escape and scrim click call `onClose` once; "Close" button name; `data-scroll-locked` set and removed; portal parent is `document.body`; closed sheet renders nothing.
    - Inert cases: with a `data-inert-exempt` div, a `next-route-announcer`, a `nextjs-portal` (and an upper-case variant) and an ordinary sibling, only the ordinary sibling gets `inert`; closing restores it; an element already `inert` before opening stays `inert` after.
    - Viewport helper: below and at 1024px width; reduced motion fade (`data-reduced-motion`).
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.12, 18.5, 22.5_

  - [x] 10.5 Write property tests in `tests/utils/focusTrap.test.ts`
    - **Property 12: Focus index wraps within the trap**
    - **Property 15: Inert exemptions depend only on the tag name and the exempt attribute**
    - **Validates: Requirements 14.4**

  - [x] 10.6 Create the first axe test in `tests/ui/styleguide.axe.test.tsx`
    - Render `StyleguideContent` inside a `ToastRegion`; run `expectNoAxeViolations` with the sheet closed and with the sheet open (open it through the trigger). If axe reports `aria-hidden-focus`-style findings because jsdom does not model `inert`, also set `aria-hidden="true"` on the inerted siblings in `BottomSheet.tsx` instead of disabling a rule.
    - _Requirements: 23.1, 23.2, 23.3, 23.6, 14.4_

- [x] 11. Checkpoint - overlays and toasts
  - Run `npm test` (the source scans of 1.8 and the contrast test of 1.9 included, unmodified), `npm run typecheck`, `npm run lint` and `npm run build`; ensure all pass and `/styleguide` is in the build output, ask the user if questions arise.

- [x] 12. LightScoreBar increment
  - [x] 12.1 Create `src/lib/utils/score.ts`
    - Export `clampScore` (NaN gives 0, ±Infinity clamped, result in [0, 100]), `getFillPercent`, `formatScoreText` (`String(Math.floor(clampScore(v)))`) and `formatBreakdown(base, momentum, score)` (`"39 = 33 base + 6 momentum"`). Named constants from the score bounds; no import from `src/lib/haunting/`.
    - _Requirements: 16.2, 16.3, 16.5, 16.6, 16.8_

  - [x] 12.2 Create `src/components/ui/LightScoreBar.tsx`
    - 10px pill track on raised surface; fill is a `motion.div` animating `width` and `backgroundSize` in `%` over 600ms so the blood → candle → ecto gradient stays anchored to the track; immediate when reduced.
    - `role="meter"` with `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow`, `aria-valuetext` ("Light score 39 of 100") and a required `aria-label`; always renders the numeric score as text; renders the breakdown line only when `baseScore` and `momentum` are both given. Takes numbers only.
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.7, 16.8, 21.6, 18.1_

  - [x] 12.3 Add the LightScoreBar section to `StyleguideContent`
    - Bars at scores 0, 19, 20, 39, 40, 59, 60, 79, 80 and 100 (with at least one showing the breakdown), each labelled.
    - _Requirements: 19.5, 19.10, 19.14, 26.2_

  - [x] 12.4 Write component tests in `tests/ui/LightScoreBar.test.tsx`
    - Meter role and attributes, accessible name, floored number text, breakdown text only with both parts, out-of-range and `NaN` inputs clamp, reduced motion applies the fill immediately (`data-reduced-motion`), `// @ts-expect-error` for a missing `aria-label`.
    - _Requirements: 16.2, 16.3, 16.4, 16.5, 16.7, 18.5, 22.6_

  - [x] 12.5 Write property tests in `tests/utils/score.test.ts`
    - **Property 4: Score clamp is total and bounded**
    - **Property 5: Fill percent is bounded and monotonic, and the number is the floor**
    - **Property 6: Breakdown text floors every part**
    - Generator for scores: `fc.double` including `NaN`, ±`Infinity` and out-of-range values.
    - **Validates: Requirements 16.2, 16.3, 16.5, 16.6**

- [x] 13. ExorcismActionRow increment
  - [x] 13.1 Create `src/components/ui/ExorcismActionRow.tsx`
    - Built on `ListRow` layout. Native `<input type="checkbox">` styled round (`appearance-none`) inside a 44px label target; accessible name `Mark "<title>" as done`; `onToggle(next)` called once on Space or click.
    - Impact text in ecto with `+` and `/mo`. Done state: title `line-through`, row text `ink-tertiary` (still ≥4.5:1 on the card), checkbox filled with candle and a check icon, 200ms fill transition within the 700ms limit, ≤150ms opacity fade when reduced. Disabled sets the native attribute and ignores activation. No imports from `src/lib/db/`, `src/lib/exorcism/` or `src/hooks/`.
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.11, 20.9, 18.1_

  - [x] 13.2 Add the ExorcismActionRow section to `StyleguideContent`
    - Open, done and disabled states, with interactive local state for the open row.
    - _Requirements: 19.5, 19.8, 19.11, 19.14, 26.2_

  - [x] 13.3 Write component tests in `tests/ui/ExorcismActionRow.test.tsx`
    - Checkbox role and accessible name with the title, Space and click each call `onToggle` once with the next value, done styling (strike-through class, checked state), disabled ignores activation, impact text format, reduced motion fade only (`data-reduced-motion`).
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.6, 17.7, 17.8, 18.5, 22.5_

  - [ ]* 13.4 Add the optional droplet burst
    - In `ExorcismActionRow.tsx` add a burst of 3 droplets within the same 700ms when the checkbox becomes checked and motion is not reduced; droplets are `aria-hidden` and not rendered when reduced. Criteria 1 to 9 must still hold without it.
    - Extend `tests/ui/ExorcismActionRow.test.tsx`: three droplets appear on check, none appear when reduced, droplets are hidden from assistive technology.
    - _Requirements: 17.10, 17.11_

- [x] 14. QuickAction increment
  - [x] 14.1 Create `src/components/ui/QuickAction.tsx`
    - Native `<button>` with a 52px circle on the raised surface, 22px icon, label beneath in the `label` scale as the accessible name, 44px minimum target. Press scale 0.97 over 120ms and a ±6° icon wiggle over 200ms on activation, both disabled when reduced; disabled dims and ignores activation.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 5.13, 18.1_

  - [x] 14.2 Add the QuickAction section to `StyleguideContent`
    - A row of four actions (Log payment, Add expense, Import CSV, Exorcise) plus a disabled example.
    - _Requirements: 19.5, 19.8, 19.14, 26.2_

  - [x] 14.3 Write component tests in `tests/ui/QuickAction.test.tsx`
    - Role and name from the label, Enter and Space activate once, disabled ignores activation, reduced motion applies neither press scale nor wiggle (`data-reduced-motion`).
    - _Requirements: 7.2, 7.5, 7.6, 18.5, 21.3, 22.5_

- [x] 15. BalanceHero increment
  - [x] 15.1 Add `formatCurrencyParts` to `src/lib/utils/money.ts` and create `src/lib/utils/delta.ts`
    - `formatCurrencyParts(value)` returns `{ symbol, integer, cents }` (en-US grouping, non-finite treated as 0, cents always two digits).
    - `delta.ts` exports `DeltaDirection`, `DeltaIntent`, `DeltaPresentation` and `getDeltaPresentation(direction, intent, amountText)`: `up` gives `+` and `arrow-up`, `down` gives `−` and `arrow-down`, `good` gives tone `success`, `bad` gives `danger`; text starts with the sign.
    - _Requirements: 8.3, 8.6, 8.7, 8.8, 8.12_

  - [x] 15.2 Create `src/components/ui/BalanceHero.tsx`
    - Label in secondary, value in `hero` scale with `tabular-nums`; `format="currency"` (default) renders symbol, integer at full size and cents at 60%; `format="score"` renders `formatScoreText(value)` with no decimal point and a "/100" suffix only with `showMax`.
    - Optional delta rendered as a `Chip` from `getDeltaPresentation` (direction and intent independent).
    - 600ms count-up driven by a motion value; animated spans are `aria-hidden` and a visually hidden span always carries the final value; reduced motion shows the new value immediately.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 5.9, 18.1_

  - [x] 15.3 Add the BalanceHero section to `StyleguideContent`
    - One `BalanceHero` per section card (Req 8.14): the currency hero with a `down`/`good` delta in one card, and the score hero with an `up`/`good` delta in its own card. Show the `up`/`bad` and the other direction and intent combinations as Chip rows built from `getDeltaPresentation`, so every combination of Req 19.13 is visible.
    - _Requirements: 19.5, 19.13, 19.14, 8.14, 26.2_

  - [x] 15.4 Write component tests in `tests/ui/BalanceHero.test.tsx`
    - Currency parts rendering (cents at the smaller size class), score format shows the floored integer and no decimal point, "/100" only with `showMax`, delta icon, sign text and tone for the three combinations, final value available to assistive technology, reduced motion shows the value immediately (`data-reduced-motion`).
    - _Requirements: 8.3, 8.4, 8.6, 8.7, 8.10, 8.11, 18.5, 22.4_

  - [x] 15.5 Write property tests in `tests/utils/money.test.ts`, `tests/utils/score.test.ts` and `tests/utils/delta.test.ts`
    - **Property 7: Currency parts reconstruct the rounded value**
    - **Property 8: Score text is the integer floor with no decimal point**
    - **Property 9: Delta direction and intent are independent**
    - **Validates: Requirements 8.3, 8.4, 8.6, 8.7, 8.8, 8.12, 8.13**

- [ ] 16. SegmentedControl increment
  - [ ] 16.1 Create `src/lib/utils/segmentedNav.ts`
    - Export `SegmentNavKey` and `getNextEnabledIndex(disabled, current, key)`: cyclic next and prev skipping disabled entries, `first` and `last` pick the lowest and highest enabled index, returns `current` when nothing is enabled or `current` is out of range. Total.
    - _Requirements: 12.4, 12.5, 12.6, 12.8_

  - [ ] 16.2 Create `src/components/ui/SegmentedControl.tsx`
    - `role="radiogroup"` with a required `aria-label` or `aria-labelledby` (union type); each segment `<button role="radio" aria-checked>` with roving `tabIndex`; selected segment white with near-black text on a raised pill track.
    - Keys: Right and Down → next, Left and Up → previous, Home, End, all through `getNextEnabledIndex`; `onChange` called once per selection; disabled segments skipped and ignore pointer activation.
    - Selected indicator is a `motion.span` with `layoutId` over 200ms, or an opacity fade ≤150ms when reduced.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 21.6, 18.1_

  - [ ] 16.3 Add the SegmentedControl section to `StyleguideContent`
    - Two- and three-option controls with interactive local state, and one with a disabled segment.
    - _Requirements: 19.5, 19.8, 19.14, 26.2_

  - [ ] 16.4 Write component tests in `tests/ui/SegmentedControl.test.tsx`
    - Radiogroup and radio roles, `aria-checked`, roving tabindex, arrow keys, Home, End and wrap-around with user-event, disabled segment skipped and not selectable by click, `onChange` called once per change, `// @ts-expect-error` for a missing accessible name, reduced motion (`data-reduced-motion`).
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 18.5, 22.5, 22.6_

  - [ ] 16.5 Write property tests in `tests/utils/segmentedNav.test.ts`
    - **Property 10: Segmented navigation always lands on an enabled segment**
    - **Property 11: Segmented navigation forms a cycle**
    - **Validates: Requirements 12.4, 12.5, 12.6, 12.8**

- [ ] 17. Checkpoint - all primitives
  - Run `npm test` (the source scans of 1.8 and the contrast test of 1.9 included, unmodified), `npm run typecheck`, `npm run lint` and `npm run build`; ensure all pass and the styleguide contains a section for every primitive, ask the user if questions arise.

- [ ] 18. Closing pass: final axe run, keyboard test, documentation
  - [ ] 18.1 Complete `tests/ui/styleguide.axe.test.tsx`
    - With every section present, run axe on `StyleguideContent` inside one `ToastRegion` for: sheet closed, sheet open, and each toast tone visible (trigger through the real buttons). Only `color-contrast` is disabled, named in a comment, and no selector exclusions.
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 26.7_

  - [ ] 18.2 Create `tests/ui/styleguide.keyboard.test.tsx`
    - Render `StyleguideContent` inside a `ToastRegion` (not the page). Assert Tab order follows DOM order and skips disabled controls, no `tabindex` greater than 0, exactly one `<main>` and one `<h1>`, heading levels never skip, every interactive element has an accessible name, and no horizontal-scroll-causing fixed widths are asserted through class checks where jsdom allows.
    - _Requirements: 21.1, 21.2, 21.4, 21.7, 21.8, 19.17_

  - [ ] 18.3 Update steering documents
    - `.kiro/steering/structure.md`: remove `tailwind.config.ts`; note the Tailwind v4 integration actually used (Turbopack loader rule in `next.config.ts`, tokens in `src/app/globals.css` with `@theme`); add `src/app/styleguide/page.tsx`, `src/components/styleguide/StyleguideContent.tsx`, `Toast.tsx`, `ToastRegion.tsx` (exports `ToastRegion` and `useToast`, mounted in the layout), `motionTokens.ts`, `src/lib/utils/` helpers, `tests/ui/`, `tests/utils/`, `tests/design-system/` and the Vitest setup file; add the note that hooks exported by a primitive file live beside it and `src/hooks/` is reserved for Dexie and haunting-engine bridges.
    - `.kiro/steering/conventions.md`: replace the "Tailwind config tokens" row with a note plus the Color_Utility_Map table (CSS variable, `@theme` variable, utility; names from `design-system.md` unchanged); document that `className` is for Layout_Properties only and why.
    - `.kiro/steering/tech.md`: state that Tailwind CSS v4 is configured in CSS; add `jsdom` and `axe-core` to the testing dependencies.
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.8_

  - [ ] 18.4 Update `README.md`
    - Document the `/styleguide` route and the test commands (`npm test`, `npx vitest --run --project ui`, `npx vitest --run --project node`).
    - _Requirements: 24.5, 22.10_

- [ ] 19. Quality gates
  - [ ] 19.1 Run and fix the quality gates
    - Run `npm run typecheck`, `npm run lint`, `npm test` (which includes the source scans of 1.8 and the contrast test of 1.9) and `npm run build`; fix any failure in the files this spec created, never by weakening a scan or the contrast test. Confirm `/styleguide` appears in the build output, fonts make no runtime request to Google, and `git status` shows no change under `src/lib/haunting/` or `tests/haunting/`.
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 4.9, 22.10, 26.4, 26.7_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Run `npm test` (scans and contrast test included, unmodified), `npm run typecheck`, `npm run lint` and `npm run build`; ensure all pass, ask the user if questions arise.

## Notes

- Sub-task `13.4` is marked optional with `*` because the droplet burst is optional (Req 17.10, 17.11) and can be skipped without affecting any other requirement.
- Every `StyleguideContent` edit is a separate sub-task and sits in its own wave of the dependency graph, because they all write to `src/components/styleguide/StyleguideContent.tsx`. Sections are inserted in the Req 19.5 order regardless of the build order (Req 26.6).
- Primitive tests, property tests and the styleguide section are part of each increment (Req 26.2, 26.3) and are not postponed to the hardening task. The source scans (1.8) and the contrast test (1.9) are installed in the foundation increment so they guard every primitive from the first one; task 18 adds only the final axe pass, the keyboard test and documentation.
- Property tests cover the pure helpers only (Properties 1 to 15 in design.md). Rendering, ARIA wiring, motion and keyboard flows use example-based component tests.
- Parallel work: pure helpers and independent primitives share a wave when they write different files.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["1.6", "1.7", "1.9"] },
    { "id": 3, "tasks": ["1.8"] },
    { "id": 4, "tasks": ["3.1", "4.1", "5.1", "6.1", "7.1", "9.1", "10.1", "12.1", "16.1"] },
    { "id": 5, "tasks": ["3.2", "3.3", "4.3", "5.3", "6.3", "7.2", "7.5", "9.2", "9.6", "10.2", "10.5", "12.2", "12.5", "13.1", "14.1", "15.1", "16.2", "16.5"] },
    { "id": 6, "tasks": ["4.2", "7.4", "9.3", "10.4", "12.4", "13.3", "14.3", "15.2", "16.4"] },
    { "id": 7, "tasks": ["5.2", "9.5", "13.4", "15.4", "15.5"] },
    { "id": 8, "tasks": ["6.2"] },
    { "id": 9, "tasks": ["7.3"] },
    { "id": 10, "tasks": ["9.4"] },
    { "id": 11, "tasks": ["10.3"] },
    { "id": 12, "tasks": ["10.6", "12.3"] },
    { "id": 13, "tasks": ["13.2"] },
    { "id": 14, "tasks": ["14.2"] },
    { "id": 15, "tasks": ["15.3"] },
    { "id": 16, "tasks": ["16.3"] },
    { "id": 17, "tasks": ["18.1", "18.2", "18.3", "18.4"] },
    { "id": 18, "tasks": ["19.1"] }
  ]
}
```
