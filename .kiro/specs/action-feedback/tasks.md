# Implementation Plan: Action Feedback

## Overview

The plan follows the design's delivery phasing. The language is TypeScript.

1. The two focus bugs and the 320px header overflow, each test-first, then the pending-control audit.
2. Measured light, toasts and the row highlight.
3. The plan checkbox that opens the Do it sheet.
4. The three new Moments.
5. The Guide.
6. **Manual checkpoint** on the deployed app at 1280 by 720.
7. The Landing preview.
8. Three QuickActions.
9. Documentation for the other specs.
10. **Final checkpoint.**

Conventions that apply to every task:

- **Property tests** live in `tests/feedback/properties/pNN-<slug>.test.ts`, tagged `// Feature: action-feedback, Property N: <text>`, with at least 100 runs. The numbers are those of `design.md`. Extended `house-scene` properties stay in their own files.
- **Other tests:** example and component tests go in `tests/feedback/`, `tests/moments/`, `tests/scene/` and `tests/ui/`. Descriptions are plain English sentences. No snapshot tests for pure functions.
- **Mutation check (`conventions.md`):** for every bug-fix test, write the test first and confirm it fails on the current code. After the fix, temporarily reintroduce the bug, confirm the test fails with a clear assertion, restore the fix and confirm it passes. Leave no trace. Report the failing assertion in the task summary.
- **Module rules:** GSAP only in `src/components/house/` and `src/components/moments/`, loaded through dynamic `import()`. Framer Motion only in chrome components. Components never import `src/lib/db/`. Moments follow every `house-scene` rule: Dashboard only, the Moment_Queue, `driveOnWallClock`, Reduced_Motion fades, Skip_Input, the hard cap and exactly-once resolution.
- **Next.js:** read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (`AGENTS.md`).
- **Browser checks:** run `scripts/check-moments.mjs` against a local production build (`npm run build && npm start`) as its header explains, at `RAF_THROTTLE_MS=0` and `700`.
- **Manual checkpoints:** a task marked **MANUAL CHECKPOINT** is not a coding task. The executor stops, shows the list and waits for the user's review.

## Tasks

- [x] 1. Focus bugs, header overflow and the pending-control audit
  - [x] 1.1 Write the failing initial-focus test
    - `tests/ui/sheetInitialFocus.test.tsx`: open the Add expense sheet from the Dashboard, type `8` with `userEvent.keyboard` and no click, and expect the "Amount" Field to contain "8" and `document.activeElement` to be that input. Also record what Enter does in that state, and state the observed behavior in the task summary, so the review's report is confirmed or corrected.
    - Run it on the current code and confirm it fails (focus is on the Close button).
    - _Requirements: 6.1, 6.6, 14.7_

  - [x] 1.2 Implement the initial-focus rule
    - Add `FIELD_SELECTOR` and `INITIAL_FOCUS_ATTRIBUTE` to `src/lib/utils/focusTrap.ts`. Change `BottomSheet.moveFocusIn` to use, in order, the marked element, the first Field and the first focusable element, and to select a non-empty input value.
    - `LogPaymentSheet`: mark the first Debt row of the picker with `data-initial-focus`. When a Debt is picked, focus and select the "Payment amount" input through its ref in a layout effect.
    - Add `src/components/sheets/useFocusFirstInvalid.ts` and use it in the Add expense, Log payment, Onboarding, Add debt, Edit debt and Add subscription forms, bumping `attempt` on each submit that finds errors.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

  - [x] 1.3 Write the initial-focus tests for every sheet and run the mutation check
    - Extend `tests/ui/sheetInitialFocus.test.tsx` with these cases:
      - Typing right after open fills the first Field in Add expense, Onboarding, Add debt, Edit debt and Add subscription.
      - The Log payment amount pre-filled from a Debt is selected, and typing replaces it.
      - The picker focuses its first Debt, and picking one moves focus to the amount.
      - A submit with errors focuses the first invalid Field.
      - The cancel, delete and details sheets keep their current focus.
      - Escape and focus return still work.
    - Mutation check: restore the old `moveFocusIn` and confirm the 1.1 test fails.
    - _Requirements: 6.1 to 6.7, 14.3, 14.7_

  - [x] 1.4 Write the failing checkbox-focus test
    - `tests/ui/planCheckboxFocus.test.tsx`: render `ExorcismPlanAction` for the "Cut Coffee" action with a mocked `toggleAction` whose promise the test holds open. Focus the checkbox, press Space and, while the promise is pending, expect:
      - no `disabled` attribute on the checkbox;
      - `aria-disabled="true"` and `aria-busy="true"`;
      - a second Space or click does not call `toggleAction` again;
      - the checkbox still shows its previous state.
    - Then resolve the promise and expect the attributes to be gone and `document.activeElement` to be the checkbox. Repeat with a rejected toggle.
    - Run it on the current code and confirm it fails on the `disabled` assertion. jsdom does not blur a disabled element, so the focus itself is guarded by task 1.7.
    - _Requirements: 15.1, 15.2, 15.3, 14.7_

  - [x] 1.5 Implement the pending state of the plan checkbox
    - `ExorcismActionRow`: add a `pending` prop that sets `aria-disabled` and `aria-busy` and makes `onChange` return early. Add `aria-disabled:` variants of the existing `disabled:` classes so the busy look stays.
    - `ExorcismPlanAction`: pass `pending={busy}` instead of `disabled={busy}`, keep the `if (busy) return` guard, and remove `disabled={busy}` from the Do it Button (it is never rendered while busy).
    - Mutation check: restore `disabled={busy}` on the row and confirm the 1.4 test fails.
    - _Requirements: 15.1, 15.2, 15.4, 15.6_

  - [x] 1.6 Audit the other controls that are disabled while focused
    - Work through the design's audit table:
      - **`DemoControls`:** the activated Button uses `loading`, the other gets `aria-disabled`, and both handlers return early while `busy`.
      - **`QuickAction`:** map `disabled` to `aria-disabled` and keep the click guard and the disabled look.
      - **Debt sheet "Log payment" (`disabled={paidOff}`):** write a test first. If focus does not land on the Debt row after a payoff, fix it.
      - **"Keep it", Settings and SegmentedControl:** confirm they need no change.
    - Tests in `tests/ui/pendingControls.test.tsx`:
      - "Reset demo" is never `disabled` while it runs, and a second click is ignored.
      - The "Log payment" QuickAction with no payable Debt has `aria-disabled="true"`, no `disabled`, and opens nothing.
      - Paying off the last Debt from the Dashboard sheet leaves focus on that QuickAction. Confirm this test fails before the `QuickAction` change.
      - Paying a Debt off from the Debt sheet leaves focus on the Debt row.
    - Update the existing `QuickAction`, Dashboard and styleguide keyboard tests that assert the `disabled` attribute.
    - _Requirements: 15.5, 15.6, 15.7_

  - [x] 1.7 Add the `checkboxFocus` browser check
    - In `scripts/check-moments.mjs`, add the `checkboxFocus` case of the design. It focuses the "Cut Coffee" checkbox, presses Space, and samples `document.activeElement` and the `disabled` attribute every 5 ms for 500 ms. It asserts the checkbox is never disabled, keeps focus at every sample and ends checked.
    - Mutation check in the browser: build with `disabled={busy}` temporarily restored and confirm the case fails, then restore the fix, rebuild and confirm it passes. Report both runs in the summary.
    - _Requirements: 15.3, 14.8_

  - [x] 1.8 Add the failing `noHorizontalScroll` browser case
    - In `scripts/check-moments.mjs`, add a `noHorizontalScroll` case: open the Dashboard in demo mode and, for each width in 320, 768, 1280 and 1920 (height 640), assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`. At 320, also report the header's width and the `TabBar` width.
    - Run it on the current code and confirm it fails at 320 (header 400px wide) and passes at 768, 1280 and 1920. Report the numbers in the summary.
    - _Requirements: 16.1, 16.4, 16.6, 14.8_

  - [x] 1.9 Let the header fit at 320px
    - Read `Chip`, `DemoChip`, `AppShell` and `NavLink` first. Implement D13: the badge shows "Demo" with its icon below `sm` and the full "Demo mode · <date>" from `sm` up, the date stays available to assistive technology, the header group can shrink (`min-w-0`) and the settings link keeps at least 44 by 44px (`shrink-0`). Use layout utilities only in `className`. Keep the header unchanged at 768px and wider.
    - Check the Real_Crypt header at 320px as well (no badge), and the pages other than the Dashboard (`/transactions`, `/subscriptions`, `/debts`, `/exorcism`, `/settings`) for overflow at 320px. If another element overflows, fix it in this task and name it in the summary.
    - jsdom tests in `tests/ui/demoChip.test.tsx`: the chip's accessible text contains "Demo mode" and the date; the short "Demo" text is present; the settings link has its accessible name.
    - Mutation check: restore the old header and chip, confirm the 1.8 case fails at 320, restore the fix and confirm it passes at all four widths, at `RAF_THROTTLE_MS=0` and `700`.
    - _Requirements: 16.1, 16.2, 16.3, 16.5, 16.6_

- [ ] 2. Measured light, toasts and the row highlight
  - [ ] 2.1 Create `src/lib/utils/lightClause.ts`
    - Add `getLightClause`, `joinToastText`, `LIGHT_NOISE_EPSILON`, `LIGHT_FULL_SCORE`, `CLAUSE_SEPARATOR`, `MINUS_SIGN`, `GHOST_EXPENSE_CLAUSE` and `EXPENSE_CLAUSE`, as in the design's clause table. No React, Dexie, Next.js or clock.
    - `tests/feedback/lightClause.test.ts`: every table row; rounding at 0.05, 0.049, −0.05 and −0.049; 100 → 100 reads "Light already full"; NaN and Infinity read "Light unchanged"; `joinToastText` with and without a clause; the measured values +0.112 → "Light +0.1" and +5.217 → "Light +5.2".
    - _Requirements: 2.1 to 2.8, 14.1_

  - [ ] 2.2 Write property tests for the clause
    - **Property 1: The light clause has the sign of the change.** File: `tests/feedback/properties/p01-light-clause-sign.test.ts`.
    - **Property 2: The shown value is the change rounded to a tenth.** File: `tests/feedback/properties/p02-light-clause-rounding.test.ts`.
    - **Validates: Requirements 2.2 to 2.6, 2.9**

  - [ ] 2.3 Add `readHouseReading` to `src/lib/db/queries.ts`
    - Use `readAllRows`, then `toFinancialSnapshot`, then `computeHouseState`, and return `{ lightScore, poltergeist }`.
    - `tests/db/readHouseReading.test.ts` (fake-indexeddb): the reading equals the `useHouseState` path, and the design's level-4 table holds to 3 decimals (32.735 → 32.735 → 32.847 → 38.065 → 39.065 → 43.605).
    - _Requirements: 2.7_

  - [ ] 2.4 Write the expense neutrality property
    - **Property 3: Expenses never move the light.** File: `tests/feedback/properties/p03-expense-neutrality.test.ts`, using the app-screens adapter generators. Cover adding a Transaction and removing an existing one. Add one example through the real `addTransaction` and `deleteTransaction` with fake-indexeddb.
    - **Validates: Requirement 2.10**

  - [ ] 2.5 Measure every Mutation in the action hooks
    - `useCryptActions.ts`:
      - Add `HouseChange`, `measured()` and `serialize()` (a `WeakMap<CryptDb, Promise<unknown>>` chain that survives rejections), and the optional `change` on `MutationResult`.
      - Run every Mutation except `clearAll` through them. Route `setIncome` through `withNow`.
      - Observe `addTransaction` with `{ kind: "expense" }`.
      - `observeAction` calls `begin` before the chain wait, and its `map` receives `(value, change)`.
    - `useExorcismPlan.toggleAction`: use the same helpers, return `change`, and put `lightDelta` on the planToggle outcome.
    - `tests/ui/measuredActions.test.tsx`:
      - two actions started together run in order, and each reports its own delta;
      - a failing reading gives `change: null` and the Mutation still succeeds;
      - a failing Mutation has no `change`;
      - `begin` runs before the wait.
    - _Requirements: 1.1, 2.7, 2.8_

  - [ ] 2.6 Update the Toast primitive
    - `Toast.tsx`: the message wraps (no `truncate whitespace-nowrap`), and a new `actionAccessibleName` sets the action Button's `aria-label`. `ToastRegion` passes it through. Add `ACTION_TOAST_DURATION_MS`, `ROW_HIGHLIGHT_MS`, `HIGHLIGHT_WAIT_MS`, `HIGHLIGHT_PENDING_TTL_MS` and `BANNER_HIGHLIGHT_MS` to `motionTokens.ts`.
    - Tests in `tests/ui/Toast.test.tsx`: the accessible name; the existing pause on focus and hover with an action; the full message text present in the DOM.
    - _Requirements: 1.12, 3.1, 3.10_

  - [ ]* 2.7 Write a class-level test that the toast message can wrap
    - Visual duplicate of the manual check at 320px: assert the message span has no `truncate` or `whitespace-nowrap` class.
    - _Requirements: 1.12_

  - [ ] 2.8 Create `src/lib/utils/destinations.ts`
    - Add `HighlightList`, `HighlightTag`, `HighlightTarget`, `DESTINATION_PATHS`, `DESTINATION_LABELS`, `getRowDomId` and `HIGHLIGHT_TAG_TEXT`.
    - `tests/feedback/destinations.test.ts`: paths, labels, DOM ids and the "View in …" names for every list.
    - _Requirements: 3.1, 3.2_

  - [ ] 2.9 Create `RowHighlightProvider` and mount it
    - `src/components/feedback/RowHighlightProvider.tsx`: the provider with one Pending, the TTL, one polite `role="status"` region, `useRequestHighlight` and `useRowHighlight` as in the design (wait while rows are null, focus and `scrollIntoView` only when `focus` is set, announce, clear after `ROW_HIGHLIGHT_MS`, and handle the missing row after `HIGHLIGHT_WAIT_MS`).
    - Mount it inside `ToastRegion` in `src/app/layout.tsx`.
    - `tests/ui/rowHighlight.test.tsx` (fake timers):
      - found row with and without focus, and the announcement text;
      - the highlight is cleared after 4000 ms;
      - a missing row focuses the heading and announces "That item is no longer here";
      - a stale Pending is ignored;
      - a fresh provider (reload) highlights nothing.
    - _Requirements: 3.4 to 3.9, 12.2_

  - [ ] 2.10 Add the `highlight` prop to `ListRow` and `ExorcismActionRow`
    - Render the "New" or "Updated" tag as a candle `Chip` after the title, and fade a `bg-candle-tint` background in and out (no fade under reduced motion). Add both states to the styleguide.
    - Tests in the existing primitive test files: the tag text is present only with the prop, and reduced motion sets no animation duration.
    - _Requirements: 3.5, 3.7, 3.11, 12.5_

  - [ ]* 2.11 Write a styleguide test for the highlight states
    - Visual duplicate: the styleguide renders one highlighted `ListRow` and one highlighted `ExorcismActionRow`.
    - _Requirements: 3.5_

  - [ ] 2.12 Create `useActionToast`
    - `src/components/feedback/useActionToast.ts`: compose the message, compare `usePathname()` with the destination path, and either request an in-place highlight (no action) or show "View" with `actionAccessibleName`, `ACTION_TOAST_DURATION_MS` and an `onAction` that requests the highlight with focus and calls `router.push`.
    - `tests/ui/useActionToast.test.tsx` (mocked router and pathname): the clause from `change`; no clause when `change` is null; the fixed expense clause; "View" off-Screen; no action and an in-place request on-Screen; no destination gives neither.
    - _Requirements: 1.1, 1.9, 2.8, 3.1, 3.3, 3.4_

  - [ ] 2.13 Switch every toast call site and add the row and heading ids
    - Use `useActionToast` in `LogPaymentSheet`, `CancelSubscriptionSheet`, `ExorcismPlanAction`, `AddExpenseSheet`, `TransactionsScreen` (delete), `DebtsScreen` (add, edit, delete), `SubscriptionsScreen` (add, reactivate, delete) and `SettingsScreen` (income), with the bases, effects and destinations of the design's call-site table.
    - Give every list row `id={getRowDomId(list, row.id)}`, replace the local Subscriptions `getRowDomId`, and add `EXORCISM_PLAN_HEADING_ID`.
    - Wire `useRowHighlight` into the Debts, Transactions, Subscriptions (both lists) and Exorcism lists.
    - Update the existing toast text tests.
    - Keep the demo control toasts unchanged.
    - _Requirements: 1.1 to 1.13, 3.2, 3.3_

  - [ ] 2.14 Write the toast and highlight integration tests
    - `tests/ui/actionToasts.test.tsx` (level-4 demo through `renderWithCrypt`):
      - Each toast reads as specified: the measured "+$120/mo saved · Light +5.2", the expense texts, "Expense deleted · doesn't change the light", and a delete with a clause.
      - "View in Transactions" after adding an expense on the Dashboard navigates, focuses the row and announces it.
      - Adding a debt on `/debts` highlights in place without moving focus.
      - The demo control toasts are unchanged.
    - _Requirements: 1.2 to 1.11, 3.1 to 3.9, 14.3_

- [ ] 3. Plan checkbox opens the Do it sheet
  - [ ] 3.1 Implement the checkbox flow
    - `ExorcismPlanAction.handleToggle`: when `next` is true and `doItTarget` is not null, call `onDoIt(action, doItTarget)` and return.
    - Add a `description` prop to `ExorcismActionRow` (a visually hidden span linked with `aria-describedby`). Pass "Opens the cancel confirmation" or "Opens the payment sheet" while the target qualifies.
    - Change `ExorcismScreen.EXPLANATION` to "Ticking a cancel or a payment opens its sheet, so the change is recorded here."
    - _Requirements: 7.1 to 7.9_

  - [ ] 3.2 Write the checkbox flow tests and run the mutation check
    - Tests in `tests/ui/planCheckboxSheet.test.tsx`:
      - Ticking "Cancel Wraithcast" opens the cancel sheet, leaves the checkbox unchecked and creates no `exorcism_action_completed` Event.
      - Confirming marks the action done with exactly one toast.
      - Escape writes nothing and returns focus to the checkbox.
      - Ticking the extra payment opens the Log payment sheet with the Do it pre-fill.
      - Unticking a done action calls `uncompletePlanAction` without a sheet.
      - A fallback and a target-less cancel tick directly.
      - The description is present, on the Dashboard and on `/exorcism`.
    - Update the explanation-text test.
    - Mutation check: restore the old `handleToggle` and confirm the first case fails.
    - _Requirements: 7.1 to 7.9, 14.3, 14.7_

  - [ ] 3.3 Add the `checkboxCancel` browser check
    - In `scripts/check-moments.mjs`, add the design's `checkboxCancel` case: the dialog opens with the checkbox unchecked, the shovel assertions pass after confirming, the checkbox ends checked, and the toast reads "+$120/mo saved · Light +5.2".
    - _Requirements: 7.2, 14.8_

- [ ] 4. Three new Moments
  - [ ] 4.1 Extend the Moment types, planning and observer
    - `src/lib/moments/types.ts`: add the `poltergeistFeed`, `ghostArrival` and `candleFlicker` requests, the `expense` outcome, `lightDelta` on `planToggle`, and `litWindowCount` on `ActionContext`.
    - `requests.ts`: add the planning rules of the design.
    - `useActionObserver.ts`: add the `expense` ObservedAction and its mapper.
    - `MomentHost`: build `litWindowCount`, add the `onPlanned` callback and the two new `shouldDrop` rules.
    - _Requirements: 4.1, 4.5, 4.8, 4.9, 8.1 to 8.3, 8.7, 11.1, 11.5_

  - [ ] 4.2 Write the planning property and update `house-scene` Property 16
    - **Property 4: New Moment requests follow the outcome.** File: `tests/feedback/properties/p04-moment-planning.test.ts`.
    - Update `house-scene` Property 16's test for the `lightDelta` field. Keep its assertion that a fallback tick never yields `sigil`.
    - `tests/moments/requests.test.ts` examples: the level-4 $8 expense yields `poltergeistFeed { appeared: false }`; the level-2 expense yields `ghostArrival`; a $40 expense yields nothing; a level-1 fallback tick with delta 1 yields `candleFlicker { litWindows: true }`; its re-tick with delta 0 yields nothing.
    - **Validates: Requirements 4.1, 4.5, 4.8, 8.1 to 8.3**

  - [ ] 4.3 Add the config and geometry of the new Moments
    - `src/lib/scene/config.ts`: add the four duration keys (`poltergeistFeed` 900, `poltergeistAppear` 1300, `ghostArrival` 800, `candleFlicker` 700) and the art constants, all checked by `validateSceneConfig`.
    - `momentGeometry.ts`: extend `getMomentExtents` for the new requests, with the clamp for the arrival rise.
    - Extend the `house-scene` Property 4 test (new request shapes at every level, every drawn ghost slot, the overflow marker, flicker with and without lit windows) and the Property 13 test (the new keys).
    - Add examples to `tests/scene/config.test.ts`: the feed extents x 149.5..354.5, y 23.5..228.5; the particles x 138..366, y 12..240; both inside the sigil extent.
    - _Requirements: 11.2, 11.3_

  - [ ] 4.4 Share the creature shapes and add the feed wrapper
    - Export `PoltergeistShape` from `Poltergeist.tsx` and `GhostShape` from `GhostSwarm.tsx`, so the Scene and the Moment art draw the same figures.
    - Wrap the glow and the body (not the sigil) in `<g data-part="poltergeist-feed">`.
    - All existing scene and ambient tests keep passing, and the ambient pulse still targets `poltergeist-body`.
    - _Requirements: 4.2, 11.6_

  - [ ] 4.5 Implement the Poltergeist feed Moment
    - `src/components/moments/PoltergeistFeedMoment.ts` (fed and appeared sequences), `FeedParticlesArt` and `PoltergeistCopyArt` in `MomentArt.tsx`, and the `momentLoader` import and duration mapping (`appeared` → `poltergeistAppear`).
    - Follow the `house-scene` contract exactly: one context and one timeline, `driveOnWallClock`, `stop` in both `finish` and `onAbort`, `progress(1)` on abort, and the cleanup registered.
    - Tests: `tests/ui/poltergeistFeedMoment.test.tsx` covers frames 1.5 s apart ending on schedule, the swell peak reaching `FEED_SCALE`, a bound Poltergeist ending bound with its ring unscaled, and abort ending at scale 1 with no art left.
    - _Requirements: 4.2, 4.4, 4.10, 11.1 to 11.4_

  - [ ] 4.6 Implement the ghost arrival Moment
    - `src/components/moments/GhostArrivalMoment.ts` with both the drawn and the overflow variants, `GhostCopyArt` and `MarkerPulseArt`, and the loader entry.
    - Tests: `tests/ui/ghostArrivalMoment.test.tsx` covers the wall-clock frames, the copy at the live rest point at the end, the overflow variant showing the live count and hiding the frozen marker for the duration, and abort leaving no art.
    - _Requirements: 4.5, 4.6, 4.7, 4.10, 11.1 to 11.4_

  - [ ] 4.7 Implement the candle flicker Moment
    - `src/components/moments/CandleFlickerMoment.ts` with the lit and the no-lit-window variants, and `FlickerGlowArt`. Use the same window light selectors and `transition: none` handling and restore as `CandleOrbMoment`. Add the loader entry.
    - Tests: `tests/ui/candleFlickerMoment.test.tsx` covers the wall-clock frames, the dip to `FLICKER_DIP_RATIO` × frozen, the rise to the live opacity, the restored transitions, the glow variant at level 5 ending at opacity 0, and abort.
    - _Requirements: 8.4, 8.5, 8.6, 11.1 to 11.4_

  - [ ] 4.8 Add the Poltergeist banner pulse
    - `PoltergeistBanner`: add `pulseKey` and the `data-part="banner-amount"` emphasis over `BANNER_HIGHLIGHT_MS`, with nothing under reduced motion. `Dashboard`: bump the key from `MomentHost.onPlanned` when a `poltergeistFeed` is planned.
    - Tests in `tests/ui/poltergeistBanner.test.tsx`: the key change starts the emphasis; reduced motion does nothing; a ghost arrival does not change the key.
    - _Requirements: 4.3, 4.9_

  - [ ] 4.9 Write the Dashboard Moment integration tests
    - `tests/ui/dashboardNewMoments.test.tsx` (GSAP mocked, as in `house-scene`):
      - The level-4 small expense enqueues `poltergeistFeed`, and the level-2 one enqueues `ghostArrival`.
      - A $40 expense enqueues nothing, and so does an expense added on `/transactions`.
      - The level-1 fallback tick enqueues `candleFlicker`, and its re-tick enqueues nothing.
      - Page load, demo load, reset and Skip_Week enqueue none of the new kinds.
      - Reduced motion creates no timeline.
    - _Requirements: 4.1, 4.5, 4.8, 4.9, 4.10, 8.2, 8.3, 11.5, 14.4_

  - [ ] 4.10 Add the Moment browser checks
    - In `scripts/check-moments.mjs`, add the `PART_OWNER` entries, the sampler fields and the `feed`, `ghostArrival` and `candleFlicker` cases of the design. `feed` types the amount without a click, so it also checks task 1.
    - Run every case, old and new, at `RAF_THROTTLE_MS=0` and `700`, and report the numbers.
    - _Requirements: 14.8_

- [ ] 5. Guide
  - [ ] 5.1 Add `getGuideStep` and `getShortTitle` to `planView.ts`
    - Tests in `tests/feedback/guideStep.test.ts`: the level-4 start reads "Press Do it on Cancel Wraithcast and watch the zombie get buried"; the payment text; the tick text; the done text.
    - **Property 5: The Guide_Step names the right action.** File: `tests/feedback/properties/p05-guide-step.test.ts`.
    - **Validates: Requirements 5.3, 5.4, 5.5**

  - [ ] 5.2 Create `CryptGuide`
    - `src/components/dashboard/CryptGuide.tsx`: add `GUIDE_STORAGE_KEY`, `startGuideSession`, `useGuideVisibility` (`useSyncExternalStore` with a hidden server snapshot, an in-memory fallback when storage throws, and component state only in the real Crypt) and the Card with its four lines, the Guide_Step in the demo and the "Got it" header action.
    - `Landing.handleDemo` calls `startGuideSession()` before `enterDemo()`.
    - _Requirements: 5.1 to 5.12, 5.14_

  - [ ] 5.3 Place the Guide and "How it works" on the Dashboard
    - Make the Guide the first grid child, with the grid-placement classes of the design for 1024px and up.
    - Put "How it works" (ghost Button, size `md`) in the `PageHeader` action slot while the Guide is hidden, in both Crypts.
    - Move focus to "How it works" after dismissing and to the Guide heading after opening.
    - _Requirements: 5.1, 5.7, 5.8, 5.13_

  - [ ] 5.4 Write the Guide tests
    - Tests in `tests/ui/cryptGuide.test.tsx`:
      - The Guide shows on entering the demo.
      - "Got it" hides it and focuses "How it works", and "How it works" reopens it and focuses its heading.
      - Dismissal survives a remount, while `startGuideSession` shows the Guide again.
      - Scenario switch, reset and Skip_Week keep the dismissal.
      - A throwing `sessionStorage` still works.
      - The real Crypt shows no Card until it is opened, then no step, and writes no storage.
      - The Guide is not a live region.
      - The Dashboard keeps one primary Button and applies the grid-placement classes.
    - Axe on the Dashboard in "demo level 4" with the Guide shown and dismissed, and in "populated real crypt" with the Guide opened.
    - _Requirements: 5.1 to 5.14, 12.3, 12.4, 14.3_

  - [ ] 5.5 Update the browser script for the Guide
    - `openDemo` asserts that the Guide is shown on entry and then clicks "Got it". Add the `guide` case at 1280 by 720.
    - Run the whole script again.
    - _Requirements: 5.13, 14.8_

- [ ] 6. MANUAL CHECKPOINT: toasts, highlight, checkbox, Moments and Guide (user review on the deployed app at 1280 by 720)
  - **Executor: STOP here. Do not start task 7 until the user confirms.** Ask the user to deploy, open the app at 1280 by 720 and check:
    - **Guide:** on entering the demo the Guide shows at the top of the right column and the whole Scene is visible. The first step names Cancel Wraithcast. "Got it" hides it, "How it works" brings it back, and both move focus sensibly. In "My crypt", "How it works" opens the Card without a step.
    - **Focus:** focus the "Cut Coffee" checkbox and press Space; focus stays on it. Typing right after opening Add expense fills the amount.
    - **Checkbox:** ticking "Cancel Wraithcast" opens the cancel sheet, and confirming plays the shovel Moment. "Keep it" leaves the checkbox unticked.
    - **Toasts:**
      - The cancel toast reads "+$120/mo saved · Light +5.2" and has "View in Subscriptions". "View" opens the Graveyard row highlighted with "New" and focused.
      - The $8 expense reads "Ghost added: $8 · feeds the Poltergeist, doesn't dim the light".
      - A minimum payment shows "Light +0.1".
    - **Moments:**
      - At level 4 the Poltergeist swells and settles, and the banner amount pulses.
      - At level 2 a new ghost fades in at its place.
      - At level 1, ticking the emergency-fund action makes the windows flicker once.
      - Every Moment can be skipped, plays one at a time, and shows only a short fade with reduced motion.
    - **Timing:** whether the durations and sizes read well on video.
  - Apply any changes the user requests before continuing.
  - _Requirements: 1, 3, 4, 5, 6, 7, 8, 11, 14.9, 15_

- [ ] 7. Landing preview
  - [ ] 7.1 Create `src/lib/demo/preview.ts`
    - `PREVIEW_DATE`, `PREVIEW_LABEL_PREFIX` and a cached `buildLandingPreview()` as in the design.
    - Tests in `tests/feedback/preview.test.ts`:
      - Two calls return deeply equal models.
      - The label reads "Preview of the demo house: Level 4, Crumbling. 5 zombies, 30 ghosts, Poltergeist awake, no tombstones".
      - A source scan confirms that the file and its imports pull no `dexie` value import.
    - _Requirements: 9.3, 9.4, 9.6_

  - [ ] 7.2 Add the `ambient` prop to `HouseScene`
    - Default `true`. With `false` the `AmbientMotion` dynamic import is never rendered.
    - Test in `tests/ui/houseScene.test.tsx` (mocked `AmbientMotion` module): not rendered with `ambient={false}`, rendered by default.
    - _Requirements: 9.5_

  - [ ] 7.3 Rebuild the Landing
    - Use the design's markup: text block, preview, and the "How it works" section with its three lines. Remove the "View the styleguide" link. Leave `/styleguide` untouched.
    - Tests in `tests/ui/landing.test.tsx`:
      - The preview `role="img"` has the label from 7.1.
      - There is no styleguide link.
      - There are exactly one `h1` and one primary Button.
      - "Continue to my crypt" replaces "Start my own crypt" when a Real_Crypt Profile exists.
      - `AmbientMotion` is never rendered, and `openDemoDb` is not called until "Enter the demo crypt".
      - Axe passes.
    - Remove the old styleguide-link assertion.
    - _Requirements: 9.1, 9.2, 9.5, 9.6, 9.7, 9.9, 9.10, 12.4, 14.5_

- [ ] 8. Three QuickActions
  - [ ] 8.1 Hide "Import CSV"
    - In `Dashboard.tsx`, use `grid grid-cols-3 gap-2` with "Log payment", "Add expense" and "Exorcise", and remove `FileUp` and the disabled "Import CSV".
    - Update the Dashboard test to assert exactly three QuickActions in this order.
    - _Requirements: 10.1, 10.2, 10.3, 14.6_

- [ ] 9. Documentation for the other specs and steering
  - [ ] 9.1 Update `design-system.md` and `visual-language.md`
    - `design-system.md`:
      - Add the four new moment catalog rows (Poltergeist fed 900 ms, Poltergeist wakes 1300 ms, Ghost arrives 800 ms, Candle flicker 700 ms).
      - QuickAction: "Row of 3 under the hero: Log payment, Add expense, Exorcise". An unavailable QuickAction uses `aria-disabled` and stays focusable.
      - Toast text may wrap to two lines.
      - ListRow and ExorcismActionRow `highlight`; ExorcismActionRow `pending` and `description`.
      - The rule that a control waiting for its own save uses `aria-disabled` and `aria-busy`, not `disabled`.
    - `visual-language.md`: timing rows for the new Moments, and the feed swell in the Poltergeist movement notes.
    - _Requirements: 13.2, 13.3_

  - [ ] 9.2 Mark superseded criteria in `app-screens` and update `house-scene`
    - `.kiro/specs/app-screens/requirements.md`: add a "Superseded by action-feedback" note on 20.8, 21.5, 21.9, 22.8, 22.12, the "Plan actions do the work" decision, and the toast criteria 22.3, 23.6, 23.8, 23.12, 24.10, 25.5, 26.6, 26.9 and 27.1.
    - `.kiro/specs/house-scene/requirements.md`: 12.5 lists the new kinds as own Moments, and 18.1 applies while the Guide is hidden.
    - `.kiro/specs/house-scene/design.md`: add a short pointer to the new request kinds and to the extended Properties 4, 13 and 16.
    - _Requirements: 13.1, 13.4_

  - [ ] 9.3 Update `structure.md` and the README
    - `structure.md`: add `src/components/feedback/`, `CryptGuide.tsx`, `src/lib/demo/preview.ts`, `src/lib/utils/{lightClause,destinations}.ts`, the three Moment files, `src/components/sheets/useFocusFirstInvalid.ts` and `tests/feedback/`.
    - Check `README.md` for the Landing styleguide link and the four QuickActions, and update them.
    - _Requirements: 13.1_

- [ ] 10. Final checkpoint
  - Run `npm test`, `npx tsc --noEmit` and `npm run lint`, one after the other, and fix every failure.
  - Run `scripts/check-moments.mjs` (every case) at `RAF_THROTTLE_MS=0` and `700` against a local build and report the results.
  - Record in the task summary:
    - the manual checklist of Requirement 14.9: the level-4 flow at 1280 by 720 and at 375 by 667, with and without reduced motion, covering every toast, "View", the Guide in both Crypts, the three new Moments, the checkbox flow, the focus fixes and the Landing at both sizes;
    - the mutation checks of tasks 1.3, 1.5, 1.6, 1.9 and 3.2.
  - Ask the user if questions arise.
  - _Requirements: 14.9, 14.10_

## Notes

- **Optional tasks:** tasks marked `*` (2.7 and 2.11) are visual duplicates of the manual checks and may be skipped. Every other test task is required, including all five properties, the extended `house-scene` Properties 4, 13 and 16, the bug tests with their mutation checks, and the browser checks.
- **Checkpoints:** tasks 6 and 10 are checkpoints. Task 6 needs the user's review on the deployed app at 1280 by 720 before the Landing work starts.
- **Traceability:** each task lists the requirements it covers. Property tasks name the numbered properties of `design.md`.
