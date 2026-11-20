# Implementation Plan: House Scene

## Overview

The plan follows the delivery phases A to E of the design. The language is TypeScript (the design is in TypeScript).

- **Phase A:** the static house with five decay levels, mounted on the Dashboard. Manual checkpoint 1.
- **Phase B:** creatures, graveyard, labels and ambient motion. Adds `gsap` and `@gsap/react`. Manual checkpoint 2.
- **Phase C:** pure moment infrastructure (planner, queue, hold, geometry), the action observer and `MomentHost`, with a no-op `play`.
- **Phase D:** the five GSAP moments. Manual checkpoint 3: the full level-4 demo at 1280 by 720.
- **Phase E:** audit and cleanup (source scans, axe, `ScenePlaceholder` removal, doc updates, final run).

Conventions that apply to every task:

- Property tests live in `tests/scene/properties/pNN-<slug>.test.ts` (queue, planner and hold properties in `tests/moments/properties/`). Each is tagged `// Feature: house-scene, Property N: <text>` and runs at least 100 iterations.
- Property numbers are those of `design.md`. Example and component tests sit beside them in `tests/scene/`, `tests/moments/` and `tests/ui/`.
- Test descriptions are plain English sentences. No snapshot tests for pure functions.
- **Mutation check (conventions.md):** where a test covers a fix or a revision-2 change (R1 flare, R2 sigil geometry, R3 hold), temporarily reintroduce the old behavior, run the new test, confirm it fails with a counterexample, restore the fix, and confirm it passes. Leave no trace of the mutation. Report the counterexample in the task summary.
- Tasks marked **MANUAL CHECKPOINT** are non-code. The executor MUST stop, show the user the list, and wait for the user's review before starting the next task.
- Framework rules: GSAP only in `src/components/house/` and `src/components/moments/`, loaded through dynamic `import()`. No Framer Motion in those folders. Components never import `src/lib/db/`.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (`AGENTS.md`).

## Tasks

- [ ] 1. Phase A: scene config, windows and features (pure)
  - [ ] 1.1 Create `src/lib/scene/config.ts`, `types.ts` and `hash.ts`
    - Define every constant of the design's config table as named exports and gather them in `SCENE_CONFIG`, including `OPACITY_FLOOR_BY_LEVEL = { 1: 0.8, 2: 0.6, 3: 0.4, 4: 0.02, 5: 0 }`, `PAYMENT_FLARE_BOOST`, the Poltergeist center `(400, 150)`, sigil geometry, the chimney box, moment durations and the scene-only colors (the only hex values in the module).
    - Implement `validateSceneConfig(config: unknown): string[]` that never throws and checks every rule of Requirement 2.5 and the design.
    - Define `SceneInput`, `SceneModel` and the part types. Implement `hashId` (FNV-1a) and `unitFromId`.
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.3_

  - [ ] 1.2 Create `features.ts` and `windows.ts`
    - `features.ts`: `LEVEL_FEATURES` table (design "Decay levels") and severity ordinal helpers.
    - `windows.ts`: fixed window layout (six windows), `WINDOW_FAILURE_ORDER` state assignment, `getWindowOpacity(level, brightness)` and `getFlareSteps(previous, live, boost)`.
    - _Requirements: 6.2, 6.3, 7.1, 7.2, 7.3, 7.6, 7.7, 14.3_

  - [ ] 1.3 Write property test for config validation
    - **Property 13: Config validation never throws and flags broken configs**
    - File: `tests/scene/properties/p13-config-validation.test.ts`.
    - **Validates: Requirements 2.4, 2.5**

  - [ ] 1.4 Write example tests for config, features and windows
    - `tests/scene/config.test.ts`: shipped config passes; one failing example per rule; `getWindowOpacity(3, 0.43) - getWindowOpacity(4, 0.327) >= MIN_VISIBLE_WINDOW_DELTA`; sigil extent `y 9..291`, `x 253..547` is inside the ViewBox and clear of the chimney; moving the Poltergeist center to `y 110` is reported (mutation check for R2).
    - `tests/scene/features.test.ts`: the table against `visual-language.md` for each level.
    - _Requirements: 2.5, 6.1, 6.2, 7.6, 15.7_

  - [ ] 1.5 Write property test for the feature table
    - **Property 9: Level feature table is monotone and distinct**
    - File: `tests/scene/properties/p09-feature-table.test.ts`.
    - **Validates: Requirements 6.2, 6.3, 7.3**

  - [ ] 1.6 Write property test for window opacity
    - **Property 10: Window opacity range, level 5 and monotonicity**
    - File: `tests/scene/properties/p10-window-opacity.test.ts`.
    - **Validates: Requirements 7.1, 7.2, 7.4, 7.5, 7.7**

  - [ ] 1.7 Write property test for the flare steps
    - **Property 19: The flare peaks at most at 1, never below the live value, and ends on it**
    - File: `tests/scene/properties/p19-flare-steps.test.ts`. Mutation check: drop the `min(1, …)` cap and confirm the test fails.
    - **Validates: Requirements 14.3, 14.6**

- [ ] 2. Phase A: scene model skeleton
  - [ ] 2.1 Create `src/lib/scene/index.ts` (`buildSceneModel`) and `summary.ts`
    - Sanitize numbers, copy inputs (no mutation), set level, name, features, lighting and windows. Poltergeist handling and creature lists return empty or null for now. The summary is level-aware ("Level 3, Haunted.").
    - Public API re-exports. No React, GSAP, clock or random source.
    - _Requirements: 1.1, 3.1, 3.2, 3.5, 3.6, 3.7, 6.4, 6.5, 7.1_

  - [ ] 2.2 Write property test for level and lighting
    - **Property 11: Level and lighting follow the engine**
    - File: `tests/scene/properties/p11-level-lighting.test.ts`.
    - **Validates: Requirements 3.7, 6.4, 6.5**

- [ ] 3. Phase A: static house on the Dashboard
  - [ ] 3.1 Create the static SVG layers in `src/components/house/`
    - `HouseBase.tsx`, `DecayLayer.tsx`, `WindowsLayer.tsx` and `HouseScene.tsx` (no GSAP, no labels, no ambient motion). One `<svg>` with `viewBox="0 0 800 600"` and `preserveAspectRatio="xMidYMid meet"`, container `role="img"` with `aria-label` from the summary, `aspect-ratio: 4 / 3`, SVG `aria-hidden`.
    - Draw the five levels from the feature table, level tints, window states with distinct shapes for boarded and broken, level-5 darkness with the Poltergeist-glow or moonlight mask, the chimney box position, and the wordmark-font nameplate if drawn. Original art, design-system tokens through CSS variables, scene-only colors from the config.
    - Layers carry `data-part` keys. Level changes without an action apply at once.
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 7.1, 7.3, 7.8, 19.1, 19.6, 19.8, 21.1, 21.7, 23.1, 23.2, 23.3_

  - [ ] 3.2 Create `src/hooks/useSceneModel.ts`
    - Combine `useHouseState` and `useExorcismPlan`. Build `SceneInput` (income cents, graveyard from inactive subscriptions with `canceledOn` using `normalizeSubscription`, Bound_Flag from the stored plan) and memoize the model. Return `{ status: "loading" }` or `{ status: "ready", model, houseState, boundFlag }`.
    - _Requirements: 1.4, 10.5, 11.5, 22.2_

  - [ ] 3.3 Mount the Scene in the Dashboard with the new layout
    - In `Dashboard.tsx`, render `HouseScene` instead of `ScenePlaceholder` (the placeholder file stays until phase E). Use the two-column layout of the design (`lg:grid-cols-2`, `xl:grid-cols-[7fr_5fr]`, `contents` wrappers below 1024px) and the new DOM order (Scene, score card, banner, plan card, demo controls). Loading shows a skeleton with the Scene aspect ratio and `aria-busy="true"`. Keep the `aria-live` level announcement, one `hero` number and at most one primary Button.
    - Update the existing Dashboard tests that assert the old order or placeholder text so they pass.
    - _Requirements: 5.2, 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.8, 22.9, 22.10_

  - [ ] 3.4 Write component tests for the static Scene and Dashboard layout
    - Exactly one `role="img"` whose `aria-label` equals the summary and updates on data change; SVG `aria-hidden`; no focusable element or handler; the `<svg>` is not remounted on a model change; two-column classes at the desktop breakpoint and single column below it; Scene shown in "empty real crypt", "demo level 4" and "loading" (with `aria-busy`).
    - _Requirements: 19.1, 19.3, 19.6, 21.7, 22.5, 22.11, 24.7, 24.8_

- [ ] 4. MANUAL CHECKPOINT 1: static house and five levels (user review in the browser)
  - **Executor: STOP here. Do not start phase B until the user confirms.** Ask the user to run `npm run dev` and review:
    - Open the Demo Crypt, use the scenario switcher to visit levels 1 to 5. Check that each level is clearly different (walls, cracks, roof, garden, lantern, fog, darkness) and the art style is acceptable (gothic-cozy, rounded, no gore).
    - Window glow: level 4 to level 3 shows a clear brightness step. Boarded and broken windows have different shapes. Level 5 has no candlelight and moonlight only (no Poltergeist yet).
    - The Poltergeist anchor area, chimney position and the roof silhouette look right.
    - Widths 320, 768, 1280 and 1920px: no horizontal scroll, the Scene keeps 4:3, no layout shift on reload.
    - At 1280 by 720: the whole Scene and the heading plus three plan actions are visible without scrolling.
    - Mobile order: Scene, score card, banner, plan card, demo controls.
    - With `prefers-reduced-motion` on and off, nothing moves yet.
  - Record any art or layout changes the user requests and apply them before continuing.
  - _Requirements: 5.3, 6.1, 18.1, 22.8, 22.9, 24.9_

- [ ] 5. Phase B: dependencies
  - [ ] 5.1 Add `gsap` and `@gsap/react` to `package.json` dependencies
    - Install with `npm install gsap @gsap/react`. Confirm `gsap/DrawSVGPlugin` and `gsap/MotionPathPlugin` resolve and typecheck. Import no `MorphSVGPlugin`.
    - _Requirements: 1.6_

- [ ] 6. Phase B: creatures in the scene model (pure)
  - [ ] 6.1 Create `src/lib/scene/layout.ts` and complete `buildSceneModel`
    - Zombie slots (sorted by monthly cost desc then id, centered row, size from cost over income, posture and badge by usage, tilt and sway from hashed id), ghost lanes (figure-eight, phase, bob period from `transactionId`), tombstone slots, overflow counts and anchors, Poltergeist state (`awake` or `bound`) with sigil geometry, ghosts omitted while a Poltergeist exists.
    - _Requirements: 3.3, 3.4, 3.8, 4.1, 4.2, 4.5, 4.6, 4.7, 5.4, 5.5, 5.6, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 10.1, 10.3, 11.1_

  - [ ] 6.2 Complete `summary.ts`
    - Full summary: level number and name, true counts with singular and plural forms, "no zombies", "no ghosts", "no tombstones", and the "Poltergeist awake" or "Poltergeist bound" clause (omitted when null). Totals, not drawn counts.
    - _Requirements: 4.8, 8.6, 10.6, 19.2_

  - [ ] 6.3 Create `tests/scene/arbitraries.ts`
    - fast-check generators: valid inputs with up to 40 zombies, 60 ghosts and 20 graveyard entries, hostile numbers (`NaN`, `Infinity`, negatives), empty arrays, permutations.
    - _Requirements: 24.1_

  - [ ] 6.4 Write property test for determinism and permutation invariance
    - **Property 1: Determinism and permutation invariance**
    - File: `tests/scene/properties/p01-determinism-permutation.test.ts`.
    - **Validates: Requirements 3.2, 3.3**

  - [ ] 6.5 Write property test for stable ghost phase
    - **Property 2: Stable ghost phase**
    - File: `tests/scene/properties/p02-ghost-phase.test.ts`.
    - **Validates: Requirements 3.4, 9.4**

  - [ ] 6.6 Write property test for no mutation and hostile numbers
    - **Property 3: No mutation and no throw on hostile numbers**
    - File: `tests/scene/properties/p03-no-mutation-hostile.test.ts`.
    - **Validates: Requirements 3.5, 3.6, 10.7**

  - [ ] 6.7 Write property test for ViewBox bounds (model part)
    - **Property 4: Everything stays inside the ViewBox** (windows, zombies, tombstones, Poltergeist, ghost orbit extremes, overflow anchors, sigil and chimney). The Moment art part is added in task 9.10.
    - File: `tests/scene/properties/p04-viewbox-bounds.test.ts`.
    - **Validates: Requirements 3.8, 15.7**

  - [ ] 6.8 Write property test for caps and conservation
    - **Property 5: Caps and conservation**
    - File: `tests/scene/properties/p05-caps-conservation.test.ts`.
    - **Validates: Requirements 4.1, 4.2, 4.8, 9.1, 9.2, 21.6**

  - [ ] 6.9 Write property test for ranked prefixes
    - **Property 6: Drawn items are the best-ranked prefix**
    - File: `tests/scene/properties/p06-ranked-prefix.test.ts`.
    - **Validates: Requirements 4.5, 4.6, 4.7, 11.1**

  - [ ] 6.10 Write property test for zombie slots and sizes
    - **Property 7: Zombie slots are distinct and sizes are bounded and monotone**
    - File: `tests/scene/properties/p07-zombie-slots-sizes.test.ts`.
    - **Validates: Requirements 5.5, 5.6**

  - [ ] 6.11 Write property test for Poltergeist, bound state and posture
    - **Property 8: Poltergeist, bound state and posture**
    - File: `tests/scene/properties/p08-poltergeist-bound-posture.test.ts`.
    - **Validates: Requirements 8.2, 8.3, 8.4, 9.2, 10.1, 10.3**

  - [ ] 6.12 Write property test for the scene summary
    - **Property 12: Scene summary states the true figures**
    - File: `tests/scene/properties/p12-summary.test.ts`.
    - **Validates: Requirements 4.8, 8.6, 10.6, 19.2**

  - [ ]* 6.13 Write example tests for the summary
    - `tests/scene/summary.test.ts`: the string of Requirement 19.2, singular and plural, zero counts, the three Poltergeist clauses.
    - _Requirements: 19.2, 24.4_

- [ ] 7. Phase B: creature components and ambient motion
  - [ ] 7.1 Create `ZombieBasement.tsx`, `GhostSwarm.tsx`, `Poltergeist.tsx` and `GraveyardRow.tsx`; wire into `HouseScene`
    - Zombie row with usage badge (flame, hourglass, skull) and posture, ghosts at their rest position (ovoid with eye-spots), jagged Poltergeist with the sigil ring when bound (dimmed, rotation and pulse stopped by ambient), tombstones. Distinct shapes without color. Empty basement and empty graveyard draw no text. Memoized by id.
    - _Requirements: 8.1, 8.2, 8.6, 9.1, 9.2, 9.5, 9.6, 10.2, 10.3, 11.1, 11.3, 11.4, 21.6, 21.7, 23.3_

  - [ ] 7.2 Create `src/hooks/useElementWidth.ts` and `SceneLabels.tsx`; wire into `HouseScene`
    - `useElementWidth` uses `ResizeObserver` and returns `null` when unavailable or before measuring. `SceneLabels` is an `aria-hidden` HTML overlay: `+N` markers at 12px or more, tombstone labels (name and `R.I.P. $X/mo` via `formatCentsShort`) only when the measured width reaches `TOMBSTONE_LABEL_MIN_SCENE_WIDTH_PX`.
    - _Requirements: 4.3, 4.4, 5.7, 11.2, 19.5_

  - [ ] 7.3 Create `AmbientMotion.tsx` and load it lazily
    - GSAP via `useGSAP({ scope })`, all tweens children of one `ambientRoot` timeline: zombie sway, ghost figure-eight and bob, Poltergeist rotation and pulse (stopped when bound), fog, fireflies, bats, level 2 and 3 window flicker. Animate only `transform` and `opacity`.
    - Pause only `ambientRoot` and the ambient ticker callback when off screen (`IntersectionObserver`) or hidden (`visibilitychange`). Never pause `gsap.globalTimeline`. Clean up on unmount.
    - Load with `next/dynamic(..., { ssr: false })` from `HouseScene` only when motion is enabled. Check `matchMedia('(prefers-reduced-motion: reduce)')` before any timeline; under reduced motion hide fog, fireflies and bats and never request the module.
    - _Requirements: 1.5, 1.8, 8.5, 9.4, 20.1, 20.2, 20.4, 20.5, 20.6, 21.2, 21.3, 21.4, 21.5, 21.8_

  - [ ]* 7.4 Write component tests for creatures and labels
    - Overflow markers only when overflow above 0; tombstone labels follow the measured width (mock `ResizeObserver`); usage badges and postures; empty basement; Poltergeist awake and bound states; no text for an empty graveyard.
    - _Requirements: 4.3, 4.4, 5.7, 8.2, 10.2, 11.2, 11.3, 24.7_

  - [ ] 7.5 Write reduced-motion tests for ambient motion
    - With `vi.mock("gsap")`: reduced motion creates no timeline, ticker or `AmbientMotion` module import.
    - _Requirements: 20.1, 20.2, 24.7_

  - [ ] 7.6 Write component tests for ambient motion loops and pause
    - With `vi.mock("gsap")`: with motion on, loops start after the lazy import; unmount removes timelines, ticker callback and listeners. With real gsap core and a mocked `IntersectionObserver`: off screen pauses `ambientRoot` only, `gsap.globalTimeline` is not paused, and a separate in-flight timeline keeps progressing. Mutation check: pause `globalTimeline` and confirm the test fails.
    - _Requirements: 20.1, 20.2, 21.3, 21.4, 21.8, 24.7_

- [ ] 8. MANUAL CHECKPOINT 2: creatures, graveyard and ambient motion (user review in the browser)
  - **Executor: STOP here. Do not start phase C until the user confirms.** Ask the user to review:
    - The five demo scenarios: zombies in the basement row (sizes, usage badge flame, hourglass and skull, posture differs by usage), ghosts around the house, Poltergeist at the roof (awake), tombstones in the graveyard row.
    - Tick the Poltergeist action on `/exorcism`, return to `/`: the Poltergeist shows the sigil ring, is dimmed and stops rotating and pulsing; untick returns it to awake. Reload keeps the bound state.
    - Level 5 with a Poltergeist: its glow is the only light. Level 5 without one: faint moonlight only.
    - A crowded input (many subscriptions, small expenses and canceled subscriptions): `+N` markers at least 12px, no overlap of zombies, tombstone labels hidden below about 453px Scene width and shown above it.
    - Ambient motion: sway, orbit, bob, pulse, fog, fireflies and bats look calm. With reduced motion on, none of them move, fog, fireflies and bats are hidden, and everything is still legible. Scrolling the Scene off screen pauses the loops.
    - Creatures are not clickable and show no tooltips.
  - Apply any art changes the user requests before continuing.
  - _Requirements: 4.3, 8.2, 9.2, 10.2, 20.2, 24.9_

- [ ] 9. Phase C: pure moment infrastructure
  - [ ] 9.1 Create `src/lib/moments/types.ts` and `requests.ts`
    - Types: `RectLike`, `MomentRequest`, `ActionOutcome`, `ActionContext`. Pure `planMoments(outcome, ctx)` (own request, then `exorcismComplete`) and a pure level step `planLevelMoment(cursor, live)` that returns one `level` request only when the levels differ.
    - _Requirements: 12.1, 12.3, 12.5, 13.1, 13.2, 13.5, 14.1, 14.2, 14.7, 15.1, 15.2, 15.6, 16.1, 16.4, 16.6, 17.1, 17.7_

  - [ ] 9.2 Create `src/lib/moments/queue.ts`
    - `createMomentQueue(options)` with FIFO order, `gapMs`, pending limit, level merging (dropping a merged request whose `from` equals `to`), drop when no target or `shouldDrop`, hard cap, `skipAll`, `destroy`, exactly-once settlement of every `enqueue` promise, `onIdle`. No React or DOM imports, `setTimeout` timers.
    - _Requirements: 1.1, 12.4, 12.6, 12.9, 12.10, 12.11, 12.12, 12.13, 15.6_

  - [ ] 9.3 Create `src/lib/moments/hold.ts`
    - Pure `holdReducer` with `begin` (freeze only when no hold is active, never replace an existing frozen model), `settled`, `queueBusy`, `queueIdle`, and the release rule (`awaiting === 0` and queue idle).
    - _Requirements: 12.8, 12.16, 12.19_

  - [ ] 9.4 Create `src/lib/scene/momentGeometry.ts`
    - Pure helpers: `shovelArc`, sinking zombie box and clip, tombstone rise box and clip, `batPath`, orb endpoint and flame fallback, crack flash, shutter box, candle boxes, and `getMomentExtents(model, request)`.
    - _Requirements: 12.18, 13.7, 14.4, 14.5, 18.2, 18.3_

  - [ ] 9.5 Write property test for request planning
    - **Property 16: Request planning follows the action outcome**
    - File: `tests/moments/properties/p16-request-planning.test.ts`.
    - **Validates: Requirements 12.1, 12.3, 12.5, 13.1, 13.2, 13.5, 14.1, 14.2, 15.1, 15.2, 17.1, 17.7**

  - [ ] 9.6 Write property test for the level request
    - **Property 17: Level request only when the level changed**
    - File: `tests/moments/properties/p17-level-request.test.ts`.
    - **Validates: Requirements 16.1, 16.4, 16.6**

  - [ ] 9.7 Write property test for queue order, gap and pending limit
    - **Property 14: Queue order, no overlap, gap and pending limit**
    - File: `tests/moments/properties/p14-queue-order.test.ts`, with fake timers and a command language (`enqueue`, `advance`, `skipAll`, `unmount`, `resolvePlay`, `rejectPlay`, `neverResolve`).
    - **Validates: Requirements 12.4, 12.6, 18.6**

  - [ ] 9.8 Write property test for exactly-once settlement
    - **Property 15: Queue settles every promise exactly once**
    - File: `tests/moments/properties/p15-queue-settle.test.ts`.
    - **Validates: Requirements 12.9, 12.10, 12.11, 12.12, 12.13, 15.6**

  - [ ] 9.9 Write property test for the hold
    - **Property 18: The hold keeps the first frozen model**
    - File: `tests/moments/properties/p18-hold.test.ts`. Mutation check (R3): make `begin` replace an existing frozen model with the live one and confirm the test fails with a counterexample, then restore.
    - **Validates: Requirements 12.19**

  - [ ] 9.10 Extend the bounds property with Moment art geometry
    - **Property 4: Everything stays inside the ViewBox** (Moment art part): sample `getMomentExtents` for every request shape (cancel at every drawn slot and at the overflow marker, payment with and without origin, every ordered pair of levels, sigil, exorcism complete); every extent is inside the ViewBox or has a clip inside it with the final box inside the clip. Mutation check (R2): move the Poltergeist center back to `y 110` and confirm the sigil check fails.
    - File: `tests/scene/properties/p04-viewbox-bounds.test.ts` (extend) or `p04b-moment-art-bounds.test.ts`.
    - **Validates: Requirements 12.18, 15.7**

  - [ ] 9.11 Write example tests for queue, requests and geometry
    - `tests/moments/queue.test.ts` (gap length, skip, hard cap, merge when `from === to`), `tests/moments/requests.test.ts`, `tests/scene/momentGeometry.test.ts` (shipped arc, bat and candle numbers, one failing example per bounds rule).
    - _Requirements: 12.4, 12.6, 12.12, 12.18, 24.6_

- [ ] 10. Phase C: observer, hold and `MomentHost` wiring
  - [ ] 10.1 Create `src/hooks/useActionObserver.ts` and wire the action hooks
    - `ActionObserver` interface (`begin`, `resolve`, `fail`) and `ActionObserverContext`. Wrap `logPayment` and `cancelSubscription` in `useCryptActions`, and `toggleAction` in `useExorcismPlan`, with `begin` before the mutation and `resolve` or `fail` after. Map `CancelOutcome` and `LogPaymentOutcome` to `ActionOutcome`. With no provider, behavior is unchanged.
    - _Requirements: 1.4, 12.1, 12.3, 12.17, 13.1, 13.2, 14.1, 14.2, 15.1, 17.1_

  - [ ] 10.2 Create `MomentHost.tsx` and `momentLoader.ts`
    - `MomentHost` implements the observer: builds `ActionContext` from live data at `begin`, captures the submit control rect for payments, drives `holdReducer` (no freeze under reduced motion), calls `planMoments`, waits for settle (`SETTLE_TIMEOUT_MS`), appends the level request using the level cursor, owns the queue, the Moment_Layer (`aria-hidden`, `pointer-events: none`), `pointerdown`, `keydown` and `visibilitychange` skip listeners (never stop the event), target-mounted tracking and `destroy` on unmount. `HouseScene` renders the frozen model while held and runs cleanups in a layout effect on release.
    - `momentLoader.ts` maps request kinds to `() => import(...)` entries (empty for now, a no-op `play` that resolves after the reduced-motion fade or immediately), and handles import failure by resolving.
    - _Requirements: 1.5, 12.2, 12.4, 12.7, 12.8, 12.9, 12.10, 12.11, 12.15, 12.16, 12.19, 16.5, 16.7, 19.5, 20.1, 20.3_

  - [ ] 10.3 Wrap the Dashboard in `MomentHost`
    - Place `MomentHost` around the Scene, the plan card and the sheets so portal sheets keep the context. Only the Dashboard provides the observer, so `/subscriptions` and `/exorcism` create no request.
    - _Requirements: 12.17, 22.7_

  - [ ] 10.4 Write tests for the observer and `MomentHost` with a fake `play`
    - Hook tests: `begin`, `resolve` and `fail` order, unchanged behavior with no provider, no observer on `/subscriptions` and `/exorcism`.
    - Host tests: hold keeps the pre-action model until idle and is released after the queue is idle; a second `begin` during a hold keeps the first frozen model; the Moment_Layer is `aria-hidden`; skip on `pointerdown` and `keydown` finishes everything without stopping the event; unmount drops pending requests.
    - _Requirements: 12.1, 12.3, 12.9, 12.17, 12.19, 24.7_

  - [ ] 10.5 Write host tests for request triggers
    - Requests for each trigger (cancel, payment with extra principal, Poltergeist tick, third completion, level change) and none for no-op cases, page load, demo load, reset and Skip_Week; the level cursor prevents a duplicate level Moment; nothing is frozen under reduced motion.
    - _Requirements: 12.1, 12.2, 12.3, 16.6, 24.7_

- [ ] 11. Phase D: cancel-subscription moment
  - [ ] 11.1 Create `MomentArt.tsx` (shovel, tombstone) and `ShovelMoment.ts`; register in `momentLoader.ts`
    - `playShovelMoment(target, options)`: shovel arc from `momentGeometry`, bonk beat held 300 ms with the subscription name, zombie wobble and sink under the clip, tombstone rise with `R.I.P. $X/mo`. `target = "overflow"` aims at the `+N` marker and reduces N. Timeline created inside `gsap.context`, only `transform` and `opacity`, abort jumps to the end, cleanup registered. Reduced motion: 150 ms fade, no GSAP import. Cartoon art, no gore.
    - _Requirements: 1.8, 12.14, 12.15, 13.3, 13.4, 13.5, 13.6, 13.7, 18.2, 18.5, 20.3, 23.1, 23.3_

  - [ ]* 11.2 Write component tests for the cancel moment
    - With a GSAP mock: timeline created only inside the play function, beat of at least `MOMENT_BEAT_MIN_MS`, abort lands on the end state, reduced motion creates no timeline, overflow target path.
    - _Requirements: 13.3, 13.5, 18.5, 20.3, 24.7_

- [ ] 12. Phase D: extra-payment moment with flare
  - [ ] 12.1 Add flame and orb art to `MomentArt.tsx`; create `CandleOrbMoment.ts`; register in `momentLoader.ts`
    - `playCandleOrbMoment`: flame flickers at the captured origin (bottom-center fallback), orb travels a curved `MotionPathPlugin` path in the Moment_Layer outside the SVG, lit windows rise to the flare peak from `getFlareSteps`, hold 300 ms with one `--accent-ecto` crack flash (omitted when `hasCrack` is false), settle to the live opacity. Flame and orb at least 24 px. End state equals the live model. Reduced motion: no flare, 150 ms fade.
    - _Requirements: 12.14, 14.1, 14.3, 14.4, 14.5, 14.6, 14.7, 18.4, 18.5, 20.3_

  - [ ]* 12.2 Write component tests for the payment moment
    - GSAP mock: recorded steps are `from`, `peak`, `final`; peak at most 1 and at least the live opacity; hold lasts `MOMENT_BEAT_MIN_MS`; abort leaves the live opacity; no flare under reduced motion; crack flash omitted when no crack. Mutation check (R1): remove the flare and confirm the test fails.
    - _Requirements: 14.3, 14.6, 14.7, 18.4, 20.3_

- [ ] 13. Phase D: Poltergeist sigil moment
  - [ ] 13.1 Add sigil art to `MomentArt.tsx`; create `SigilMoment.ts`; register in `momentLoader.ts`
    - `playSigilMoment`: `<ellipse>` sigil drawn with `DrawSVGPlugin` (imported from `gsap/DrawSVGPlugin`), closing beat held 300 ms, one shake of `SIGIL_SHAKE`, settle into the bound state with a brief `--text-primary` flash. Never splits or removes the Poltergeist. Diameter at least 1.5 times the Poltergeist width. The queue drops the request when the Poltergeist is null (`shouldDrop`).
    - _Requirements: 1.6, 10.2, 15.3, 15.4, 15.5, 15.6, 15.7, 18.3, 18.5, 20.3_

  - [ ]* 13.2 Write component tests for the sigil moment
    - Circle diameter at least 1.5 times the Poltergeist size, `DrawSVGPlugin` used, bound state at the end, request dropped when the Poltergeist is null, no `MorphSVGPlugin` import.
    - _Requirements: 1.6, 15.3, 15.6, 18.3_

- [ ] 14. Phase D: level-change moment
  - [ ] 14.1 Create `LevelChangeMoment.ts`; register in `momentLoader.ts`
    - `playLevelChangeMoment`: better level plays dawn (1600 ms: background warms, fog thins, one bat flies away along `batPath`), worse level plays creak (1000 ms: one crack draws, one shutter swings). A `prepare` step renders the incoming level layer in `incoming-level` and waits one frame. Old features show until the midpoint; new features show at the end or on skip. No announcement is added (the Dashboard `aria-live` region owns it).
    - _Requirements: 6.7, 12.14, 16.2, 16.3, 16.4, 16.5, 16.7, 20.3_

  - [ ]* 14.2 Write component tests for the level-change moment
    - Better versus worse sequences chosen by direction, a multi-step change plays one Moment ending at the new level, skip shows the new level, no extra `aria-live` text.
    - _Requirements: 16.2, 16.3, 16.4, 16.5, 16.7_

- [ ] 15. Phase D: exorcism-complete moment
  - [ ] 15.1 Add candle art to `MomentArt.tsx`; create `ThreeCandlesMoment.ts`; register in `momentLoader.ts`
    - `playThreeCandlesMoment`: three candles above the Scene light one after another, hold, fade out. Candle boxes come from `momentGeometry`. The completion card text is independent and never delayed or hidden. Cleanup leaves no element.
    - _Requirements: 17.2, 17.3, 17.5, 17.6, 20.3_

  - [ ]* 15.2 Write component tests for the exorcism-complete moment
    - Three candles light in order, no leftover element after end or skip, completion card text present immediately, no request from other screens.
    - _Requirements: 17.2, 17.4, 17.5, 17.6_

- [ ] 16. Phase D: demo flow verification
  - [ ]* 16.1 Write the demo-path test with the real mutations
    - `tests/scene/demoPath.test.ts` (fake-indexeddb, as in `tests/demo/calibration.test.ts`): cancel Wraithcast, tick Coffee, $300 extra payment. Assert light 32.74, 37.95, 38.95, 43.49, levels 4, 4, 4, 3, window opacity 0.262, 0.361, 0.380, 0.435, and flare peak minus previous opacity at least `MIN_VISIBLE_WINDOW_DELTA`.
    - _Requirements: 7.6, 14.3, 18.4, 18.7_

  - [ ] 16.2 Write the demo flow request-order test
    - `tests/moments/requests.test.ts` (extend): the same three actions produce, in order, cancel, then sigil, then payment, exorcism complete and level 4 to 3, played without overlap and separated by `MOMENT_GAP_MS`.
    - _Requirements: 12.5, 18.6, 18.7_

- [ ] 17. MANUAL CHECKPOINT 3: full level-4 demo at 1280 by 720 (user review in the browser)
  - **Executor: STOP here. Do not start phase E until the user confirms.** Ask the user to open the browser at 1280 by 720, load the default Demo Crypt (level 4) and run the flow:
    - **First viewport:** the whole Scene and the heading plus three actions of "This week's exorcism" are visible without scrolling.
    - **Cancel Wraithcast:** the shovel swoops in on an arc and is at least a quarter of the Scene height tall. The bonk is held long enough to see. The zombie sinks, its usage badge is readable, and the tombstone rises labeled "R.I.P. $X/mo" at 12px or more. The toast and the score update at once, without waiting for the animation. The zombie is gone and the tombstone stays.
    - **Tick "Cut Coffee":** the sigil circle draws around the Poltergeist (about 1.5 times its width), the monster shakes once and settles dimmed with a brief warm flash, and the sigil ring stays. The Poltergeist is not removed or split.
    - **$300 extra payment:** the flame (at least 24px) lights at the Save button, the orb flies along a curve to the house, the windows brighten to a clear peak (the flare beat, held about 300 ms) while one crack flashes in green, then they settle to the new brightness. The effect is clearly visible at this step.
    - **Third action done and level change:** the three candles light, the card text "Exorcism complete. The lights flicker back on." appears at once, then the dawn moment plays and the house reads as level 3 (Haunted) with the Poltergeist still present and bound.
    - **Queue and skip:** Moments play one at a time with small gaps. Clicking or pressing a key mid-Moment finishes everything at once and the click still reaches its target. Total sequence length is acceptable for a demo video.
    - **Other screens:** canceling on `/subscriptions` and ticking on `/exorcism` play no Moment.
    - **Reduced motion:** every end state appears with a short fade, no flare, no travel. Reload and demo reset create no Moment.
  - Apply any timing, size or art changes the user requests before continuing.
  - _Requirements: 12.2, 12.8, 12.9, 12.17, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 24.9_

- [ ] 18. Phase E: audit and cleanup
  - [ ] 18.1 Write the source scans
    - `tests/scene/staticChecks.test.ts` and `tests/moments/staticChecks.test.ts`: forbidden imports (React, Next, Dexie, GSAP, Motion) and `Math.random`, `Date.now`, `new Date` in `src/lib/scene/` and `src/lib/moments/`; no `canvas`, `getContext`, `WebGL` or `three` under `src/`; GSAP imported only in `AmbientMotion.tsx` and the moment files; no Framer Motion in `house/` or `moments/`; no `MorphSVGPlugin`; a static import walk from `Dashboard.tsx` (following `import` and `export … from`, not `import()`) reaches no `gsap` import; no numeric literal other than 0, 1 and arithmetic identities in `src/lib/scene/` outside `config.ts`; hex colors in `house/` and `moments/` only from the scene-only palette; no image or font asset imports; no `gsap.timeline` at module scope; no `globalTimeline` pause call.
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.8, 2.6, 21.1, 23.6_

  - [ ] 18.2 Write axe tests for the Dashboard with the Scene
    - Axe passes in "empty real crypt", "demo level 4" and "loading" using the existing `tests/ui/helpers/axe.ts`.
    - _Requirements: 19.9, 24.7_

  - [ ] 18.3 Replace the old placeholder assertions
    - Find every test and doc reference to `ScenePlaceholder` or "House scene arrives in the next update", replace them with Scene assertions (the Scene in place of the placeholder in the three states), and keep every other existing test passing.
    - _Requirements: 22.1, 22.6, 24.8_

  - [ ] 18.4 Delete `ScenePlaceholder.tsx`
    - Delete `src/components/dashboard/ScenePlaceholder.tsx`, confirm with `grep_search` that nothing references it or its text, and run typecheck.
    - _Requirements: 22.1_

  - [ ] 18.5 Update steering and docs
    - `.kiro/steering/structure.md`: list the new `src/lib/scene/`, `src/lib/moments/`, `src/components/house/` and `src/components/moments/` files, note the `.ts` moment modules (F4) and the new hooks, and update the "Built so far" paragraph.
    - `.kiro/steering/visual-language.md`: state that the window-brightness percentages for levels 2 to 4 are nominal and the real curve is in `src/lib/scene/config.ts` (F2).
    - Check `tech.md` and `README.md` for statements that the house scene is not built, and update them. Add a short entry to `docs/kiro-journal.md` if the project keeps one for features.
    - _Requirements: 1.2, 6.1, 7.1_

  - [ ] 18.6 Run the final verification
    - Run `npm test -- --run`, `npm run typecheck` and `npm run lint`. Fix every failure.
    - _Requirements: 24.10_

- [ ] 19. Final checkpoint: ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Record in the task summary the manual checklist of Requirement 24.9: all five levels at 320, 768, 1280 and 1920px with and without reduced motion, and the level-4 demo flow at 1280 by 720, with the three checkpoint outcomes.
  - _Requirements: 24.9, 24.10_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. The pure scene-model properties (P1 to P13), the flare property (P19), the planner and queue properties (P14 to P17) and the hold property (P18) are required.
- **MANUAL CHECKPOINT** tasks (4, 8 and 17) are not coding tasks. The executor stops and waits for the user's review in the browser.
- Each task references the requirements it satisfies. Property tasks reference the numbered properties of `design.md`.
- Phases A and B do not touch the queue or the Moments. `gsap` and `@gsap/react` are added in task 5.1.
- Mutation checks (R1 flare, R2 sigil geometry, R3 hold, ambient pause) follow the `conventions.md` procedure.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "1.6", "1.7", "2.1"] },
    { "id": 3, "tasks": ["2.2", "3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3"] },
    { "id": 5, "tasks": ["3.4"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["6.2", "6.3"] },
    { "id": 8, "tasks": ["6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10", "6.11", "6.12", "6.13", "7.1"] },
    { "id": 9, "tasks": ["7.2"] },
    { "id": 10, "tasks": ["7.3"] },
    { "id": 11, "tasks": ["7.4", "7.5", "7.6"] },
    { "id": 12, "tasks": ["9.1", "9.2", "9.3", "9.4"] },
    { "id": 13, "tasks": ["9.5", "9.6", "9.7", "9.8", "9.9", "9.10", "9.11", "10.1"] },
    { "id": 14, "tasks": ["10.2"] },
    { "id": 15, "tasks": ["10.3"] },
    { "id": 16, "tasks": ["10.4", "10.5"] },
    { "id": 17, "tasks": ["11.1"] },
    { "id": 18, "tasks": ["11.2", "12.1"] },
    { "id": 19, "tasks": ["12.2", "13.1"] },
    { "id": 20, "tasks": ["13.2", "14.1"] },
    { "id": 21, "tasks": ["14.2", "15.1"] },
    { "id": 22, "tasks": ["15.2", "16.1", "16.2"] },
    { "id": 23, "tasks": ["18.1", "18.2", "18.3", "18.5"] },
    { "id": 24, "tasks": ["18.4"] },
    { "id": 25, "tasks": ["18.6"] }
  ]
}
```
