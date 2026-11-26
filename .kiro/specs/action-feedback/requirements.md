# Requirements Document

## Introduction

A manual UX review of the deployed level-4 demo, played as a first-time user, found that CashCrypt does the right thing with the data but does not tell the user what happened. After an action only a toast appears, nothing links to the row it changed, many actions move the light score by tenths that the floored number hides (or not at all), a new ghost is invisible while the Poltergeist is active, nobody explains the game on entering the demo, and the plan checkbox of an action with a "Do it" target records nothing and plays no Moment. The review also found two focus bugs: the Add expense sheet does not focus its first field, and ticking a plan checkbox with the keyboard drops focus to `<body>`, because the checkbox gets the `disabled` attribute for about 28 ms while the toggle saves and disabling a focused element blurs it. It also found a Landing page that shows only two buttons and an internal styleguide link, and a disabled "Import CSV" quick action that looks unfinished.

This feature closes those gaps. It delivers:

1. **Light effect in toasts and a "View" action** (Requirements 1 to 3): every success toast of a Mutation states its effect on the light, or says why the light does not move, and, when the changed row lives on another Screen, offers "View", which opens that Screen and highlights the row.
2. **Scene reaction to a new small expense** (Requirement 4): the Poltergeist is fed visibly, or the new Ghost arrives visibly, on the Dashboard.
3. **Guide** (Requirement 5): a dismissible "How your crypt works" card, shown on entering the demo with a first step, and reopened from a "How it works" control in both Crypts.
4. **Three bugs**: initial focus in sheets (Requirement 6), focus lost to `<body>` when a control is disabled while it saves (Requirement 15), and horizontal overflow at 320px in the app header (Requirement 16).
5. **Plan checkbox behavior** (Requirements 7 and 8): ticking an action with a "Do it" target opens the same sheet as "Do it"; ticking other actions plays a reaction.
6. **Landing preview** (Requirement 9) and **three quick actions** (Requirement 10).
7. **Shared Moment, accessibility, documentation and test rules** (Requirements 11 to 14).

This spec builds on `app-screens` and `house-scene` and does not restate them. Colors, typography, components and the moment catalog come from `design-system.md`. Scene art and scene animation rules come from `visual-language.md`. Moment framework rules (queue, Dashboard only, Skip_Input, Reduced_Motion, wall-clock timing, hard cap) come from `house-scene` Requirements 12 and 20. The light score formula and its constants come from `src/lib/haunting/config.ts`.

Out of scope: CSV import, JSON export and import, sound, clickable creatures and creature tooltips, and any change to the haunting engine, the planner or the Data_Layer Mutations.

### Decisions recorded by this spec

- **The light clause comes from the unfloored score.** The toast shows the change of the real-valued light score with one decimal, so a minimum payment that moves the score by 0.1 says so even when the floored Dashboard number does not change (measured on the level-4 demo: a $150 minimum payment on the Car loan moves the score from 32.735 to 32.847). A change smaller than 0.05 in size reads "Light rises slightly" or "Light dims slightly" instead of a misleading "+0.0".
- **One rule for every Mutation toast.** The light clause is computed the same way for every success toast of a Data_Layer Mutation, edits and deletes included, from the unfloored light score before and after. Only the expense toasts use fixed text, because Transactions never affect the light. Demo controls (scenario switch, reset, Skip_Week) are not Data_Layer Mutations of the user's finances and keep their toasts unchanged.
- **Expenses never claim a light change.** Transactions are not an input of the light score (factors A, B and C and momentum do not read them). The expense toasts say so in plain words, and a property test guards that adding a Transaction leaves the light score unchanged, so the text stays true.
- **"View" only when the row lives on another Screen.** When the action happens on the Screen that lists the row, the row is highlighted in place and the toast has no "View" action.
- **Ticking means recording.** For a Plan_Action whose Do_It_Button is shown, ticking opens the same sheet as "Do it". The action becomes done only when that sheet's Mutation succeeds (Auto_Completion), so the data, the scene and the Moment always agree. This replaces the `app-screens` rule that ticking stays available "for things done outside the app": a change made outside the app is recorded through the same sheet. Unticking stays direct.
- **The candle flicker is truthful.** The new candle-flicker Moment plays only when ticking raised the light score (a first completion creates an `exorcism_action_completed` Event worth `COEFF_ACTIONS_COMPLETED` momentum points). Re-ticking an action that was completed before, or ticking while momentum is at `MOMENTUM_MAX`, changes no light, so it plays no flicker.
- **Guide in both Crypts, first step in the demo only.** The "How it works" control is on the Dashboard in both Crypts and opens the same "How your crypt works" Card. In the Demo_Crypt the Card also shows the Guide_Step and opens by itself on entering the demo. In the Real_Crypt it shows only when the user opens it and has no Guide_Step.
- **Guide session.** In the Demo_Crypt, dismissal is remembered in `sessionStorage` for the browser tab. Entering the demo from the Landing starts a new session and shows the guide again. Scenario switch, reset and Skip_Week keep the dismissal. The stored value holds no financial data.
- **First viewport with the guide.** The `house-scene` Requirement 18.1 layout rule (whole Scene, plan heading and three actions in the first viewport at 1280 by 720) applies while the Guide is dismissed. While it is shown, the Scene and the guide's first step must fit the first viewport. The presenter dismisses the guide before recording.
- **Pending is not disabled.** A control that is waiting for its own save stays focusable: it carries `aria-disabled="true"` and `aria-busy="true"` and its handler ignores repeated activations, instead of the `disabled` attribute. `disabled` stays for controls that are unavailable while nothing has focus on them, and is replaced wherever a control can hold focus when it becomes unavailable.
- **Static Landing preview.** The Landing draws the level-4 demo house from the seed in memory at a fixed date, without opening a Crypt, without GSAP and without Moments, so the first page stays fast and its markup is identical on the server and the client.

## Glossary

- **App**, **Screen**, **Dashboard**, **Mutation**, **Plan_Action**, **Weekly_Plan**, **Plan_Week**, **Do_It_Button**, **Auto_Completion**, **Demo_Crypt**, **Real_Crypt**, **Active_Crypt**, **Demo_Now**, **Skip_Week**, **Demo_Scenario**, **Cents**, **Local_Date**, **Haunting_Engine**, **House_State**, **Hook**, **Primitives**, **Axe_Check**: As defined in `.kiro/specs/app-screens/requirements.md`.
- **Desktop_Breakpoint**: The 1024px viewport width at which the app switches to its two-column layout.
- **Scene**, **Scene_Model**, **Scene_Builder**, **Scene_Config**, **Scene_Summary**, **Moment**, **Moment_Request**, **Moment_Queue**, **Moment_Target**, **End_State**, **Skip_Input**, **Reduced_Motion**, **Visible_Cap**, **Overflow_Count**, **Bound_Poltergeist**, **Ghost**, **Poltergeist**, **ViewBox**: As defined in `.kiro/specs/house-scene/requirements.md`.
- **Light_Delta**: The light score computed from the stored data right after a Mutation commits minus the light score computed from the stored data right before it, both through `useHouseState`'s path (Snapshot_Adapter and `computeHouseState`) with the same "now". A real number, not floored.
- **Light_Clause**: The text that states the Light_Delta in a toast, defined in Requirement 2.
- **Light_Toast**: The success toast of one of the Mutations listed in Requirement 1 criterion 1, ending with a Light_Clause or, for the expense Mutations, with the fixed expense text.
- **Destination_Row**: The list row that shows the row a Light_Toast action created or changed, on the Screen that lists it (Requirement 3 criterion 2).
- **View_Action**: The "View" action of a Light_Toast that opens the Screen of the Destination_Row and highlights it.
- **Row_Highlight**: The temporary emphasis of a Destination_Row, with a non-color cue and a polite announcement, lasting `ROW_HIGHLIGHT_MS`.
- **Poltergeist_Feed_Moment**: The new Moment in which the Poltergeist swells briefly because a small expense was added.
- **Ghost_Arrival_Moment**: The new Moment in which the new Ghost appears visibly in the Scene.
- **Candle_Flicker_Moment**: The new Moment in which the house windows flicker once, for a ticked Plan_Action without a Do_It_Button.
- **Guide**: The dismissible "How your crypt works" Card on the Dashboard, available in both Crypts.
- **Guide_Step**: The "first step" line of the Guide, derived from the current Weekly_Plan, shown in the Demo_Crypt only.
- **Guide_Session**: The period in one browser tab from entering the demo on the Landing until the tab closes, during which the dismissal of the Guide in the Demo_Crypt is remembered.
- **Field**: A text Input or money Input of a BottomSheet form.
- **Landing_Preview**: The static Scene drawn on the Landing from the level-4 seed.
- **Preview_Date**: A fixed Local_Date constant used as "now" for the Landing_Preview.
- **Test_Suite**: The Vitest tests of this feature (node and jsdom projects).

## Requirements

### Requirement 1: Light effect in action toasts

**User Story:** As a first-time user, I want every action toast to tell me what happened to my light, so that I learn which actions brighten the house and which do not.

#### Acceptance Criteria

1. WHEN one of these Mutations succeeds, THE App SHALL show its existing success text followed by " · " and the Light_Clause: `setMonthlyIncome` (from Settings), `addDebt`, `editDebt`, `deleteDebt`, `logPayment`, `addSubscription`, `cancelSubscription`, `reactivateSubscription`, `deleteSubscription` and `completePlanAction` from a tick.
2. WHEN `logPayment` succeeds, THE toast SHALL read "Payment saved. $X off your balance · <Light_Clause>", with `$X` formatted per `app-screens` Requirement 28.8. On the level-4 demo a $150 minimum payment on the Car loan reads "Payment saved. $150 off your balance · Light +0.1".
3. WHEN `cancelSubscription` succeeds, THE toast SHALL read "+$X/mo saved · <Light_Clause>". On the level-4 demo, canceling Wraithcast from the start reads "+$120/mo saved · Light +5.2" (the delta includes the momentum of its Auto_Completion).
4. WHEN `completePlanAction` succeeds from a tick, THE toast SHALL read the existing completion text followed by the Light_Clause, for example "+$60/mo freed · Light +1.0" for "Cut Coffee by $60" or "Action completed · Light +1.0".
5. WHEN any other Mutation of criterion 1 succeeds, THE toast SHALL keep its existing text and add the Light_Clause, for example "Zombie added: Lantern Club, $12/mo · Light −1.3", "Debt deleted · Light +2.0" or "Income saved · Light +3.1".
6. WHEN `addTransaction` succeeds with an amount below `SMALL_EXPENSE_THRESHOLD_CENTS`, THE toast SHALL read "Ghost added: $X · feeds the Poltergeist, doesn't dim the light".
7. WHEN `addTransaction` succeeds with an amount at or above `SMALL_EXPENSE_THRESHOLD_CENTS`, THE toast SHALL read "Expense added: $X · doesn't change the light".
8. WHEN `deleteTransaction` succeeds, THE toast SHALL read "Expense deleted · doesn't change the light".
9. WHEN a Mutation fails, THE App SHALL show its existing error toast with no Light_Clause.
10. WHEN a Mutation completes from a sheet opened by a Do_It_Button or by a plan checkbox (Requirement 7), THE App SHALL show exactly one toast, the Mutation's Light_Toast, as `app-screens` Requirement 22.11 requires.
11. THE App SHALL leave the toasts of the demo controls (scenario switch, "Reset demo", "Skip to next week") unchanged, and SHALL add no toast where a Mutation has none today (usage change, uncompleting a Plan_Action, "Clear all data").
12. THE Light_Toast SHALL show its whole text without truncation at every viewport width from 320px, wrapping to a second line WHERE the text does not fit on one.
13. THE Light_Toast SHALL keep the existing tone of its toast (`app-screens` Requirement 28.5).

### Requirement 2: Light_Delta and the Light_Clause

**User Story:** As a user who makes small progress, I want the exact change shown, so that a minimum payment does not look like it did nothing.

#### Acceptance Criteria

1. THE App SHALL provide a pure function in `src/lib/utils/` that takes the light score before and after a Mutation and returns the Light_Clause, with no React, Dexie or Next.js import and no clock read. Every Light_Toast of Requirement 1 criteria 1 to 5 SHALL get its clause from this one function.
2. WHEN the Light_Delta rounded to the nearest tenth (half away from zero) is not 0, THE Light_Clause SHALL be "Light " followed by a sign and the rounded value with exactly one decimal: "+" for a rise and "−" (U+2212) for a drop, for example "Light +0.3" and "Light −1.3".
3. WHEN the Light_Delta is above 0 and its rounded value is 0, THE Light_Clause SHALL be "Light rises slightly".
4. WHEN the Light_Delta is below 0 and its rounded value is 0, THE Light_Clause SHALL be "Light dims slightly".
5. WHEN the Light_Delta is exactly 0 and the light score before the Mutation is 100, THE Light_Clause SHALL be "Light already full".
6. WHEN the Light_Delta is exactly 0 and the light score before the Mutation is below 100, THE Light_Clause SHALL be "Light unchanged".
7. THE App SHALL compute both light scores from the stored data of the Active_Crypt with the same "now", through the Snapshot_Adapter and `computeHouseState`, and SHALL NOT estimate the Light_Delta from the action's amounts.
8. IF either light score is not a finite number, THEN THE function SHALL return "Light unchanged" and SHALL NOT throw. IF a light score cannot be read after a successful Mutation (the read fails), THEN THE App SHALL show the toast's base text without a Light_Clause rather than guess the effect.
9. FOR ALL pairs of finite light scores from 0 to 100, the sign of the Light_Clause (rise, drop or no change) SHALL match the sign of the after score minus the before score (sign property).
10. FOR ALL valid Crypts and valid Transactions, the light score after `addTransaction`, and after `deleteTransaction` of an existing Transaction, SHALL equal the light score before it (expense neutrality property), so that the expense toasts of Requirement 1 criteria 6 to 8 stay true.

### Requirement 3: View action and row highlight

**User Story:** As a user who just added or changed something, I want to jump to where it lives and see it highlighted, so that I know where it went.

#### Acceptance Criteria

1. WHEN a Light_Toast with a Destination_Row appears on a Screen other than the Screen that lists that row, THE toast SHALL show a "View" action whose accessible name names the destination, for example "View in Debts".
2. THE App SHALL map each Mutation to its Destination_Row: `logPayment`, `addDebt` and `editDebt` to the Debt row on `/debts`; `addTransaction` to the Transaction row on `/transactions`; `cancelSubscription` to the Graveyard row on `/subscriptions`; `reactivateSubscription` and `addSubscription` to the Zombies row on `/subscriptions`; `completePlanAction` to the Plan_Action row on `/exorcism`. `setMonthlyIncome` and the delete Mutations have no Destination_Row, so their toasts have no "View" action and no Row_Highlight.
3. WHEN the action happens on the Screen that lists its Destination_Row, THE toast SHALL show no "View" action and THE Screen SHALL apply the Row_Highlight to the Destination_Row at once.
4. WHEN the user activates "View", THE App SHALL navigate to the destination Screen, scroll the Destination_Row into view, move focus to the row's interactive element, and apply the Row_Highlight.
5. THE Row_Highlight SHALL last `ROW_HIGHLIGHT_MS` (a named constant, suggested 4000), SHALL combine a visual emphasis with a non-color cue (for example a "New" or "Updated" text tag in the row), and SHALL end by removing both.
6. WHEN the Row_Highlight starts, THE App SHALL announce it once in an `aria-live="polite"` region, naming the row and its list, for example "Latte, $8, highlighted in Last 30 days".
7. WHILE Reduced_Motion is active, THE Row_Highlight SHALL appear and disappear without animation, or with an opacity fade of at most 150ms.
8. IF the Destination_Row no longer exists when the destination Screen renders (for example it was deleted), THEN THE App SHALL move focus to the heading of the list it belonged to, SHALL announce "That item is no longer here", and SHALL apply no Row_Highlight.
9. WHEN the destination Screen is reloaded or reached later through the browser history, THE App SHALL NOT apply the Row_Highlight again.
10. WHILE the toast is hovered or holds focus, THE Toast SHALL keep its existing pause behavior, and THE Light_Toast with a "View" action SHALL stay on screen for at least `ACTION_TOAST_DURATION_MS` (a named constant, suggested 6000), so that the action is reachable by keyboard and pointer.
11. THE Row_Highlight SHALL be offered by the existing list primitives through a prop, and SHALL NOT be applied through visual utilities in `className`, so that the className layout-only scan keeps passing.

### Requirement 4: Scene reaction to a new small expense

**User Story:** As a user who adds a small expense on the Dashboard, I want to see it reach the house, so that ghosts and the Poltergeist feel connected to my spending.

#### Acceptance Criteria

1. WHEN `addTransaction` succeeds on the Dashboard with an amount below `SMALL_EXPENSE_THRESHOLD_CENTS` and the House_State after the Mutation has a Poltergeist, THE action handler SHALL create a Poltergeist_Feed_Moment Moment_Request.
2. THE Poltergeist_Feed_Moment SHALL make the Poltergeist swell and settle once (a scale and glow pulse larger than its ambient pulse), with a spirit-colored particle burst, and SHALL end at the End_State. WHILE the Poltergeist is bound, THE Moment SHALL keep the sigil ring drawn and SHALL end in the bound state.
3. WHEN the Poltergeist_Feed_Moment Moment_Request is created, THE Dashboard SHALL briefly emphasize the amount of the Poltergeist banner, which already shows the new total, for `BANNER_HIGHLIGHT_MS` (a named constant), with chrome motion only and no motion under Reduced_Motion.
4. WHEN the Poltergeist was null before the Mutation and is present after it, THE Scene SHALL show the Poltergeist appearing as `house-scene` Requirement 9.5 defines, and THE Poltergeist_Feed_Moment SHALL play on the new Poltergeist after it.
5. WHEN `addTransaction` succeeds on the Dashboard with an amount below `SMALL_EXPENSE_THRESHOLD_CENTS` and the House_State after the Mutation has no Poltergeist, THE action handler SHALL create a Ghost_Arrival_Moment Moment_Request with the new Transaction's id.
6. THE Ghost_Arrival_Moment SHALL show the new Ghost absent until its arrival step, then fade it in at its rest position with a brief glow and a small rise, and SHALL end at the End_State.
7. IF the new Ghost is not among the drawn Ghosts because of the Visible_Cap, THEN THE Ghost_Arrival_Moment SHALL pulse the Ghosts "+N" marker instead and SHALL end with the marker showing the new Overflow_Count.
8. WHEN `addTransaction` succeeds with an amount at or above `SMALL_EXPENSE_THRESHOLD_CENTS`, THE action handler SHALL create no Moment_Request.
9. WHEN `addTransaction` succeeds on a Screen other than the Dashboard, THE App SHALL create no Moment_Request and SHALL NOT emphasize the banner, as `house-scene` Requirement 12.17 requires.
10. WHILE Reduced_Motion is active, THE Poltergeist_Feed_Moment and the Ghost_Arrival_Moment SHALL show their End_State at once with an opacity fade of at most `REDUCED_MOTION_FADE_MS`, as `house-scene` Requirement 20.3 requires.

### Requirement 5: Guide

**User Story:** As a judge entering the demo for the first time, I want a short explanation of the house and a first thing to try, so that I understand the game in seconds; as any user, I want to read that explanation again when I need it.

#### Acceptance Criteria

1. WHILE the Demo_Crypt is active and the Guide is not dismissed in the current Guide_Session, THE Dashboard SHALL show the Guide as a Card titled "How your crypt works" as an `h2`, first in reading order among the Dashboard cards: above the Scene below the Desktop_Breakpoint, and at the top of the right column from the Desktop_Breakpoint, so that it never pushes the Scene down on desktop.
2. THE Guide SHALL state, in plain sentences of at most one line each at 375px where possible: debt darkens the house and paying it down raises the light score (0 to 100), which sets the house level; subscriptions are zombies in the basement; small expenses are ghosts, and enough of them in 30 days merge into a Poltergeist; the weekly exorcism lists three actions that bring the light back.
3. WHILE the Demo_Crypt is active, THE Guide SHALL show the Guide_Step: WHEN the current Weekly_Plan has a not-done Plan_Action with a Do_It_Button, THE Guide_Step SHALL name the first such action in plan order by the part of its title before " — ", with the Moment it plays: "Press Do it on Cancel Wraithcast and watch the zombie get buried" for a `cancel_subscription` action and "Press Do it on Pay $300 extra on Scarlet Moth Card and watch the windows light up" for an `extra_payment` action.
4. WHEN no not-done Plan_Action has a Do_It_Button and at least one Plan_Action is not done, THE Guide_Step SHALL read "Tick <short title> in This week's exorcism once you've done it" for the first not-done action in plan order.
5. WHEN all three Plan_Actions are done, THE Guide_Step SHALL read "This week's exorcism is done. Use Skip to next week in Demo controls for a new plan."
6. THE Guide SHALL show a secondary or ghost "Got it" Button that dismisses it, and SHALL add no primary Button, so that the Dashboard keeps at most one.
7. WHEN the user dismisses the Guide, THE App SHALL hide it and SHALL move focus to the "How it works" control, and WHILE the Demo_Crypt is active it SHALL remember the dismissal for the Guide_Session in `sessionStorage`.
8. WHILE the Guide is hidden, THE Dashboard SHALL show a small "How it works" control (a ghost Button with a 44px touch target) in both Crypts, and WHEN the user activates it THE Dashboard SHALL show the Guide and move focus to its heading.
9. WHEN the user enters the demo from the Landing, THE App SHALL start a new Guide_Session, so that the Guide shows again. WHEN the user switches scenario, resets the demo, runs Skip_Week or reloads the page, THE App SHALL keep the dismissal of the current Guide_Session.
10. IF `sessionStorage` is unavailable, THEN THE App SHALL show the Guide in the Demo_Crypt, SHALL keep the dismissal in memory for the page's lifetime, and SHALL NOT throw.
11. WHILE the Real_Crypt is active, THE Dashboard SHALL hide the Guide until the user opens it with "How it works", SHALL show it without a Guide_Step, and SHALL write nothing to `sessionStorage` for it.
12. THE Guide SHALL be a labelled region in the normal reading order, SHALL NOT be a live region, SHALL NOT trap or take focus when it appears by itself, and SHALL be fully operable with the keyboard.
13. WHILE the Guide is shown at a 1280 by 720 viewport, THE Dashboard SHALL keep the whole Scene and, in the Demo_Crypt, the Guide_Step in the first viewport, and WHILE it is hidden THE Dashboard SHALL meet `house-scene` Requirement 18.1 unchanged.
14. THE Guide SHALL follow the voice rules of `design-system.md`: plain instructions, spooky flavor only in the title, no jokes about debt and no fear.

### Requirement 6: Initial focus in sheets

**User Story:** As a keyboard user opening a form sheet, I want the cursor in the first field, so that I can type at once and Enter does not submit an empty form.

#### Acceptance Criteria

1. WHEN a BottomSheet that contains at least one Field opens, THE BottomSheet SHALL move focus to the first Field in DOM order, so that the user's first keystrokes go into it. This covers the Add expense, Log payment (after a Debt is chosen), Onboarding, Add debt, Edit debt and Add subscription sheets.
2. WHEN the Log payment sheet opens on its Debt picker, THE sheet SHALL move focus to the first Debt row of the picker, and WHEN the user picks a Debt THE sheet SHALL move focus to the "Payment amount" Field.
3. WHEN initial focus lands on a Field that is pre-filled (for example the payment amount), THE Field SHALL select its whole value, so that typing replaces it.
4. WHEN a BottomSheet without a Field opens (confirmations, details), THE BottomSheet SHALL keep its existing initial focus.
5. WHEN the user submits a sheet form with invalid Fields, THE sheet SHALL show the existing error on each invalid Field and SHALL move focus to the first invalid Field.
6. WHEN the user opens the Add expense sheet and types digits right away, THE "Amount" Field SHALL contain those digits.
7. THE initial focus SHALL respect the existing focus trap, Escape and focus-return behavior of the BottomSheet primitive.

### Requirement 7: Plan checkbox for actions with a Do it target

**User Story:** As a user who ticks "Cancel Wraithcast", I want ticking to actually cancel it, so that the checkbox does not feel broken and the house shows the zombie buried.

#### Acceptance Criteria

1. WHILE a Plan_Action is not done and its Do_It_Button is shown, WHEN the user activates its checkbox, THE Screen SHALL open the same sheet that its Do_It_Button opens, with the same pre-fill (`app-screens` Requirement 22.10), and SHALL NOT call `completePlanAction`.
2. WHEN the sheet opened from the checkbox completes its Mutation, THE Plan_Action SHALL become done through Auto_Completion, THE Screen SHALL show the Mutation's Light_Toast only, and on the Dashboard THE action handler SHALL create the same Moment_Requests as the Do_It_Button flow (the cancel or payment Moment, then the exorcism-complete and level-change Moments as `house-scene` Requirement 12.5 orders them).
3. WHEN the sheet opened from the checkbox closes without a Mutation, THE checkbox SHALL stay unchecked, THE App SHALL write nothing, and focus SHALL return to the checkbox.
4. THE checkbox SHALL NOT show the checked state before the Mutation succeeds.
5. WHEN the user activates the checkbox of a done Plan_Action, THE Screen SHALL call `uncompletePlanAction` directly, as today, and SHALL open no sheet.
6. WHILE a Plan_Action is not done and has no Do_It_Button (a `reduce_small_expenses` or `fallback` action, or a `cancel_subscription` or `extra_payment` action whose target no longer qualifies), THE checkbox SHALL call `completePlanAction` directly, as today.
7. THE checkbox of an action that opens a sheet SHALL keep the `checkbox` role and its accessible name, and SHALL carry an accessible description that says it opens the sheet, for example "Opens the cancel confirmation" or "Opens the payment sheet".
8. WHILE at least one Plan_Action is not done, THE Exorcism Screen SHALL replace the explanation "Tap Do it to make the change here, or tick an action you did somewhere else." with "Ticking a cancel or a payment opens its sheet, so the change is recorded here."
9. THE behavior of criteria 1 to 7 SHALL apply on the Dashboard plan card and on the Exorcism Screen, and Moments SHALL play on the Dashboard only.

### Requirement 8: Reactions for ticked actions without a Do it target

**User Story:** As a user who ticks the Poltergeist cut or a fallback action, I want the house to react, so that ticking feels acknowledged.

#### Acceptance Criteria

1. WHEN `completePlanAction` succeeds on the Dashboard from a tick on a `reduce_small_expenses` Plan_Action and the Poltergeist is not null, THE action handler SHALL create the existing sigil Moment_Request of `house-scene` Requirement 15, unchanged.
2. WHEN `completePlanAction` succeeds on the Dashboard from a tick on a `fallback` Plan_Action, or on a `reduce_small_expenses` Plan_Action while the Poltergeist is null, and the Light_Delta is above 0, THE action handler SHALL create a Candle_Flicker_Moment Moment_Request.
3. WHEN the Light_Delta of that tick is 0 (a re-tick after an untick, or momentum at `MOMENTUM_MAX`), THE action handler SHALL create no Candle_Flicker_Moment Moment_Request.
4. THE Candle_Flicker_Moment SHALL make every lit window dip and return once (one flicker with the `none` ease of the "House light flicker" row of `visual-language.md`), then rise to the live opacity, and SHALL hold the brightest step for at least `MOMENT_BEAT_MIN_MS`.
5. WHERE no window is lit (Decay_Level 5, or every window boarded or broken), THE Candle_Flicker_Moment SHALL show a brief candle glow through the gaps of the boarded and broken windows instead, and SHALL end with no leftover glow.
6. THE Candle_Flicker_Moment SHALL end at the End_State and SHALL change no data.
7. WHEN the tick also completes the Weekly_Plan or changes the Decay_Level, THE Moment_Queue SHALL order the Moments as `house-scene` Requirement 12.5 defines, with the Candle_Flicker_Moment or the sigil Moment as the action's own Moment.

### Requirement 9: Landing preview

**User Story:** As a judge opening the app, I want to see the haunted house and what the game is about before I press anything, so that the first page sells the idea.

#### Acceptance Criteria

1. WHILE no Active_Crypt exists, THE Landing Screen SHALL show, in this reading order: the "CashCrypt" wordmark `h1`, the one-line pitch of `app-screens` Requirement 20.1, the two Buttons of `app-screens` Requirement 20 (with "Continue to my crypt" in place of "Start my own crypt" when a Real_Crypt Profile exists), the Landing_Preview and three short lines on how the game works. The visual order MAY place the Landing_Preview beside the text from 1024px.
2. THE three lines SHALL say, in plain language: debt dims the house and paying it down brings the light back; subscriptions are zombies and small expenses are ghosts that can merge into a Poltergeist; a weekly exorcism plan gives three actions to do next.
3. THE Landing_Preview SHALL be built from the `level-4` Demo_Scenario seed in memory, through the Snapshot_Adapter, `computeHouseState` and the Scene_Builder, with the Preview_Date as "now", so that it shows the level-4 demo look (Crumbling, five zombies, the Poltergeist awake).
4. THE Landing_Preview SHALL open no Crypt, SHALL write nothing to IndexedDB or `localStorage`, SHALL read no clock, and SHALL render identical markup on the server and on the client.
5. THE Landing_Preview SHALL draw the static Scene only: no ambient loop, no Moment, no Moment_Target, and no GSAP module loaded by the Landing route.
6. THE Landing_Preview SHALL be one `role="img"` element whose `aria-label` starts with "Preview of the demo house:" followed by its Scene_Summary.
7. THE Landing_Preview SHALL keep the ViewBox aspect ratio and reserve its height before any script runs, so that it causes no layout shift.
8. WHILE the viewport is 1280 by 720, THE Landing SHALL show the wordmark, the pitch, both Buttons and the whole Landing_Preview in the first viewport; WHILE the viewport is 375 by 667, THE Landing SHALL show the wordmark, the pitch and both Buttons in the first viewport.
9. THE Landing SHALL show exactly one primary Button.
10. THE Landing SHALL NOT show the "View the styleguide" link, and THE App SHALL keep the `/styleguide` route working and unchanged.

### Requirement 10: Dashboard quick actions

**User Story:** As a user, I want only quick actions that work, so that the Dashboard does not look unfinished.

#### Acceptance Criteria

1. WHILE CSV import is not implemented, THE Dashboard SHALL NOT render the "Import CSV" QuickAction.
2. THE Dashboard SHALL show three QuickActions in this order: "Log payment", "Add expense" and "Exorcise", with the behavior of `app-screens` Requirement 21 criteria 6 to 8 unchanged.
3. THE three QuickActions SHALL share the row width evenly, with the row centered under the score card content at every width from 320px, and SHALL keep their 44px minimum touch target.
4. WHEN CSV import is implemented later, THE App MAY restore the "Import CSV" QuickAction as the third of four, which is outside this spec.

### Requirement 11: Rules for the new Moments

**User Story:** As a maintainer, I want the new Moments to follow the same rules as the existing ones, so that the scene stays calm, skippable and truthful.

#### Acceptance Criteria

1. THE Poltergeist_Feed_Moment, the Ghost_Arrival_Moment and the Candle_Flicker_Moment SHALL be played through the Moment_Queue and SHALL follow `house-scene` Requirement 12 (one at a time, created only after a successful Mutation of a user action, Dashboard only, Skip_Input, hidden document, hard cap and exactly-once resolution) and Requirement 20 (Reduced_Motion).
2. THE Scene_Config SHALL define the duration of each new Moment as a named constant between 600 ms and `MOMENT_HARD_CAP_MS`, equal to the duration of its new row in the moment catalog of `design-system.md`, and `validateSceneConfig` SHALL check it.
3. THE new Moments SHALL animate only `transform` and `opacity`, SHALL be driven on wall-clock time as the existing Moments are, and SHALL keep every art position inside the ViewBox (`house-scene` Requirement 12.18).
4. THE new Moments SHALL create no announcement, because the toasts announce the action result.
5. WHEN a page load, reload, demo load, reset, scenario switch or Skip_Week changes the Ghosts or the Poltergeist, THE App SHALL create none of the new Moment_Requests.
6. THE new Moments SHALL use original art, the design-system tokens and the scene-only colors of the Scene_Config only.

### Requirement 12: Accessibility and design-system conformance

**User Story:** As a user of assistive technology, I want the new feedback to reach me in text and by keyboard, so that I miss nothing.

#### Acceptance Criteria

1. THE new UI SHALL be built from the Primitives and native elements, SHALL use design tokens only, and SHALL keep the className layout-only, token and hex scans passing.
2. THE App SHALL announce action results through the existing Toast live regions and the Row_Highlight through one polite region, and SHALL add no assertive announcement.
3. THE Dashboard, the Landing and every Screen that shows a Row_Highlight SHALL keep exactly one `h1`, at most one primary Button and at most one `hero`-scale number.
4. WHEN the Axe_Check runs on the Landing (with the Landing_Preview), on the Dashboard in "demo level 4" with the Guide shown and dismissed, on the Dashboard in "populated real crypt" with the Guide opened, and on a destination Screen during a Row_Highlight, THE Test_Suite SHALL report zero violations.
5. THE new statuses (highlighted row, guide shown) SHALL be conveyed with text or shape in addition to color.

### Requirement 13: Documentation and superseded criteria

**User Story:** As a maintainer, I want the older specs and steering to match the new behavior, so that the documents do not contradict the app.

#### Acceptance Criteria

1. THE App SHALL record in `.kiro/specs/app-screens/requirements.md` that this spec supersedes Requirement 20.8 (styleguide link on the Landing), Requirement 21.5 and 21.9 (four QuickActions with a disabled "Import CSV"), Requirement 22.8 (explanation text), Requirement 22.12 and the "Plan actions do the work" decision (ticking an action with a Do_It_Button), and the success toast texts of Requirements 22.3, 23.6, 23.8, 23.12, 24.10, 25.5, 26.6, 26.9 and 27.1, which gain the Light_Clause or the fixed expense text.
2. THE App SHALL add the three new Moments to the moment catalog of `design-system.md` with their trigger, sequence and duration, and SHALL change "Row of 4 under the hero" in the QuickAction description to the three QuickActions of Requirement 10.
3. THE App SHALL add the new Moments to the timing reference of `visual-language.md`.
4. THE App SHALL update `house-scene` Requirement 12.5 so that the action's own Moment includes the new Moment kinds, and SHALL record that Requirement 18.1 applies while the Guide is dismissed.

### Requirement 14: Test suite

**User Story:** As a maintainer, I want the new behavior covered at the right level, so that the feedback stays truthful.

#### Acceptance Criteria

1. THE Test_Suite SHALL include unit tests for the Light_Clause function covering each branch of Requirement 2 (rise, drop, slight rise, slight drop, already full, unchanged, non-finite input) and the rounding at 0.05 and −0.05.
2. THE Test_Suite SHALL include fast-check properties with at least 100 runs, tagged `// Feature: action-feedback, Property N: <text>` in `tests/<area>/properties/pNN-<slug>.test.ts`, for the sign property (Requirement 2.9) and the expense neutrality property (Requirement 2.10).
3. THE Test_Suite SHALL include component tests for each Light_Toast text of Requirement 1, the "View" action presence and absence, the navigation, focus and Row_Highlight of Requirement 3 (including the deleted-row case and no highlight on reload), the Guide states and Guide_Step texts in both Crypts, the dismissal and reopen focus moves, initial focus and value selection in each sheet with Fields, and the checkbox flows of Requirement 7.
4. THE Test_Suite SHALL include Moment tests that the action handlers create a Poltergeist_Feed_Moment, a Ghost_Arrival_Moment or a Candle_Flicker_Moment Moment_Request exactly in the cases of Requirements 4 and 8, and none for large expenses, off-Dashboard actions, re-ticks with a Light_Delta of 0, page load, demo load, reset and Skip_Week.
5. THE Test_Suite SHALL include a test that the Landing renders the Landing_Preview with the level-4 Scene_Summary, loads no GSAP module, opens no Crypt, and shows no styleguide link.
6. THE Test_Suite SHALL include a test that the Dashboard renders exactly three QuickActions in the order of Requirement 10.
7. WHEN a test is added for a bug fix (the Add expense initial focus, the checkbox focus loss of Requirement 15 and the checkbox that recorded nothing), THE task summary SHALL report the mutation check required by `conventions.md`: the bug reintroduced, the test failing, the fix restored.
8. THE `scripts/check-moments.mjs` browser script SHALL gain one case per new Moment (Poltergeist_Feed_Moment, Ghost_Arrival_Moment, Candle_Flicker_Moment), one case for the plan checkbox that opens the cancel sheet, and one case that ticks a plan checkbox with Space and asserts that focus stays on it, because jsdom does not blur a focused element when it becomes disabled. Every existing case SHALL keep passing.
   - It SHALL also gain the `noHorizontalScroll` case of Requirement 16.4.
9. THE Test_Suite SHALL record, as a manual checklist in the task summary, a browser check of the level-4 demo flow at 1280 by 720 and at 375 by 667 with and without Reduced_Motion, covering every toast, "View", the Guide, the three new Moments and the Landing.
10. THE Test_Suite SHALL keep `npm test`, `npm run lint` and `npm run typecheck` passing, with plain English test descriptions and no snapshot tests for pure functions.

### Requirement 15: Focus kept while an action saves

**User Story:** As a keyboard user who ticks a plan action with Space, I want focus to stay on the checkbox while it saves, so that I do not have to find my place again.

#### Acceptance Criteria

1. WHILE a plan checkbox's toggle is saving, THE ExorcismActionRow SHALL keep the checkbox focusable, SHALL NOT set the `disabled` attribute on it, and SHALL set `aria-disabled="true"` and `aria-busy="true"` on it.
2. WHILE a plan checkbox's toggle is saving, THE ExorcismPlanAction SHALL ignore further activations of that checkbox, and THE checkbox SHALL keep showing the state it had before the activation until the Mutation resolves.
3. WHEN the user focuses a plan checkbox and presses Space, THE checkbox SHALL still hold focus after the toggle saves and after it fails.
4. WHILE a control is pending its own save (Requirement 15.1), THE control SHALL show the existing disabled look through the `aria-disabled` state, so that sighted users still see that it is busy.
5. THE App SHALL apply the same pattern (focusable, `aria-disabled`, handler guard) to every other control that can hold focus at the moment it becomes unavailable: the "Reset demo" and "Skip to next week" Buttons while a demo action runs, and the "Log payment" QuickAction, which becomes unavailable when a payment from its own sheet pays off the last Debt and would otherwise receive the sheet's returned focus while disabled.
6. THE App SHALL keep the `disabled` attribute on controls that cannot hold focus when they become unavailable, and SHALL remove a `disabled` binding that can never take effect (the Do_It_Button is never rendered while its row is saving).
7. THE Button primitive's `loading` state SHALL stay as it is (`aria-disabled` and `aria-busy`, no `disabled`), since it already keeps focus, and every sheet submit Button SHALL keep using `loading` rather than `disabled` while it saves.

### Requirement 16: No horizontal overflow at 320px

**User Story:** As a user on a 320px-wide phone, I want the whole app to fit the screen width, so that the browser does not zoom the page out and the bottom navigation stays at its normal size.

Found on the deployed app at 320 by 640 in demo mode: the header (wordmark, "Demo mode · <date>" badge and settings link) is 400px wide. The page is wider than the viewport, mobile browsers zoom out to fit 400px, and the fixed bottom nav becomes 400px wide too. Viewports of 768, 1280 and 1920 have no horizontal scroll.

#### Acceptance Criteria

1. AT a viewport width of 320px, in the Demo_Crypt and in the Real_Crypt, no element of the Dashboard SHALL be wider than the viewport, and `document.documentElement.scrollWidth` SHALL be at most `document.documentElement.clientWidth`.
2. THE app header (wordmark, demo badge and settings link) SHALL fit within 320px without clipping any of them, by shortening the badge, moving its date to a second line or hiding the date below the `sm` breakpoint, or by allowing the header to wrap.
3. THE demo badge SHALL stay readable (text of at least 12px, with the "Demo" word and its icon visible at every width from 320px), and the settings link SHALL keep a touch target of at least 44 by 44px. WHERE the date is hidden or moved, it SHALL stay available to assistive technology (visible text or an accessible name that includes it).
4. THE `scripts/check-moments.mjs` browser script SHALL include a `noHorizontalScroll` case that opens the Dashboard in demo mode at viewport widths 320, 768, 1280 and 1920 and asserts `document.documentElement.scrollWidth <= document.documentElement.clientWidth` at each.
5. THE fix SHALL keep the header layout at 768px and wider unchanged, and SHALL pass the className layout-only, token and hex scans.
6. WHEN a test is added for this bug fix, THE task summary SHALL report the mutation check required by `conventions.md`: the browser case failing on the current header (header 400px wide at 320px), the fix applied, the case passing.
