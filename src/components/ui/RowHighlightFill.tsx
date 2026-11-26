"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ROW_HIGHLIGHT_MS, TAB_DURATION_S } from "./motionTokens";

const MS_PER_S = 1000;
const HIGHLIGHT_S = ROW_HIGHLIGHT_MS / MS_PER_S;
const FADE_FRACTION = TAB_DURATION_S / HIGHLIGHT_S;
const FILL_OPACITY_KEYFRAMES = [0, 1, 1, 0];
const FILL_OPACITY_TIMES = [0, FADE_FRACTION, 1 - FADE_FRACTION, 1];

type RowHighlightFillProps = {
  /** True while the row is highlighted. */
  active: boolean;
};

/**
 * Candle-tint background that fades in and out behind a row. The parent row must be `relative isolate`.
 * Under reduced motion there is no animation: the fill is shown or hidden at once.
 */
export function RowHighlightFill({ active }: RowHighlightFillProps) {
  const reduced = useReducedMotion();
  const animation = reduced
    ? { animate: { opacity: active ? 1 : 0 }, transition: { duration: 0 } }
    : active
      ? {
          animate: { opacity: FILL_OPACITY_KEYFRAMES },
          transition: { duration: HIGHLIGHT_S, times: FILL_OPACITY_TIMES, ease: "linear" as const },
        }
      : { animate: { opacity: 0 }, transition: { duration: TAB_DURATION_S } };

  return (
    <motion.span
      aria-hidden="true"
      data-row-highlight-fill={active ? "on" : "off"}
      data-fade-s={reduced ? 0 : animation.transition.duration}
      className="pointer-events-none absolute inset-0 -z-10 rounded-md bg-candle-tint"
      initial={{ opacity: 0 }}
      animate={animation.animate}
      transition={animation.transition}
    />
  );
}
