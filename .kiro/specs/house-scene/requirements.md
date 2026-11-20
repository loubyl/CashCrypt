# Requirements Document

## Introduction

CashCrypt has a finished haunting engine, finished chrome and screens, and a Dashboard that shows `ScenePlaceholder` ("House scene arrives in the next update") where the haunted house goes. This feature builds that house and the one-shot "moments" that react to real user actions. It is the visual core of the Costume Contest entry.

It delivers:

1. **Scene model** (`src/lib/scene/`): a pure function from `HouseState` and a few extra rows to "what to draw" (counts, caps, positions, states, summary text). All limits are named constants in `src/lib/scene/config.ts`.
2. **House scene** (`src/components/house/`): an inline SVG with original art, five decay levels, window light, basement zombies, ghosts, the Poltergeist and a graveyard.
3. **Moments** (`src/components/moments/`, `src/lib/moments/queue.ts`): cancel-subscription shovel, extra-payment candle, Poltergeist sigil, decay-level change and exorcism-complete celebration. Each is a GSAP one-shot, fired once per user action and queued so two never overlap.
4. **Accessibility, performance and tests** as defined below.

This spec does not restate values owned elsewhere. Colors, typography and chrome rules come from `design-system.md`. Level features, creature appearance, creature movement and scene animation rules come from `visual-language.md`. The thresholds (`SMALL_EXPENSE_THRESHOLD_CENTS`, `POLTERGEIST_RATIO`, `WINDOW_DAYS`) and decay bands come from `src/lib/haunting/config.ts`. Moment durations come from the moment catalog in `design-system.md`.

Out of scope: sound, CSV import, JSON export and import, the spirit-jar moment, the ghost-to-Poltergeist merge and split morph (MorphSVG, deferred for time, not for license), the dispel moment that splits an exorcised Poltergeist into ghosts, clickable creatures and creature tooltips (deferred), and showing the scene or any Moment on screens other than the Dashboard.

### Delivery order

The static house with its five Decay_Levels is built and reviewed by hand in the browser before the creatures and the Moments are built, so that the art style can be adjusted early. This note constrains the order of work; the tasks carry the checkpoint.

### Decisions recorded by this spec

- **Name of level 5.** The scene uses "Condemned", the name used by `visual-language.md`, `product.md`, `scoreView.ts` and `config.ts`.
- **Scene reads data, never writes it.** The scene shows what `HouseState` and the stored rows say. No scene element changes a financial figure and no moment changes data.
- **Moments come from user actions only.** A Moment_Request is created by an action handler after its Mutation succeeds. Loading a page, reloading, loading a demo scenario, resetting the demo, switching scenario and Skip_Week create none.
- **Level change without an action is instant.** When the level changes with no user action in the same session (load, reload, demo load, reset, scenario switch, Skip_Week), the scene shows the new level at once with at most the reduced-motion fade.
- **Bound Poltergeist.** Ticking the `reduce_small_expenses` action shows the Poltergeist as bound (sealed and dimmed) for as long as that action is done in the current Weekly_Plan. The Poltergeist leaves the scene only when the engine stops reporting it. Trade-off: the user gets visible feedback for an action whose data effect is only momentum, and the scene never claims the small expenses dropped when they did not.
- **Extra-payment moment only for extra principal.** The candle moment plays when the payment has `extraPrincipalCents` above 0. A payment at or below the minimum shows its toast only. The "Log a debt payment" row of `design-system.md` states this.
- **Moment durations follow the catalog.** Each moment lasts the duration of its row in the `design-system.md` moment catalog (all between 600 and 1600 ms). `MOMENT_HARD_CAP_MS` (2500 ms) is a watchdog, not a target.
- **Dashboard only.** The Scene and every Moment exist on the Dashboard only. Canceling on `/subscriptions` or ticking on `/exorcism` plays no Moment.
- **One skip finishes everything.** One Skip_Input finishes the current Moment and all pending ones.
- **GSAP plugins.** GSAP and its former Club plugins ship in the public `gsap` npm package under the standard no-charge license, whose only restriction is on visual animation builders that compete with Webflow, which CashCrypt is not. The Scene uses `DrawSVGPlugin` for the sigil stroke draw, imported from `gsap/DrawSVGPlugin`. `MorphSVGPlugin` is out of scope for time only.
- **Non-interactive creatures.** Creatures are not buttons and have no tooltips in this version. The Scene is one `role="img"` and the financial detail lives in the chrome lists.
- **Perceptual window opacity.** The Scene draws window light through a monotonic curve of `windowBrightness`, so that the demo step from level 4 to level 3 is clearly visible. The curve and its limits live in the Scene_Config.
- **Merge and split later.** The Ghosts and the Poltergeist swap by fade in this version. When small expenses drop below the threshold the Poltergeist fades out as plain data; the full split-into-ghosts dispel Moment may come later.
- **Desktop layout.** From 1024px the Dashboard places the Scene and the plan card side by side so that both fit the first viewport at 1280 by 720. The exact layout is a design decision.

## Glossary

- **App**: The CashCrypt Next.js application.
- **Scene**: The inline SVG haunted house rendered by `HouseScene` inside the Dashboard, including its creatures and graveyard.
- **Scene_Model**: The plain data returned by `buildSceneModel`: everything the Scene needs to draw, with no DOM, React or GSAP.
- **Scene_Builder**: The pure function `buildSceneModel(input, config)` in `src/lib/scene/`.
- **Scene_Input**: The argument of the Scene_Builder: the `HouseState`, the monthly income in Cents, the Graveyard_Entries and the Bound_Flag.
- **Scene_Config**: The module `src/lib/scene/config.ts` that holds every constant of this feature, with a pure `validateSceneConfig(config): string[]` that never throws.
- **House_State**: The engine output defined in `src/lib/haunting/types.ts`.
- **Decay_Level**: `House_State.decayLevel`, an integer from 1 to 5 (Pristine, Uneasy, Haunted, Crumbling, Condemned).
- **Cents**: Integer hundredths of a dollar, as in `app-screens`.
- **Zombie**: One entry of `House_State.zombies`; one active, valid Subscription.
- **Ghost**: One entry of `House_State.ghosts`; one small expense in the 30-day window.
- **Poltergeist**: `House_State.poltergeist` when it is not null.
- **Graveyard_Entry**: One inactive Subscription with its name, monthly cost in Cents and cancellation date.
- **Bound_Flag**: True while the Weekly_Plan of the current Plan_Week has a `reduce_small_expenses` Plan_Action with `done` equal to true.
- **Bound_Poltergeist**: The Poltergeist drawn in its bound state (sealed and dimmed). It exists only while the Poltergeist is not null and the Bound_Flag is true.
- **Visible_Cap**: The largest number of Zombies, Ghosts or tombstones the Scene draws as individual figures. Values are in Scene_Config.
- **Overflow_Count**: The total number of rows of a kind minus the number drawn, shown as a "+N" marker.
- **Scene_Summary**: The single text string that describes the whole Scene, produced by the Scene_Builder.
- **ViewBox**: The fixed SVG coordinate space of the Scene. All Scene_Model positions are in ViewBox units.
- **Moment**: A one-shot GSAP animation defined by `design-system.md` and played by a function `playXMoment(target, options): Promise<void>`.
- **Moment_Request**: A plain object that names a Moment kind and the data it needs (for example the canceled Subscription's name and monthly cost in Cents).
- **Moment_Queue**: The framework-agnostic queue in `src/lib/moments/queue.ts` that plays Moments one at a time.
- **Moment_Layer**: The non-interactive overlay in which Moments draw items that leave the Scene (the candle orb travelling from a control to the house).
- **Moment_Target**: The mounted region a Moment draws into. It exists on the Dashboard only and consists of the Scene and the Moment_Layer.
- **Window_Opacity_Curve**: The function in `src/lib/scene/` that maps a House_State to the candlelight opacity of a lit window. It depends only on the Decay_Level and `windowBrightness`.
- **Desktop_Breakpoint**: The 1024px viewport width at which the app switches to its two-column layout.
- **Skip_Input**: Any `pointerdown` or `keydown` event on the document while a Moment plays.
- **End_State**: The Scene (and, for the exorcism-complete Moment, the plan card region) as the data says it should look after the Moment.
- **Reduced_Motion**: The state in which `window.matchMedia('(prefers-reduced-motion: reduce)')` matches.
- **Plan_Action**, **Weekly_Plan**, **Plan_Week**, **Mutation**, **Do_It_Button**, **Auto_Completion**, **Demo_Crypt**, **Skip_Week**: As defined in `.kiro/specs/app-screens/requirements.md`.
- **Dashboard**: The `/` Screen rendered by `Dashboard.tsx`.
- **Test_Suite**: The Vitest tests of this feature (node and jsdom projects).

## Requirements

### Requirement 1: Module boundaries and lazy loading

**User Story:** As a maintainer, I want the scene logic, the drawing code and GSAP separated, so that the Dashboard stays fast and the model stays testable.

#### Acceptance Criteria

1. THE Scene_Builder, the Scene_Config and the Moment_Queue SHALL import no React, Next.js, Dexie, GSAP or Framer Motion module, and SHALL read neither the clock nor a random source.
2. THE App SHALL place the Scene components in `src/components/house/` and the Moment components in `src/components/moments/`, and SHALL import GSAP only in those two directories.
3. THE App SHALL import no Framer Motion module in `src/components/house/` or `src/components/moments/`.
4. THE Scene and Moment components SHALL obtain data only through Hooks from `src/hooks/` and SHALL import nothing from `src/lib/db/`.
5. THE App SHALL load every module that imports GSAP through a dynamic `import()`, so that no module statically imported by the Dashboard route imports GSAP.
6. THE App SHALL import GSAP core and its plugins from the public `gsap` npm package (for example `gsap/DrawSVGPlugin`), SHALL draw the sigil stroke with `DrawSVGPlugin`, and SHALL import no `MorphSVGPlugin` in this version.
7. WHEN a source-scan test runs, THE Test_Suite SHALL fail if a file in `src/lib/scene/` or `src/lib/moments/` imports a forbidden module, uses `Math.random`, `Date.now` or `new Date`, or if a file under `src/` references `canvas`, `getContext`, `WebGL` or `three`.
8. THE App SHALL create every GSAP timeline inside `useGSAP()` or inside a `playXMoment` function, and never in module scope.

### Requirement 2: Scene configuration

**User Story:** As a maintainer, I want every scene limit in one config, so that caps and timings can be tuned without hunting for literals.

#### Acceptance Criteria

1. THE Scene_Config SHALL define as named constants: `MAX_VISIBLE_ZOMBIES` (6), `MAX_VISIBLE_GHOSTS` (12), `MAX_VISIBLE_TOMBSTONES` (6), the ViewBox width and height (suggested 800 by 600, a 4:3 ratio), `WINDOW_COUNT`, the per-level decay feature table, `MOMENT_HARD_CAP_MS` (2500), `MOMENT_INPUT_UNBLOCK_MS` (300), `MOMENT_GAP_MS` (200), `MOMENT_BEAT_MIN_MS` (300), `MOMENT_QUEUE_MAX_PENDING` (4), `REDUCED_MOTION_FADE_MS` (150), `MIN_SCENE_WIDTH_DESKTOP_PX` (480), `MIN_LABEL_PX` (12), `MIN_VISIBLE_WINDOW_DELTA` (0.15), `PAYMENT_FLARE_BOOST` (suggested 0.35), the sigil geometry (Poltergeist center and size, sigil diameter, stroke width, glow padding and shake offset) and the parameters of the Window_Opacity_Curve.
2. THE Scene_Config SHALL define the duration of each Moment so that it equals the duration of the matching row of the moment catalog in `design-system.md`.
3. THE Scene_Config SHALL define the scene-only colors that `visual-language.md` lists (the five decay tints and the Zombie body and clothing colors) and SHALL define no other hex value.
4. THE Scene_Config SHALL provide `validateSceneConfig(config)` that returns a list of problems and never throws.
5. THE Scene_Config SHALL pass `validateSceneConfig`, which checks that every cap is an integer of at least 1, that the ViewBox sides are positive, that every Moment duration is between 600 and `MOMENT_HARD_CAP_MS`, and that `MOMENT_INPUT_UNBLOCK_MS` is below every Moment duration, and that the Window_Opacity_Curve parameters are finite and keep every per-level opacity inside 0 to 1, that `PAYMENT_FLARE_BOOST` is finite and in the range above 0 up to 1, and that the sigil, with its stroke, glow padding and shake offset, lies inside the ViewBox and is at least 1.5 times the Poltergeist width across.
6. THE Scene_Builder and the Scene components SHALL contain no numeric literal for a cap, size, duration or count outside the Scene_Config, except 0, 1 and arithmetic identities.

### Requirement 3: Scene model purity and determinism

**User Story:** As a developer, I want one pure function that decides what to draw, so that the Scene always agrees with the data and can be tested without a browser.

#### Acceptance Criteria

1. THE Scene_Builder SHALL accept a Scene_Input and return a Scene_Model that contains the Decay_Level, the window list, the decay features, the drawn Zombies, the drawn Ghosts, the Poltergeist state, the drawn tombstones, the three Overflow_Counts and the Scene_Summary.
2. THE Scene_Builder SHALL return an identical Scene_Model for identical Scene_Inputs (determinism).
3. THE Scene_Builder SHALL derive every position, phase and tilt from the row ids and the Scene_Config only, and SHALL NOT use the order of the input arrays, so that FOR ALL permutations of the input arrays the Scene_Model is deeply equal (permutation invariance).
4. THE Scene_Builder SHALL give a Ghost the same phase offset in every Scene_Model that contains it, because the offset depends only on the Ghost's `transactionId`.
5. THE Scene_Builder SHALL NOT mutate its inputs.
6. IF the Scene_Input contains non-finite or negative numbers, THEN THE Scene_Builder SHALL treat them as 0 and SHALL still return a valid Scene_Model without throwing.
7. THE Scene_Builder SHALL read the Decay_Level, the light score and the window brightness from the House_State and SHALL recompute none of them.
8. FOR ALL valid Scene_Inputs, every position in the Scene_Model SHALL lie inside the ViewBox (bounds property).

### Requirement 4: Caps and overflow markers

**User Story:** As a user with many subscriptions, expenses or tombstones, I want the scene to stay readable and tell me how many figures it leaves out.

#### Acceptance Criteria

1. THE Scene_Builder SHALL draw at most `MAX_VISIBLE_ZOMBIES` Zombies, at most `MAX_VISIBLE_GHOSTS` Ghosts and at most `MAX_VISIBLE_TOMBSTONES` tombstones.
2. FOR ALL valid Scene_Inputs, the number drawn plus the Overflow_Count SHALL equal the total number of rows of that kind (conservation property).
3. WHEN the Overflow_Count of a kind is above 0, THE Scene SHALL draw one "+N" marker for that kind with N equal to the Overflow_Count, as text at least `MIN_LABEL_PX` tall on screen at every Scene width.
4. WHEN the Overflow_Count of a kind is 0, THE Scene SHALL draw no marker for that kind.
5. THE Scene_Builder SHALL choose the drawn Zombies by monthly cost descending, then by `subscriptionId` ascending, so that the figures that matter most are shown.
6. THE Scene_Builder SHALL choose the drawn Ghosts by amount descending, then by `transactionId` ascending.
7. THE Scene_Builder SHALL choose the drawn tombstones by cancellation date descending, then by subscription id ascending, so that the newest tombstone is always drawn.
8. THE Scene_Summary and the chrome lists SHALL state the true totals, not the drawn counts.

### Requirement 5: Layout, aspect ratio and responsiveness

**User Story:** As a user on any device, I want the house to keep its shape from a small phone to a wide desktop, so that it always looks right.

#### Acceptance Criteria

1. THE Scene SHALL render as one `<svg>` with a fixed `viewBox` from the Scene_Config and `preserveAspectRatio="xMidYMid meet"`.
2. THE Scene container SHALL keep the ViewBox aspect ratio at every width through CSS `aspect-ratio`, and SHALL reserve its height before any script runs, so that loading the Scene causes no layout shift.
3. THE Scene SHALL stay fully legible from a 320px wide viewport to a 1920px wide viewport, with no horizontal scrolling.
4. THE Scene SHALL place the Zombies in one row in the basement, the Ghosts and the Poltergeist around the house, and the tombstones in the graveyard row at the base of the basement, as `visual-language.md` describes.
5. THE Scene_Builder SHALL place the drawn Zombies at pairwise distinct slots that do not overlap (no-overlap property).
6. THE Scene_Builder SHALL scale each Zombie by its monthly cost divided by monthly income and each Ghost by its amount, within the size limits of `visual-language.md`.
7. THE Scene SHALL render each text label (the "+N" markers and the tombstone labels) at a size of at least `MIN_LABEL_PX` on screen. WHERE the rendered Scene width is below the width at which that size fits the label, THE Scene SHALL omit the persistent tombstone labels, because the same figures are in the Graveyard card and in the Scene_Summary.

### Requirement 6: Five decay levels

**User Story:** As a user, I want the house to look clearly different at each level, so that I see my progress without reading numbers.

#### Acceptance Criteria

1. THE Scene SHALL draw the walls, windows, roof, garden and atmosphere features that `visual-language.md` lists for the current Decay_Level, using the names Pristine, Uneasy, Haunted, Crumbling and Condemned.
2. THE Scene_Model SHALL expose the features of the level as data (crack count, boarded and broken windows, roof state, garden state, lantern state, fog density and bat presence), taken from the per-level feature table of the Scene_Config.
3. THE feature table SHALL give each pair of different levels at least one different feature, and SHALL NOT decrease the severity of any feature as the level worsens (monotonicity property over levels 1 to 5).
4. WHILE the Decay_Level is 5 and the Poltergeist is not null, THE Scene SHALL use the Poltergeist glow as the only light source of the scene, as `visual-language.md` specifies.
5. WHILE the Decay_Level is 5 and the Poltergeist is null, THE Scene SHALL draw only the faint moonlight that `visual-language.md` specifies.
6. THE Scene SHALL draw the level tints from the scene-only palette and every other color from design-system tokens.
7. WHEN the Decay_Level changes without a user action in the same session, THE Scene SHALL show the new level at once, with at most an opacity fade of `REDUCED_MOTION_FADE_MS`.

### Requirement 7: Window light

**User Story:** As a user, I want the windows to glow in proportion to my light score, so that every payment brightens the house.

#### Acceptance Criteria

1. THE Scene_Builder SHALL set the candlelight opacity of each lit window to the Window_Opacity_Curve of the House_State `decayLevel` and `windowBrightness`, with `windowBrightness` clamped to the range 0 to 1 and the result clamped to the range 0 to 1.
2. WHILE the Decay_Level is 5, THE Window_Opacity_Curve SHALL return 0.
3. THE Scene_Builder SHALL mark windows as lit, boarded or broken according to the feature table, and SHALL give boarded and broken windows a distinct shape, so that the state is not shown by brightness alone.
4. FOR ALL pairs of House_States with the same Decay_Level and different light scores, the lit-window opacity SHALL be non-decreasing in the light score (monotonicity within a level).
5. FOR ALL pairs of House_States where the first has a better (lower) Decay_Level than the second, the lit-window opacity of the first SHALL be greater than or equal to that of the second (monotonicity across levels).
6. THE Window_Opacity_Curve SHALL return for `windowBrightness` 0.43 at Decay_Level 3 an opacity at least `MIN_VISIBLE_WINDOW_DELTA` above its return for `windowBrightness` 0.327 at Decay_Level 4, so that the demo step from light score about 32.7 to about 43 is clearly visible.
7. THE Window_Opacity_Curve SHALL be a pure function that is non-decreasing in `windowBrightness` and MAY combine a concave curve with a per-level visible minimum, provided criteria 4 and 5 hold.
8. WHEN `windowBrightness` changes without a Moment, THE Scene SHALL interpolate the window opacity over the "Window brightness interpolation" duration of `visual-language.md`, or apply it at once under Reduced_Motion.

### Requirement 8: Zombies

**User Story:** As a user, I want one zombie per active subscription, looking more decayed the less I use it, so that I know which ones to banish.

#### Acceptance Criteria

1. THE Scene SHALL draw one Zombie figure per drawn entry of `House_State.zombies`, up to `MAX_VISIBLE_ZOMBIES` (Requirement 4).
2. THE Scene SHALL show the usage of each Zombie with the badge icon that `visual-language.md` assigns (flame for `often`, hourglass for `rarely`, skull for `never`) and with a different posture per usage, so that usage is not shown by color alone.
3. THE Scene_Builder SHALL expose each drawn Zombie's `usage` as data, and SHALL give Zombies of different usage different posture values.
4. THE Scene SHALL give each Zombie a head tilt and a sway phase derived from its `subscriptionId`.
5. WHILE the Scene is not in Reduced_Motion, THE Scene SHALL sway each Zombie with the idle motion of `visual-language.md`.
6. WHEN no Zombie exists, THE Scene SHALL draw an empty basement and the Scene_Summary SHALL state "no zombies".

### Requirement 9: Ghosts and Poltergeist

**User Story:** As a user, I want small expenses to appear as ghosts that merge into one Poltergeist when they pile up, so that I see when small spending becomes a problem.

#### Acceptance Criteria

1. WHILE `House_State.poltergeist` is null, THE Scene SHALL draw one Ghost figure per drawn entry of `House_State.ghosts`, up to `MAX_VISIBLE_GHOSTS`.
2. WHILE `House_State.poltergeist` is not null, THE Scene SHALL draw one Poltergeist figure and no individual Ghost figures, because the Ghosts have merged into it.
3. THE Scene_Builder SHALL base this on `House_State.poltergeist` only, and SHALL NOT recompute the threshold or the 30-day window.
4. WHILE the Scene is not in Reduced_Motion, THE Scene SHALL move each Ghost on the figure-eight orbit and vertical bob of `visual-language.md`, with the phase derived from its `transactionId`, and SHALL rotate and pulse the Poltergeist as `visual-language.md` specifies.
5. WHEN the Poltergeist appears or disappears because the data changed, THE Scene SHALL fade it in or out over `REDUCED_MOTION_FADE_MS` or the Ghost spawn duration, and SHALL play no merge or split morph (out of scope).
6. THE Scene SHALL draw the Ghost and the Poltergeist with distinct shapes (an ovoid with eye-spots, and an amorphous jagged figure), so that they differ without color.

### Requirement 10: Bound Poltergeist

**User Story:** As a user who ticked "Cut Coffee…", I want the Poltergeist to look sealed, so that my action is acknowledged without the scene claiming the problem is gone.

#### Acceptance Criteria

1. WHILE the Poltergeist is not null and the Bound_Flag is true, THE Scene_Builder SHALL set the Poltergeist state to bound.
2. WHILE the Poltergeist state is bound, THE Scene SHALL draw a sigil ring around the Poltergeist, dim the Poltergeist opacity, and stop its rotation and pulse, so that the state does not rely on color alone.
3. WHILE the Poltergeist is null, THE Scene SHALL draw no Poltergeist whatever the Bound_Flag is.
4. WHEN the user unticks the `reduce_small_expenses` Plan_Action, THE Scene SHALL return the Poltergeist to its awake state within `REDUCED_MOTION_FADE_MS` and SHALL play no Moment.
5. THE Bound_Flag SHALL come from the stored Weekly_Plan of the current Plan_Week, so that the bound state survives a reload and is not created by any Moment.
6. WHEN the Poltergeist is bound, THE Scene_Summary SHALL state "Poltergeist bound", and WHEN it is awake it SHALL state "Poltergeist awake".
7. THE App SHALL leave the engine output, the light score and every stored row unchanged by the bound state.

### Requirement 11: Graveyard

**User Story:** As a user, I want a tombstone for every subscription I canceled, so that banishing zombies feels like a trophy.

#### Acceptance Criteria

1. THE Scene SHALL draw one tombstone per drawn Graveyard_Entry, up to `MAX_VISIBLE_TOMBSTONES`, in the graveyard row at the base of the basement.
2. WHERE the rendered Scene width allows it (Requirement 5 criterion 7), THE Scene SHALL label each tombstone with the subscription name and "R.I.P. $X/mo", where `$X` is the monthly cost formatted with `formatCentsShort`.
3. WHEN no Graveyard_Entry exists, THE Scene SHALL draw an empty graveyard with no text, and the empty-state copy "No tombstones yet. Suspiciously quiet." SHALL stay in the Subscriptions Screen Graveyard card.
4. WHEN a canceled Subscription is brought back, THE Scene SHALL remove its tombstone and draw its Zombie, without a Moment.
5. THE App SHALL persist nothing new for the graveyard, because the canceled Subscription rows already carry the data (Requirement 7.3 of `app-screens`).

### Requirement 12: Moment framework and queue

**User Story:** As a user, I want short playful animations that follow my actions and never get in my way, so that the app feels alive but stays usable.

#### Acceptance Criteria

1. WHEN a Mutation of a user action succeeds, THE action handler SHALL create the Moment_Requests that the action defines in Requirements 13 to 17.
2. THE App SHALL create no Moment_Request on page load, reload, route change, demo scenario load, demo reset, scenario switch or Skip_Week.
3. WHEN a Mutation rejects, THE App SHALL create no Moment_Request.
4. THE Moment_Queue SHALL play Moment_Requests one at a time in the order they were enqueued, and SHALL wait `MOMENT_GAP_MS` between two Moments.
5. WHEN several Moment_Requests come from one user action, THE App SHALL enqueue them in this order: the action's own Moment, the exorcism-complete Moment, the level-change Moment.
6. WHEN more than `MOMENT_QUEUE_MAX_PENDING` Moment_Requests are pending, THE Moment_Queue SHALL finish the oldest pending one at its End_State without animation, and WHEN two level-change requests are pending THE Moment_Queue SHALL merge them into one that goes to the latest level.
7. THE Moment_Layer and the Scene overlay SHALL ignore pointer events and SHALL take no focus from the first frame, so that no Moment blocks input.
8. WHILE a Moment plays, THE App SHALL accept user input at every moment, and SHALL show the toast and the changed chrome figures of the action immediately, without waiting for the Moment.
9. WHEN a Skip_Input occurs while a Moment plays, THE Moment_Queue SHALL finish the current Moment and every pending one at their End_States, and SHALL pass the input event on to its target unchanged.
10. WHEN the document becomes hidden or the Moment_Target unmounts, THE Moment_Queue SHALL finish the current and pending Moments at their End_States.
11. IF no Moment_Target is mounted when a Moment_Request is dequeued, THEN THE Moment_Queue SHALL drop the request without playing it and SHALL NOT replay it when a Moment_Target mounts later.
12. IF a Moment is still playing after `MOMENT_HARD_CAP_MS`, THEN THE Moment_Queue SHALL finish it at its End_State.
13. THE Moment_Queue SHALL resolve the promise of every `playXMoment` call exactly once, whether the Moment completed, was skipped or was dropped.
14. THE Moments SHALL animate only `transform` and `opacity` of SVG and overlay elements.
15. WHEN a Moment finishes or is skipped, THE Scene SHALL show the End_State, which equals the Scene_Model built from the current data.
16. WHILE a Moment plays, THE Scene MAY show the element the action removed or changed (the canceled Zombie, the previous window brightness) in its pre-action state until the Moment reaches that step.
17. WHEN a user action completes on a Screen other than the Dashboard, THE App SHALL create no Moment_Request, because the Moment_Target exists on the Dashboard only.
18. THE Moment art that is positioned in ViewBox units (shovel, tombstone, sigil with its shake, bat, orb and flame endpoints inside the Scene, crack flash, shutter and candles) SHALL lie inside the ViewBox at every sampled point of its path, or SHALL be clipped by a clip region that lies inside the ViewBox.
19. WHEN a user action starts while the Scene is still showing the pre-action state of an earlier action, THE Scene SHALL keep showing that earlier pre-action state until the Moment_Queue is idle, and SHALL NOT replace it with the state at the start of the later action.

### Requirement 13: Cancel-subscription Moment

**User Story:** As a user who cancels a subscription, I want to see the zombie banished, so that canceling feels like a win.

#### Acceptance Criteria

1. WHEN `cancelSubscription` succeeds and its result reports that an active Subscription was canceled, THE action handler SHALL create a cancel Moment_Request with the Subscription's id, name and monthly cost in Cents.
2. WHEN `cancelSubscription` resolves without a change (the Subscription was already inactive), THE action handler SHALL create no Moment_Request.
3. THE cancel Moment SHALL play the sequence of the "Cancel subscription" row of the moment catalog: a cartoon shovel swoops in on an arc, a bonk, the Zombie wobbles and sinks, and a tombstone rises with "R.I.P. $X/mo".
4. THE cancel Moment SHALL show the Subscription name as text next to the sinking Zombie for the length of the bonk beat.
5. WHEN the canceled Zombie is not among the drawn Zombies because of the cap, THE cancel Moment SHALL aim the shovel at the "+N" marker and SHALL reduce N.
6. WHEN the Moment ends or is skipped, THE Scene SHALL show the Zombie gone and the new tombstone in the graveyard, which the Scene_Model already contains.
7. THE shovel and the tombstone SHALL be original cartoon art with rounded shapes and no gore, as the Moment rules of `design-system.md` require.

### Requirement 14: Extra-payment Moment

**User Story:** As a user who pays extra on a debt, I want a flame to carry my effort to the house, so that I see the windows warm up.

#### Acceptance Criteria

1. WHEN `logPayment` succeeds with `extraPrincipalCents` above 0, THE action handler SHALL create a payment Moment_Request that carries the screen rectangle of the control that submitted the payment, captured at submit time.
2. WHEN `logPayment` succeeds with `extraPrincipalCents` equal to 0, THE action handler SHALL create no payment Moment_Request.
3. THE payment Moment SHALL play the sequence of the "Log a debt payment" row of the moment catalog: a flame flickers at the origin, a light orb travels along a curved path to the house, the lit windows rise from their previous opacity to a flare peak equal to the smaller of 1 and the live opacity plus `PAYMENT_FLARE_BOOST`, hold the peak for `MOMENT_BEAT_MIN_MS` while one crack on the walls flashes in the ecto accent, and then settle to the live opacity.
4. IF the submitting control is no longer in the document, THEN THE payment Moment SHALL start the orb from the horizontal center of the bottom edge of the Moment_Target.
5. THE Moment_Layer SHALL draw the orb above the page content and outside the Scene's SVG, so that the orb is not clipped by the Scene.
6. WHEN the Moment ends or is skipped, THE Scene SHALL show the window opacity of the current Scene_Model, without the flare.
7. WHERE the Decay_Level of the displayed Scene has no crack, THE payment Moment SHALL omit the crack flash.

### Requirement 15: Poltergeist sigil Moment

**User Story:** As a user who ticks the Poltergeist action, I want a sigil to bind the monster, so that the action feels meaningful and the scene stays truthful.

#### Acceptance Criteria

1. WHEN `completePlanAction` succeeds on a `reduce_small_expenses` Plan_Action that was not done and the House_State Poltergeist is not null, THE action handler SHALL create a sigil Moment_Request.
2. WHEN `completePlanAction` or Auto_Completion succeeds on any other kind of Plan_Action, THE action handler SHALL create no sigil Moment_Request.
3. THE sigil Moment SHALL play the "Poltergeist bound" row of the moment catalog, for 1200 ms: a glowing circle draws itself under the Poltergeist with a `DrawSVGPlugin` stroke-draw, the Poltergeist shakes once, and it settles into the bound state of Requirement 10, with a brief warm flash that uses `--text-primary`.
4. THE sigil Moment SHALL NOT split the Poltergeist into Ghosts and SHALL NOT remove it.
5. WHEN the Moment ends or is skipped, THE Scene SHALL show the Bound_Poltergeist.
6. IF the Poltergeist is null when the sigil Moment would play, THEN THE Moment_Queue SHALL drop the request.
7. THE Scene_Config SHALL place the Poltergeist so that the sigil circle, including its stroke, its glow padding and the shake offset, lies inside the ViewBox and does not overlap the chimney.

### Requirement 16: Level-change Moment

**User Story:** As a user whose action moves the house to another level, I want to see the house change, so that crossing a level feels earned.

#### Acceptance Criteria

1. WHEN the Decay_Level shown by the Scene differs, after a user action's Mutation, from the Decay_Level shown before it, THE App SHALL create one level-change Moment_Request with the old and new levels.
2. WHEN the new level is better (a lower number), THE level-change Moment SHALL play the "Decay level improves" sequence of the moment catalog (dawn): the scene background warms by one step, the fog thins and a bat flies away.
3. WHEN the new level is worse, THE level-change Moment SHALL play the "Decay level worsens" sequence (creak): a single crack draws across the wall and a shutter swings once.
4. WHEN the level moves by more than one step, THE App SHALL create one Moment_Request, and the Moment SHALL end at the new level.
5. WHILE the level-change Moment plays, THE Scene SHALL show the old level's features until the Moment's transition step, and SHALL show the new level's features when it ends or is skipped.
6. THE App SHALL create no level-change Moment_Request when the level did not change, even if the light score changed.
7. THE App SHALL announce a level change only through the existing `aria-live="polite"` region of the Dashboard (Requirement 21.13 of `app-screens`), and the Moment SHALL add no announcement.

### Requirement 17: Exorcism-complete Moment

**User Story:** As a user who finishes the weekly plan, I want a short celebration that matches the completion card, so that the week ends on a high.

#### Acceptance Criteria

1. WHEN a user action (ticking, `cancelSubscription` or `logPayment` with Auto_Completion) makes the number of done Plan_Actions of the current Weekly_Plan reach 3 from fewer than 3, THE action handler SHALL create one exorcism-complete Moment_Request.
2. THE exorcism-complete Moment SHALL play the "Weekly plan completed" sequence of the moment catalog: three candles light one by one.
3. THE Moment SHALL draw the candles over the Scene on the Dashboard.
4. WHEN the plan is completed from a Screen other than the Dashboard, THE App SHALL create no exorcism-complete Moment_Request, and the completion card text SHALL still appear.
5. THE completion card text "Exorcism complete. The lights flicker back on." SHALL appear at once, without waiting for the Moment, and the Moment SHALL NOT replace, hide or delay it.
6. WHEN the Moment ends or is skipped, THE three candles SHALL leave no leftover element, because the completion card carries the End_State.
7. WHEN the user unticks an action so that fewer than 3 are done and ticks it again, THE action handler SHALL create a new Moment_Request, because a new completion happened.

### Requirement 18: Demo-video legibility at 1280px

**User Story:** As a presenter recording at 1280px, I want the three demo moments to read clearly, so that the level-4 flow (cancel Wraithcast, cut Coffee, $300 extra payment, level 3) lands on video.

#### Acceptance Criteria

1. WHILE the viewport is 1280px wide and 720px tall, THE Dashboard SHALL show the whole Scene and the heading and three actions of the "This week's exorcism" card in the first viewport without scrolling, with a Scene width of at least `MIN_SCENE_WIDTH_DESKTOP_PX` (the layout of Requirement 22 criteria 8 to 10).
2. WHILE the viewport is 1280px wide, THE cancel Moment SHALL draw the shovel at least a quarter of the Scene height tall, the sinking Zombie large enough to show its usage badge, and the tombstone label at least `MIN_LABEL_PX` tall on screen.
3. WHILE the viewport is 1280px wide, THE sigil Moment SHALL draw the circle with a diameter of at least 1.5 times the Poltergeist width.
4. WHILE the viewport is 1280px wide, THE payment Moment SHALL draw the flame and orb at least 24px across, and, for the level-4 demo payment, the flare peak SHALL be at least `MIN_VISIBLE_WINDOW_DELTA` above the previous window opacity.
5. THE cancel, payment and sigil Moments SHALL each hold their key beat (the bonk, the windows at their flare peak, the circle closing) in a state visible for at least `MOMENT_BEAT_MIN_MS`, so that a 30 frames-per-second recording shows it.
6. WHEN the user runs the three plan actions of the level-4 demo in succession, THE Moment_Queue SHALL play the Moments without overlap, separated by `MOMENT_GAP_MS`, and the level-change Moment SHALL follow the action that crosses the level boundary.
7. WHEN the demo reaches level 3, THE Scene SHALL show the Haunted features, with the Poltergeist still present and bound, because the data still reports it.

### Requirement 19: Accessibility

**User Story:** As a user of assistive technology, I want the scene described in one sentence and never be the only place for information, so that I miss nothing.

#### Acceptance Criteria

1. THE Scene SHALL be exactly one element with `role="img"` and an `aria-label` equal to the Scene_Summary, and its child SVG content SHALL be hidden from the accessibility tree.
2. THE Scene_Builder SHALL produce a Scene_Summary of the form "Level 3, Haunted. 4 zombies, 30 ghosts, Poltergeist awake, 1 tombstone", using the level number, the level name, the true counts, the correct singular and plural forms, "no zombies", "no ghosts" and "no tombstones" for zero, and the Poltergeist clause "Poltergeist awake", "Poltergeist bound" or omitted when the Poltergeist is null.
3. WHEN the House_State, the Graveyard_Entries or the Bound_Flag change, THE Scene SHALL update its `aria-label` to the new Scene_Summary.
4. THE Scene_Summary SHALL NOT be a live region, because the Dashboard already announces level changes and the toasts announce action results.
5. THE Moment_Layer, every Moment element and every GSAP animation container SHALL carry `aria-hidden="true"`.
6. THE Scene SHALL contain no focusable element and no element with an interaction handler in this version.
7. THE Scene SHALL show no financial information that is not also in the chrome: the zombie list, ghost list, Poltergeist banner, tombstone list and light score stay available as text in the Dashboard and the other Screens.
8. THE Scene SHALL show every status with a shape, icon or text in addition to color.
9. THE Dashboard SHALL pass the Axe_Check of `app-screens` Requirement 30.7 with the Scene mounted, in the states "empty real crypt", "demo level 4" and "loading".

### Requirement 20: Reduced motion

**User Story:** As a user who prefers reduced motion, I want the scene to show the right state without movement, so that nothing moves unexpectedly.

#### Acceptance Criteria

1. THE Scene and the Moments SHALL read `window.matchMedia('(prefers-reduced-motion: reduce)')` before they create any GSAP timeline.
2. WHILE Reduced_Motion is active, THE Scene SHALL create no continuous loop (sway, orbit, bob, pulse, rotation, flicker or atmospheric particles) and SHALL hide fog, fireflies and bats.
3. WHILE Reduced_Motion is active, THE Moment_Queue SHALL show each Moment's End_State at once with an opacity fade of at most `REDUCED_MOTION_FADE_MS`, and SHALL play no shovel, orb, flare, circle-draw or candle travel.
4. WHILE Reduced_Motion is active, THE Scene SHALL apply level, window, creature and bound-state changes immediately with no morphing.
5. WHEN the preference changes while the Dashboard is open, THE Scene SHALL stop its loops or start them at the next Moment boundary, and SHALL NOT interrupt a Moment that is already playing.
6. THE Scene SHALL stay fully legible, and every figure SHALL stay in the chrome, with all motion disabled.

### Requirement 21: Performance

**User Story:** As a user on a modest device, I want the Dashboard to stay smooth, so that the scene adds charm without cost.

#### Acceptance Criteria

1. THE Scene SHALL use inline SVG with CSS and GSAP only, and SHALL use no `<canvas>` and no WebGL.
2. THE Dashboard SHALL render the static Scene (the SVG from the Scene_Model) without waiting for GSAP, and SHALL start the ambient loops after the GSAP module has loaded.
3. WHILE the Reduced_Motion is active, THE App SHALL NOT download the GSAP module for ambient loops, and SHALL download it for Moments only if a Moment needs to run, which under Reduced_Motion it does not.
4. WHILE the document is hidden or the Scene is outside the viewport, THE Scene SHALL pause its own ambient loops, and SHALL NOT pause or delay a Moment that is playing.
5. THE Scene SHALL animate no layout property (width, height, top, left, margin) and SHALL cause no layout shift after first paint.
6. THE Scene SHALL render at most `MAX_VISIBLE_ZOMBIES` + `MAX_VISIBLE_GHOSTS` + `MAX_VISIBLE_TOMBSTONES` creature figures, plus the Poltergeist and the overflow markers, so that the number of animated elements is bounded.
7. WHEN the House_State changes without a Moment, THE Scene SHALL update only the elements that changed, and SHALL NOT unmount the SVG.
8. THE Scene SHALL remove every GSAP timeline, ticker callback and event listener when it unmounts.

### Requirement 22: Dashboard integration

**User Story:** As a user, I want the scene where the placeholder was, so that the Dashboard shows the house.

#### Acceptance Criteria

1. THE Dashboard SHALL render `HouseScene` in place of `ScenePlaceholder`, and THE App SHALL delete `ScenePlaceholder` and its text "House scene arrives in the next update".
2. THE Dashboard SHALL feed the Scene only with the House_State from `useHouseState`, the monthly income, the Graveyard_Entries and the Bound_Flag, each from a Hook.
3. THE Dashboard SHALL keep the visually hidden `aria-live="polite"` level announcement of `app-screens` Requirement 21.13 unchanged.
4. THE Dashboard SHALL keep exactly one `hero`-scale number and at most one primary Button, as the existing Dashboard tests require.
5. WHILE the House_State is loading, THE Dashboard SHALL show a skeleton with the Scene's aspect ratio, with `aria-busy="true"`.
6. THE App SHALL replace the Dashboard placeholder assertions of `app-screens` Requirement 21.12 with Scene assertions, and SHALL keep every other existing test passing.
7. WHEN a `Do it` flow, a tick or a QuickAction on the Dashboard completes its Mutation, THE Dashboard SHALL enqueue the Moment_Requests of Requirements 13 to 17.
8. WHILE the viewport width is at least the Desktop_Breakpoint, THE Dashboard SHALL place the Scene and the plan card side by side in two columns, so that a full-width Scene does not push the plan card below the first viewport.
9. WHILE the viewport width is below the Desktop_Breakpoint, THE Dashboard SHALL stack the Scene and the plan card in one column.
10. THE Dashboard SHALL keep the fixed ViewBox aspect ratio of the Scene in both layouts, and the exact column arrangement SHALL be a design decision recorded in the design document.
11. THE Test_Suite SHALL include a component test that the Dashboard markup applies the two-column layout classes at the Desktop_Breakpoint and the single-column classes below it, and the manual checklist of Requirement 24 criterion 9 SHALL verify the first-viewport rule at 1280 by 720.

### Requirement 23: Design-system and art conformance

**User Story:** As a maintainer, I want the scene to follow the design system and use original art, so that it is consistent and free of third-party material.

#### Acceptance Criteria

1. THE Scene SHALL draw all art as original inline SVG, with no third-party character, mark, image file or font.
2. THE Scene SHALL use design-system tokens for every color except the scene-only colors that `visual-language.md` lists.
3. THE Scene SHALL keep the gothic-cozy tone, with rounded cartoon shapes and no gore, no blood drips and no screaming faces.
4. THE Scene SHALL use no sound and no network request.
5. THE Scene SHALL keep the house nameplate, if drawn, in the wordmark font only.
6. WHEN a scan test reads the files of `src/components/house/` and `src/components/moments/`, THE Test_Suite SHALL fail if a hex color appears that is not one of the scene-only colors of the Scene_Config, or if a file imports an image or font asset.

### Requirement 24: Test suite

**User Story:** As a maintainer, I want the model and the moment queue verified automatically and the visuals checked by hand, so that the scene is correct and looks right.

#### Acceptance Criteria

1. THE Test_Suite SHALL include fast-check properties for the Scene_Builder with at least 100 runs each, tagged `// Feature: house-scene, Property N: <text>`, in `tests/scene/properties/pNN-<slug>.test.ts`.
2. THE Test_Suite SHALL assert the properties of caps and conservation (Requirement 4.2), determinism and permutation invariance (3.2, 3.3), stable Ghost phase (3.4), bounds (3.8), no-overlap of Zombie slots (5.5), level-feature monotonicity (6.3), window opacity monotonicity within and across levels (7.4, 7.5), the visible delta of the demo step (7.6), level-5 window opacity 0 (7.2), no Ghost figures while a Poltergeist exists (9.2), bound state only with a Poltergeist (10.3), the Scene_Summary counts equal the true counts, the flare peak (at most 1, at least the live opacity, ending at the live opacity), the bounds of every Moment art position (12.18), and the hold that keeps the first frozen model (12.19).
3. THE Test_Suite SHALL assert that the Scene_Builder does not mutate its input and does not throw for `NaN`, `Infinity`, negative values and empty arrays.
4. THE Test_Suite SHALL include unit tests for the Scene_Summary strings, including the example of Requirement 19.2, singular and plural forms and zero counts.
5. THE Test_Suite SHALL include unit tests for the Scene_Config (the shipped config passes `validateSceneConfig`, and bad configs report problems without throwing).
6. THE Test_Suite SHALL include Moment_Queue tests with fake timers for order, no overlap, the gap, the pending limit, merging of level-change requests, Skip_Input, drop when no Moment_Target is mounted, the hard cap, and exactly-once resolution.
7. THE Test_Suite SHALL include component tests (Testing Library, jsdom) for the single `role="img"`, the updating `aria-label`, `aria-hidden` on Moments, reduced motion (a GSAP mock records that no timeline or loop is created), and the action handlers that create Moment_Requests for each trigger and none for no-op cases, page load, demo load, reset and Skip_Week.
8. THE Test_Suite SHALL include a test that the Dashboard shows the Scene in place of the placeholder in the states "empty real crypt", "demo level 4" and "loading".
9. THE Test_Suite SHALL record, as a manual checklist in the task summary, a visual check in a browser at 320px, 768px, 1280px and 1920px, for each decay level, with and without Reduced_Motion, and the full level-4 demo flow at 1280px.
10. THE Test_Suite SHALL keep `npm test`, `npm run lint` and `npm run typecheck` passing, and SHALL use plain English test descriptions and no snapshot tests for pure functions.
