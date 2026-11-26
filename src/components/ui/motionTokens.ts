// Motion constants for chrome primitives (Framer Motion).
// Durations mirror the CSS custom properties in `src/app/globals.css`;
// `tests/design-system/tokens.test.ts` asserts that both stay equal.

/** Press feedback duration, in seconds (CSS: 120ms). */
export const PRESS_DURATION_S = 0.12;

/** Tabs and chips transition duration, in seconds (CSS: 200ms). */
export const TAB_DURATION_S = 0.2;

/** Sheets and modals transition duration, in seconds (CSS: 280ms). */
export const SHEET_DURATION_S = 0.28;

/** Number count-up and count-down duration, in seconds (CSS: 600ms). */
export const COUNT_DURATION_S = 0.6;

/** Scale applied while a button or quick action is pressed. */
export const PRESS_SCALE = 0.97;

/** Ceiling for opacity fades under `prefers-reduced-motion`, in seconds (CSS: 150ms). */
export const REDUCED_FADE_MAX_S = 0.15;

/** Distance a toast rises while fading in, in pixels. */
export const TOAST_RISE_PX = 12;

/** Default time a toast stays visible, in milliseconds. */
export const TOAST_DEFAULT_DURATION_MS = 4000;

/** Time a toast with an action stays visible, in milliseconds. */
export const ACTION_TOAST_DURATION_MS = 6000;

/** Time a list row stays highlighted after an action, in milliseconds. */
export const ROW_HIGHLIGHT_MS = 4000;

/** Time to wait for a highlight target to appear before giving up, in milliseconds. */
export const HIGHLIGHT_WAIT_MS = 1500;

/** Time a pending highlight request stays valid, in milliseconds. */
export const HIGHLIGHT_PENDING_TTL_MS = 5000;

/** Time a banner stays highlighted, in milliseconds. */
export const BANNER_HIGHLIGHT_MS = 900;

/** Maximum rotation of the QuickAction icon wiggle, in degrees (plus and minus). */
export const WIGGLE_DEGREES = 6;

/** Duration of the QuickAction icon wiggle, in seconds. */
export const WIGGLE_DURATION_S = 0.2;

/** Horizontal offset of each Input error shake step, in pixels. */
export const SHAKE_PX = 4;

/** Number of back-and-forth steps in the Input error shake. */
export const SHAKE_COUNT = 3;

/** Total duration of the Input error shake, in seconds. */
export const SHAKE_DURATION_S = 0.24;

/** Time the Button label shows a check after success, in milliseconds. */
export const SUCCESS_MORPH_MS = 600;

/**
 * Class names that affect layout only (margin, width, grid placement, and so on).
 * Visual changes go through `variant`, `size` and `tone` props, never `className`.
 */
export type LayoutClassName = string;

/** Press-feedback props that can be spread onto a Framer Motion element. */
export type PressMotion = {
  whileTap?: { scale: number };
  transition?: { duration: number };
};

/** Returns the press-feedback props, or an empty object when motion is reduced. */
export function getPressMotion(reduced: boolean | null): PressMotion {
  if (reduced) {
    return {};
  }
  return {
    whileTap: { scale: PRESS_SCALE },
    transition: { duration: PRESS_DURATION_S },
  };
}
