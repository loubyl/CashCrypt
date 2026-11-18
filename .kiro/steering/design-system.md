---
inclusion: always
---

# CashCrypt — Design System ("Crypt UI")

Inspiration: modern consumer fintech in dark mode (Revolut-style). Bold numbers, pill buttons, big rounded cards, circular quick actions, almost no borders. Spooky comes from the scene and a few accent colors, never from decoration in the UI.

## Principle: two registers

| Register | Where | Feel |
|---|---|---|
| **Chrome** | Navigation, balances, lists, forms, sheets, the exorcism plan, every number | Clean, bold, friendly fintech. Black and white first; color only carries meaning. |
| **Scene** | The haunted house canvas and its creatures | Atmospheric and theatrical. Governed by `visual-language.md`. |

Money figures always live in the chrome, never only in the scene. This file is the source of truth for tokens, typography, spacing and components; `visual-language.md` must reference these tokens instead of redefining them.

---

## Color tokens

All ratios are measured WCAG contrast ratios.

### Surfaces (elevation by lightness, no borders on cards)

| Token | Hex | Usage |
|---|---|---|
| `--surface-void` | `#08080A` | App background, house canvas backdrop |
| `--surface-card` | `#151518` | Cards, list groups, bottom sheets |
| `--surface-raised` | `#1F1F23` | Secondary buttons, quick-action circles, pressed rows |
| `--surface-overlay` | `#2A2A2F` | Popovers, dropdowns, toasts, tooltips |

Cards have **no border**. Separation comes from the surface step and spacing. Rows inside a card are separated by spacing, or by a 1px `--divider` (`#232328`) inset from the left by the icon width.

### Text

| Token | Hex | void | card | raised | overlay | Usage |
|---|---|---|---|---|---|---|
| `--text-primary` | `#F7F7F8` | 18.7 | 17.0 | 15.3 | 13.3 | Headings, balances, body |
| `--text-secondary` | `#A1A1AA` | 7.8 | 7.1 | 6.4 | 5.6 | Labels, descriptions, row subtitles |
| `--text-tertiary` | `#8C8C96` | 6.0 | 5.5 | 4.9 | 4.3 | Timestamps, placeholders. Not on overlay; use secondary there |

### Controls

| Token | Hex | Usage |
|---|---|---|
| `--border-control` | `#6B6B75` | Input, select and checkbox boundaries. ≥3:1 on void, card and raised (WCAG 1.4.11) |
| `--focus-ring` | candle `#FFB547` | 2px ring with 2px offset on every focusable element. Exception: Input (see Input) |

### Primary action = white

The primary button is a **white pill with near-black text** (`#F7F7F8` on `#08080A`, 18.7:1). There is exactly one per screen. Color is never used just to make a button look important.

### Accents (meaning only)

| Token | Name | Hex | On card | Meaning |
|---|---|---|---|---|
| `--accent-candle` | Candlelight | `#FFB547` | 10.4 | **Brand accent.** Light returning, light score, focus ring, links, selected tab, highlights |
| `--accent-ecto` | Ectoplasm | `#3DDC97` | 10.3 | Money saved, debt down, exorcised, success |
| `--accent-blood` | Blood rose | `#FF6B78` | 6.6 | Debt up, overdue, destructive, errors |
| `--accent-ghost` | Ghost blue | `#7AB0FF` | 8.2 | Small expenses (ghosts), info |
| `--accent-spirit` | Spirit violet | `#B69CFF` | 8.0 | Poltergeist only, in charts and badges |

Semantic aliases: `--color-success` = ecto, `--color-warning` = candle, `--color-danger` = blood, `--color-info` = ghost.

Tinted backgrounds (badges, quick-action icon circles, banners): the accent at 14% alpha over the current surface, with the full accent color for the icon or text. On `--surface-card` each accent reaches at least 5.4:1 on its own tint (candle 7.85, ecto 7.82, blood 5.44, ghost 6.43, spirit 6.26).

### Content on accent fills: `--on-accent`

| Token | Value | Utility |
|---|---|---|
| `--on-accent` | `var(--surface-void)` | `text-on-accent` (theme alias `--color-on-accent`) |

**Rule:** any text or icon placed on a **solid** accent fill (candle, ecto, blood, ghost, spirit) uses `--on-accent`, never ink. Light ink on an accent fill fails WCAG (1.6–2.6:1). `--on-accent` on each fill:

| Fill | `--on-accent` on fill | Ink on fill (forbidden) |
|---|---|---|
| candle | 11.39 | 1.64 |
| ecto | 11.32 | 1.65 |
| blood | 7.27 | 2.57 |
| ghost | 9.03 | 2.07 |
| spirit | 8.76 | 2.13 |

This covers the destructive button (blood background, `text-on-accent`), the checked `ExorcismActionRow` checkbox (candle fill, check icon in `text-on-accent`), filled badges, and any future solid accent surface. Tinted (14%) backgrounds keep the full accent color for their content. `tests/design-system/contrast.test.ts` enforces both rules.

Rules:
- Black, white and grays do 90% of the work. Accents carry meaning, not branding.
- Accent color is never the only signal: always pair with an icon, sign (+/−) or label.
- No gradients in the chrome except the light-score bar.

### Data visualization

Ordered palette (all ≥3:1 on card): candle, ecto, ghost, spirit, blood, `#A1A1AA`. No gridlines by default; axis labels in `--text-tertiary`.

---

## Typography

| Role | Font | Notes |
|---|---|---|
| Display and balances | **Manrope** 700 / 800 | Big numbers, page titles, card titles. Geometric and bold like modern fintech |
| UI and body | **Inter** 400 / 500 / 600 | Everything else |
| Amounts in lists and tables | **Inter** with `tabular-nums` | Right-aligned so columns line up |
| CSV preview | **JetBrains Mono** | Only raw data previews |
| Wordmark | **Cinzel** 500 | Only the CashCrypt logo and the house nameplate in the scene |

Load all with `next/font/google`.

### Scale

| Token | Size / line-height | Font / weight | Tracking | Usage |
|---|---|---|---|---|
| `hero` | 48 / 52 | Manrope 800 | -0.03em | Light score, total balance (one per screen) |
| `display` | 32 / 38 | Manrope 700 | -0.02em | Page titles |
| `title` | 22 / 28 | Manrope 700 | -0.01em | Card and section titles, KPI values |
| `body-lg` | 16 / 24 | Inter 500 | 0 | List row titles, amounts in rows |
| `body` | 15 / 22 | Inter 400 | 0 | Default text |
| `label` | 13 / 18 | Inter 500 | 0 | Form labels, quick-action labels, tabs |
| `caption` | 12 / 16 | Inter 400 | 0 | Row subtitles, timestamps (never amounts) |

Cents render smaller than the integer part in `hero` (e.g. **$18,420**.50 with the cents at 60% size).
Minimum text 12px. Amounts are never smaller than 15px.

---

## Shape, spacing, elevation

- Spacing (4px base): 4, 8, 12, 16, 20, 24, 32, 40, 56.
- Page padding 24 desktop / 16 mobile. Card padding 20. Gap between cards 12.
- Radius: `pill` 999 (all buttons, chips, segmented controls), `lg` 24 (cards, sheets, house canvas), `md` 16 (inputs, inner panels), `circle` (icon avatars, quick actions).
- Layout: single centered column, max width 560px for the main dashboard (mobile-first, like a banking app), widening to a 2-column grid of cards on desktop ≥1024px.
- Elevation: surface steps only. Overlays add `0 12px 32px rgb(0 0 0 / 0.6)`.

---

## Motion (chrome only)

- Durations: 120ms (press), 200ms (tabs, chips), 280ms (sheets, modals; spring with low bounce).
- Press feedback: `scale(0.97)` on buttons and quick actions.
- Number changes (balances, light score) count up or down over 600ms with tabular digits.
- At rest, the chrome never floats, flickers or sways. Theatrical motion belongs to the scene and to "moments" (below).
- `prefers-reduced-motion`: no count-up, no scale, opacity fades ≤150ms.

---

## Micro-interactions and "moments" (the Halloween layer)

The chrome stays calm at rest. The Halloween comes out as **moments**: short, playful animations triggered by a real financial action. Each moment shows what just happened to your money, then gets out of the way.

### Rules for every moment

1. **Earned**: only fires after a real action (payment saved, subscription canceled, plan completed). Never on page load, scroll or hover.
2. **Short**: 600–1600ms total. The UI is usable again after 300ms; the moment finishes on top without blocking input.
3. **Truthful**: the money figure (e.g. "+$22.99/mo saved") is always shown as text in a toast or row, not only in the animation.
4. **Cartoon, never gore**: tools and creatures are cute-spooky (rounded shapes, big eyes). No blood, no realistic weapons, no screaming faces.
5. **Skippable and accessible**: click or Esc skips to the end state. With `prefers-reduced-motion`, play a 150ms fade to the end state and announce the result in the `aria-live` region.
6. **One at a time**: moments queue; never overlap two.
7. **Original art only**: no references to existing franchises (no proton packs, no famous ghost vacuums, no movie props).

### Moment catalog

| Trigger | Tool | Sequence | Duration |
|---|---|---|---|
| **Cancel subscription** (zombie) | Cartoon shovel | Shovel swoops in on an arc → "bonk" → zombie wobbles, sinks into the ground → a small tombstone rises with the subscription name and "R.I.P. $22.99/mo" → tombstone stays in the basement graveyard as a trophy | 1400ms |
| **Log a debt payment** | Candle | The "Save payment" pill ignites: a small flame flickers on its left edge for 300ms → a light orb flies from the button to the house along a curved path → one crack seals and a window warms up → light score counts up | 1200ms |
| **Complete an exorcism action** | Holy-water sprinkle | Round checkbox fills with candle color, three droplets burst out → the related creature in the scene reacts (ghost fades, zombie sinks) | 700ms |
| **Ghosts captured** (small-expense action done) | Spirit jar | Ghosts in that category spiral into a glass jar with a cork that pops shut → jar label shows "−$41.51/mo" | 1100ms |
| **Poltergeist exorcised** (small expenses back under threshold) | Sigil circle | A glowing circle draws itself under the monster (stroke draw) → monster shakes → splits into ghosts that fly outward and fade → brief warm flash on the scene | 1600ms |
| **Weekly plan completed** | Three candles | Three candles light one by one above the plan card → "Exorcism complete. The lights flicker back on." | 1200ms |
| **Decay level improves** | Dawn | Scene background warms by one step, fog thins, a bird or bat flies away | 1600ms |
| **Decay level worsens** | Creak | A single crack draws across the wall, a shutter swings once. No sound by default | 1000ms |

### Chrome micro-interactions (always subtle)

| Element | Interaction |
|---|---|
| Primary pill | Press: `scale(0.97)`. Success: label morphs to a check for 600ms |
| Quick-action circles | Press: icon wiggles ±6° once (200ms) |
| Toast "+$X saved" | Rises 12px and fades in like a small spirit; ecto icon |
| Light-score number | Counts to the new value over 600ms; candle glow pulses once behind it |
| Input error | Horizontal shake 3 × 4px (240ms) + blood-rose border + message. No drips |
| Loading skeletons | Slow fog shimmer (gradient sweep 1.6s) instead of a gray pulse |
| Empty states | One small static illustration (a sleepy bat, an empty basement) with one subtle idle loop, disabled with reduced motion |
| Delete confirmation | Coffin lid closes over the item (300ms) before it leaves the list |

### Sound (optional)

- Off by default; toggle in settings and in the header ("Sounds").
- Short original or CC0 sounds only (bonk, candle whoosh, cork pop, chime). ≤ 400ms each, volume ≤ 40%.
- Never required to understand anything.

### Implementation ownership

| Layer | Library | Owns |
|---|---|---|
| Chrome micro-interactions | **Motion (Framer Motion)** | Buttons, toasts, sheets, count-up, list enter/exit. State-driven, spring-based |
| Scene and moments | **GSAP** (core + MotionPathPlugin, DrawSVGPlugin, MorphSVGPlugin) | Multi-step timelines on the house SVG: shovel arc, light orb path, sigil drawing, ghost → Poltergeist morph |

- Never animate the same element with both libraries.
- GSAP code lives in `src/components/house/` and `src/components/moments/`, scoped with `useGSAP()` from `@gsap/react` and cleaned up automatically on unmount.
- Each moment is a function `playXMoment(target, options): Promise<void>` so the UI can await or skip it.
- No Three.js / WebGL: the house is SVG, and 3D would hurt load time, accessibility and the schedule.

---

## Components

All primitives live in `src/components/ui/`. Each has visible focus, pressed and disabled states.

- **Button** (pill): `primary` white/black, `secondary` raised surface/white text, `ghost` text only in candle, `danger` blood fill with `text-on-accent`. Heights 36 / 44 / 52. Min touch target 44px.
- **QuickAction**: 52px circle on raised surface with a 22px icon, label underneath (13/500). Row of 4 under the hero: Log payment, Add expense, Import CSV, Exorcise.
- **BalanceHero**: label (secondary), `hero` number, delta chip underneath (ecto "−$640 this month" with ↓ icon, or blood with ↑).
- **Card**: card surface, radius 24, padding 20, no border. Optional header: `title` + ghost "See all" link.
- **ListRow**: 40px circle icon avatar (tinted accent background), title (body-lg) + subtitle (caption, secondary), amount right-aligned (body-lg, tabular; sign and color for in/out). Row height 64.
- **Chip / Badge**: pill, 24px, tinted background, icon + text.
- **SegmentedControl**: pill track on raised, selected segment white with black text.
- **Input**: radius 16, 52px tall, card or raised fill + `--border-control` 1px, floating label. **Focus (exception to the offset ring):** one line, not two. On `:focus-visible` the field's border turns candle and a 2px candle outline sits on the border with no gap (offset -1px, covering the 1px border), so a single 2px candle line shows and the grey border never appears next to the ring. With an error the focused line stays blood, not candle. Other primitives keep the 2px ring with 2px offset. Money input: large Manrope number centered, currency prefix in secondary.
- **BottomSheet / Modal**: card surface, radius 24 top (sheet on mobile) or all corners (modal on desktop), drag handle on mobile, focus trap, Esc closes.
- **Toast**: overlay surface, pill, icon + one line ("+$11.99/mo saved").
- **LightScoreBar**: 10px pill track (raised), fill blood → candle → ecto by score, number always shown.
- **ExorcismActionRow**: ListRow with a round checkbox on the left; impact in ecto ("+$22.99/mo"); when done, title strikes through and the row dims to tertiary, and the checkbox fills with candle with its check icon in `text-on-accent`.

Icons: Lucide, 20px in rows, 22px in quick actions, stroke 2, inherit color.

---

## Voice and microcopy

- Numbers and instructions are plain and exact: "Cancel StreamMax — saves $22.99/mo".
- Spooky flavor only in titles, empty states and celebrations: "No zombies in the basement. Suspiciously quiet.", "Exorcism complete. The lights flicker back on."
- Never joke about the user's debt itself, and never use fear to pressure a decision.
- Sentence case everywhere except the wordmark.

---

## Do / Don't

- ✅ Black canvas, borderless rounded cards, white pill primary, big bold numbers.
- ✅ One primary action per screen; quick actions as circles.
- ✅ Color only when it means something (saved, debt, ghosts, light).
- ❌ Colored primary buttons, gradients on buttons, card borders.
- ❌ Gothic fonts outside the wordmark and house nameplate.
- ❌ Neon glows, blood drips, cobwebs or Halloween clip-art in the chrome.
- ❌ New hex values in components: always use tokens.
- ❌ Ink (`text-ink*`) on a solid accent fill: use `text-on-accent`.
