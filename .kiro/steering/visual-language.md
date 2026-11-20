# CashCrypt — Visual Language (Scene)

This file covers the haunted house canvas and its creatures only. Color tokens, typography, spacing and component rules are defined in `design-system.md`; this file references those tokens and does not redefine them.

## Design Philosophy

The haunted aesthetic is **gothic-cozy**, not horror. The house should feel melancholy and atmospheric at its worst, warm and inviting at its best. The scene canvas sits inside a `--surface-void` backdrop. Every creature color maps to a design-system accent; raw hex values in this file are limited to scene-specific decay tints that have no chrome equivalent.

---

## Decay Spectrum

The five decay levels share a color language that derives from, but extends beyond, the chrome palette. These tints apply to SVG scene elements only — never to chrome surfaces, text or controls.

| Level | Name | Scene tint | Mood |
|---|---|---|---|
| 1 | Pristine | Warm cream `#F5EFC8` | Alive — `--accent-candle` glow in windows |
| 2 | Uneasy | Soft amber `#F0E0A0` | Slightly dim, yellow-tinted |
| 3 | Haunted | Deep amber `#C89040` | Flicker, cracks visible |
| 4 | Crumbling | Rust `#A05030` | Heavy decay, near-dark |
| 5 | Condemned | Near-black `#200810` | Barely lit; see level 5 atmosphere rules |

---

## Creature Colors

All creature colors map to design-system accent tokens. No new hex values are introduced for creatures.

| Creature | Token | Hex | Notes |
|---|---|---|---|
| Ghost | `--accent-ghost` | `#7AB0FF` | Use at 75% opacity base; glow at 20% opacity |
| Zombie | *(scene-only)* | `#4A6B3A` body / `#2E4A24` clothing | Desaturated green — no chrome equivalent; never bright |
| Poltergeist | `--accent-spirit` | `#B69CFF` | Base color; inner glow at 60% opacity |
| Exorcism flash | `--text-primary` | `#F7F7F8` | Brief white burst on completion |
| Window light (healthy) | `--accent-candle` | `#FFB547` | Interpolates with the light score within a level |
| Window light (exorcised) | `--accent-ecto` | `#3DDC97` | Brief flash when a crack seals |

---

## House Decay Levels

Each level affects the SVG house layers: walls, windows, roof, garden, and ambient lighting. Window light intensity interpolates continuously with the light score within a level, so every debt payment produces a perceptible brightening even without a level change.

The window fill is `--accent-candle` at full opacity (level 1) down to 0% (level 5), with intermediate values mapped linearly to the light score within each band. The percentages in the level list below are **nominal** (they describe the intended mood of each level); the real candlelight opacity is decided by the window opacity curve in `src/lib/scene/config.ts` (see the house-scene design), which keeps the curve non-decreasing within and across levels and makes a payment visible. The `LightScoreBar` in the chrome always shows the numeric score alongside the visual change.

### Level 1 — Pristine
- Walls: clean, warm cream (`#F5EFC8` tint).
- Windows: soft `--accent-candle` glow from inside; full brightness.
- Roof: intact, deep slate.
- Garden: green grass, one lit lantern.
- Atmosphere: subtle firefly particles drifting upward.
- Financial trigger: light score 80–100.

### Level 2 — Uneasy
- Walls: slightly yellowed, one hairline crack on the left facade.
- Windows: `--accent-candle` at a nominal ~70% brightness, slow flicker (4s cycle).
- Roof: a few shingles missing.
- Garden: grass slightly brown at edges, lantern dimmer.
- Atmosphere: faint fog at ground level.
- Financial trigger: light score 60–79.

### Level 3 — Haunted
- Walls: visible cracks on two sides, dark staining near the foundation.
- Windows: `--accent-candle` at a nominal ~40% brightness (amber tone), one window boarded up.
- Roof: sagging in one corner, moss growing.
- Garden: mostly dead grass, lantern unlit (silhouette only).
- Atmosphere: fog thicker, slow-moving shadow passes behind a window.
- Financial trigger: light score 40–59.

### Level 4 — Crumbling
- Walls: large cracks, one section of plaster missing revealing dark interior.
- Windows: `--accent-candle` at a nominal ~15% brightness, two boarded up, one broken.
- Roof: partial collapse on the right wing.
- Garden: bare earth, dead tree, broken fence.
- Atmosphere: heavy fog, bats circling overhead.
- Financial trigger: light score 20–39.

### Level 5 — Condemned
- Walls: structural collapse imminent — leaning walls, exposed beams.
- Windows: all boarded or broken; no candlelight remains.
- Roof: heavily collapsed, only the chimney stands.
- Garden: scorched earth, the dead tree is split and charred.
- Atmosphere: near-total darkness. If the Poltergeist is active, its `--accent-spirit` glow is the sole light source in the scene. If there is no Poltergeist, faint moonlight (`--text-tertiary` at 30% opacity) provides the only illumination.
- Financial trigger: light score 0–19.

---

## Creatures

### Ghosts (Small Expenses)

**Appearance**
- Simple ovoid SVG shape with two dark eye-spots.
- Fill: `--accent-ghost` (`#7AB0FF`) at 75% opacity.
- Glow: `--accent-ghost` at 20% opacity as a drop-shadow filter.
- Size: `32×40px` base; scales proportionally to the transaction amount (min 24px, max 56px).

**Movement**
- Float in a lazy figure-eight orbit around the house perimeter.
- Each ghost has a randomized phase offset (0–2π) so they don't clump.
- Vertical bob: sinusoidal, amplitude 6px, period 2.5–3.5s (randomized per ghost).
- On hover: ghost brightens to 100% opacity and shows the transaction amount in a chrome tooltip.

**Merge into Poltergeist**
- Threshold values (`SMALL_EXPENSE_THRESHOLD` and `POLTERGEIST_RATIO`) and 30-day rolling window logic are defined in `product.md` → Ghosts and owned by `src/lib/haunting/config.ts`. This file does not restate them.
- When the threshold is crossed: all individual ghosts animate toward the center of the scene over 800ms, then collapse into the Poltergeist with a `--text-primary` flash.
- Reverse (Poltergeist splits back to ghosts) plays when the 30-day total drops below the threshold.

### Zombies (Subscriptions)

**Appearance**
- Humanoid silhouette SVG, roughly `40×64px` base.
- Fill: desaturated green `#4A6B3A` body, `#2E4A24` clothing. These are scene-only values with no chrome equivalent.
- Size scales with monthly cost / monthly income ratio (min 32px tall, max 80px tall).
- Each zombie has a unique stagger so they don't all look identical (head tilt variation ±5°).
- Usage badge: a small icon overlaid on the zombie's chest indicates usage (`often` = flame, `rarely` = hourglass, `never` = skull). Communicates cancellation priority without relying on color alone.

**Movement**
- Stand in a row in the basement section of the house SVG.
- Idle: slow side-to-side sway, amplitude 3px, period 3–5s per zombie.
- On hover: zombie lurches forward (translateY −6px) and shows subscription name + cost in a chrome tooltip.

**Banishment (subscription canceled)**
- Handled by the ShovelMoment (see `design-system.md` → Moment catalog).
- After the moment completes, a tombstone trophy appears in `GraveyardRow`.

### Poltergeist Monster (Expense Pile-Up)

**Appearance**
- Large amorphous SVG shape, `120×120px`.
- Fill: `--accent-spirit` (`#B69CFF`) with an inner glow at 60% opacity.
- Outlined with jagged, irregular strokes to suggest merged ghost energy.
- Floats at the center-top of the house scene, partially overlapping the roof.

**Movement**
- Rotates slowly (full 360° over 8s).
- Pulses in scale: 1.0 → 1.08 → 1.0, period 1.5s.
- Emits small particle dots in `--accent-spirit` that drift outward and fade.

**Exorcism**
- Handled by the SigilMoment (see `design-system.md` → Moment catalog).

### Graveyard (Tombstone Trophies)

- After each zombie is banished, a tombstone SVG is added to `GraveyardRow` at the base of the basement.
- Tombstone shows the subscription name and "R.I.P. $X/mo" in `caption` / `--text-secondary`.
- Trophies persist across sessions (stored in Dexie alongside the canceled subscription record).
- An empty graveyard shows the empty-state copy: "No tombstones yet. Suspiciously quiet."

---

## Scene Animation Rules

The scene is animated exclusively with GSAP (see `design-system.md` → Implementation ownership). These rules apply to all scene animations; chrome animation rules are in `design-system.md` → Motion.

### Principles
1. **Smooth**: use GSAP `power2.inOut` or `elastic` for organic motion. Avoid `linear` on living creatures.
2. **Performant**: animate only `transform` and `opacity` on SVG elements. Never drive layout properties.
3. **Purposeful**: every animation communicates a financial state change. No decorative motion without a mapped event.
4. **Layered**: background atmosphere (fog, fireflies) runs as continuous GSAP ticker loops. Creature idle animations loop via GSAP `repeat: -1`. Moments are one-shot timelines.

### Timing Reference

| Event | Duration | GSAP ease |
|---|---|---|
| Ghost spawn | 300ms | `power2.out` |
| Ghost merge to Poltergeist | 800ms | `power2.inOut` |
| Zombie banishment (ShovelMoment) | 1400ms | see moment catalog |
| Exorcism flash | 400ms | `power2.out` |
| Decay level transition | 1200ms | `power2.inOut` |
| House light flicker | 200ms per flicker | `none` |
| Poltergeist pulse | 1500ms loop | `power2.inOut` |
| Window brightness interpolation | 600ms | `power2.out` |

### `prefers-reduced-motion`

- Check `window.matchMedia('(prefers-reduced-motion: reduce)')` before creating any GSAP timeline.
- When reduced motion is active:
  - Skip all continuous loops (sway, orbit, pulse, flicker, atmospheric particles).
  - Replace transition timelines with an instant `gsap.set()` to the end state plus a 150ms opacity fade.
  - Decay level and creature state changes apply immediately with no morphing.
  - Atmospheric effects (fog, fireflies, bats) are hidden via `display: none` or `visibility: hidden`.
- The scene must remain **fully legible and all financial data accessible** with all motion disabled.

---

## Accessibility (Scene-Specific)

Scene accessibility requirements that layer on top of the chrome rules in `design-system.md`:

- **Deferred:** creatures as buttons, hover tooltips and the hover behavior described above are not built in this version. Creatures are non-interactive, the scene is one `role="img"`, and the financial detail lives in the chrome lists. The next rule applies once creatures become interactive.
- All interactive creatures (ghosts, zombies, Poltergeist) are `<button>` elements or carry `role="button"` with an `aria-label` that names the financial item and its amount.
- The house decay level is announced via a visually-hidden `<span aria-live="polite">` updated on every level change (e.g., "House is now Crumbling — light score 28").
- All GSAP animation containers carry `aria-hidden="true"`; the financial data they represent is in the chrome DOM independently.
- Focus ring on scene interactive elements: 2px `--focus-ring` (`#FFB547`) outline with 2px offset, visible against all decay-level backgrounds.
- Color is never the sole indicator of creature type or financial status: each creature has a distinct shape, and financial figures are always present as text in the chrome.
