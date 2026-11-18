# Requirements Document

## Introduction

The Design System Foundation implements `.kiro/steering/design-system.md` ("Crypt UI") as code. It delivers four things: (1) the design tokens as CSS custom properties and Tailwind v4 theme tokens in `src/app/globals.css`; (2) the four font families loaded through `next/font/google` in `src/app/layout.tsx`; (3) the thirteen chrome primitives in `src/components/ui/`, including the `ToastRegion` that hosts the `useToast` API; and (4) a `/styleguide` route that renders every primitive in every variant and state on the real dark background. The route is a thin server page that renders the client component `StyleguideContent` in `src/components/styleguide/`. Primitives are built in the screen-driven order defined in Requirement 26, and the styleguide grows with each primitive. The foundation is verified by Vitest component tests (jsdom and Testing Library) and by an automated axe check on `/styleguide`.

The foundation covers the **chrome register** only. The house scene, GSAP moments, Dexie persistence, the haunting engine, and the app screens (`/`, `/debts`, `/subscriptions`, `/transactions`, `/exorcism`, `/settings`) are out of scope. The design-system "moments" are scene concerns and are also out of scope; only the chrome micro-interactions listed in `design-system.md` are in scope.

Tailwind CSS v4 is configured in CSS with `@theme` and has no `tailwind.config.ts`. `structure.md` currently lists `tailwind.config.ts` and describes the Tailwind config tokens as a JS object. This feature updates `structure.md` and replaces the "Tailwind config tokens" row of `conventions.md` with a CSS-variable-to-utility mapping table. The CSS custom properties keep the names from `design-system.md`; `@theme` registers shorter Tailwind color names (`ink`, `candle`, `ecto`, and so on) that point at them. Because this Next.js version has breaking changes (see `AGENTS.md`), the relevant guides in `node_modules/next/dist/docs/` are consulted before implementation.

## Glossary

- **Design_System**: The Crypt UI specification in `.kiro/steering/design-system.md`. It is the source of truth for every token value, size, and component rule in this spec.
- **Token_Sheet**: The file `src/app/globals.css`. It is the only source file allowed to contain color hex values.
- **Token**: A named design value (color, radius, spacing, shadow, duration, or easing) exposed as a CSS custom property and as a Tailwind v4 theme variable.
- **Theme_Block**: The `@theme` block in the Token_Sheet that registers Tokens as Tailwind v4 theme variables, so that utilities such as `bg-surface-card` exist. Theme variables reference the design-system CSS custom properties (for example `--color-ink: var(--text-primary)`).
- **Color_Utility_Map**: The mapping from design-system CSS custom properties to Tailwind color names: `--text-primary`, `--text-secondary`, `--text-tertiary` map to `ink`, `ink-secondary`, `ink-tertiary` (utilities `text-ink`, `text-ink-secondary`, `text-ink-tertiary`); `--surface-void`, `--surface-card`, `--surface-raised`, `--surface-overlay` map to `surface-void`, `surface-card`, `surface-raised`, `surface-overlay` (utilities `bg-surface-void` and so on); `--accent-candle`, `--accent-ecto`, `--accent-blood`, `--accent-ghost`, `--accent-spirit` map to `candle`, `ecto`, `blood`, `ghost`, `spirit` (utilities `text-candle`, `bg-ecto` and so on); `--border-control` maps to `control` (utility `border-control`); `--focus-ring` maps to `focus` (utility `ring-focus`); `--divider` maps to `divider` (utility `bg-divider`).
- **Font_Loader**: The font setup in `src/app/layout.tsx` that uses `next/font/google`.
- **Primitive**: One of the thirteen chrome components in `src/components/ui/`: Button, QuickAction, BalanceHero, Card, ListRow, Chip, SegmentedControl, Input, BottomSheet, Toast, ToastRegion, LightScoreBar, and ExorcismActionRow.
- **ToastRegion**: The Primitive in `src/components/ui/ToastRegion.tsx` that provides the toast context and renders two always-mounted `aria-live` regions (one polite with `role="status"`, one assertive with `role="alert"`). It is mounted once in `src/app/layout.tsx`.
- **useToast**: The hook exported from `src/components/ui/ToastRegion.tsx` that returns `show` and `dismiss` functions for toasts. It is exported from the same file as ToastRegion because it depends on the ToastRegion context and `structure.md` has no rule that forbids hooks in `src/components/ui/` files (the `src/hooks/` directory is reserved for hooks that bridge Dexie and the haunting engine).
- **Delta_Direction**: The `direction` prop of the BalanceHero delta, `"up"` or `"down"`, which selects the arrow icon and the sign.
- **Delta_Intent**: The `intent` prop of the BalanceHero delta, `"good"` or `"bad"`, which selects the color (`good` = `--accent-ecto`, `bad` = `--accent-blood`).
- **Money_Input**: The money variant of Input: a large Manrope number, centered, with the currency prefix in `--text-secondary`.
- **Styleguide_Page**: The route `/styleguide` at `src/app/styleguide/page.tsx`. It is a thin server component that exports the `metadata` and renders Styleguide_Content.
- **Styleguide_Content**: The client component `StyleguideContent` in `src/components/styleguide/StyleguideContent.tsx`. It holds every showcase section and all interactive state (BottomSheet and Toast triggers).
- **Surface_Token**: One of `--surface-void`, `--surface-card`, `--surface-raised`, `--surface-overlay`.
- **Text_Token**: One of `--text-primary`, `--text-secondary`, `--text-tertiary`.
- **Accent_Token**: One of `--accent-candle`, `--accent-ecto`, `--accent-blood`, `--accent-ghost`, `--accent-spirit`.
- **Focus_Ring**: A 2px outline in `--focus-ring` with a 2px offset.
- **Reduced_Motion**: The user preference `prefers-reduced-motion: reduce`, read in chrome components through Framer Motion's `useReducedMotion()` hook.
- **Interactive_State**: One of default, hover, focus-visible, pressed, disabled, or loading, applied only where the Design_System defines it for that Primitive.
- **Test_Suite**: The Vitest tests for the Primitives, using `@testing-library/react`, `@testing-library/user-event`, and the `jsdom` environment.
- **Axe_Check**: An automated accessibility test that runs axe against the rendered Styleguide_Content and reports violations.
- **Build_Order**: The implementation sequence defined in Requirement 26.
- **Contrast_Ratio**: The WCAG relative-luminance contrast ratio between two colors.
- **Tinted_Background**: An Accent_Token at 14% alpha over the current surface, used for badges, icon circles, and banners.
- **Layout_Property**: A style property that positions or sizes a Primitive within its parent: margin, width, flex or grid placement, and positioning. A caller may set Layout_Properties through the `className` prop.
- **Visual_Property**: A style property that defines how a Primitive looks: color, background, border, radius, padding, font size, and shadow. A caller changes Visual_Properties only through Primitive props such as `variant`, `size`, and `tone`, and never through `className`, because Tailwind does not guarantee the winner between conflicting utility classes and `tailwind-merge` is not a permitted dependency (Requirement 25 criterion 6).
- **Touch_Target**: The interactive hit area of a control. The minimum is 44px in height and width.

## Requirements

### Requirement 1: Color Tokens

**User Story:** As a developer, I want every color from the Design_System available as a CSS custom property and a Tailwind utility, so that components never need a literal color value.

#### Acceptance Criteria

1. THE Token_Sheet SHALL define the four Surface_Tokens with the values `#08080A`, `#151518`, `#1F1F23`, and `#2A2A2F` for `--surface-void`, `--surface-card`, `--surface-raised`, and `--surface-overlay` respectively.
2. THE Token_Sheet SHALL define `--divider` as `#232328`.
3. THE Token_Sheet SHALL define the three Text_Tokens with the values `#F7F7F8`, `#A1A1AA`, and `#8C8C96` for `--text-primary`, `--text-secondary`, and `--text-tertiary` respectively.
4. THE Token_Sheet SHALL define `--border-control` as `#6B6B75` and `--focus-ring` as the same value as `--accent-candle`.
5. THE Token_Sheet SHALL define the five Accent_Tokens with the values `#FFB547`, `#3DDC97`, `#FF6B78`, `#7AB0FF`, and `#B69CFF` for `--accent-candle`, `--accent-ecto`, `--accent-blood`, `--accent-ghost`, and `--accent-spirit` respectively.
6. THE Token_Sheet SHALL define the semantic aliases `--color-success`, `--color-warning`, `--color-danger`, and `--color-info` as references to `--accent-ecto`, `--accent-candle`, `--accent-blood`, and `--accent-ghost` respectively.
7. THE Token_Sheet SHALL define, for each Accent_Token, a tinted variant that renders the accent at 14% alpha, so that Tinted_Background is available without a per-component alpha value.
8. THE Token_Sheet SHALL define the ordered data-visualization palette as the sequence candle, ecto, ghost, spirit, blood, and `#A1A1AA`.
9. THE Theme_Block SHALL register every color Token from criteria 1 to 8 according to the Color_Utility_Map, each as a reference to the design-system CSS custom property (for example `--color-ink: var(--text-primary)`, `--color-ink-secondary: var(--text-secondary)`, `--color-surface-card: var(--surface-card)`, `--color-ecto: var(--accent-ecto)`, `--color-focus: var(--focus-ring)`), so that the utilities `text-ink`, `text-ink-secondary`, `text-ink-tertiary`, `bg-surface-void`, `bg-surface-card`, `bg-surface-raised`, `bg-surface-overlay`, `text-candle`, `bg-ecto`, `text-blood`, `text-ghost`, `text-spirit`, `border-control`, and `ring-focus` are generated.
10. THE Token_Sheet SHALL keep the design-system CSS custom property names (`--text-primary`, `--surface-card`, `--accent-candle`, and the others in criteria 1 to 8) unchanged, and THE Primitive SHALL use the Tailwind utility names from the Color_Utility_Map rather than the long `text-text-*` or `*-accent-*` forms.
11. THE Token_Sheet SHALL set `--surface-void` as the `body` background and `--text-primary` as the default `body` text color, and SHALL set `color-scheme` to `dark`.
12. THE Token_Sheet SHALL replace the `create-next-app` defaults (`--background`, `--foreground`, the `prefers-color-scheme` media block, and the Arial `font-family`).

### Requirement 2: Shape, Spacing, Shadow, and Motion Tokens

**User Story:** As a developer, I want radius, spacing, elevation, and motion values defined once, so that every Primitive uses the same geometry and timing.

#### Acceptance Criteria

1. THE Token_Sheet SHALL define the radius Tokens `pill` as 999px, `lg` as 24px, and `md` as 16px, and the Theme_Block SHALL register them so that utilities such as `rounded-pill`, `rounded-lg`, and `rounded-md` resolve to those values.
2. THE Token_Sheet SHALL define the spacing scale of 4, 8, 12, 16, 20, 24, 32, 40, and 56 pixels on a 4px base, and the Theme_Block SHALL register them as Tailwind spacing values.
3. THE Token_Sheet SHALL define a page-padding Token of 16px below the 1024px breakpoint and 24px at or above it, a card-padding Token of 20px, and a card-gap Token of 12px.
4. THE Token_Sheet SHALL define a content-width Token of 560px for the main dashboard column.
5. THE Token_Sheet SHALL define the overlay shadow Token as `0 12px 32px rgb(0 0 0 / 0.6)` and the Theme_Block SHALL register it as a Tailwind shadow utility.
6. THE Token_Sheet SHALL define the duration Tokens 120ms (press), 200ms (tabs and chips), 280ms (sheets and modals), and 600ms (number count-up).
7. THE Token_Sheet SHALL define the press-scale Token as 0.97 and the reduced-motion fade ceiling Token as 150ms.
8. THE Token_Sheet SHALL define a type-scale Token set for `hero` (48/52), `display` (32/38), `title` (22/28), `body-lg` (16/24), `body` (15/22), `label` (13/18), and `caption` (12/16), each with size, line height, and tracking (`-0.03em`, `-0.02em`, `-0.01em`, then 0 for the rest), and the Theme_Block SHALL register them as Tailwind text utilities.
9. THE Token_Sheet SHALL define a gradient Token for the LightScoreBar fill that runs from `--accent-blood` through `--accent-candle` to `--accent-ecto`.
10. THE Token_Sheet SHALL define a skeleton-shimmer keyframe animation of 1.6s used for loading skeletons, and SHALL disable it under `prefers-reduced-motion: reduce`.

### Requirement 3: No Literal Colors Outside the Token Sheet

**User Story:** As a maintainer, I want a guard against stray hex values, so that the palette stays governed by tokens.

#### Acceptance Criteria

1. THE Test_Suite SHALL include a source-scan test that reads every `.ts`, `.tsx`, and `.css` file under `src/` except `src/app/globals.css` and fails when any file contains a hex color literal (`#` followed by 3, 4, 6, or 8 hexadecimal digits) or an `rgb(`, `rgba(`, `hsl(`, or `oklch(` color function.
2. THE source-scan test SHALL exclude `src/lib/haunting/` and `src/lib/exorcism/`, because those modules contain no color values and are governed by other specs, and SHALL exclude files under `src/components/house/` and `src/components/moments/`, because scene-only decay tints are governed by `visual-language.md`.
3. THE Token_Sheet SHALL be the only file in the scanned set that contains a color literal.
4. IF the source-scan test finds a color literal outside the Token_Sheet, THEN THE Test_Suite SHALL report the file path and line number of each occurrence.

### Requirement 4: Fonts

**User Story:** As a developer, I want the four brand fonts self-hosted and exposed as CSS variables, so that typography matches the Design_System with no runtime font request.

#### Acceptance Criteria

1. THE Font_Loader SHALL load Manrope at weights 700 and 800, Inter at weights 400, 500, and 600, Cinzel at weight 500, and JetBrains Mono at weight 400, each through `next/font/google`.
2. THE Font_Loader SHALL expose each family as a CSS variable (`--font-manrope`, `--font-inter`, `--font-cinzel`, `--font-jetbrains-mono`) and SHALL apply all four variable class names to the `<html>` element.
3. THE Font_Loader SHALL set `display` to `swap` for every family.
4. THE Theme_Block SHALL map the Tailwind font utilities `font-display` to Manrope, `font-sans` to Inter, `font-wordmark` to Cinzel, and `font-mono` to JetBrains Mono, each with a system-font fallback stack.
5. THE Token_Sheet SHALL set Inter as the default `body` font family.
6. THE Primitive SHALL apply tabular digits through the Tailwind built-in `tabular-nums` utility, and THE Token_Sheet SHALL NOT define a custom `tabular-nums` class or any other custom class that sets `font-variant-numeric`.
7. THE Font_Loader SHALL replace the `Geist` and `Geist_Mono` imports from the `create-next-app` scaffold in `src/app/layout.tsx`.
8. THE root layout SHALL replace the scaffold `title` and `description` metadata with the CashCrypt product name and a one-sentence description.
9. WHEN the production build completes, THE application SHALL make no request to `fonts.googleapis.com` or `fonts.gstatic.com` at runtime.

### Requirement 5: Primitive Conventions

**User Story:** As a developer, I want every Primitive to follow the same structure and rules, so that the library is consistent and predictable.

#### Acceptance Criteria

1. THE Design_System_Foundation SHALL implement each Primitive in its own file under `src/components/ui/`, named after the component in PascalCase (`Button.tsx`, `QuickAction.tsx`, `BalanceHero.tsx`, `Card.tsx`, `ListRow.tsx`, `Chip.tsx`, `SegmentedControl.tsx`, `Input.tsx`, `BottomSheet.tsx`, `Toast.tsx`, `ToastRegion.tsx`, `LightScoreBar.tsx`, `ExorcismActionRow.tsx`), and `ToastRegion.tsx` SHALL export both the `ToastRegion` component and the `useToast` hook.
2. THE Design_System_Foundation SHALL export each Primitive as a named export and SHALL NOT use default exports for Primitives.
3. THE Design_System_Foundation SHALL type every Primitive's props with a `type` alias, extend the matching native HTML element props where one exists, and use no `any` type.
4. THE Primitive SHALL style itself using the Tailwind utilities defined by the Color_Utility_Map and the other Theme_Block Tokens, and SHALL NOT use inline color, radius, spacing, or shadow literals.
5. THE Primitive SHALL define its Framer Motion `variants` objects in the same file as the component.
6. THE Primitive SHALL import Framer Motion from `framer-motion` and SHALL NOT import GSAP.
7. THE Primitive SHALL declare `"use client"` only when it uses state, effects, event handlers, or Framer Motion.
8. THE Primitive SHALL accept a `className` prop for Layout_Properties only (margin, width, flex or grid placement, and positioning), and SHALL change Visual_Properties (color, background, border, radius, padding, font size, and shadow) only through its props such as `variant`, `size`, and `tone`.
9. WHERE a Primitive wraps a native focusable element, THE Primitive SHALL forward a `ref` to that element.
10. WHEN a Primitive is focused through the keyboard, THE Primitive SHALL show the Focus_Ring using `--focus-ring`, and SHALL show the Focus_Ring only for `:focus-visible`.
11. WHILE a Primitive that supports a disabled state is disabled, THE Primitive SHALL set the native `disabled` attribute or `aria-disabled="true"` as appropriate, SHALL ignore activation, and SHALL render a visual dimming that is paired with the attribute rather than color alone.
12. THE Design_System_Foundation SHALL add `framer-motion` and `lucide-react` to `dependencies`, and `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and an axe integration for Vitest to `devDependencies`.
13. THE Primitive SHALL render Lucide icons at 20px in rows, 22px in QuickAction, with stroke width 2 and `currentColor` color, and SHALL mark decorative icons `aria-hidden="true"`.

### Requirement 6: Button

**User Story:** As a user, I want pill buttons with clear hierarchy and feedback, so that the primary action on each screen is obvious.

#### Acceptance Criteria

1. THE Button SHALL support the variants `primary`, `secondary`, `ghost`, and `danger`, with `primary` as the default.
2. THE Button SHALL render `primary` as `--text-primary` background with `--surface-void` text, `secondary` as `--surface-raised` background with `--text-primary` text, `ghost` as transparent background with `--accent-candle` text, and `danger` as `--accent-blood` background with `--surface-void` text.
3. THE Button SHALL support the sizes `sm`, `md`, and `lg` with heights of 36px, 44px, and 52px respectively, with `md` as the default, and a pill radius.
4. WHERE the Button size is `sm`, THE Button SHALL extend its hit area to a Touch_Target of at least 44px in height without changing its visual height.
5. WHEN the Button is pressed and Reduced_Motion is not active, THE Button SHALL scale to 0.97 over 120ms.
6. WHILE Reduced_Motion is active, THE Button SHALL apply no scale transform on press.
7. WHILE the Button `loading` prop is `true`, THE Button SHALL show a spinner, set `aria-busy="true"`, ignore activation, and keep its width unchanged.
8. WHILE the Button is disabled or loading, THE Button SHALL NOT call its `onClick` handler.
9. WHERE the Button receives a leading icon, THE Button SHALL render the icon at 20px before the label.
10. THE Button SHALL render a native `<button>` element with `type="button"` by default.
11. WHEN the Button has no visible text label and is an icon-only button, THE Button SHALL require an `aria-label` through its prop types.
12. WHERE a `success` prop is set, THE Button SHALL morph its label to a check icon for 600ms and then restore the label, announcing the result through an `aria-live="polite"` region.

### Requirement 7: QuickAction

**User Story:** As a user, I want circular quick actions under the hero balance, so that frequent tasks are one tap away.

#### Acceptance Criteria

1. THE QuickAction SHALL render a 52px circle on `--surface-raised` containing a 22px Lucide icon and a label underneath in the `label` type scale (13/500).
2. THE QuickAction SHALL render a native `<button>` whose accessible name is the label text.
3. WHEN the QuickAction is pressed and Reduced_Motion is not active, THE QuickAction SHALL scale to 0.97 over 120ms.
4. WHEN the QuickAction is activated and Reduced_Motion is not active, THE QuickAction SHALL wiggle its icon ±6° once over 200ms.
5. WHILE Reduced_Motion is active, THE QuickAction SHALL apply neither the press scale nor the icon wiggle.
6. WHILE the QuickAction is disabled, THE QuickAction SHALL dim and ignore activation.
7. THE QuickAction SHALL provide a Touch_Target of at least 44px by 44px.

### Requirement 8: BalanceHero

**User Story:** As a user, I want a bold hero number with a clear change indicator, so that I see my headline figure at a glance.

#### Acceptance Criteria

1. THE BalanceHero SHALL render a label in `--text-secondary`, the value in the `hero` type scale (Manrope 800, 48/52, `-0.03em`), and an optional delta Chip underneath.
2. THE BalanceHero SHALL accept a `format` prop with the values `"currency"` and `"score"`, with `"currency"` as the default.
3. WHERE `format` is `"currency"`, THE BalanceHero SHALL render the currency symbol, the integer part of the value at full size, and the cents at 60% of that size.
4. WHERE `format` is `"score"`, THE BalanceHero SHALL render the value as an integer equal to `Math.floor(value)`, with no decimal point and no cents element, and SHALL render a "/100" suffix only WHERE a `showMax` prop is set.
5. THE BalanceHero SHALL render the value with the Tailwind `tabular-nums` utility.
6. WHERE a delta is provided, THE BalanceHero SHALL render a Chip that accepts `direction` (Delta_Direction, `"up"` or `"down"`), `intent` (Delta_Intent, `"good"` or `"bad"`), and an amount as separate props.
7. WHERE a delta is provided, THE BalanceHero SHALL select the arrow icon from Delta_Direction (up-arrow for `"up"`, down-arrow for `"down"`), SHALL select the Chip color from Delta_Intent (`--accent-ecto` for `"good"`, `--accent-blood` for `"bad"`), and SHALL render the sign (`+` for `"up"`, `−` for `"down"`) as text together with the amount, so that direction and intent are independent (for example a debt decrease is `direction="down"` with `intent="good"`, and a light-score increase is `direction="up"` with `intent="good"`).
8. WHERE the dashboard shows the light score, THE BalanceHero SHALL be used with `format="score"`, and a rising light score SHALL use `direction="up"` and `intent="good"`.
9. WHEN the value prop changes and Reduced_Motion is not active, THE BalanceHero SHALL animate the displayed number to the new value over 600ms.
10. WHILE Reduced_Motion is active, THE BalanceHero SHALL show the new value immediately with no count-up.
11. THE BalanceHero SHALL expose the final value as text to assistive technology at all times during a count-up, with the intermediate frames hidden using `aria-hidden="true"`.
12. FOR ALL finite non-negative values, WHERE `format` is `"currency"`, THE BalanceHero SHALL render text that, when the thousands separators and currency symbol are removed, equals the input value rounded to 2 decimal places.
13. FOR ALL finite values in [0, 100], WHERE `format` is `"score"`, THE BalanceHero SHALL render text that equals `String(Math.floor(value))` once the optional "/100" suffix is removed, and the rendered text SHALL contain no decimal point.
14. THE Styleguide_Content SHALL render no more than one BalanceHero per screen section, in line with the Design_System rule that `hero` appears once per screen.

### Requirement 9: Card

**User Story:** As a developer, I want a borderless card surface, so that layouts group content by elevation instead of lines.

#### Acceptance Criteria

1. THE Card SHALL render on `--surface-card` with a 24px radius, 20px padding, and no border.
2. WHERE a `title` prop is provided, THE Card SHALL render a header with the title in the `title` type scale as a heading element whose level is set by an `as` or `headingLevel` prop, defaulting to `h2`.
3. WHERE an `action` prop with a label and `href` or `onClick` is provided, THE Card SHALL render a ghost "See all" link or button in the header, with an accessible name that includes the card title.
4. THE Card SHALL expose its content as a `<section>` labelled by its title through `aria-labelledby` WHEN a title is provided.
5. THE Card SHALL NOT apply a border, outline, or box-shadow at rest.

### Requirement 10: ListRow

**User Story:** As a user, I want consistent list rows with a clear amount column, so that I can scan balances and costs quickly.

#### Acceptance Criteria

1. THE ListRow SHALL render a 40px circular icon avatar with a Tinted_Background, a title in the `body-lg` scale, an optional subtitle in `caption` and `--text-secondary`, and an optional right-aligned amount in `body-lg` with `tabular-nums`, at a row height of 64px.
2. WHERE an amount direction of `in` or `out` is provided, THE ListRow SHALL render the amount with a `+` or `−` sign and the color `--accent-ecto` or `--text-primary` respectively, and the sign SHALL be present as text.
3. WHERE the ListRow is interactive (it has an `onClick` or `href`), THE ListRow SHALL render a native `<button>` or `<a>` element, show the pressed surface `--surface-raised`, and show the Focus_Ring.
4. WHERE the ListRow is not interactive, THE ListRow SHALL render a non-interactive element and SHALL NOT expose a button or link role.
5. WHERE the ListRow is the non-last row of a group, THE ListRow SHALL support a 1px `--divider` inset from the left edge by the icon width.
6. THE ListRow SHALL render the amount at a size no smaller than 15px.
7. THE ListRow SHALL use the `caption` scale only for the subtitle and never for an amount.

### Requirement 11: Chip

**User Story:** As a user, I want small status badges that combine color with an icon and text, so that status is never conveyed by color alone.

#### Acceptance Criteria

1. THE Chip SHALL render a 24px-high pill with a Tinted_Background, and the full Accent_Token color for its icon and text.
2. THE Chip SHALL support the tones `success`, `warning`, `danger`, `info`, `spirit`, and `neutral`, mapped to `--accent-ecto`, `--accent-candle`, `--accent-blood`, `--accent-ghost`, `--accent-spirit`, and `--text-secondary` respectively.
3. THE Chip SHALL require a text label and SHALL render an icon alongside it for every tone other than `neutral`.
4. THE Chip SHALL render in the `label` or `caption` type scale at a size no smaller than 12px.

### Requirement 12: SegmentedControl

**User Story:** As a user, I want a pill-shaped segmented control, so that I can switch between a few mutually exclusive options with the keyboard or pointer.

#### Acceptance Criteria

1. THE SegmentedControl SHALL render a pill track on `--surface-raised` and the selected segment with a `--text-primary` background and `--surface-void` text.
2. THE SegmentedControl SHALL expose `role="radiogroup"` with an accessible name from a required `aria-label` or `aria-labelledby` prop, and each segment SHALL expose `role="radio"` with `aria-checked` set to `true` for the selected segment and `false` otherwise.
3. THE SegmentedControl SHALL implement a roving tabindex, so that the selected segment has `tabindex="0"` and every other segment has `tabindex="-1"`.
4. WHEN the user presses the Right Arrow or Down Arrow key on a segment, THE SegmentedControl SHALL move focus to and select the next enabled segment, wrapping from the last to the first.
5. WHEN the user presses the Left Arrow or Up Arrow key on a segment, THE SegmentedControl SHALL move focus to and select the previous enabled segment, wrapping from the first to the last.
6. WHEN the user presses the Home or End key, THE SegmentedControl SHALL select the first or last enabled segment respectively.
7. WHEN a segment is selected, THE SegmentedControl SHALL call `onChange` once with the selected segment value.
8. WHILE a segment is disabled, THE SegmentedControl SHALL skip it during arrow-key navigation and ignore pointer activation.
9. WHEN the selection changes and Reduced_Motion is not active, THE SegmentedControl SHALL transition the selected indicator over 200ms, and WHILE Reduced_Motion is active the transition SHALL be an opacity fade of at most 150ms.

### Requirement 13: Input and Money Input

**User Story:** As a user, I want large, clearly labelled inputs with obvious error feedback, so that entering money and text is easy and unambiguous.

#### Acceptance Criteria

1. THE Input SHALL render a 52px-high field with a 16px radius, a `--surface-card` or `--surface-raised` fill, a 1px `--border-control` boundary, and a floating label.
2. THE Input SHALL associate the label with the control through `htmlFor` and `id`, so that the label is the accessible name.
3. WHEN the Input has a value or has focus, THE Input SHALL float the label above the value, and the label SHALL remain visible and readable in every state.
4. WHERE an `error` message is provided, THE Input SHALL set `aria-invalid="true"`, render the message as text with a leading icon, link the message through `aria-describedby`, and use the `--accent-blood` border.
5. WHEN an `error` message is first provided and Reduced_Motion is not active, THE Input SHALL shake horizontally 3 times by 4px over 240ms.
6. WHILE Reduced_Motion is active, THE Input SHALL show the error with no shake.
7. WHERE a `hint` is provided, THE Input SHALL link the hint through `aria-describedby`.
8. WHILE the Input is disabled, THE Input SHALL set the native `disabled` attribute and dim to a state that remains readable.
9. WHERE the variant is `money`, THE Money_Input SHALL render a currency prefix in `--text-secondary` and the entered number in Manrope, centered, in the `title` scale or larger, and SHALL set `inputmode="decimal"`.
10. WHERE the variant is `money`, THE Money_Input SHALL accept only digits, at most one decimal separator and thousands separators, with at most 2 fractional digits, and SHALL reject any other character. Both `.` and `,` are accepted as input: WHEN the value contains a `.`, commas SHALL be treated as thousands separators and removed; WHEN it contains no `.` and every comma is followed by exactly 3 digits (and then another comma or the end), commas SHALL be treated as thousands separators and removed (`"1,000"` → `"1000"`); OTHERWISE the first comma SHALL be treated as the decimal separator and later commas removed (`"15,49"` → `"15.49"`). The stored value always uses `.` as the decimal separator.
11. WHERE the variant is `money`, THE Money_Input SHALL render the value with `tabular-nums`.
12. FOR ALL strings typed into the Money_Input, THE Money_Input SHALL produce a value that matches the pattern of digits, an optional decimal separator, and at most 2 fractional digits (invariant property), and re-applying the sanitizer to its own output SHALL return the same string (idempotence property).
13. WHEN the Money_Input loses focus with a non-empty value, THE Money_Input SHALL format the value to exactly 2 fractional digits.

### Requirement 14: BottomSheet

**User Story:** As a user, I want sheets on mobile and modals on desktop that trap focus and close predictably, so that dialogs are accessible and comfortable to use.

#### Acceptance Criteria

1. THE BottomSheet SHALL render as a single component that appears as a bottom sheet with a top radius of 24px and a drag handle below 1024px viewport width, and as a centered modal with a radius of 24px on all corners at or above 1024px.
2. THE BottomSheet SHALL render a `role="dialog"` element with `aria-modal="true"` and an accessible name from `aria-labelledby` referencing its title.
3. WHEN the BottomSheet opens, THE BottomSheet SHALL move focus to the first focusable element inside it, or to the dialog container when none exists.
4. WHILE the BottomSheet is open, THE BottomSheet SHALL trap Tab and Shift+Tab focus within the dialog and SHALL mark the content behind it as inert or `aria-hidden`, except the ToastRegion live regions, the Next.js `next-route-announcer` element, and development-only Next.js overlay elements whose tag name starts with `nextjs-` (case-insensitive), which SHALL remain operable.
5. WHEN the user presses Escape while the BottomSheet is open, THE BottomSheet SHALL call `onClose` once.
6. WHEN the user activates the scrim outside the dialog, THE BottomSheet SHALL call `onClose` once.
7. WHEN the BottomSheet closes, THE BottomSheet SHALL return focus to the element that had focus before it opened.
8. WHILE the BottomSheet is open, THE BottomSheet SHALL prevent the page behind it from scrolling.
9. THE BottomSheet SHALL render a visible close control with the accessible name "Close", a Touch_Target of at least 44px, and the Focus_Ring.
10. WHEN the BottomSheet opens or closes and Reduced_Motion is not active, THE BottomSheet SHALL animate over 280ms using a low-bounce spring, and WHILE Reduced_Motion is active the BottomSheet SHALL use an opacity fade of at most 150ms.
11. THE BottomSheet SHALL render on `--surface-card` and its scrim SHALL use `--surface-void` at partial opacity through a Token.
12. THE BottomSheet SHALL render into a portal attached to `document.body`.

### Requirement 15: Toast

**User Story:** As a user, I want brief confirmation toasts that state exactly what changed, so that I get truthful feedback without being blocked.

#### Acceptance Criteria

1. THE Toast SHALL render a pill on `--surface-overlay` with the overlay shadow, an icon, and one line of text.
2. THE Toast SHALL support the tones `success`, `info`, `warning`, and `danger`, with `success` rendering an `--accent-ecto` icon, and every tone SHALL render a distinct icon shape.
3. THE ToastRegion SHALL render two `aria-live` regions: one polite region with `role="status"` that hosts `success` and `info` Toasts, and one assertive region with `role="alert"` that hosts `warning` and `danger` Toasts.
4. THE ToastRegion SHALL render both `aria-live` regions in the DOM on its first render, before any Toast message is inserted, and SHALL keep them mounted while no Toast is visible.
5. THE ToastRegion SHALL be mounted once in the root layout `src/app/layout.tsx`, and THE Styleguide_Content SHALL NOT mount a second ToastRegion.
6. THE ToastRegion SHALL provide the Toast context, and THE useToast hook SHALL return a `show` function and a `dismiss` function.
7. WHEN `show` is called with a tone, a message, and an optional `duration` or action, THE ToastRegion SHALL add one Toast to the region that matches the tone and SHALL return a Toast identifier.
8. WHEN `dismiss` is called with a Toast identifier, THE ToastRegion SHALL remove that Toast, and WHEN `dismiss` is called with an unknown identifier, THE ToastRegion SHALL leave the visible Toasts unchanged.
9. IF `useToast` is called outside a ToastRegion, THEN THE useToast hook SHALL throw an error whose message names both `useToast` and `ToastRegion`.
10. THE ToastRegion and the useToast hook SHALL be exported by name from `src/components/ui/ToastRegion.tsx`, and THE Toast SHALL be exported by name from `src/components/ui/Toast.tsx`.
11. WHEN the Toast appears and Reduced_Motion is not active, THE Toast SHALL rise 12px while fading in, and WHILE Reduced_Motion is active the Toast SHALL fade in over at most 150ms with no translation.
12. WHEN the Toast has been visible for its `duration` (default 4000ms), THE Toast SHALL call `onDismiss` once.
13. WHILE the pointer is over the Toast or the Toast contains keyboard focus, THE Toast SHALL pause its dismissal timer.
14. THE Toast SHALL render its text in `--text-primary`, which meets WCAG AA on `--surface-overlay`.
15. WHERE an action label is provided, THE Toast SHALL render a ghost button with that label and a Touch_Target of at least 44px.
16. WHEN `onDismiss` is called, THE Toast SHALL animate out before being removed from the DOM, and the removal SHALL be immediate WHILE Reduced_Motion is active.

### Requirement 16: LightScoreBar

**User Story:** As a user, I want a score bar that always shows the number as well as the fill, so that I never rely on color alone to read my light score.

#### Acceptance Criteria

1. THE LightScoreBar SHALL render a 10px-high pill track on `--surface-raised` with a fill whose width equals the score percentage and whose color follows the Token gradient blood → candle → ecto by score.
2. THE LightScoreBar SHALL always render the numeric score as text, as `Math.floor(score)`.
3. WHERE `baseScore` and `momentum` props are provided, THE LightScoreBar SHALL render the breakdown text in the form "39 = 33 base + 6 momentum", using `Math.floor` on each part.
4. THE LightScoreBar SHALL expose `role="meter"` with `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow` equal to the score, `aria-valuetext` describing the score, and an accessible name.
5. IF the `score` prop is outside [0, 100] or is not a finite number, THEN THE LightScoreBar SHALL clamp it to [0, 100], treating `NaN` as 0, before computing the fill width and the numeric text.
6. FOR ALL finite scores, THE LightScoreBar SHALL render a fill width in [0%, 100%] that is monotonically non-decreasing with the score (invariant property).
7. WHEN the score changes and Reduced_Motion is not active, THE LightScoreBar SHALL animate the fill and the number over 600ms, and WHILE Reduced_Motion is active the fill SHALL change immediately.
8. THE LightScoreBar SHALL NOT import from `src/lib/haunting/`; the score and breakdown SHALL be supplied through props.

### Requirement 17: ExorcismActionRow

**User Story:** As a user, I want to tick off exorcism actions with a clear checkbox and impact amount, so that completion is obvious and reversible by keyboard or pointer.

#### Acceptance Criteria

1. THE ExorcismActionRow SHALL render a ListRow layout with a round checkbox on the left, a title, an optional subtitle, and the monthly impact amount in `--accent-ecto` with a `+` sign and a "/mo" suffix.
2. THE ExorcismActionRow SHALL render the checkbox as a native `<input type="checkbox">` or an element with `role="checkbox"`, with `aria-checked` reflecting the done state and an accessible name that includes the action title.
3. WHEN the user presses Space on the focused checkbox or clicks the row's checkbox, THE ExorcismActionRow SHALL call `onToggle` once with the next done value.
4. WHILE the action is done, THE ExorcismActionRow SHALL render the title with a strike-through, dim the row to `--text-tertiary`, and fill the checkbox with `--accent-candle` that contains a check icon.
5. WHILE the action is done, THE ExorcismActionRow SHALL keep the title and the impact amount readable at a Contrast_Ratio of at least 4.5:1 against `--surface-card`.
6. WHEN the checkbox becomes checked and Reduced_Motion is not active, THE ExorcismActionRow SHALL fill the round checkbox with `--accent-candle` within 700ms, and WHILE Reduced_Motion is active the checkbox SHALL change state with an opacity fade of at most 150ms.
7. WHILE the ExorcismActionRow is disabled, THE ExorcismActionRow SHALL ignore activation and set the native `disabled` attribute or `aria-disabled="true"`.
8. THE ExorcismActionRow SHALL provide a Touch_Target of at least 44px by 44px for the checkbox.
9. THE ExorcismActionRow SHALL be a presentational Primitive and SHALL NOT import from `src/lib/db/`, `src/lib/exorcism/`, or `src/hooks/`.
10. WHERE the optional droplet burst is implemented, THE ExorcismActionRow SHALL play a burst of 3 droplets within the same 700ms when the checkbox becomes checked and Reduced_Motion is not active, SHALL hide the droplets from assistive technology, and SHALL render no droplets WHILE Reduced_Motion is active.
11. THE ExorcismActionRow SHALL satisfy criteria 1 to 9 whether or not the optional droplet burst is implemented.

### Requirement 18: Reduced Motion

**User Story:** As a user who prefers reduced motion, I want chrome animations disabled or collapsed to short fades, so that the interface remains comfortable.

#### Acceptance Criteria

1. WHILE Reduced_Motion is active, THE Primitive SHALL apply no scale, translate, rotate, shake, or count-up animation.
2. WHILE Reduced_Motion is active, THE Primitive SHALL limit every opacity transition to a duration of at most 150ms.
3. THE Primitive SHALL read the Reduced_Motion preference through Framer Motion's `useReducedMotion()` hook.
4. THE Primitive SHALL provide the same information and the same interactive behavior in both the Reduced_Motion and standard motion modes.
5. THE Test_Suite SHALL include, for each Primitive that animates, at least one test that mocks Reduced_Motion as active and asserts that no transform animation is applied.

### Requirement 19: Styleguide Route

**User Story:** As a designer and developer, I want a single page that shows every Primitive in every variant and state on the real dark background, so that I can review the UI visually and record the demo video.

#### Acceptance Criteria

1. THE Design_System_Foundation SHALL provide the route `/styleguide` at `src/app/styleguide/page.tsx` as a server component that contains no state, no event handlers, and no `"use client"` directive.
2. THE Styleguide_Page SHALL export `metadata` with `robots` set to `{ index: false, follow: false }` and SHALL render Styleguide_Content as its only content.
3. THE Design_System_Foundation SHALL provide Styleguide_Content as a named export of the client component at `src/components/styleguide/StyleguideContent.tsx`, declared with `"use client"`.
4. THE Styleguide_Content SHALL render on the real `--surface-void` application background.
5. THE Styleguide_Content SHALL render one section per Primitive, in this order: Button, QuickAction, BalanceHero, Card, ListRow, Chip, SegmentedControl, Input, BottomSheet, Toast (including ToastRegion usage through `useToast`), LightScoreBar, ExorcismActionRow, and WHEN a Primitive is not yet implemented under Requirement 26, THE Styleguide_Content SHALL omit its section until that Primitive is added.
6. THE Styleguide_Content SHALL render a section for Tokens that shows every Surface_Token, Text_Token, and Accent_Token as a labelled swatch with its name and hex value, the type scale with its token names, the radius Tokens, and the four font families.
7. THE Styleguide_Content SHALL render, for the Button, every combination of the 4 variants and 3 sizes, plus the disabled and loading states of each variant, and the `success` morph.
8. THE Styleguide_Content SHALL render, for every other Primitive, each variant and each Interactive_State the Primitive supports (default, pressed or selected, disabled, loading, error, and done where defined).
9. THE Styleguide_Content SHALL provide a trigger that opens the BottomSheet and a trigger that calls `useToast().show` for each Toast tone.
10. THE Styleguide_Content SHALL render the LightScoreBar at the scores 0, 19, 20, 39, 40, 59, 60, 79, 80, and 100, so that every decay-level boundary is visible.
11. THE Styleguide_Content SHALL render the ExorcismActionRow in both the open and the done states.
12. THE Styleguide_Content SHALL render the Money_Input in the default, filled, error, and disabled states.
13. THE Styleguide_Content SHALL render the BalanceHero in the `currency` format and in the `score` format, with deltas for the combinations `direction="down"` with `intent="good"`, `direction="up"` with `intent="bad"`, and `direction="up"` with `intent="good"`.
14. THE Styleguide_Content SHALL render a label next to each showcase item that names the variant and state.
15. THE Styleguide_Content SHALL render using only Primitives and Tokens, and SHALL NOT import from `src/lib/db/`, `src/hooks/`, `src/components/house/`, or `src/components/moments/`.
16. THE Styleguide_Content SHALL use sentence case for all headings and labels and SHALL follow the Voice and microcopy rules in the Design_System.
17. WHEN the Styleguide_Content is rendered at a 375px viewport width, THE Styleguide_Content SHALL NOT produce horizontal page scroll.
18. WHEN the Styleguide_Content is rendered at 1024px or wider, THE Styleguide_Content SHALL lay out its showcase cards in a 2-column grid, and below 1024px in a single centered column with a maximum width of 560px.

### Requirement 20: Color Contrast

**User Story:** As a user with low vision, I want text and controls to meet WCAG AA contrast, so that every piece of content is readable.

#### Acceptance Criteria

1. THE Design_System_Foundation SHALL render every Text_Token on every Surface_Token it is paired with so that the Contrast_Ratio is at least 4.5:1, except `--text-tertiary` on `--surface-overlay`, which SHALL NOT be used.
2. THE Design_System_Foundation SHALL render `--border-control` against `--surface-void`, `--surface-card`, and `--surface-raised` at a Contrast_Ratio of at least 3:1.
3. THE Design_System_Foundation SHALL render the Focus_Ring against every Surface_Token at a Contrast_Ratio of at least 3:1.
4. THE Design_System_Foundation SHALL render each Accent_Token as text or icon on `--surface-card` at a Contrast_Ratio of at least 4.5:1.
5. THE Design_System_Foundation SHALL render `--surface-void` text on the `primary` Button background (`--text-primary`) and on the `danger` Button background (`--accent-blood`) at a Contrast_Ratio of at least 4.5:1.
6. THE Test_Suite SHALL include a contrast test that parses the color Tokens from the Token_Sheet, computes the Contrast_Ratio for every foreground and background pair listed in criteria 1 to 5, and fails when any pair is below its threshold.
7. THE contrast test SHALL verify that the computed ratios match the values published in the Design_System tables to within 0.1.
8. FOR ALL colors in the Token_Sheet, THE contrast function SHALL return a ratio in [1, 21] and SHALL return the same ratio when the foreground and the background are swapped (symmetry property).
9. THE Chip, Toast, ListRow, and ExorcismActionRow SHALL render every status or meaning with an icon, a sign, or a text label in addition to color.

### Requirement 21: Keyboard Navigation and Accessible Names

**User Story:** As a keyboard and screen-reader user, I want every interactive Primitive to be operable from the keyboard and to announce a meaningful name, so that I can use the interface without a pointer.

#### Acceptance Criteria

1. THE Primitive SHALL expose an accessible name for every interactive element through a visible label, `aria-label`, or `aria-labelledby`.
2. WHEN the user presses Tab, THE Design_System_Foundation SHALL move focus through interactive Primitives in DOM order, and SHALL skip disabled Primitives.
3. WHEN the user presses Enter or Space on a focused Button, QuickAction, or interactive ListRow, THE Primitive SHALL call its activation handler once.
4. THE Design_System_Foundation SHALL render no `tabindex` value greater than 0.
5. THE Design_System_Foundation SHALL render the Focus_Ring at least 2px wide with a 2px offset and SHALL keep it visible on every Surface_Token.
6. IF a Primitive that requires an accessible name is rendered without one, THEN THE Primitive SHALL fail type-checking through its prop types.
7. THE Styleguide_Content SHALL render a single `<main>` landmark, a single `<h1>`, and heading levels that do not skip a level.
8. THE Test_Suite SHALL run its Tab-order and keyboard-navigation tests against Styleguide_Content rendered inside a ToastRegion, and SHALL NOT render the Styleguide_Page for those tests.

### Requirement 22: Component Tests

**User Story:** As a maintainer, I want component tests for keyboard and aria behavior, so that accessibility regressions are caught automatically.

#### Acceptance Criteria

1. THE Test_Suite SHALL run Primitive tests under the `jsdom` environment, configured per file or per glob so that the existing `tests/haunting/` tests continue to run under the `node` environment.
2. THE Test_Suite SHALL place component tests under `tests/ui/`, with one test file per Primitive named `<Primitive>.test.tsx`.
3. THE Test_Suite SHALL load `@testing-library/jest-dom` matchers through a Vitest setup file.
4. THE Test_Suite SHALL cover, for every Primitive, role and accessible name, each variant prop reflected in the rendered output, and the disabled behavior where the Primitive supports it.
5. THE Test_Suite SHALL cover keyboard behavior with `@testing-library/user-event`: Enter and Space on Button and QuickAction; arrow keys, Home, End, and wrap-around on SegmentedControl; Space on ExorcismActionRow; Escape, Tab trap, and focus return on BottomSheet.
6. THE Test_Suite SHALL cover aria state: `aria-busy` on a loading Button, `aria-invalid` and `aria-describedby` on an Input with an error, `aria-checked` on SegmentedControl and ExorcismActionRow, `role="meter"` attributes on LightScoreBar, `role="status"` or `role="alert"` on the matching ToastRegion live region, the presence of both live regions before any Toast is shown, and the error thrown by `useToast` outside a ToastRegion.
7. THE Test_Suite SHALL include fast-check properties, tagged `// Feature: design-system-foundation, Property N: <property text>` and run for at least 100 iterations each, for: the Money_Input sanitizer (Requirement 13 criterion 12), the LightScoreBar clamp and fill monotonicity (Requirement 16 criteria 5 and 6), the BalanceHero rounding in the `currency` format and the floor-to-integer text without a decimal point in the `score` format (Requirement 8 criteria 12 and 13), and the contrast function symmetry and bounds (Requirement 20 criterion 8).
8. THE Test_Suite SHALL NOT use snapshot tests.
9. THE Test_Suite description strings SHALL be plain English sentences, per `conventions.md`.
10. THE `npm test` command SHALL run the Primitive tests together with the existing haunting-engine tests and pass.
11. THE Test_Suite SHALL fail when a Primitive imports GSAP, `src/lib/db/`, or `src/hooks/`, through a source-scan test of `src/components/ui/`.

### Requirement 23: Automated Axe Check on the Styleguide

**User Story:** As a maintainer, I want an automated axe run on the styleguide content, so that structural accessibility violations are detected before they reach users.

#### Acceptance Criteria

1. THE Test_Suite SHALL render Styleguide_Content (not the Styleguide_Page) inside a ToastRegion in jsdom and run axe against the rendered document with the WCAG 2.0 A, WCAG 2.0 AA, WCAG 2.1 A, WCAG 2.1 AA, and best-practice rule sets enabled.
2. IF axe reports one or more violations, THEN THE Test_Suite SHALL fail and print the rule id, impact, and the selector of each violating node.
3. THE Axe_Check SHALL run with the BottomSheet closed and again with the BottomSheet open.
4. THE Axe_Check SHALL run against the Styleguide_Content with each Toast tone visible.
5. IF an axe rule cannot be evaluated in jsdom (for example `color-contrast`, which needs real layout), THEN THE Test_Suite SHALL list that rule as skipped in the test source with a comment naming the rule, and the contrast of the same pairs SHALL be covered by the contrast test in Requirement 20.
6. THE Axe_Check SHALL NOT disable any other rule, and SHALL NOT use blanket exclusions of Primitive selectors.
7. WHERE a Playwright or other real-browser setup is added to the project, THE Axe_Check SHOULD also run with `color-contrast` enabled; this setup is not required by this feature.
8. THE Test_Suite SHALL include a test that imports the Styleguide_Page module and asserts that its exported `metadata.robots` has `index` false and `follow` false, and a source-scan test that asserts `src/app/styleguide/page.tsx` contains no `"use client"` directive.

### Requirement 24: Documentation and Steering Updates

**User Story:** As a maintainer, I want steering files and docs to match the implementation, so that future specs start from accurate information.

#### Acceptance Criteria

1. THE Design_System_Foundation SHALL update `.kiro/steering/structure.md` to remove `tailwind.config.ts` from the directory layout, to add `postcss.config.mjs` (or the Tailwind v4 integration file the project actually uses), `src/app/styleguide/page.tsx` (thin server wrapper with the noindex metadata), `src/components/styleguide/StyleguideContent.tsx` (client component), `src/components/ui/Toast.tsx`, `src/components/ui/ToastRegion.tsx` (exports `ToastRegion` and `useToast`, mounted in `src/app/layout.tsx`), `tests/ui/`, and the Vitest setup file, and to note that Tailwind tokens are defined in `src/app/globals.css` with `@theme`.
2. THE Design_System_Foundation SHALL replace the "Tailwind config tokens" row of `.kiro/steering/conventions.md` with a note and a mapping table that documents the Color_Utility_Map, with one row per design-system CSS custom property and the columns CSS variable, `@theme` variable, and utility (for example `--text-primary`, `--color-ink`, `text-ink`; `--surface-card`, `--color-surface-card`, `bg-surface-card`; `--accent-ecto`, `--color-ecto`, `text-ecto`; `--focus-ring`, `--color-focus`, `ring-focus`), and that states that the CSS variable names from `design-system.md` are unchanged.
3. THE Design_System_Foundation SHALL add to `.kiro/steering/structure.md` the note that hooks exported by a Primitive file (`useToast` in `ToastRegion.tsx`) live beside that Primitive in `src/components/ui/`, and that `src/hooks/` is reserved for hooks that bridge Dexie and the haunting engine.
4. THE Design_System_Foundation SHALL update `.kiro/steering/tech.md` to state that Tailwind CSS v4 is configured in CSS and to list `jsdom` and an axe integration among the testing dependencies.
5. THE Design_System_Foundation SHALL document, in `README.md`, the `/styleguide` route and the commands to run the component tests.
6. WHEN a Token value changes in `design-system.md`, THE maintainer SHALL update the Token_Sheet in the same change; the contrast test and the Token value test SHALL fail if the values drift.
7. THE Test_Suite SHALL include a Token value test that parses the Token_Sheet and asserts every Token value listed in Requirements 1 and 2, and that every Color_Utility_Map entry in the Theme_Block references the matching design-system CSS custom property.
8. THE Design_System_Foundation SHALL document in `.kiro/steering/conventions.md` that a Primitive's `className` prop is for Layout_Properties only (margin, width, flex or grid placement, and positioning), that Visual_Properties (color, background, border, radius, padding, font size, and shadow) change only through Primitive props such as `variant`, `size`, and `tone`, and that the rule exists because Tailwind does not guarantee the winner between conflicting utility classes and `tailwind-merge` is not a permitted dependency.

### Requirement 25: Build and Quality Gates

**User Story:** As a maintainer, I want the foundation to build and lint cleanly, so that it can be merged without breaking the project.

#### Acceptance Criteria

1. WHEN `npm run typecheck` runs, THE Design_System_Foundation SHALL produce no TypeScript errors under `strict` mode.
2. WHEN `npm run lint` runs, THE Design_System_Foundation SHALL produce no ESLint errors.
3. WHEN `npm run build` runs, THE Design_System_Foundation SHALL complete successfully and include `/styleguide` in the build output.
4. WHEN `npm test` runs, THE Design_System_Foundation SHALL pass all Primitive tests, the contrast test, the Token value test, the source-scan tests, and the axe check.
5. THE Design_System_Foundation SHALL NOT modify `src/lib/haunting/`, `tests/haunting/`, or the haunting-engine spec.
6. THE Design_System_Foundation SHALL add no runtime dependency other than `framer-motion` and `lucide-react`.

### Requirement 26: Screen-Driven Build Order

**User Story:** As a developer, I want the Primitives built in the order the app screens need them, so that the earliest screens can be assembled first and the styleguide is reviewable after every increment.

#### Acceptance Criteria

1. THE Design_System_Foundation SHALL be implemented in this Build_Order: (1) Tokens in the Token_Sheet and the Font_Loader, (2) Button, (3) Card, (4) ListRow, (5) Chip, (6) Input including Money_Input, (7) Toast and ToastRegion, (8) BottomSheet, (9) LightScoreBar, (10) ExorcismActionRow, (11) QuickAction, (12) BalanceHero, (13) SegmentedControl.
2. WHEN a Primitive is added in the Build_Order, THE Design_System_Foundation SHALL add that Primitive's showcase section to Styleguide_Content in the same increment, covering the variants and states required by Requirement 19.
3. WHEN a Primitive is added in the Build_Order, THE Design_System_Foundation SHALL add that Primitive's tests under `tests/ui/` in the same increment.
4. WHEN a Primitive is added in the Build_Order, THE Design_System_Foundation SHALL leave `npm run typecheck`, `npm run lint`, and `npm test` passing.
5. WHEN the Toast and ToastRegion increment is added, THE Design_System_Foundation SHALL mount ToastRegion in `src/app/layout.tsx` in that same increment.
6. THE Design_System_Foundation SHALL place the Styleguide_Content sections in the order given in Requirement 19 criterion 5 regardless of the Build_Order.
7. WHEN the last increment in the Build_Order is complete, THE Styleguide_Content SHALL contain a section for every Primitive, and the Axe_Check and the Requirement 25 gates SHALL pass.
